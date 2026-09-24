import { load, type CheerioAPI } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type {
  Commodity as CommodityType,
  GreenFlag,
  MeccanismoPrezzo,
  OffertaLuce,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';
import { nowIso } from './_utils/clock.ts';
import { fetchHtml } from './_utils/fetch-html.ts';

const SORGENIA_LUCE_URL =
  'https://www.sorgenia.it/sites/default/themes/sorgenia/modules/preprod_dynamic_card.php?offert=43124&commodity=ELE&consume=medium';
const SCRAPER_TIMEOUT_MS = 15_000;




function parseEuroNumber(raw: string): number {
  if (raw.includes(',') && raw.includes('.')) {
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    const decimal = lastComma > lastDot ? ',' : '.';
    return Number(raw.replace(decimal === ',' ? /\./g : /,/g, '').replace(decimal, '.'));
  }
  return Number(raw.replace(',', '.'));
}

function parseEurPerKwh(text: string): number | null {
  const match = text.match(/(\d{1,4}(?:[.,]\d{1,6})?)\s*€\s*\/\s*kWh/i);
  if (!match) return null;
  const n = parseEuroNumber(match[1] ?? '');
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseEurPerYear(text: string): number | null {
  const match = text.match(/(\d{1,5}(?:[.,]\d{1,2})?)\s*€\s*\/\s*POD\s*\/\s*anno/i);
  if (!match) return null;
  const n = Number((match[1] ?? '').replace('.', '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseSpreadEurPerKwh(text: string): number | null {
  const match = text.match(/PUN[^+\d]*?\+\s*(\d+(?:[.,]\d+)?)\s*€\s*\/\s*kWh/i);
  if (!match) return null;
  const n = Number((match[1] ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parseCodiceOfferta(text: string): string | null {
  const match = text.match(/CODICE\s+OFFERTA\s+LUCE:\s*([A-Z0-9]+)/i);
  return match ? (match[1] ?? '').trim() : null;
}

function extractCodiciByIndex($: CheerioAPI): readonly string[] {
  const codici: string[] = [];
  const re = /CODICE\s+OFFERTA\s+LUCE:\s*([A-Z0-9]+)/gi;
  $('.product-tile-popup-content-body').each((_, el) => {
    const body = $(el).text();
    const m = body.match(re);
    if (m && m[0]) {
      const parsed = parseCodiceOfferta(m[0]);
      if (parsed) codici.push(parsed);
    }
  });
  return codici;
}

function detectGreenFlag(text: string): GreenFlag {
  if (/100\s*%\s*rinnovabile|fonti\s+rinnovabili/i.test(text)) return 'A';
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
  $('s, del').remove();
  const cards: ParsedCard[] = [];
  const codici = extractCodiciByIndex($);

  $('.product-tiles-item').each((index, el) => {
    const $el = $(el);
    const nome = $el.find('h2.thin-heading small').first().text().trim();
    if (!nome) return;

    const cardText = $el.text();

    const prezzoRow = $el.find('table tr').filter((_, tr) => {
      const txt = $(tr).text();
      return /Prezzo\s+(componente|indicizzato)/i.test(txt) && /€\s*\/\s*kWh/i.test(txt);
    }).first();

    const prezzoText = prezzoRow.length > 0 ? prezzoRow.text() : cardText;

    const quotaRow = $el.find('table tr').filter((_, tr) => {
      return /Servizio\s+commerciale/i.test($(tr).text()) && /€\s*\/\s*POD\s*\/\s*anno/i.test($(tr).text());
    }).first();

    const quotaText = quotaRow.length > 0 ? quotaRow.text() : cardText;

    const prezzo = parseEurPerKwh(prezzoText);
    const quota = parseEurPerYear(quotaText);
    if (prezzo === null || quota === null) return;

    const isFisso = /Prezzo\s+fisso/i.test(cardText);
    let meccanismo: MeccanismoPrezzo;
    if (isFisso) {
      meccanismo = { tipo: 'fisso' };
    } else {
      const spread = parseSpreadEurPerKwh(cardText) ?? prezzo;
      meccanismo = { tipo: 'PUN', spread_euro_kwh: spread };
    }

    const codice = codici[index] ?? nome.toUpperCase().replace(/\s+/g, '-');

    cards.push({
      codice_offerta: codice,
      nome_commerciale: nome,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      meccanismo_prezzo: meccanismo,
      green_flag: detectGreenFlag(cardText),
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
    commodity: 'luce' satisfies CommodityType,
    operatore_id: 'sorgenia',
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

export class SorgeniaLuceScraper implements Scraper {
  readonly operatoreId = 'sorgenia';
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