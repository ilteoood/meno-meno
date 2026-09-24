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
import { nowIso } from './_utils/clock.ts';
import { fetchHtml } from './_utils/fetch-html.ts';
import { slugify, slugFromHref } from './_utils/slug.ts';

const ILLUMIA_LUCE_URL = 'https://www.illumia.it/casa/luce/';
const SCRAPER_TIMEOUT_MS = 30_000;


const CATALOG_CARD_SELECTOR = 'div.image-title-description-cta';
const LUCE_PATH_FRAGMENT = '/casa/luce/';
const PREZZO_COMPONENTE_LABEL = 'Prezzo Componente Energia';
const QUOTA_COMMERCIALIZZAZIONE_LABEL = 'Corrispettivo Commercializzazione e Vendita';



function parseEuroNumber(raw: string): number | null {
  const cleaned = raw.replace(/\./g, '').replace(',', '.').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}


interface CatalogEntry {
  codice_offerta: string;
  nome_commerciale: string;
  detailUrl: string;
}

function detailUrlFromCard($el: Cheerio<any>, sourceUrl: string): { href: string | undefined; detailUrl: string } {
  const anchor = $el.find('a[href]').first();
  const href = anchor.attr('href');
  if (!href) return { href: undefined, detailUrl: '' };
  if (!href.includes(LUCE_PATH_FRAGMENT)) return { href, detailUrl: '' };
  try {
    return { href, detailUrl: new URL(href, sourceUrl).toString() };
  } catch {
    return { href, detailUrl: '' };
  }
}

function parseCatalog(html: string, sourceUrl: string): readonly CatalogEntry[] {
  const $ = load(html);
  const entries: CatalogEntry[] = [];
  const seen = new Set<string>();

  $(CATALOG_CARD_SELECTOR).each((_, el) => {
    const $el = $(el);
    const nome = $el.find('.mcl-text-section h3.mcl-title').first().text().replace(/\s+/g, ' ').trim();
    if (!nome) return;
    const { href, detailUrl } = detailUrlFromCard($el, sourceUrl);
    if (!detailUrl) return;
    const slug = slugFromHref(href, nome);
    if (seen.has(slug)) return;
    seen.add(slug);
    entries.push({
      codice_offerta: slug,
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
}

function extractRowNumberByLabel($: CheerioAPI, label: string): number | null {
  let value: number | null = null;
  $('.mcl-row').each((_, row) => {
    if (value !== null) return;
    const $row = $(row);
    const labelText = $row.find('.mcl-left-section .mcl-title').first().text().trim();
    if (labelText !== label) return;
    const priceRaw = $row.find('.mcl-right-section .mcl-price').first().text().trim();
    const cleaned = priceRaw.replace(/^-\s*/, '');
    value = parseEuroNumber(cleaned);
  });
  return value;
}

function detectMeccanismo(priceRaw: string): MeccanismoPrezzo {
  const normalized = priceRaw.trim().toUpperCase();
  if (normalized.startsWith('PUN')) {
    const tail = normalized.replace(/^PUN\s*\+?\s*/, '').trim();
    const spread = tail === '' ? 0 : Number(tail.replace(',', '.'));
    return { tipo: 'PUN', spread_euro_kwh: Number.isFinite(spread) ? spread : 0 };
  }
  return { tipo: 'fisso' };
}

function detectGreenFlag(pageText: string): GreenFlag {
  if (/energia verde|garanzie d[’']origine|fonti rinnovabili|100\s*%\s*(green|rinnovabil)/i.test(pageText)) {
    return 'A';
  }
  return 'C';
}

function parseLuceDetail(html: string): DetailPrices | null {
  const $ = load(html);
  const priceRaw = $('.mcl-row').filter((_, row) => {
    return $(row).find('.mcl-left-section .mcl-title').first().text().trim() === PREZZO_COMPONENTE_LABEL;
  }).first().find('.mcl-right-section .mcl-price').first().text().trim();

  const quota = extractRowNumberByLabel($, QUOTA_COMMERCIALIZZAZIONE_LABEL);
  if (!priceRaw) return null;
  if (quota === null) return null;

  const meccanismo = detectMeccanismo(priceRaw);
  let prezzo_effettivo_euro_kwh: number;
  if (meccanismo.tipo === 'fisso') {
    const parsed = parseEuroNumber(priceRaw);
    if (parsed === null) return null;
    prezzo_effettivo_euro_kwh = parsed;
  } else if (meccanismo.spread_euro_kwh > 0) {
    prezzo_effettivo_euro_kwh = meccanismo.spread_euro_kwh;
  } else {
    return null;
  }

  return {
    prezzo_effettivo_euro_kwh,
    quota_fissa_euro_anno: quota,
    meccanismo_prezzo: meccanismo,
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
  green_flag: GreenFlag,
  url: string,
  scrapedAt: string,
): OffertaLuce {
  return {
    commodity: 'luce' satisfies CommodityType,
    operatore_id: 'illumia',
    codice_offerta: entry.codice_offerta,
    nome_commerciale: entry.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_kwh: detail.prezzo_effettivo_euro_kwh,
    quota_fissa_euro_anno: detail.quota_fissa_euro_anno,
    meccanismo_prezzo: detail.meccanismo_prezzo,
    green_flag,
  };
}

export class IllumiaLuceScraper implements Scraper {
  readonly operatoreId = 'illumia';
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
        const detail = parseLuceDetail(settled.value);
        if (detail === null) return;
        const green_flag = detectGreenFlag(settled.value);
        offerte.push(toOffertaLuce(entry, detail, green_flag, sourceUrl, scrapedAt));
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
