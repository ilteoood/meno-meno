import { load } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type { OffertaLuce, Commodity } from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';

const SORGENIA_LUCE_URL = 'https://www.sorgenia.it/offerte-luce-e-gas-casa';
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

interface ParsedCard {
  codice_offerta: string;
  nome_commerciale: string;
  prezzo_effettivo_euro_kwh: number;
  quota_fissa_euro_anno: number;
  tipo_indicizzazione: 'fisso' | 'PUN';
}

function parseOfferCards(html: string): readonly ParsedCard[] {
  const $ = load(html);
  const cards: ParsedCard[] = [];

  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const quotaText = $el.find('.offer-fee, .fee').first().text();
    if (!codice || !nome) return;
    const prezzo = parsePriceEur(prezzoText);
    const quota = parsePriceEur(quotaText);
    if (prezzo === null || quota === null) return;
    cards.push({
      codice_offerta: codice,
      nome_commerciale: nome,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      tipo_indicizzazione: nome.toLowerCase().includes('fix') ? 'fisso' : 'PUN',
    });
  });

  return cards;
}

function toOffertaLuce(
  card: ParsedCard,
  url: string,
  scrapedAt: string,
): OffertaLuce {
  return {
    commodity: 'luce' satisfies Commodity,
    operatore_id: 'sorgenia',
    codice_offerta: card.codice_offerta,
    nome_commerciale: card.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_kwh: card.prezzo_effettivo_euro_kwh,
    quota_fissa_euro_anno: card.quota_fissa_euro_anno,
    meccanismo_prezzo:
      card.tipo_indicizzazione === 'fisso'
        ? { tipo: 'fisso' }
        : { tipo: 'PUN', spread_euro_kwh: 0 },
    green_flag: 'C',
  };
}

export class SorgeniaLuceScraper implements Scraper {
  readonly operatoreId = 'sorgenia';
  readonly commodity: Commodity = 'luce';
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