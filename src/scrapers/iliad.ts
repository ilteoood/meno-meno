import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type {
  Commodity as CommodityType,
  OffertaFisso,
  OffertaMobile,
  TecnologiaFisso,
  TecnologiaMobile,
  TipoSim,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';

const ILIAD_MOBILE_URL = 'https://www.iliad.it/offerte-iliad-mobile.html';
const ILIAD_FISSO_URL = 'https://www.iliad.it/offerte-iliad-fibra.html';
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

function priceFromCents(cents: string): number | null {
  const n = Number(cents);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n) / 100;
}

function gbFromQty(qty: string | undefined): number {
  if (!qty) return 0;
  const match = qty.match(/(-?\d+(?:[.,]\d+)?)\s*(GB|MB|KB)/i);
  if (!match) return 0;
  const n = Number(match[1]!.replace(',', '.'));
  const unit = (match[2] || '').toUpperCase();
  if (!Number.isFinite(n)) return 0;
  if (unit === 'TB') return n * 1000;
  if (unit === 'GB') return n;
  if (unit === 'MB') return Math.max(0, n / 1000);
  if (unit === 'KB') return 0;
  return n;
}

function minutiFromQty(voiceQty: string | undefined, smsQty: string | undefined): number {
  if (voiceQty === '-1') return -1;
  const v = Number(voiceQty ?? 'NaN');
  if (!Number.isFinite(v)) return -1;
  return v;
}

function isTecnologia5G($card: Cheerio<any>): boolean {
  return $card.find('.notice.5g').length > 0;
}

function tecnologiaFromCard($card: Cheerio<any>): TecnologiaMobile {
  return isTecnologia5G($card) ? '5G' : '4G';
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugFromHref(href: string | undefined, fallback: string): string {
  if (href && !href.startsWith('javascript:')) {
    try {
      const url = new URL(href, ILIAD_MOBILE_URL);
      const cleaned = url.pathname.replace(/\/$/, '');
      const segments = cleaned.split('/').filter(Boolean);
      // Offer hrefs are /mobile/<slug> or /privati/mobile/<slug>; skip generic /supporto/<id>/
      if (segments.length >= 2 && !segments.includes('supporto')) {
        return slugify(segments[segments.length - 1]!.replace(/\.html$/, ''));
      }
    } catch {
      // fall through
    }
  }
  return slugify(fallback);
}

interface ParsedCard {
  codice_offerta: string;
  nome_commerciale: string;
  prezzo_effettivo_euro_mese: number;
  gb: number;
  minuti: number;
  tecnologia: TecnologiaMobile;
}

function parseOfferCards(html: string): readonly ParsedCard[] {
  const $ = load(html);
  const cards: ParsedCard[] = [];

  $('.commercial-offer-tile').each((_, el) => {
    const $el = $(el);
    const nome = $el.find('.offer-title').first().text().trim();
    if (!nome) return;

    const priceAttr = $el.find('i-packshot-price').attr('price');
    const prezzo = priceFromCents(priceAttr ?? '');
    if (prezzo === null) return;

    const dataQty = $el.find('i-packshot-data').attr('data-qty');
    const voiceQty = $el.find('i-packshot-data').attr('voice-qty');
    const smsQty = $el.find('i-packshot-data').attr('sms-qty');

    const gb = gbFromQty(dataQty);
    const minuti = minutiFromQty(voiceQty, smsQty);
    const tecnologia = tecnologiaFromCard($el);

    const href = $el.find('a[href]').first().attr('href');

    cards.push({
      codice_offerta: slugFromHref(href, nome),
      nome_commerciale: nome,
      prezzo_effettivo_euro_mese: prezzo,
      gb,
      minuti,
      tecnologia,
    });
  });

  return cards;
}

function toOffertaMobile(
  card: ParsedCard,
  url: string,
  scrapedAt: string,
): OffertaMobile {
  return {
    commodity: 'mobile' satisfies CommodityType,
    operatore_id: 'iliad',
    codice_offerta: card.codice_offerta,
    nome_commerciale: card.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_mese: card.prezzo_effettivo_euro_mese,
    gb: card.gb,
    minuti: card.minuti,
    tipo_sim: 'entrambe' satisfies TipoSim,
    tecnologia: card.tecnologia,
  };
}

export class IliadMobileScraper implements Scraper {
  readonly operatoreId = 'iliad';
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
      const offerte = cards.map((c) => toOffertaMobile(c, url, scrapedAt));
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

interface IliadFissoTracking {
  offer_id?: string;
  offer_variant?: string;
  price_eur?: string;
}

const ILIAD_FIBRA_OFFER_NAME = new Map<string, string>([['iliadbox', 'iliadbox']]);

function slugifyFisso(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseIliadFissoPriceEur(priceEur: string | undefined): number | null {
  if (!priceEur) return null;
  const value = Number(priceEur.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function parseIliadFissoVelocitaMbps(html: string): number {
  const $ = load(html);
  const bodyText = $('body').text();
  const download = bodyText.match(/fino a (\d+(?:[.,]\d+)?)\s*Gigabit\/s|download fino a (\d+(?:[.,]\d+)?)\s*G?bit\/s/i);
  if (download) {
    const raw = (download[1] ?? download[2] ?? '').replace(',', '.');
    return Math.round(Number(raw) * 1000);
  }
  const mbps = bodyText.match(/fino a (\d+(?:[.,]\d+)?)\s*Megabit\/s|Mbps/i);
  if (mbps && mbps[1]) return Math.round(Number(mbps[1].replace(',', '.')));
  return 0;
}

interface ParsedFissoCard {
  codice_offerta: string;
  nome_commerciale: string;
  prezzo_effettivo_euro_mese: number;
}

function parseFissoOfferCards(html: string): readonly ParsedFissoCard[] {
  const $ = load(html);
  const cards: ParsedFissoCard[] = [];
  const seen = new Set<string>();

  $('[data-cta-tracking]').each((_, el) => {
    const $el = $(el);
    const raw = $el.attr('data-cta-tracking');
    if (!raw) return;
    let decoded: string;
    try {
      decoded = raw.replace(/&quot;/g, '"').replace(/&#x7B;/g, '{').replace(/&#x7D;/g, '}');
    } catch {
      return;
    }
    let tracking: IliadFissoTracking;
    try {
      tracking = JSON.parse(decoded) as IliadFissoTracking;
    } catch {
      return;
    }
    if (!tracking.offer_id || !tracking.offer_id.startsWith('fibra')) return;
    if (seen.has(tracking.offer_id)) return;
    const prezzo = parseIliadFissoPriceEur(tracking.price_eur);
    if (prezzo === null) return;
    const variant = tracking.offer_variant ?? 'iliadbox';
    const nome = ILIAD_FIBRA_OFFER_NAME.get(variant) ?? variant;
    seen.add(tracking.offer_id);
    cards.push({
      codice_offerta: slugifyFisso(`${tracking.offer_id}-${variant}`),
      nome_commerciale: `${nome.charAt(0).toUpperCase()}${nome.slice(1)} Super`,
      prezzo_effettivo_euro_mese: prezzo,
    });
  });

  return cards;
}

function toOffertaFisso(
  card: ParsedFissoCard,
  velocita_mbps: number,
  url: string,
  scrapedAt: string,
): OffertaFisso {
  return {
    commodity: 'fisso' satisfies CommodityType,
    operatore_id: 'iliad',
    codice_offerta: card.codice_offerta,
    nome_commerciale: card.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_mese: card.prezzo_effettivo_euro_mese,
    tecnologia: 'FTTH' satisfies TecnologiaFisso,
    velocita_mbps,
    costo_attivazione_euro: 0,
  };
}

export class IliadFissoScraper implements Scraper {
  readonly operatoreId = 'iliad';
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

      const cards = parseFissoOfferCards(html);
      if (cards.length === 0) {
        return {
          ok: false,
          source: this.source,
          scrapedAt,
          error: 'no offer cards parsed from source',
        };
      }

      const url = this.source.kind === 'live' ? this.source.url : `file://${this.source.path}`;
      const velocitaMbpsPerCard = cards.map(() => parseIliadFissoVelocitaMbps(html));
      const offerte = cards.map((c, i) => toOffertaFisso(c, velocitaMbpsPerCard[i] ?? 0, url, scrapedAt));
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
