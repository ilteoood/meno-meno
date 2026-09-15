import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type {
  Commodity as CommodityType,
  OffertaMobile,
  TecnologiaMobile,
  TipoSim,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';

const KENA_MOBILE_URL = 'https://www.kenamobile.it/offerte/';
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
  const match = text.match(/(\d{1,4})\s*[.,]\s*(\d{2})/);
  if (!match) return null;
  return Number(`${match[1]}.${match[2]}`);
}

function parseGb(text: string): number {
  if (/illimitat/i.test(text)) return -1;
  const match = text.match(/(\d{1,4})\s*(?:Giga|GB)/i);
  if (match) return Number(match[1]);
  return 0;
}

function tecnologiaFromCard($card: Cheerio<any>, cardText: string): TecnologiaMobile {
  if (/5G\+/i.test(cardText)) return '5G+';
  if ($card.find('.five_g').length > 0 || /5G/.test(cardText)) return '5G';
  return '4G';
}

function velocitaPerTecnologia(tech: TecnologiaMobile): number {
  if (tech === '5G+') return 2000;
  if (tech === '5G') return 1000;
  return 150;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
  const seen = new Set<string>();

  $('.kena-card-rd').each((_, el) => {
    const $el = $(el);
    const cardText = $el.text().replace(/\s+/g, ' ');

    if (/ogni\s+\d+\s+mesi/i.test(cardText)) return;

    const priceMatch = cardText.match(/(\d{1,4})\s*[.,]\s*(\d{2})\s*€\s*al\s*mese/i);
    if (!priceMatch) return;
    const prezzo = Number(`${priceMatch[1]}.${priceMatch[2]}`);

    const gbMatch = cardText.match(/(\d{1,4})\s*(?:Giga|GB)/i);
    if (!gbMatch) return;
    const gb = Number(gbMatch[1]);

    const hasIllimitati = /illimitat/i.test(cardText);
    const minuti = hasIllimitati ? -1 : -1;

    const nome = `Kena ${gb} Giga`;

    const tecnologia = tecnologiaFromCard($el, cardText);

    const slug = slugify(`${nome}-${prezzo}`);
    if (seen.has(slug)) return;
    seen.add(slug);

    cards.push({
      codice_offerta: slug,
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
    operatore_id: 'kena',
    codice_offerta: card.codice_offerta,
    nome_commerciale: card.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_mese: card.prezzo_effettivo_euro_mese,
    gb: card.gb,
    minuti: card.minuti,
    tipo_sim: 'entrambe' satisfies TipoSim,
    tecnologia: card.tecnologia,
    velocita_mbps: velocitaPerTecnologia(card.tecnologia),
  };
}

export class KenaMobileScraper implements Scraper {
  readonly operatoreId = 'kena';
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
