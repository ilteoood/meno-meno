import { load } from 'cheerio';
import { readFile } from 'node:fs/promises';
import type {
  Commodity as CommodityType,
  OffertaFisso,
  TecnologiaFisso,
} from '../types/offerta.ts';
import type { Scraper, ScrapeSource, ScrapeResult } from './types.ts';
import { nowIso } from './_utils/clock.ts';
import { fetchHtml } from './_utils/fetch-html.ts';
import { slugify, slugFromHref } from './_utils/slug.ts';

const EOLO_FISSO_URL = 'https://www.eolo.it/';
const SCRAPER_TIMEOUT_MS = 15_000;





interface ParsedFissoCard {
  codice_offerta: string;
  nome_commerciale: string;
  prezzo_effettivo_euro_mese: number;
  velocita_mbps: number;
  tecnologia: TecnologiaFisso;
}

function tecnologiaFromVelocityHint(text: string): TecnologiaFisso {
  if (/FWA/i.test(text)) return 'FWA';
  if (/FTTH/i.test(text)) return 'FTTH';
  if (/FTTC/i.test(text)) return 'FTTC';
  if (/ADSL/i.test(text)) return 'ADSL';
  return 'FTTH';
}

function parseVelocitaMbpsFromText(text: string): number {
  const giga = text.match(/fino a\s+(\d+(?:[.,]\d+)?)\s*G(?:igabit|bps|b\/s)/i);
  if (giga) return Math.round(Number((giga[1] ?? '0').replace(',', '.')) * 1000);
  const mega = text.match(/fino a\s+(\d+(?:[.,]\d+)?)\s*M(?:egabit|bps|b\/s)/i);
  if (mega) return Math.round(Number((mega[1] ?? '0').replace(',', '.')));
  return 0;
}

function parseVelocityByOfferName(html: string): Map<string, { velocita_mbps: number; tecnologia: TecnologiaFisso }> {
  const $ = load(html);
  const out = new Map<string, { velocita_mbps: number; tecnologia: TecnologiaFisso }>();

  $('.menu_card').each((_, el) => {
    const $el = $(el);
    const cardText = $el.text().replace(/\s+/g, ' ');
    const href = $el.find('a[href^="/offerte/"]').first().attr('href') ?? '';
    const slug = href.replace(/^\/offerte\//, '').trim();
    if (!slug) return;

    const velocita_mbps = parseVelocitaMbpsFromText(cardText);
    if (velocita_mbps === 0) return;

    const tecnologia = tecnologiaFromVelocityHint(cardText);
    if (!out.has(slug)) {
      out.set(slug, { velocita_mbps, tecnologia });
    }
  });

  return out;
}

function parseFissoOfferCards(html: string): readonly ParsedFissoCard[] {
  const $ = load(html);
  const cards: ParsedFissoCard[] = [];
  const seen = new Set<string>();
  const velocityBySlug = parseVelocityByOfferName(html);

  $('.swiper-slide').each((_, el) => {
    const $el = $(el);
    const cardText = $el.text().replace(/\s+/g, ' ');

    const offerLink = $el.find('a[href^="/offerte/"]').first();
    const href = offerLink.attr('href') ?? '';
    const slug = href.replace(/^\/offerte\//, '').trim();
    if (!slug) return;

    const nome = offerLink.text().trim().replace(/\s+/g, ' ');
    if (!nome) return;

    const priceMatch = cardText.match(/poi da\s+(\d{1,4})\s*[.,]\s*(\d{2})\s*€/i);
    if (!priceMatch) return;
    const prezzo = Number(`${priceMatch[1]}.${priceMatch[2]}`);

    if (seen.has(slug)) return;
    seen.add(slug);

    const velocityInfo = velocityBySlug.get(slug);
    const velocita_mbps = velocityInfo?.velocita_mbps ?? 0;
    const tecnologia: TecnologiaFisso = velocityInfo?.tecnologia ?? 'FTTH';

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
    operatore_id: 'eolo',
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

export class EoloFissoScraper implements Scraper {
  readonly operatoreId = 'eolo';
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