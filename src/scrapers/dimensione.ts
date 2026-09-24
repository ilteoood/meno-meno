import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type {
  Commodity as CommodityType,
  OffertaMobile,
  TecnologiaMobile,
  TipoSim,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';
import { nowIso } from './_utils/clock.ts';
import { fetchHtml } from './_utils/fetch-html.ts';
import { slugify, slugFromHref } from './_utils/slug.ts';

const DIMENSIONE_MOBILE_URL = 'https://www.dimensione.com/portale/sim-mobile/index.php';
const SCRAPER_TIMEOUT_MS = 15_000;




function parsePriceEur(text: string): number | null {
  const match = text.match(/(\d{1,4})\s*[.,]\s*(\d{2})/);
  if (!match) return null;
  return Number(`${match[1]}.${match[2]}`);
}

function parseGb(text: string): number {
  if (/illimitat/i.test(text)) return -1;
  const match = text.match(/(\d{1,4}(?:[.,]\d+)?)\s*(?:Giga|GB)/i);
  if (match) return Number(match[1].replace(',', '.'));
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

  $('.card-offerta').each((_, el) => {
    const $el = $(el);
    const cardText = $el.text().replace(/\s+/g, ' ');

    const qtaGbText = $el.find('.qta-gb').first().text().trim();
    const qtaGbMatch = qtaGbText.match(/(\d{1,4}(?:[.,]\d+)?)/);
    if (!qtaGbMatch) return;
    const gb = Number(qtaGbMatch[1].replace(',', '.'));

    const priceMatch = cardText.match(/(\d{1,4})\s*[.,]\s*(\d{2})\s*€\s*\/\s*mese/i);
    if (!priceMatch) return;
    const prezzo = Number(`${priceMatch[1]}.${priceMatch[2]}`);

    const labelTop = $el.find('.label-card-top').first().text().trim().replace(/\s+/g, ' ');
    const nome = labelTop || `Dimensione Mobile ${gb} Giga`;

    const hasIllimitati = /minut[ai]\s+illimitat/i.test(cardText);
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
    operatore_id: 'dimensione',
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

export class DimensioneMobileScraper implements Scraper {
  readonly operatoreId = 'dimensione';
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
