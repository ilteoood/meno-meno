import { load, type CheerioAPI } from 'cheerio';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  Commodity as CommodityType,
  GreenFlag,
  MeccanismoPrezzo,
  OffertaLuce,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';
import { nowIso } from './_utils/clock.ts';

const ACEA_LISTING_URL = 'https://www.aceaenergia.it/elenco-offerte';
const ACEA_JSON_URL = `${ACEA_LISTING_URL}/_jcr_content/article-par/lista_offerte.listaOfferte.json`;
const ACEA_FIXTURE_DETAIL = 'luce-detail.html';
const SCRAPER_TIMEOUT_MS = 15_000;

const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';


async function fetchText(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': DESKTOP_UA,
      Accept: 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5',
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

interface RawCodice {
  readonly nome: string;
  readonly label: string;
  readonly valore: string;
}

interface RawCanale {
  readonly label: string;
  readonly link?: string;
}

interface RawProduct {
  readonly name: string;
  readonly endDate: string;
  readonly durata: string;
  readonly id: string;
  readonly tipoUso: string;
  readonly isPlacet: boolean;
  readonly commodity: 'luce' | 'gas' | 'dual' | 'elettrico';
  readonly allegati: readonly { readonly tipo: string; readonly stato: string; readonly url: string }[];
  readonly codici: readonly RawCodice[];
  readonly canali: readonly RawCanale[];
  readonly priority: number;
}

interface RawListing {
  readonly domestico: { readonly fisse: { readonly products: readonly RawProduct[] }; readonly variabili: { readonly products: readonly RawProduct[] } };
  readonly altriusi: { readonly fisse: { readonly products: readonly RawProduct[] }; readonly variabili: { readonly products: readonly RawProduct[] } };
  readonly condominio: { readonly fisse: { readonly products: readonly RawProduct[] }; readonly variabili: { readonly products: readonly RawProduct[] } };
}

interface LuceEntry {
  readonly product: RawProduct;
  readonly isVariabile: boolean;
}

function isLuceProduct(p: RawProduct): boolean {
  if (p.commodity === 'elettrico') return true;
  if (p.commodity === 'dual') return p.codici.some((c) => c.nome.startsWith('E'));
  return false;
}

function luceMonorariaCodice(p: RawProduct): RawCodice | null {
  return p.codici.find((c) => c.nome === 'EFM1' || c.nome === 'EVM1')
    ?? p.codici.find((c) => c.nome.startsWith('E'))
    ?? null;
}

function productPageUrl(p: RawProduct): string | null {
  const direct = p.canali.find((c) => c.link && c.label === 'Web')?.link
    ?? p.canali.find((c) => c.link)?.link;
  if (!direct) return null;
  if (!/^\/offerte-(casa|business)\//.test(direct)) return null;
  return direct;
}

function listingEntries(listing: RawListing): readonly LuceEntry[] {
  const out: LuceEntry[] = [];
  for (const cat of ['domestico', 'altriusi', 'condominio'] as const) {
    const block = listing[cat];
    for (const product of block.fisse.products) {
      if (isLuceProduct(product)) out.push({ product, isVariabile: false });
    }
    for (const product of block.variabili.products) {
      if (isLuceProduct(product)) out.push({ product, isVariabile: true });
    }
  }
  return out;
}

interface ParsedDetailPrices {
  readonly prezzo_effettivo_euro_kwh: number;
  readonly quota_fissa_euro_anno: number;
}

function parseEurPerKwh(text: string): number | null {
  const match = text.match(/(\d{1,3}(?:[.,]\d{1,6})?)\s*€\s*\/\s*kWh/i);
  if (!match) return null;
  const raw = match[1] ?? '';
  const n = Number(raw.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseEurPerYear(text: string): number | null {
  const match = text.match(/(\d{1,5}(?:[.,]\d{1,2})?)\s*€\s*\/\s*anno/i);
  if (!match) return null;
  const raw = match[1] ?? '';
  const n = Number(raw.replace('.', '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDetailPrices(html: string): ParsedDetailPrices | null {
  const $ = load(html);
  const firstAnnuoText = $('.main')
    .map((_, el) => $(el).find('.price').first().text())
    .get()
    .find((t) => /€\s*\/\s*anno/i.test(t)) ?? '';
  const quota = parseEurPerYear(firstAnnuoText);
  if (quota === null) return null;

  const kwhBlocks = $('.price')
    .map((_, el) => $(el).text())
    .get()
    .filter((t) => /€\s*\/\s*kWh/i.test(t));
  if (kwhBlocks.length === 0) return null;
  const candidates = kwhBlocks.map(parseEurPerKwh).filter((n): n is number => n !== null);
  const prezzo = candidates[0];
  if (prezzo === undefined || prezzo <= 0) return null;
  return { prezzo_effettivo_euro_kwh: prezzo, quota_fissa_euro_anno: quota };
}

function buildMeccanismo(isVariabile: boolean, $: CheerioAPI): MeccanismoPrezzo {
  if (!isVariabile) return { tipo: 'fisso' };
  const firstKwhText = $('.price')
    .map((_, el) => $(el).text())
    .get()
    .find((t) => /€\s*\/\s*kWh/i.test(t)) ?? '';
  const spread = parseEurPerKwh(firstKwhText);
  return { tipo: 'PUN', spread_euro_kwh: spread ?? 0 };
}

function toOffertaLuce(
  product: RawProduct,
  codice: RawCodice,
  detail: ParsedDetailPrices,
  meccanismo: MeccanismoPrezzo,
  url: string,
  scrapedAt: string,
): OffertaLuce {
  const greenFlag: GreenFlag = product.isPlacet ? 'B' : 'C';
  return {
    commodity: 'luce' satisfies CommodityType,
    operatore_id: 'acea',
    codice_offerta: codice.valore,
    nome_commerciale: product.name.trim(),
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_kwh: detail.prezzo_effettivo_euro_kwh,
    quota_fissa_euro_anno: detail.quota_fissa_euro_anno,
    meccanismo_prezzo: meccanismo,
    green_flag: greenFlag,
  };
}

async function readDetailFixtureFor(jsonPath: string): Promise<string | null> {
  const sibling = join(dirname(jsonPath), ACEA_FIXTURE_DETAIL);
  try {
    return await readFile(sibling, 'utf8');
  } catch {
    return null;
  }
}

export class AceaLuceScraper implements Scraper {
  readonly operatoreId = 'acea';
  readonly commodity: CommodityType = 'luce';
  readonly source: ScrapeSource;

  constructor(source: ScrapeSource) {
    this.source = source;
  }

  async scrape(): Promise<ScrapeResult> {
    const scrapedAt = nowIso();
    try {
      const listing: RawListing =
        this.source.kind === 'fixture'
          ? JSON.parse(await readFile(this.source.path, 'utf8')) as RawListing
          : JSON.parse(await fetchText(ACEA_JSON_URL, AbortSignal.timeout(SCRAPER_TIMEOUT_MS))) as RawListing;

      const entries = listingEntries(listing).filter((entry) => {
        if (this.source.kind === 'fixture') return true;
        return productPageUrl(entry.product) !== null;
      });
      if (entries.length === 0) {
        return { ok: false, source: this.source, scrapedAt, error: 'no luce products with product page in source' };
      }

      let sharedFixtureHtml: string | null = null;
      if (this.source.kind === 'fixture') {
        sharedFixtureHtml = await readDetailFixtureFor(this.source.path);
        if (!sharedFixtureHtml) {
          return { ok: false, source: this.source, scrapedAt, error: `fixture detail not found: ${ACEA_FIXTURE_DETAIL}` };
        }
      }

      const detailUrls = entries.map((entry) => {
        const link = productPageUrl(entry.product);
        return link ? new URL(link, ACEA_LISTING_URL).toString() : null;
      });

      const detailHtmls: (string | null)[] = await Promise.all(
        entries.map(async (_, i) => {
          if (sharedFixtureHtml !== null) return sharedFixtureHtml;
          const target = detailUrls[i];
          if (target === null) return null;
          try {
            return await fetchText(target, AbortSignal.timeout(SCRAPER_TIMEOUT_MS));
          } catch {
            return null;
          }
        }),
      );

      const url = this.source.kind === 'live' ? this.source.url : `file://${this.source.path}`;
      const offerte: OffertaLuce[] = [];
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        const detailHtml = detailHtmls[i];
        if (!detailHtml) continue;
        const detail = parseDetailPrices(detailHtml);
        if (!detail) continue;
        const codice = luceMonorariaCodice(entry.product);
        if (!codice) continue;
        const meccanismo = buildMeccanismo(entry.isVariabile, load(detailHtml));
        offerte.push(toOffertaLuce(entry.product, codice, detail, meccanismo, url, scrapedAt));
      }

      if (offerte.length === 0) {
        return { ok: false, source: this.source, scrapedAt, error: 'no detail prices parsed' };
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