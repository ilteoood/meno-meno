import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type {
  Commodity as CommodityType,
  OffertaMobile,
  TecnologiaMobile,
  TipoSim,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';

const TIM_MOBILE_URL = 'https://www.tim.it/fisso-e-mobile/mobile';
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
  const match = text.match(/(\d{1,4})\s*[.,]\s*(\d{2})/);
  if (!match) return null;
  return Number(`${match[1]}.${match[2]}`);
}

function parseGb(text: string): number {
  if (/illimitat/i.test(text)) return -1;
  const match = text.match(/(\d{1,4})\s*(?:Giga|GB)/i);
  if (match) return Number(match[1]);
  const parsed = parsePriceEur(text);
  return parsed ?? 0;
}

function parseMinuti(text: string): number {
  if (/illimitat/i.test(text)) return -1;
  const match = text.match(/(\d{1,4})\s*(?:minut|min)/i);
  if (match) return Number(match[1]);
  return -1;
}

function isTecnologia5G(cardText: string, $card: Cheerio<any>): boolean {
  return $card.find('img[title="5G"]').length > 0 || /5G\+?(?:\s|$)/.test(cardText);
}

function tecnologiaFromCard($card: Cheerio<any>, cardText: string): TecnologiaMobile {
  if (/5G\+/i.test(cardText)) return '5G+';
  if (isTecnologia5G(cardText, $card)) return '5G';
  return '4G';
}

function velocitaPerTecnologia(tech: TecnologiaMobile): number {
  if (tech === '5G+') return 2000;
  if (tech === '5G') return 1000;
  return 150;
}

function slugFromHref(href: string | undefined, fallback: string): string {
  if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
    const cleaned = href.split('?')[0].replace(/\/$/, '');
    const segments = cleaned.split('/').filter(Boolean);
    if (segments.length > 0) {
      const slug = segments[segments.length - 1]!.replace(/\.html$/, '');
      if (slug) return slug;
    }
  }
  return fallback
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
  const seen = new Set<string>();

  $('.tm-tile--offerta').each((_, el) => {
    const $el = $(el);
    const nameRaw = $el.find('.tm-tile__title h3').first().text();
    const nome = nameRaw.replace(/\s+/g, ' ').trim();
    if (!nome) return;

    const priceText = $el.find('.tm-tile__price').text();
    const prezzo = parsePriceEur(priceText);
    if (prezzo === null) return;

    const featureTexts = $el
      .find('.ta-feature__text')
      .map((_, ft) => $(ft).text())
      .get();
    const joinedFeatures = featureTexts.join(' | ');
    const hasGiga = /Giga|GB/i.test(joinedFeatures);
    if (!hasGiga) return;

    const firstFeature = featureTexts[0] ?? '';
    const secondFeature = featureTexts[1] ?? '';

    const cardText = $el.text();
    const href = $el.find('a[href]').filter((_, a) => {
      const h = $(a).attr('href') ?? '';
      return h && !h.startsWith('javascript:') && !h.startsWith('#');
    }).first().attr('href');

    cards.push({
      codice_offerta: slugFromHref(href, nome),
      nome_commerciale: nome,
      prezzo_effettivo_euro_mese: prezzo,
      gb: parseGb(firstFeature),
      minuti: parseMinuti(secondFeature || joinedFeatures),
      tecnologia: tecnologiaFromCard($el, cardText),
    });
    seen.add(nome);
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
    operatore_id: 'tim',
    codice_offerta: card.codice_offerta,
    nome_commerciale: card.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_mese: card.prezzo_effettivo_euro_mese,
    gb: card.gb,
    minuti: card.minuti,
    tipo_sim: 'entrambe' satisfies TipoSim,
    tecnologia: card.tecnologia,
    velocita_mbps: velocitaPerTecnologia(card.tecnologia),
  };
}

export class TimMobileScraper implements Scraper {
  readonly operatoreId = 'tim';
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
