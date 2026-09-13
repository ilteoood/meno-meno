import type { Commodity } from '../types/offerta.ts';
import type { Scraper, ScrapeSource } from './types.ts';
import { EnelLuceScraper } from './enel.ts';

export function createScraper(
  operatoreId: string,
  commodity: Commodity,
  source: ScrapeSource,
): Scraper | null {
  if (operatoreId === 'enel' && commodity === 'luce') {
    return new EnelLuceScraper(source);
  }
  return null;
}

export { EnelLuceScraper } from './enel.ts';
export type { ScrapeResult, ScrapeSource, Scraper } from './types.ts';
