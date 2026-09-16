import { load } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type { Commodity, OffertaLuce } from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';

const OCTOPUS_LUCE_URL = 'https://octopusenergy.it/offerta/tariffe';
const SCRAPER_TIMEOUT_MS = 15_000;

const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const MONTHS_PER_YEAR = 12;

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

function parseDecimalEur(text: string): number | null {
  const match = text.match(/(\d{1,4}(?:[.,]\d{1,4})?)/);
  if (!match) return null;
  const raw = match[1]!.replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
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
  prezzo_effettivo_euro_kwh: number;
  quota_fissa_euro_anno: number;
  meccanismo_prezzo: OffertaLuce['meccanismo_prezzo'];
}

function extractLuceSection(cardText: string): {
  lucePriceText: string;
  luceQuotaText: string;
  hasPunLabel: boolean;
} | null {
  const luceIdx = cardText.toLowerCase().indexOf('materia prima luce');
  if (luceIdx === -1) return null;
  const gasIdx = cardText.toLowerCase().indexOf('materia prima gas', luceIdx);
  const luceEnd = gasIdx === -1 ? cardText.length : gasIdx;
  const luceSection = cardText.slice(luceIdx, luceEnd);
  const priceMatch = luceSection.match(/(\d{1,4}(?:[.,]\d{1,4})?)\s*€\s*\/\s*kWh/i);
  if (!priceMatch) return null;
  const afterPrice = luceSection.slice(priceMatch.index! + priceMatch[0].length);
  const quotaMatch = afterPrice.match(/(\d{1,4}(?:[.,]\d{1,4})?)\s*€\s*\/\s*mese/i);
  if (!quotaMatch) return null;
  const hasPunLabel = /\bPUN\b/i.test(luceSection.slice(0, priceMatch.index!));
  return {
    lucePriceText: priceMatch[1]!,
    luceQuotaText: quotaMatch[1]!,
    hasPunLabel,
  };
}

function parseOfferCards(html: string): readonly ParsedCard[] {
  const $ = load(html);
  const cards: ParsedCard[] = [];

  $('[data-testid="offeringCard"]').each((_, el) => {
    const $el = $(el);
    const headingRaw = $el.find('h2').first().text().trim().replace(/\s+/g, ' ');
    if (!headingRaw) return;
    const cardText = $el.text();
    const luce = extractLuceSection(cardText);
    if (!luce) return;

    const prezzo = parseDecimalEur(luce.lucePriceText);
    const quotaMese = parseDecimalEur(luce.luceQuotaText);
    if (prezzo === null || quotaMese === null) return;

    const nome = `${headingRaw} Luce`;
    const meccanismo_prezzo: OffertaLuce['meccanismo_prezzo'] = luce.hasPunLabel
      ? { tipo: 'PUN', spread_euro_kwh: prezzo }
      : { tipo: 'fisso' };

    cards.push({
      codice_offerta: slugify(nome),
      nome_commerciale: nome,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quotaMese * MONTHS_PER_YEAR,
      meccanismo_prezzo,
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
    operatore_id: 'octopus',
    codice_offerta: card.codice_offerta,
    nome_commerciale: card.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_kwh: card.prezzo_effettivo_euro_kwh,
    quota_fissa_euro_anno: card.quota_fissa_euro_anno,
    meccanismo_prezzo: card.meccanismo_prezzo,
    green_flag: 'A',
  };
}

export class OctopusLuceScraper implements Scraper {
  readonly operatoreId = 'octopus';
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