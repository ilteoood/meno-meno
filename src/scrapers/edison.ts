import { load } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type { OffertaLuce, Commodity } from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';
import { launchBrowser } from '../browser/playwright.ts';

const EDISON_LUCE_URL = 'https://www.edison.it/it-it/luce-gas/offerte-luce';
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

  $('[data-offer-code], article[data-offer]').each((_, el) => {
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
    operatore_id: 'edison',
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

export class EdisonLuceScraper implements Scraper {
  readonly operatoreId = 'edison';
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
