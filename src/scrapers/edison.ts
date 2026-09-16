import { load } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type {
  Commodity as CommodityType,
  GreenFlag,
  MeccanismoPrezzo,
  OffertaLuce,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';
import { launchBrowser } from '../browser/playwright.ts';

const EDISON_LUCE_URL = 'https://www.edisonenergia.it/edison/casa/luce';
const SCRAPER_TIMEOUT_MS = 30_000;
const BROWSER_WAIT_TIMEOUT_MS = 15_000;

const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const OFFER_CARD_SELECTOR = '.OffersShowcase_OfferShowcase_offer-showcase-container';

function nowIso(): string {
  return new Date().toISOString();
}

async function fetchHtml(url: string, signal: AbortSignal): Promise<string> {
  const browser = await launchBrowser();
  const context = await browser.newContext({ userAgent: DESKTOP_UA, locale: 'it-IT' });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: SCRAPER_TIMEOUT_MS });
    await page.waitForSelector(OFFER_CARD_SELECTOR, { timeout: BROWSER_WAIT_TIMEOUT_MS });
    return await page.content();
  } finally {
    await context.close();
  }
}

function parseEuroNumber(raw: string): number | null {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePricePerKwh(text: string): number | null {
  const match = text.match(/(\d{1,5}[,.]\d{1,6})\s*€\s*\/\s*kWh/i);
  if (!match) return null;
  return parseEuroNumber(match[1] ?? '');
}

function parseQuotaPerYear(text: string): number | null {
  const match = text.match(/(\d{1,5})\s*€\s*\/\s*anno/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractOfferCodeFromLink(cardHtml: string): string | null {
  const match = cardHtml.match(/offerCode=([^&"]+)/);
  return match && typeof match[1] === 'string' && match[1].length > 0 ? match[1] : null;
}

function detectMeccanismo(cardText: string): MeccanismoPrezzo {
  if (/PUN\s+Index\s+GME|VARIABILE/i.test(cardText)) {
    return { tipo: 'PUN', spread_euro_kwh: 0 };
  }
  return { tipo: 'fisso' };
}

function detectGreenFlag(cardText: string): GreenFlag {
  if (/Energia Sostenibile|100\s*%\s*green|fonti\s+rinnovabili|energia\s+verde/i.test(cardText)) {
    return 'A';
  }
  return 'C';
}

interface ParsedCard {
  codice_offerta: string;
  nome_commerciale: string;
  prezzo_effettivo_euro_kwh: number;
  quota_fissa_euro_anno: number;
  meccanismo_prezzo: MeccanismoPrezzo;
  green_flag: GreenFlag;
}

function parseOfferCards(html: string): readonly ParsedCard[] {
  const $ = load(html);
  const cards: ParsedCard[] = [];

  $(OFFER_CARD_SELECTOR).each((_, el) => {
    const $el = $(el);
    const cardText = $el.text().replace(/\s+/g, ' ').trim();
    const cardHtml = $.html($el);
    if (!cardText) return;

    const $title = $el.find('h2.title').first();
    if ($title.length === 0) return;
    const $label = $title.find('.offer-label');
    const rawName = ($title.text() ?? '').replace(/\s+/g, ' ').trim();
    const labelText = ($label.text() ?? '').replace(/\s+/g, ' ').trim();
    const nome = labelText && rawName.includes(labelText)
      ? rawName.replace(labelText, '').trim()
      : rawName;
    if (!nome) return;

    const codice_offerta = extractOfferCodeFromLink(cardHtml)
      ?? nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    const prezzo = parsePricePerKwh(cardText);
    if (prezzo === null) return;
    const quota = parseQuotaPerYear(cardText);
    if (quota === null) return;

    cards.push({
      codice_offerta,
      nome_commerciale: nome,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      meccanismo_prezzo: detectMeccanismo(cardText),
      green_flag: detectGreenFlag(cardText),
    });
  });

  return cards;
}

function toOffertaLuce(card: ParsedCard, url: string, scrapedAt: string): OffertaLuce {
  return {
    commodity: 'luce' satisfies CommodityType,
    operatore_id: 'edison',
    codice_offerta: card.codice_offerta,
    nome_commerciale: card.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_kwh: card.prezzo_effettivo_euro_kwh,
    quota_fissa_euro_anno: card.quota_fissa_euro_anno,
    meccanismo_prezzo: card.meccanismo_prezzo,
    green_flag: card.green_flag,
  };
}

export class EdisonLuceScraper implements Scraper {
  readonly operatoreId = 'edison';
  readonly commodity: CommodityType = 'luce';
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
          error: 'no luce offer cards parsed from source',
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