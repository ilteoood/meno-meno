import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import type {
  Commodity as CommodityType,
  GreenFlag,
  MeccanismoPrezzo,
  OffertaLuce,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';

const PLENITUDE_LUCE_URL = 'https://eniplenitude.com/offerta/casa/gas-e-luce/offerte-energia-elettrica';
const SCRAPER_TIMEOUT_MS = 30_000;

const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const OFFER_CARD_SELECTOR = '[data-pln-component="cart"]';

function nowIso(): string {
  return new Date().toISOString();
}

async function fetchHtml(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': DESKTOP_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5',
      Referer: 'https://eniplenitude.com/',
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

function parseEuroNumber(raw: string): number | null {
  const cleaned = raw.replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePricePerKwh(text: string): number | null {
  const chartMatch = text.match(/(\d{1,5},\d{1,6})\s*€\s*\/\s*kWh[\s\S]{0,150}?Prezzo effettivo/i);
  if (chartMatch) {
    const n = parseEuroNumber(chartMatch[1] ?? '');
    if (n !== null) return n;
  }
  const proseMatch = text.match(/pari a\s+(\d{1,5},\d{1,6})\s*€\s*\/\s*kWh/i);
  if (proseMatch) {
    const n = parseEuroNumber(proseMatch[1] ?? '');
    if (n !== null) return n;
  }
  return null;
}

function parseQuotaPerYear(text: string): number | null {
  const match = text.match(/Commercializzazione e Vendita[^<>]{0,80}?pari a\s+(\d{1,5})\s*€\s*\/\s*anno/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function detectMeccanismo(cardText: string): MeccanismoPrezzo {
  if (/Indice PUN|Corrispettivo luce Index|Luce - Indice PUN/i.test(cardText)) {
    return { tipo: 'PUN', spread_euro_kwh: 0 };
  }
  return { tipo: 'fisso' };
}

function detectGreenFlag(cardText: string): GreenFlag {
  if (/garanzie d[’']origine|fonti rinnovabili|100\s*%\s*(green|rinnovabil)/i.test(cardText)) {
    return 'A';
  }
  return 'C';
}

function slugFromHref(href: string | undefined, fallback: string): string {
  if (href) {
    try {
      const cleaned = href.split('?')[0]?.split('#')[0] ?? href;
      const segments = cleaned.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last && last.length > 0) return last;
    } catch {
      // fall through
    }
  }
  return fallback
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface CatalogEntry {
  codice_offerta: string;
  nome_commerciale: string;
  detailUrl: string;
}

function detailUrlFromCard($el: Cheerio<any>, sourceUrl: string): { href: string | undefined; detailUrl: string } {
  const ctaTarget = $el.find('#app-web-cart');
  for (const attr of ['data-cta-secondary', 'data-cta-primary'] as const) {
    const raw = ctaTarget.attr(attr);
    if (!raw) continue;
    const match = raw.match(/\((https?:\/\/[^)]+)\)/);
    if (match && match[1]) return { href: match[1], detailUrl: match[1] };
  }
  const anchor = $el.find('a[href*="/offerta/"]').first().attr('href');
  if (anchor) {
    const absolute = new URL(anchor, sourceUrl).toString();
    return { href: anchor, detailUrl: absolute };
  }
  return { href: undefined, detailUrl: '' };
}

function parseCatalog(html: string, sourceUrl: string): readonly CatalogEntry[] {
  const $ = load(html);
  const entries: CatalogEntry[] = [];

  $(OFFER_CARD_SELECTOR).each((_, el) => {
    const $el = $(el);
    const nome = $el.find('.cart-title.both-text-light').first().text().replace(/\s+/g, ' ').trim();
    if (!nome) return;
    const { href, detailUrl } = detailUrlFromCard($el, sourceUrl);
    if (!detailUrl) return;
    entries.push({
      codice_offerta: slugFromHref(href, nome),
      nome_commerciale: nome,
      detailUrl,
    });
  });

  return entries;
}

interface DetailPrices {
  prezzo_effettivo_euro_kwh: number;
  quota_fissa_euro_anno: number;
  meccanismo_prezzo: MeccanismoPrezzo;
  green_flag: GreenFlag;
}

function parseDetail($: CheerioAPI): DetailPrices | null {
  const text = $.text();
  const prezzo = parsePricePerKwh(text);
  const quota = parseQuotaPerYear(text);
  if (prezzo === null || quota === null) return null;
  const baseMeccanismo = detectMeccanismo(text);
  const meccanismo_prezzo: MeccanismoPrezzo =
    baseMeccanismo.tipo === 'PUN'
      ? { tipo: 'PUN', spread_euro_kwh: prezzo }
      : { tipo: 'fisso' };
  return {
    prezzo_effettivo_euro_kwh: prezzo,
    quota_fissa_euro_anno: quota,
    meccanismo_prezzo,
    green_flag: detectGreenFlag(text),
  };
}

function detailFixturePath(source: ScrapeSource, detailUrl: string): string | null {
  if (source.kind !== 'fixture') return null;
  let slug: string;
  try {
    slug = basename(new URL(detailUrl).pathname);
  } catch {
    return null;
  }
  if (!slug) return null;
  return resolve(dirname(source.path), 'details', `${slug}.html`);
}

async function fetchDetailHtml(
  source: ScrapeSource,
  detailUrl: string,
  signal: AbortSignal,
): Promise<string> {
  const fixturePath = detailFixturePath(source, detailUrl);
  return fixturePath !== null
    ? readFile(fixturePath, 'utf8')
    : fetchHtml(detailUrl, signal);
}

function toOffertaLuce(
  entry: CatalogEntry,
  detail: DetailPrices,
  url: string,
  scrapedAt: string,
): OffertaLuce {
  return {
    commodity: 'luce' satisfies CommodityType,
    operatore_id: 'plenitude',
    codice_offerta: entry.codice_offerta,
    nome_commerciale: entry.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_kwh: detail.prezzo_effettivo_euro_kwh,
    quota_fissa_euro_anno: detail.quota_fissa_euro_anno,
    meccanismo_prezzo: detail.meccanismo_prezzo,
    green_flag: detail.green_flag,
  };
}

export class PlenitudeLuceScraper implements Scraper {
  readonly operatoreId = 'plenitude';
  readonly commodity: CommodityType = 'luce';
  readonly source: ScrapeSource;

  constructor(source: ScrapeSource) {
    this.source = source;
  }

  async scrape(): Promise<ScrapeResult> {
    const scrapedAt = nowIso();
    try {
      const signal = AbortSignal.timeout(SCRAPER_TIMEOUT_MS);
      const catalogHtml =
        this.source.kind === 'fixture'
          ? await readFile(this.source.path, 'utf8')
          : await fetchHtml(this.source.url, signal);

      const sourceUrl =
        this.source.kind === 'live' ? this.source.url : `file://${this.source.path}`;
      const catalog = parseCatalog(catalogHtml, sourceUrl);
      if (catalog.length === 0) {
        return {
          ok: false,
          source: this.source,
          scrapedAt,
          error: 'no luce offer cards found in catalog',
        };
      }

      const detailResults = await Promise.allSettled(
        catalog.map((entry) => fetchDetailHtml(this.source, entry.detailUrl, signal)),
      );

      const offerte: OffertaLuce[] = [];
      catalog.forEach((entry, idx) => {
        const settled = detailResults[idx];
        if (settled === undefined || settled.status !== 'fulfilled') return;
        const $ = load(settled.value);
        const detail = parseDetail($);
        if (detail === null) return;
        offerte.push(toOffertaLuce(entry, detail, sourceUrl, scrapedAt));
      });

      if (offerte.length === 0) {
        return {
          ok: false,
          source: this.source,
          scrapedAt,
          error: 'no luce offer prices parsed from detail pages',
        };
      }

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
