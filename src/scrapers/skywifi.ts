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

const SKYWIFI_MOBILE_URL = 'https://www.sky.it/mobile';
const SKYWIFI_FISSO_URL = 'https://www.sky.it/sky-wifi-fibra';
const SCRAPER_TIMEOUT_MS = 15_000;




function parsePriceEur(text: string): number | null {
  const match = text.match(/(\d{1,4})\s*[.,]\s*(\d{2})/);
  if (!match) return null;
  return Number(`${match[1]}.${match[2]}`);
}

function parseGb(text: string): number {
  if (/illimitat/i.test(text)) return -1;
  const match = text.match(/(\d{1,4})\s*(?:GB|Giga)/i);
  if (match) return Number(match[1]);
  return 0;
}

function isTecnologia5G(cardText: string): boolean {
  return /5G/.test(cardText);
}

function tecnologiaFromCard(cardText: string): TecnologiaMobile {
  if (isTecnologia5G(cardText)) return '5G';
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

  $('[class*="StyledCardOffer"]').each((_, el) => {
    const $el = $(el);
    const nome = $el.find('section-title').first().text().trim().replace(/\s+/g, ' ');
    if (!nome) return;

    const cardText = $el.text();
    const priceMatch = cardText.match(/(\d{1,4})\s*[.,]\s*(\d{2})\s*€/);
    if (!priceMatch) return;
    const prezzo = Number(`${priceMatch[1]}.${priceMatch[2]}`);

    const ariaLabels = $el
      .find('[aria-label]')
      .map((_, e) => $(e).attr('aria-label') ?? '')
      .get();
    const ariaText = ariaLabels.join(' | ');
    const combined = `${cardText} | ${ariaText}`;

    const gbMatch = combined.match(/(\d{1,4})\s*(?:GB|Giga)/i);
    const gb = gbMatch ? Number(gbMatch[1]) : parseGb(combined);

    const hasIllimitati = /illimitat/i.test(combined);
    const minuti = hasIllimitati ? -1 : -1;

    cards.push({
      codice_offerta: slugify(nome),
      nome_commerciale: nome,
      prezzo_effettivo_euro_mese: prezzo,
      gb,
      minuti,
      tecnologia: tecnologiaFromCard(combined),
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
    operatore_id: 'skywifi',
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

export class SkywifiMobileScraper implements Scraper {
  readonly operatoreId = 'skywifi';
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

function parseVelocitaMbps(html: string): number {
  const text = load(html)('body').text();
  const gbps = text.match(/fino a (\d+(?:[.,]\d+)?)\s*Gb(?:\/?s|ps|it)/i);
  if (gbps) return Math.round(Number(gbps[1]!.replace(',', '.')) * 1000);
  const mbps = text.match(/fino a (\d+(?:[.,]\d+)?)\s*Mb(?:\/?s|ps|it)/i);
  if (mbps) return Math.round(Number(mbps[1]!.replace(',', '.')));
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

  $('[class*="StyledCard-sc-fe23b798-18"]').each((_, el) => {
    const $el = $(el);
    const nome = $el.find('[class*="Title-sc-fe23b798-5"]').first().text().trim().replace(/\s+/g, ' ');
    if (!nome) return;
    const priceText = $el.find('[class*="StyledPrice"]').first().text();
    const prezzo = parsePriceEur(priceText);
    if (prezzo === null) return;
    cards.push({
      codice_offerta: slugify(`fisso-${nome}`),
      nome_commerciale: nome,
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
    operatore_id: 'skywifi',
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

export class SkywifiFissoScraper implements Scraper {
  readonly operatoreId = 'skywifi';
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

      const velocitaMbps = parseVelocitaMbps(html);
      const url = this.source.kind === 'live' ? this.source.url : `file://${this.source.path}`;
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
