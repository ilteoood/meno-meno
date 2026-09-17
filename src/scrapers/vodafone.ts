import { load, type CheerioAPI } from 'cheerio';
import { readFile } from 'node:fs/promises';
import { launchBrowser } from '../browser/playwright.ts';
import type {
  Commodity as CommodityType,
  OffertaFisso,
  OffertaMobile,
  TecnologiaFisso,
  TecnologiaMobile,
  TipoSim,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';

const VODAFONE_MOBILE_URL = 'https://privati.vodafone.it/mobile/telefonia-mobile';
const VODAFONE_FISSO_URL = 'https://privati.vodafone.it/casa/fibra';
const SCRAPER_TIMEOUT_MS = 30_000;
const PAGE_SETTLE_TIMEOUT_MS = 8_000;

const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const OFFER_QUERY_KEY = 'hubmobileline-consumer-eshop-mobile-line-products-all';
const FISSO_OFFER_QUERY_KEY = 'hubfixedline-consumer-eshop-fixed-line-products-all';

function nowIso(): string {
  return new Date().toISOString();
}

async function fetchHtml(url: string, signal: AbortSignal): Promise<string> {
  const browser = await launchBrowser();
  const context = await browser.newContext({ userAgent: DESKTOP_UA, locale: 'it-IT' });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: SCRAPER_TIMEOUT_MS });
    await page.waitForTimeout(PAGE_SETTLE_TIMEOUT_MS);
    return await page.content();
  } finally {
    await context.close();
  }
}

function parsePriceEur(text: string): number | null {
  const match = text.match(/(\d{1,4})\s*[.,]\s*(\d{2})/);
  if (!match) return null;
  return Number(`${match[1]}.${match[2]}`);
}

function parseGb(label: string): number {
  if (/illimitat/i.test(label)) return -1;
  const match = label.match(/(\d{1,4})\s*(?:Giga|GB|GIGA)/i);
  if (match) return Number(match[1]);
  return 0;
}

function isTecnologia5G(label: string, category: string, cardText: string): boolean {
  return /5G/.test(`${label} ${category} ${cardText}`);
}

function tecnologiaFrom5G(has5G: boolean): TecnologiaMobile {
  return has5G ? '5G' : '4G';
}

interface RawOffer {
  slug?: string;
  label?: string;
  category?: string;
  price?: string;
}

interface ParsedOffer {
  codice_offerta: string;
  nome_commerciale: string;
  prezzo_effettivo_euro_mese: number;
  gb: number;
  tecnologia: TecnologiaMobile;
}

const SKIP_CATEGORIES = new Set([
  'OFFERTE ROAMING',
  'RAY-BAN META + SAMSUNG GALAXY S26',
  'VODAFONE SMARTPHONE EASY',
  'GIGA SPEED SPECIAL',
]);

function isMobileOffer(o: RawOffer): boolean {
  const slug = (o.slug || '').toLowerCase();
  if (!slug.startsWith('mobile-') && !slug.startsWith('under')) return false;
  const cat = (o.category || '').toUpperCase();
  if (SKIP_CATEGORIES.has(cat)) return false;
  if (!o.price) return false;
  const price = parsePriceEur(o.price);
  if (price === null || price <= 0) return false;
  if (!o.label) return false;
  return true;
}

function parseOffers(html: string): readonly ParsedOffer[] {
  const $ = load(html);
  const nextData = $('script#__NEXT_DATA__').html();
  if (!nextData) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(nextData);
  } catch {
    return [];
  }

  const queries = (parsed as { props?: { pageProps?: { dehydratedState?: { queries?: Array<{ queryKey?: unknown; state?: { data?: unknown } }> } } } })
    .props?.pageProps?.dehydratedState?.queries ?? [];

  const offerQuery = queries.find((q) => {
    const key = q.queryKey;
    if (typeof key === 'string') return key.includes(OFFER_QUERY_KEY);
    if (Array.isArray(key)) return key.some((k) => typeof k === 'string' && k.includes(OFFER_QUERY_KEY));
    return false;
  });
  const rawOffers = (offerQuery?.state?.data ?? {}) as Record<string, RawOffer>;

  const results: ParsedOffer[] = [];
  for (const o of Object.values(rawOffers)) {
    if (!isMobileOffer(o)) continue;
    const slug = o.slug!;
    const label = o.label!;
    const category = o.category ?? '';
    const price = parsePriceEur(o.price!)!;
    const gb = parseGb(label);
    const has5G = isTecnologia5G(label, category, '');
    const tecnologia = tecnologiaFrom5G(has5G);
    results.push({
      codice_offerta: slug,
      nome_commerciale: label,
      prezzo_effettivo_euro_mese: price,
      gb,
      tecnologia,
    });
  }
  return results;
}

function toOffertaMobile(
  card: ParsedOffer,
  url: string,
  scrapedAt: string,
): OffertaMobile {
  return {
    commodity: 'mobile' satisfies CommodityType,
    operatore_id: 'vodafone',
    codice_offerta: card.codice_offerta,
    nome_commerciale: card.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_mese: card.prezzo_effettivo_euro_mese,
    gb: card.gb,
    minuti: -1,
    tipo_sim: 'entrambe' satisfies TipoSim,
    tecnologia: card.tecnologia,
  };
}

export class VodafoneMobileScraper implements Scraper {
  readonly operatoreId = 'vodafone';
  readonly commodity: CommodityType = 'mobile';
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

      const offers = parseOffers(html);
      if (offers.length === 0) {
        return {
          ok: false,
          source: this.source,
          scrapedAt,
          error: 'no offer cards parsed from source',
        };
      }

      const url = this.source.kind === 'live' ? this.source.url : `file://${this.source.path}`;
      const offerte = offers.map((c) => toOffertaMobile(c, url, scrapedAt));
      return { ok: true, source: this.source, scrapedAt, offerte };
    } catch (err) {
      const message =
        err instanceof Error && /playwright|chromium|browser|executable/i.test(err.message)
          ? 'browser unavailable'
          : err instanceof Error
            ? err.message
            : String(err);
      return {
        ok: false,
        source: this.source,
        scrapedAt,
        error: message,
      };
    }
  }
}

interface RawFissoOffer {
  slug?: string;
  title?: string;
  category?: string;
  price?: string;
  isCvm?: boolean;
  isLockInProduct?: boolean;
}

interface ParsedFissoOffer {
  codice_offerta: string;
  nome_commerciale: string;
  prezzo_effettivo_euro_mese: number;
}

function isCanonicalFissoOffer(o: RawFissoOffer): boolean {
  const slug = o.slug;
  if (!slug) return false;
  if (!o.title) return false;
  if (!o.category) return false;
  if (o.isCvm || o.isLockInProduct) return false;
  if (/-cvm(-|$)/.test(slug)) return false;
  if (/-app(-|$)/.test(slug)) return false;
  if (/lockin|lock-in/.test(slug)) return false;
  if (/wifi-seconda-linea/.test(slug)) return false;
  if (/vodafoneclub/.test(slug)) return false;
  if (/^(card|energia|red-card)-/.test(slug)) return false;
  if (/casa-fwa/.test(slug)) return false;
  if (/family-plan/.test(slug)) return false;
  return true;
}

function parseFissoOffers(html: string): readonly ParsedFissoOffer[] {
  const $ = load(html);
  const nextData = $('script#__NEXT_DATA__').html();
  if (!nextData) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(nextData);
  } catch {
    return [];
  }

  const queries = (parsed as { props?: { pageProps?: { dehydratedState?: { queries?: Array<{ queryKey?: unknown; state?: { data?: unknown } }> } } } })
    .props?.pageProps?.dehydratedState?.queries ?? [];

  const offerQuery = queries.find((q) => {
    const key = q.queryKey;
    if (typeof key === 'string') return key.includes(FISSO_OFFER_QUERY_KEY);
    if (Array.isArray(key)) return key.some((k) => typeof k === 'string' && k.includes(FISSO_OFFER_QUERY_KEY));
    return false;
  });
  const rawOffers = (offerQuery?.state?.data ?? {}) as Record<string, RawFissoOffer>;

  const results: ParsedFissoOffer[] = [];
  const seenTitles = new Set<string>();
  for (const o of Object.values(rawOffers)) {
    if (!isCanonicalFissoOffer(o)) continue;
    const title = o.title!.trim();
    if (seenTitles.has(title)) continue;
    if (!o.price) continue;
    const price = parsePriceEur(o.price);
    if (price === null || price <= 0) continue;
    seenTitles.add(title);
    results.push({
      codice_offerta: o.slug!,
      nome_commerciale: title,
      prezzo_effettivo_euro_mese: price,
    });
  }
  return results;
}

function toOffertaFisso(
  card: ParsedFissoOffer,
  url: string,
  scrapedAt: string,
): OffertaFisso {
  return {
    commodity: 'fisso' satisfies CommodityType,
    operatore_id: 'vodafone',
    codice_offerta: card.codice_offerta,
    nome_commerciale: card.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_mese: card.prezzo_effettivo_euro_mese,
    tecnologia: 'FTTH' satisfies TecnologiaFisso,
    velocita_mbps: 0,
    costo_attivazione_euro: 0,
  };
}

export class VodafoneFissoScraper implements Scraper {
  readonly operatoreId = 'vodafone';
  readonly commodity: CommodityType = 'fisso';
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

      const offers = parseFissoOffers(html);
      if (offers.length === 0) {
        return {
          ok: false,
          source: this.source,
          scrapedAt,
          error: 'no offer cards parsed from source',
        };
      }

      const url = this.source.kind === 'live' ? this.source.url : `file://${this.source.path}`;
      const offerte = offers.map((c) => toOffertaFisso(c, url, scrapedAt));
      return { ok: true, source: this.source, scrapedAt, offerte };
    } catch (err) {
      const message =
        err instanceof Error && /playwright|chromium|browser|executable/i.test(err.message)
          ? 'browser unavailable'
          : err instanceof Error
            ? err.message
            : String(err);
      return {
        ok: false,
        source: this.source,
        scrapedAt,
        error: message,
      };
    }
  }
}
