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
import { nowIso } from './_utils/clock.ts';
import { fetchHtml } from './_utils/fetch-html.ts';
import { slugify, slugFromHref } from './_utils/slug.ts';

const TISCALI_MOBILE_URL = 'https://casa.tiscali.it/mobile/';
const TISCALI_FISSO_URL = 'https://casa.tiscali.it/';
const SCRAPER_TIMEOUT_MS = 15_000;




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

function tecnologiaFromCard(cardText: string): TecnologiaMobile {
  if (/5G/.test(cardText)) return '5G';
  return '4G';
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

  $('.miniCard').each((_, el) => {
    const $el = $(el);
    const cardText = $el.text().replace(/\s+/g, ' ');

    const priceMatch = cardText.match(/(\d{1,4})\s*[.,]\s*(\d{2})\s*€\s*al\s*mese/i);
    if (!priceMatch) return;
    const prezzo = Number(`${priceMatch[1]}.${priceMatch[2]}`);

    const gbMatch = cardText.match(/(\d{1,4})\s*(?:Giga|GB)/i);
    if (!gbMatch) return;
    const gb = Number(gbMatch[1]);

    const titleEl = $el.find('[class*="card_"], [class*="title"], h1, h2, h3, h4').first();
    const nome = titleEl.text().trim().replace(/\s+/g, ' ') || `Tiscali Mobile ${gb}`;
    if (!nome.toLowerCase().includes('mobile')) return;

    const hasIllimitati = /illimitat/i.test(cardText);
    const minuti = hasIllimitati ? -1 : -1;

    const tecnologia = tecnologiaFromCard(cardText);

    cards.push({
      codice_offerta: slugify(nome),
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
    operatore_id: 'tiscali',
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

export class TiscaliMobileScraper implements Scraper {
  readonly operatoreId = 'tiscali';
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

interface ParsedFissoCard {
  codice_offerta: string;
  nome_commerciale: string;
  prezzo_effettivo_euro_mese: number;
}

function parseFissoOfferCards(html: string): readonly ParsedFissoCard[] {
  const $ = load(html);
  const cards: ParsedFissoCard[] = [];
  const seen = new Set<string>();

  $('div.slide').each((_, el) => {
    const $el = $(el);
    const sticker = $el.find('img.sticker_1').first().attr('src') ?? '';
    if (!/FIBRA\.svg(?:$|\?)/.test(sticker)) return;

    const nome = ($el.find('h1, h2').first().text() ?? '').trim().replace(/\s+/g, ' ');
    if (!nome) return;

    const prodRaw = $el.find('[data-prod]').first().attr('data-prod') ?? nome;
    const codice_offerta = (prodRaw.split(',')[0] ?? nome).trim();

    const altImg = $el.find('img[alt^="€"]').first().attr('alt') ?? '';
    let prezzo = parsePriceEur(altImg);
    if (prezzo === null) {
      const filename = $el.find('img').not('.sticker_1').first().attr('src') ?? '';
      const filenamePrice = filename.match(/(\d{1,2})_(\d{2})(?=[^.]*\.(?:png|webp))/);
      if (filenamePrice) prezzo = Number(`${filenamePrice[1]}.${filenamePrice[2]}`);
    }
    if (prezzo === null || !Number.isFinite(prezzo)) return;
    if (seen.has(codice_offerta)) return;
    seen.add(codice_offerta);

    cards.push({ codice_offerta, nome_commerciale: nome, prezzo_effettivo_euro_mese: prezzo });
  });

  return cards;
}

function parseFissoVelocitaMbps(html: string): number {
  const text = load(html)('body').text();
  const giga = text.match(/fino a\s+(\d+(?:[.,]\d+)?)\s*G(?:igabit|bps|b\/s|iga)/i);
  if (giga) return Math.round(Number((giga[1] ?? '0').replace(',', '.')) * 1000);
  const mega = text.match(/fino a\s+(\d+(?:[.,]\d+)?)\s*M(?:egabit|bps|b\/s)/i);
  if (mega) return Math.round(Number((mega[1] ?? '0').replace(',', '.')));
  return 0;
}

function toOffertaFisso(
  card: ParsedFissoCard,
  velocita_mbps: number,
  url: string,
  scrapedAt: string,
): OffertaFisso {
  return {
    commodity: 'fisso' satisfies CommodityType,
    operatore_id: 'tiscali',
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

export class TiscaliFissoScraper implements Scraper {
  readonly operatoreId = 'tiscali';
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
      const velocitaMbps = parseFissoVelocitaMbps(html);
      const offerte = cards.map((c) => toOffertaFisso(c, velocitaMbps, url, scrapedAt));
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
