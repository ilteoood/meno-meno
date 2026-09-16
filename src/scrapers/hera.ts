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

const HERA_LUCE_URL = 'https://heracomm.gruppohera.it/casa/offerte-luce-gas';
const SCRAPER_TIMEOUT_MS = 30_000;

const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const OFFER_CARD_SELECTOR = '.card.pb-2';

function nowIso(): string {
  return new Date().toISOString();
}

async function fetchHtml(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': DESKTOP_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5',
      Referer: 'https://heracomm.gruppohera.it/',
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

function parseEuroNumber(raw: string): number | null {
  const cleaned = raw.replace(/\./g, '').replace(',', '.').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractKwhFromValueText(valueText: string): number | null {
  const matches = valueText.match(/(\d{1,5}(?:[.,]\d{1,6})?)\s*€\s*\/\s*kWh/g);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1] ?? '';
  const numMatch = last.match(/(\d{1,5}(?:[.,]\d{1,6})?)/);
  if (!numMatch) return null;
  return parseEuroNumber(numMatch[1] ?? '');
}

function extractQuotaFromValueText(valueText: string): number | null {
  const matches = valueText.match(/(\d{1,5}(?:[.,]\d{1,3})?)\s*€\s*\/?\s*(?:all['’]?\s*)?anno/gi);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1] ?? '';
  const numMatch = last.match(/(\d{1,5}(?:[.,]\d{1,3})?)/);
  if (!numMatch) return null;
  return parseEuroNumber(numMatch[1] ?? '');
}

function detectMeccanismoFromLabel(labelText: string): MeccanismoPrezzo {
  if (/PREZZO\s+VARIABILE/i.test(labelText)) {
    return { tipo: 'PUN', spread_euro_kwh: 0 };
  }
  return { tipo: 'fisso' };
}

function detectGreenFlag(articleText: string): GreenFlag {
  if (/garanzie d[’']origine|fonti rinnovabili|100\s*%\s*(green|rinnovabil)|energia sostenibile/i.test(articleText)) {
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
  const anchor = $el.find('a[href*="/offerte-luce-gas/"]').first();
  const href = anchor.attr('href');
  if (href) {
    try {
      return { href, detailUrl: new URL(href, sourceUrl).toString() };
    } catch {
      // fall through
    }
  }
  return { href: undefined, detailUrl: '' };
}

function parseCatalog(html: string, sourceUrl: string): readonly CatalogEntry[] {
  const $ = load(html);
  const entries: CatalogEntry[] = [];

  $(OFFER_CARD_SELECTOR).each((_, el) => {
    const $el = $(el);
    const nome = $el.find('h3.card-title').first().text().replace(/\s+/g, ' ').trim();
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

function parseLuceArticle($: CheerioAPI): DetailPrices | null {
  const luce = $('article.tariffa.tariffa-luce').first();
  if (luce.length === 0) return null;
  const articleText = luce.text();

  let prezzo: number | null = null;
  let quota: number | null = null;
  let meccanismo: MeccanismoPrezzo = { tipo: 'fisso' };

  luce.find('.price-module__card').each((_, card) => {
    const $card = $(card);
    const labelText = $card.find('.price-module__label').first().text();
    const valueText = $card.find('.price-module__value').first().text();
    if (prezzo === null) {
      const candidate = extractKwhFromValueText(valueText);
      if (candidate !== null) {
        prezzo = candidate;
        meccanismo = detectMeccanismoFromLabel(labelText);
        return;
      }
    }
    if (quota === null) {
      const candidate = extractQuotaFromValueText(valueText);
      if (candidate !== null) {
        quota = candidate;
      }
    }
  });

  if (prezzo === null || quota === null) return null;

  const meccanismo_prezzo: MeccanismoPrezzo =
    meccanismo.tipo === 'PUN'
      ? { tipo: 'PUN', spread_euro_kwh: prezzo }
      : { tipo: 'fisso' };

  return {
    prezzo_effettivo_euro_kwh: prezzo,
    quota_fissa_euro_anno: quota,
    meccanismo_prezzo,
    green_flag: detectGreenFlag(articleText),
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
    operatore_id: 'hera',
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

export class HeraLuceScraper implements Scraper {
  readonly operatoreId = 'hera';
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
        const detail = parseLuceArticle($);
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