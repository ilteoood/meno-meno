import { load } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type {
  Commodity as CommodityType,
  GreenFlag,
  MeccanismoPrezzo,
  OffertaLuce,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';
import { nowIso } from './_utils/clock.ts';
import { fetchHtml } from './_utils/fetch-html.ts';

const ENEL_LUCE_URL = 'https://www.enel.it/it-it/offerte-luce';
const SCRAPER_TIMEOUT_MS = 15_000;




interface JsonLdNode {
  '@type'?: string | readonly string[];
  '@graph'?: readonly JsonLdNode[];
  mainEntity?: JsonLdNode;
  itemListElement?: readonly JsonLdNode[];
  item?: JsonLdNode;
  name?: string;
  url?: string;
  category?: string;
  serviceType?: string;
  offers?: JsonLdNode;
  price?: number | string;
  priceSpecification?: readonly JsonLdNode[] | JsonLdNode;
  additionalProperty?: readonly JsonLdNode[] | JsonLdNode;
  unitText?: string;
}

function collectItemLists(node: JsonLdNode | undefined, acc: JsonLdNode[]): void {
  if (!node || typeof node !== 'object') return;
  if (node['@type'] === 'ItemList' && node.itemListElement) {
    acc.push(node);
  }
  if (Array.isArray(node['@graph'])) {
    for (const child of node['@graph']) collectItemLists(child, acc);
  }
  if (node.mainEntity) collectItemLists(node.mainEntity, acc);
}

function parseJsonLdScripts(html: string): JsonLdNode[] {
  const $ = load(html);
  const docs: JsonLdNode[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as JsonLdNode;
      docs.push(parsed);
    } catch {
      // ponytail: skip malformed JSON-LD blocks; remaining blocks may still yield data
    }
  });
  return docs;
}

function asArray<T>(v: T | readonly T[] | undefined): readonly T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function extractPricePerKwh(offers: JsonLdNode | undefined): number | null {
  if (!offers) return null;
  const specs = asArray(offers.priceSpecification);
  for (const spec of specs) {
    if (spec?.unitText === 'kWh' && typeof spec.price === 'number') return spec.price;
  }
  if (typeof offers.price === 'number') return offers.price;
  return null;
}

function extractQuotaPerYear(offers: JsonLdNode | undefined): number | null {
  if (!offers) return null;
  const specs = asArray(offers.priceSpecification);
  for (const spec of specs) {
    if (spec?.unitText === 'anno' && typeof spec.price === 'number') return spec.price;
  }
  return null;
}

function extractMeccanismo(service: JsonLdNode, offers: JsonLdNode | undefined): MeccanismoPrezzo {
  const tariffProps = asArray(service.additionalProperty).concat(asArray(offers?.additionalProperty));
  for (const prop of tariffProps) {
    const value = String(prop?.value ?? '').toLowerCase();
    if (/prezzo fisso|fisso/.test(value)) return { tipo: 'fisso' };
    if (/prezzo variabile|indicizzat|pun/.test(value)) return { tipo: 'PUN', spread_euro_kwh: 0 };
  }
  const category = String(service.category ?? '').toLowerCase();
  if (/prezzo fisso/.test(category)) return { tipo: 'fisso' };
  if (/prezzo variabile/.test(category)) return { tipo: 'PUN', spread_euro_kwh: 0 };
  return { tipo: 'fisso' };
}

function extractGreenFlag(service: JsonLdNode, offers: JsonLdNode | undefined): GreenFlag {
  const text = `${service.description ?? ''} ${service.name ?? ''} ${offers?.description ?? ''}`.toLowerCase();
  if (/100\s*%\s*(green|rinnovabil)|fonti rinnovabili|energia verde|garanzie d[’']origine/.test(text)) {
    return 'A';
  }
  return 'C';
}

function slugFromUrl(url: string | undefined, fallback: string): string {
  if (url) {
    const cleaned = url.split('?')[0]?.split('#')[0] ?? url;
    const segments = cleaned.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && last.length > 0) return last;
  }
  return fallback
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isLuceService(service: JsonLdNode): boolean {
  const serviceType = String(service.serviceType ?? '').toLowerCase();
  if (serviceType.includes('energia elettrica')) return true;
  if (serviceType.includes('luce')) return true;
  const category = String(service.category ?? '').toLowerCase();
  if (/prezzo (fisso|variabile)/.test(category)) return true;
  const offers = service.offers;
  if (offers && typeof offers.price === 'number') return true;
  return false;
}

interface ParsedCard {
  codice_offerta: string;
  nome_commerciale: string;
  prezzo_effettivo_euro_kwh: number;
  quota_fissa_euro_anno: number;
  meccanismo_prezzo: MeccanismoPrezzo;
  green_flag: GreenFlag;
  detailUrl: string;
}

function parseOfferCards(html: string): readonly ParsedCard[] {
  const docs = parseJsonLdScripts(html);
  const itemLists: JsonLdNode[] = [];
  for (const doc of docs) collectItemLists(doc, itemLists);

  const cards: ParsedCard[] = [];
  const seen = new Set<string>();

  for (const list of itemLists) {
    for (const li of list.itemListElement ?? []) {
      const service = li?.item ?? li;
      if (!service || service['@type'] !== 'Service') continue;
      if (!isLuceService(service)) continue;

      const nome = String(service.name ?? '').trim();
      if (!nome) continue;

      const prezzo = extractPricePerKwh(service.offers);
      const quota = extractQuotaPerYear(service.offers);
      if (prezzo === null || quota === null) continue;

      const slug = slugFromUrl(service.url, nome);
      if (seen.has(slug)) continue;
      seen.add(slug);

      cards.push({
        codice_offerta: slug,
        nome_commerciale: nome,
        prezzo_effettivo_euro_kwh: prezzo,
        quota_fissa_euro_anno: quota,
        meccanismo_prezzo: extractMeccanismo(service, service.offers),
        green_flag: extractGreenFlag(service, service.offers),
        detailUrl: String(service.url ?? ''),
      });
    }
  }

  return cards;
}

function toOffertaLuce(card: ParsedCard, url: string, scrapedAt: string): OffertaLuce {
  return {
    commodity: 'luce' satisfies CommodityType,
    operatore_id: 'enel',
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

export class EnelLuceScraper implements Scraper {
  readonly operatoreId = 'enel';
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
          error: 'no luce offer cards parsed from JSON-LD',
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
