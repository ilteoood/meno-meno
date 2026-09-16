import { load, type Cheerio } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type {
  Commodity as CommodityType,
  GreenFlag,
  MeccanismoPrezzo,
  OffertaLuce,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';

const ENGIE_LUCE_URL = 'https://www.engie.it/casa/offerte-luce-gas/';
const SCRAPER_TIMEOUT_MS = 15_000;

const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function nowIso(): string {
  return new Date().toISOString();
}

async function fetchHtml(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': DESKTOP_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5',
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugFromHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, ENGIE_LUCE_URL);
    const segments = url.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    if (segments.length === 0) return null;
    return slugify(segments[segments.length - 1] ?? '');
  } catch {
    return null;
  }
}

function parseNumericEuro(text: string): number | null {
  const match = text.match(/(\d{1,4}(?:[.,]\d{1,4})?)/);
  if (!match) return null;
  const raw = (match[1] ?? '').replace('.', '').replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseSpreadEur(text: string): number | null {
  const match = text.match(/PUN\s*\+\s*(\d+(?:[.,]\d+)?)/i);
  if (!match) return null;
  const raw = (match[1] ?? '').replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function fasciaText($fascia: Cheerio<any>): string {
  return $fascia.find('.originalPrice').first().text().trim();
}

function pickFasciaByLabelPrefix(
  $fasce: Cheerio<any>,
  prefix: string,
): string | null {
  for (let i = 0; i < $fasce.length; i++) {
    const label = $fasce.eq(i).find('.dettaglio-offerta__fascia-name').first().text().trim();
    if (label.startsWith(prefix)) return fasciaText($fasce.eq(i));
  }
  return null;
}

interface ParsedCard {
  codice_offerta: string;
  nome_commerciale: string;
  prezzo_effettivo_euro_kwh: number;
  quota_fissa_euro_anno: number;
  meccanismo_prezzo: MeccanismoPrezzo;
  green_flag: GreenFlag;
}

function detectGreenFlag(features: readonly string[]): GreenFlag {
  for (const f of features) {
    if (/100\s*%\s*rinnovabile|rinnovabile/i.test(f)) return 'A';
  }
  return 'C';
}

function parseOfferCards(html: string): readonly ParsedCard[] {
  const $ = load(html);
  const cards: ParsedCard[] = [];

  $('.card-offerte-esplosa').each((_, el) => {
    const $el = $(el);
    const nome = $el.find('.card-offerte-esplosa__heading h3').first().text().trim();
    if (!nome) return;

    const $luce = $el.find('.dettaglio-offerta[data-title="Luce"]');
    if ($luce.length === 0) return;

    const $fasce = $luce.find('.dettaglio-offerta__fascia');
    const quotaText = pickFasciaByLabelPrefix($fasce, 'Corrispettivo annuo');
    const f1Text = pickFasciaByLabelPrefix($fasce, 'Corrispettivo per il consumo F1');

    if (!quotaText || !f1Text) return;

    const quota = parseNumericEuro(quotaText);
    if (quota === null) return;

    let meccanismo: MeccanismoPrezzo;
    let prezzo: number;
    if (/PUN\s*\+/i.test(f1Text)) {
      const spread = parseSpreadEur(f1Text);
      meccanismo = { tipo: 'PUN', spread_euro_kwh: spread ?? 0 };
      prezzo = spread ?? 0;
    } else {
      const fixed = parseNumericEuro(f1Text);
      if (fixed === null) return;
      meccanismo = { tipo: 'fisso' };
      prezzo = fixed;
    }
    if (prezzo <= 0) return;

    const href = $el.find('a.btn-link.card-offerte-esplosa__cta').first().attr('href');
    const codice = slugFromHref(href) ?? slugify(nome);

    const features = $el
      .find('.card-offerte-esplosa__feature')
      .map((_, fEl) => $(fEl).text().trim())
      .get();

    cards.push({
      codice_offerta: codice,
      nome_commerciale: nome,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      meccanismo_prezzo: meccanismo,
      green_flag: detectGreenFlag(features),
    });
  });

  return cards;
}

function toOffertaLuce(
  card: ParsedCard,
  url: string,
  scrapedAt: string,
): OffertaLuce {
  return {
    commodity: 'luce' satisfies CommodityType,
    operatore_id: 'engie',
    codice_offerta: card.codice_offerta,
    nome_commerciale: card.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_kwh: card.prezzo_effettivo_euro_kwh,
    quota_fissa_euro_anno: card.quota_fissa_euro_anno,
    meccanismo_prezzo: card.meccanismo_prezzo,
    green_flag: card.green_flag,
  };
}

export class EngieLuceScraper implements Scraper {
  readonly operatoreId = 'engie';
  readonly commodity: CommodityType = 'luce';
  readonly source: ScrapeSource;

  constructor(source: ScrapeSource) {
    this.source = source;
  }

  async scrape(): Promise<ScrapeResult> {
    const scrapedAt = nowIso();
    try {
      const html =
        this.source.kind === 'fixture'
          ? await readFile(this.source.path, 'utf8')
          : await fetchHtml(this.source.url, AbortSignal.timeout(SCRAPER_TIMEOUT_MS));

      const cards = parseOfferCards(html);
      if (cards.length === 0) {
        return {
          ok: false,
          source: this.source,
          scrapedAt,
          error: 'no offer cards parsed from source',
        };
      }

      const url = this.source.kind === 'live' ? this.source.url : `file://${this.source.path}`;
      const offerte = cards.map((c) => toOffertaLuce(c, url, scrapedAt));
      return { ok: true, source: this.source, scrapedAt, offerte };
    } catch (err) {
      return {
        ok: false,
        source: this.source,
        scrapedAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
