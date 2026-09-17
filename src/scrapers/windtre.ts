import { load } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type {
  Commodity as CommodityType,
  OffertaMobile,
  TecnologiaMobile,
  TipoSim,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';
import { launchBrowser } from '../browser/playwright.ts';

const WINDTRE_MOBILE_URL = 'https://www.windtre.it/offerte-mobile';
const SCRAPER_TIMEOUT_MS = 15_000;
const BROWSER_WAIT_TIMEOUT_MS = 10_000;

const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function nowIso(): string {
  return new Date().toISOString();
}

async function fetchHtml(url: string, signal: AbortSignal): Promise<string> {
  const browser = await launchBrowser();
  const context = await browser.newContext({ userAgent: DESKTOP_UA });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: SCRAPER_TIMEOUT_MS });
    await page.waitForSelector('[data-offer-code], article[data-offer]', {
      timeout: BROWSER_WAIT_TIMEOUT_MS,
    });
    return await page.content();
  } finally {
    await context.close();
  }
}

function parsePriceEur(text: string): number | null {
  const match = text.match(/(\d{1,4}(?:[.,]\d{2})?)/);
  if (!match) return null;
  return Number(match[1].replace(',', '.'));
}

function parseGb(text: string): number {
  const lower = text.toLowerCase();
  if (lower.includes('illimitat')) return -1;
  const parsed = parsePriceEur(text);
  return parsed ?? 0;
}

function parseMinuti(text: string): number {
  if (text.toLowerCase().includes('illimitat')) return -1;
  const parsed = parsePriceEur(text);
  return parsed ?? 0;
}

function parseTecnologia(text: string): TecnologiaMobile {
  const value = text.trim().toUpperCase();
  if (value === '5G') return '5G';
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

  $('[data-offer-code], article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const gbText = $el.find('.offer-gb').first().text();
    const minutiText = $el.find('.offer-minuti').first().text();
    const techText = $el.find('.offer-tech').first().text();
    if (!codice || !nome) return;
    const prezzo = parsePriceEur(prezzoText);
    if (prezzo === null) return;
    const tecnologia = parseTecnologia(techText);
    cards.push({
      codice_offerta: codice,
      nome_commerciale: nome,
      prezzo_effettivo_euro_mese: prezzo,
      gb: parseGb(gbText),
      minuti: parseMinuti(minutiText),
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
    operatore_id: 'windtre',
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

export class WindtreMobileScraper implements Scraper {
  readonly operatoreId = 'windtre';
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
      const message =
        err instanceof Error && /playwright|chromium|browser|executable/i.test(err.message)
          ? 'browser unavailable'
          : err instanceof Error
            ? err.message
            : String(err);
      return {
        ok: false,
        source: this.source,
        scrapedAt,
        error: message,
      };
    }
  }
}