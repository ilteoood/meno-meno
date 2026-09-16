import { load, type CheerioAPI } from 'cheerio';
import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import type {
  Commodity as CommodityType,
  GreenFlag,
  MeccanismoPrezzo,
  OffertaLuce,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';

const A2A_LUCE_URL = 'https://www.a2a.it/casa/offerte-luce-gas';
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

function parseEuroNumber(raw: string): number {
  if (raw.includes(',') && raw.includes('.')) {
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    const decimal = lastComma > lastDot ? ',' : '.';
    return Number(raw.replace(decimal === ',' ? /\./g : /,/g, '').replace(decimal, '.'));
  }
  return Number(raw.replace(',', '.'));
}

function parseEurPerKwh(text: string): number | null {
  const match = text.match(/(\d{1,5}(?:[.,]\d{1,6})?)\s*€\s*\/\s*kWh/i);
  if (!match) return null;
  const n = parseEuroNumber(match[1] ?? '');
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseEurPerYear(text: string): number | null {
  const match = text.match(/(\d{1,5})\s*€\s*\/\s*anno/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function slugFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return basename(u.pathname) || null;
  } catch {
    return null;
  }
}

function detectGreenFlag(cardText: string): GreenFlag {
  if (/100\s*%\s*green|100\s*%\s*rinnovabil|fonti\s+rinnovabili/i.test(cardText)) return 'A';
  return 'C';
}

interface CatalogEntry {
  codice_offerta: string;
  nome_commerciale: string;
  detailUrl: string;
  cardText: string;
}

function parseCatalog(html: string): readonly CatalogEntry[] {
  const $ = load(html);
  const entries: CatalogEntry[] = [];
  $('.card-offer.js-commodity-filter-luce').each((_, el) => {
    const $card = $(el);
    const nome = $card.find('.card-offer__titolo').first().text().trim();
    if (!nome) return;
    const href = $card.find('a.card-offer__cta').first().attr('href');
    if (!href) return;
    const slug = slugFromUrl(href);
    if (!slug) return;
    const detailUrl = href.split('#')[0] ?? href;
    const cardIdMatch = ($card.attr('class') ?? '').match(/js-card-id-(\d+)/);
    const cardId = cardIdMatch?.[1] ?? slug;
    const cardText = $card.text();
    entries.push({
      codice_offerta: `a2a-${cardId}`,
      nome_commerciale: nome,
      detailUrl,
      cardText,
    });
  });
  return entries;
}

interface DetailPrices {
  prezzo_effettivo_euro_kwh: number;
  quota_fissa_euro_anno: number;
  meccanismo_prezzo: MeccanismoPrezzo;
}

function parseDetail(html: string): DetailPrices | null {
  const $ = load(html);

  const $luce = $('#luce');
  if ($luce.length > 0) {
    const result = parseLuceSection($, $luce);
    if (result !== null) return result;
  }

  const $ppa = $('.attivazione-ppa__prices-wrapper');
  if ($ppa.length > 0) {
    const result = parsePpaSection($, $ppa);
    if (result !== null) return result;
  }

  return null;
}

function parseLuceSection($: CheerioAPI, $luce: any): DetailPrices | null {
  const offerIndex = $luce.find('.product-offer__offer-index').first().text();
  const isPUN = /PUN/i.test(offerIndex);

  let prezzo: number | null = null;
  if (isPUN) {
    const spreadText = $luce
      .find('.product-offer__price-wrapper--full .product-offer__price')
      .filter((_, el) => /€\s*\/\s*kWh/i.test($(el).text()))
      .first()
      .text();
    prezzo = parseEurPerKwh(spreadText);
  } else {
    const monoraria = $luce
      .find('.product-offer__price-wrapper.js-offer.js-offer--monohourly_prices .product-offer__price')
      .first()
      .text();
    prezzo = parseEurPerKwh(monoraria);
  }

  const quotaText = $luce
    .find('.product-offer__price')
    .filter((_, el) => {
      if ($(el).closest('s.product-offer__strike').length > 0) return false;
      return /€\s*\/\s*anno/i.test($(el).text());
    })
    .first()
    .text();
  const quota = parseEurPerYear(quotaText);

  if (prezzo === null || quota === null) return null;

  const meccanismo_prezzo: MeccanismoPrezzo = isPUN
    ? { tipo: 'PUN', spread_euro_kwh: prezzo }
    : { tipo: 'fisso' };

  return { prezzo_effettivo_euro_kwh: prezzo, quota_fissa_euro_anno: quota, meccanismo_prezzo };
}

function parsePpaSection($: CheerioAPI, $wrapper: any): DetailPrices | null {
  const rows = $wrapper.find('.attivazione-ppa__details-wrapper');
  let prezzo: number | null = null;
  let quota: number | null = null;

  rows.each((_, row) => {
    const $row = $(row);
    const kicker = $row.find('.attivazione-ppa__details-kicker').text().trim();
    const detail = $row.find('.attivazione-ppa__details').text();
    if (/^Prezzo\s+fisso$/i.test(kicker) && prezzo === null) {
      prezzo = parseEurPerKwh(detail);
    } else if (/^Corrispettivo\s+fisso$/i.test(kicker) && quota === null) {
      quota = parseEurPerYear(detail);
    }
  });

  if (prezzo === null || quota === null) return null;

  return { prezzo_effettivo_euro_kwh: prezzo, quota_fissa_euro_anno: quota, meccanismo_prezzo: { tipo: 'fisso' } };
}

function toOffertaLuce(
  entry: CatalogEntry,
  detail: DetailPrices,
  url: string,
  scrapedAt: string,
): OffertaLuce {
  return {
    commodity: 'luce' satisfies CommodityType,
    operatore_id: 'a2a',
    codice_offerta: entry.codice_offerta,
    nome_commerciale: entry.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_kwh: detail.prezzo_effettivo_euro_kwh,
    quota_fissa_euro_anno: detail.quota_fissa_euro_anno,
    meccanismo_prezzo: detail.meccanismo_prezzo,
    green_flag: detectGreenFlag(entry.cardText),
  };
}

async function fetchDetail(detailUrl: string, signal: AbortSignal): Promise<string> {
  return fetchHtml(detailUrl, signal);
}

function detailFixturePath(source: ScrapeSource, detailUrl: string): string | null {
  if (source.kind !== 'fixture') return null;
  const slug = slugFromUrl(detailUrl);
  if (!slug) return null;
  return resolve(dirname(source.path), 'details', `${slug}.html`);
}

async function fetchDetailHtml(
  source: ScrapeSource,
  entry: CatalogEntry,
  signal: AbortSignal,
): Promise<string> {
  const detailPath = detailFixturePath(source, entry.detailUrl);
  return detailPath !== null
    ? readFile(detailPath, 'utf8')
    : fetchDetail(entry.detailUrl, signal);
}

export class A2aLuceScraper implements Scraper {
  readonly operatoreId = 'a2a';
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

      const catalog = parseCatalog(catalogHtml);
      if (catalog.length === 0) {
        return {
          ok: false,
          source: this.source,
          scrapedAt,
          error: 'no luce offer cards found in catalog',
        };
      }

      const sourceUrl =
        this.source.kind === 'live' ? this.source.url : `file://${this.source.path}`;
      const detailResults = await Promise.allSettled(
        catalog.map((entry) => fetchDetailHtml(this.source, entry, signal)),
      );
      const offerte: OffertaLuce[] = [];
      catalog.forEach((entry, idx) => {
        const settled = detailResults[idx];
        if (settled === undefined || settled.status !== 'fulfilled') return;
        const detail = parseDetail(settled.value);
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
