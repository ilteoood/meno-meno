import { load } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type {
  Commodity as CommodityType,
  OffertaFisso,
  TecnologiaFisso,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';

const LINKEM_FISSO_URL = 'https://www.linkem.com/';
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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface ParsedFissoCard {
  codice_offerta: string;
  nome_commerciale: string;
  prezzo_effettivo_euro_mese: number;
  velocita_mbps: number;
  tecnologia: TecnologiaFisso;
}

function tecnologiaFromVelocityHint(text: string): TecnologiaFisso {
  if (/FWA/i.test(text)) return 'FTTH';
  if (/FTTH/i.test(text)) return 'FTTH';
  if (/Fibra/i.test(text)) return 'FTTH';
  if (/FTTC/i.test(text)) return 'FTTC';
  if (/ADSL/i.test(text)) return 'ADSL';
  return 'FTTH';
}

function parseVelocitaMbpsFromText(text: string): number {
  const giga = text.match(/fino a\s+(\d+(?:[.,]\d+)?)\s*G(?:igabit|bps|b\/s|iga)/i);
  if (giga) return Math.round(Number((giga[1] ?? '0').replace(',', '.')) * 1000);
  const mega = text.match(/fino a\s+(\d+(?:[.,]\d+)?)\s*M(?:egabit|bps|b\/s|ega)/i);
  if (mega) return Math.round(Number((mega[1] ?? '0').replace(',', '.')));
  return 0;
}

function parseFissoOfferCards(html: string): readonly ParsedFissoCard[] {
  const $ = load(html);
  const cards: ParsedFissoCard[] = [];
  const seen = new Set<string>();

  $('article.rounded-\\[20px\\].border.bg-white').each((_, el) => {
    const $el = $(el);
    const cardText = $el.text().replace(/\s+/g, ' ');

    const nameEl = $el.find('h3').first();
    const nome = nameEl.text().trim();
    if (!nome) return;

    const linkEl = $el.find('a[href^="/casa-"]').first();
    const href = linkEl.attr('href') ?? '';
    const slug = href.replace(/^\//, '').replace(/\/$/, '').trim();
    if (!slug) return;
    if (seen.has(slug)) return;
    seen.add(slug);

    const priceMatch = cardText.match(/poi\s+(\d{1,4})\s*[.,]\s*(\d{2})\s*€/i);
    if (!priceMatch) return;
    const prezzo = Number(`${priceMatch[1]}.${priceMatch[2]}`);

    const velocita_mbps = parseVelocitaMbpsFromText(cardText);
    const tecnologia = tecnologiaFromVelocityHint(cardText);

    cards.push({
      codice_offerta: slugify(slug),
      nome_commerciale: nome,
      prezzo_effettivo_euro_mese: prezzo,
      velocita_mbps,
      tecnologia,
    });
  });

  return cards;
}

function toOffertaFisso(
  card: ParsedFissoCard,
  url: string,
  scrapedAt: string,
): OffertaFisso {
  return {
    commodity: 'fisso' satisfies CommodityType,
    operatore_id: 'linkem',
    codice_offerta: card.codice_offerta,
    nome_commerciale: card.nome_commerciale,
    url_sorgente: url,
    scraped_at: scrapedAt,
    prezzo_effettivo_euro_mese: card.prezzo_effettivo_euro_mese,
    tecnologia: card.tecnologia,
    velocita_mbps: card.velocita_mbps,
    costo_attivazione_euro: 0,
  };
}

export class LinkemFissoScraper implements Scraper {
  readonly operatoreId = 'linkem';
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

      const url = this.source.kind === 'live' ? this.source.url : `file://${this.source.path}`;
      const offerte = cards.map((c) => toOffertaFisso(c, url, scrapedAt));
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
