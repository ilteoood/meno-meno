import type { Commodity, Offerta } from '../types/offerta.ts';

export type ScrapeSource =
  | { readonly kind: 'live'; readonly url: string }
  | { readonly kind: 'fixture'; readonly path: string };

export interface ScrapeOk {
  readonly ok: true;
  readonly source: ScrapeSource;
  readonly offerte: readonly Offerta[];
  readonly scrapedAt: string;
}

export interface ScrapeFail {
  readonly ok: false;
  readonly source: ScrapeSource;
  readonly error: string;
  readonly scrapedAt: string;
}

export type ScrapeResult = ScrapeOk | ScrapeFail;

export interface Scraper {
  readonly operatoreId: string;
  readonly commodity: Commodity;
  readonly source: ScrapeSource;
  scrape(): Promise<ScrapeResult>;
}
