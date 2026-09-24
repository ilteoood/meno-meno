import { load } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type { OffertaLuce, Commodity } from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';
import { nowIso } from './_utils/clock.ts';
import { fetchHtml } from './_utils/fetch-html.ts';
import { slugify, slugFromHref } from './_utils/slug.ts';

const IREN_LUCE_URL = 'https://www.irenlucegas.it/casa/offerte-luce';
const SCRAPER_TIMEOUT_MS = 15_000;




function parseEurPerKwh(text: string): number | null {
  const match = text.match(/(\d{1,4}(?:[.,]\d{1,6})?)\s*€\s*\/\s*kWh/i);
  if (!match) return null;
  const n = Number((match[1] ?? '').replace('.', '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseEurPerMonth(text: string): number | null {
  const match = text.match(/(\d{1,5}(?:[.,]\d{1,2})?)\s*€\s*al\s*mese/i);
  if (!match) return null;
  const n = Number((match[1] ?? '').replace('.', '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}



interface ParsedCard {
  codice_offerta: string;
  nome_commerciale: string;
  prezzo_effettivo_euro_kwh: number;
  quota_fissa_euro_anno: number;
  tipo_indicizzazione: 'fisso' | 'PUN';
  spread_euro_kwh: number;
}

function parseOfferCards(html: string): readonly ParsedCard[] {
  const $ = load(html);
  const cards: ParsedCard[] = [];

  $('.no-product.offer').each((_, el) => {
    const $el = $(el);
    const filterType = $el.attr('data-filter-type');
    const nome = $el.find('h3.title').first().text().trim();
    if (!nome) return;

    const kwhTexts = $el.find('.price').map((_, p) => $(p).text()).get();
    const kwh = kwhTexts.map(parseEurPerKwh).find((n): n is number => n !== null);
    if (kwh === undefined) return;

    const labelTexts = $el.find('.price-label').map((_, p) => $(p).text()).get();
    const monthly = labelTexts.map(parseEurPerMonth).find((n): n is number => n !== null);
    if (monthly === undefined) return;

    const href = $el.find('.container-button a[href]').first().attr('href');
    const codice = slugFromHref(href) ?? slugify(nome);

    const isVariabile = filterType === 'variabile';

    cards.push({
      codice_offerta: codice,
      nome_commerciale: nome,
      prezzo_effettivo_euro_kwh: kwh,
      quota_fissa_euro_anno: monthly * 12,
      tipo_indicizzazione: isVariabile ? 'PUN' : 'fisso',
      spread_euro_kwh: isVariabile ? kwh : 0,
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
    operatore_id: 'iren',
    codice_offerta: card.codice_offerta,
    nome_commerciale: card.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_kwh: card.prezzo_effettivo_euro_kwh,
    quota_fissa_euro_anno: card.quota_fissa_euro_anno,
    meccanismo_prezzo:
      card.tipo_indicizzazione === 'fisso'
        ? { tipo: 'fisso' }
        : { tipo: 'PUN', spread_euro_kwh: card.spread_euro_kwh },
    green_flag: 'C',
  };
}

export class IrenLuceScraper implements Scraper {
  readonly operatoreId = 'iren';
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
