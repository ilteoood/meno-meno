import { readFile } from 'node:fs/promises';
import type { Commodity as CommodityType, OffertaLuce } from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';

const NEN_LUCE_URL = 'https://nen.it/landing/migliore-offerta-luce';
const NEN_CATALOG_URL =
  'https://prod.api.nen.it/subscriptions/catalog?action=S&utility=EE%3BGA&channel=Web&target=Domestico';
const SCRAPER_TIMEOUT_MS = 15_000;

const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

interface RawBaseOffer {
  readonly offerCode?: unknown;
  readonly fixedPrice?: unknown;
  readonly pcv?: unknown;
}

interface RawOffer {
  readonly utility?: unknown;
  readonly priceType?: unknown;
  readonly commercialName?: unknown;
  readonly baseOffer?: RawBaseOffer;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
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
  return JSON.parse(await response.text());
}

function parseEuroNumber(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isLuceFixedOffer(raw: unknown): raw is RawOffer & { baseOffer: RawBaseOffer } {
  if (raw === null || typeof raw !== 'object') return false;
  const o = raw as RawOffer;
  if (o.utility !== 'EE' || o.priceType !== 'F') return false;
  if (o.baseOffer === undefined || o.baseOffer === null) return false;
  return true;
}

function toOffertaLuce(
  raw: RawOffer & { baseOffer: RawBaseOffer },
  url: string,
  scrapedAt: string,
): OffertaLuce | null {
  const { baseOffer, commercialName } = raw;
  if (typeof commercialName !== 'string' || commercialName.length === 0) return null;
  if (typeof baseOffer.offerCode !== 'string' || baseOffer.offerCode.length === 0) return null;
  const prezzo = parseEuroNumber(baseOffer.fixedPrice);
  const quota = parseEuroNumber(baseOffer.pcv);
  if (prezzo === null || quota === null) return null;
  return {
    commodity: 'luce' satisfies CommodityType,
    operatore_id: 'nen',
    codice_offerta: baseOffer.offerCode,
    nome_commerciale: `Luce | ${commercialName}`,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_kwh: prezzo,
    quota_fissa_euro_anno: quota,
    meccanismo_prezzo: { tipo: 'fisso' },
    green_flag: 'A',
  };
}

function parseCatalog(payload: unknown): readonly OffertaLuce[] {
  if (!Array.isArray(payload)) return [];
  const out: OffertaLuce[] = [];
  for (const item of payload) {
    if (isLuceFixedOffer(item)) {
      const offerta = toOffertaLuce(item, '', '');
      if (offerta !== null) out.push(offerta);
    }
  }
  return out;
}

export class NenLuceScraper implements Scraper {
  readonly operatoreId = 'nen';
  readonly commodity: CommodityType = 'luce';
  readonly source: ScrapeSource;

  constructor(source: ScrapeSource) {
    this.source = source;
  }

  async scrape(): Promise<ScrapeResult> {
    const scrapedAt = nowIso();
    try {
      const payload: unknown =
        this.source.kind === 'fixture'
          ? JSON.parse(await readFile(this.source.path, 'utf8'))
          : await fetchJson(NEN_CATALOG_URL, AbortSignal.timeout(SCRAPER_TIMEOUT_MS));

      const url = this.source.kind === 'live' ? this.source.url : `file://${this.source.path}`;
      const offerteRaw = parseCatalog(payload);
      const offerte = offerteRaw.map((o) => ({ ...o, url_sorgente: url, scraped_at: scrapedAt }));
      if (offerte.length === 0) {
        return {
          ok: false,
          source: this.source,
          scrapedAt,
          error: 'no luce fixed offers parsed from source',
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
