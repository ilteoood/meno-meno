import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type {
  Commodity as CommodityType,
  OffertaMobile,
  TecnologiaMobile,
  TipoSim,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';

const FASTWEB_MOBILE_URL = 'https://www.fastweb.it/adsl-fibra-ottica/offerta-mobile';
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

function parsePriceEur(text: string): number | null {
  const match = text.match(/(\d{1,4}(?:[.,]\d{2})?)/);
  if (!match) return null;
  return Number(match[1].replace(',', '.'));
}

function parseGb(text: string): number {
  if (/illimitat/i.test(text)) return -1;
  const parsed = parsePriceEur(text);
  return parsed ?? 0;
}

function parseMinuti(text: string): number {
  if (text.trim() === '') return -1;
  if (/illimitat/i.test(text)) return -1;
  const parsed = parsePriceEur(text);
  return parsed ?? -1;
}

function isTecnologia5G(cardText: string, $card: Cheerio<any>): boolean {
  return $card.find('.logo5g').length > 0 || /5G\+?\b/.test(cardText);
}

function tecnologiaFromCard($card: Cheerio<any>, cardText: string): TecnologiaMobile {
  if (isTecnologia5G(cardText, $card)) return '5G';
  return '4G';
}

function slugFromHref(href: string | undefined, pageUrl: string): string {
  if (!href) return pageUrl;
  const cleaned = href.split('?')[0].replace(/\/$/, '');
  const segments = cleaned.split('/').filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : cleaned;
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

  $('.item.offer_card').each((_, el) => {
    const $el = $(el);
    const $name = $el.find('.oname').first();
    $name.find('svg, .labelhdr').remove();
    const nome = $name.text().trim();
    const prezzoText = $el.find('.pricebox .price').first().text();
    const firstLiText = $el.find('ul li').first().text();
    const minutiText = $el.find('ul li .minill').first().text();
    const cardText = $el.text();
    const offerHref = $el.find('.pricebox a[href]').filter((_, a) => {
      const h = $(a).attr('href') ?? '';
      return !h.includes('/dettagli/');
    }).first().attr('href');

    if (!nome) return;
    const prezzo = parsePriceEur(prezzoText);
    if (prezzo === null) return;

    cards.push({
      codice_offerta: slugFromHref(offerHref, nome),
      nome_commerciale: nome,
      prezzo_effettivo_euro_mese: prezzo,
      gb: parseGb(firstLiText),
      minuti: parseMinuti(minutiText),
      tecnologia: tecnologiaFromCard($el, cardText),
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
    operatore_id: 'fastweb',
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

export class FastwebMobileScraper implements Scraper {
  readonly operatoreId = 'fastweb';
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
