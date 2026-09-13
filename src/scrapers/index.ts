import type { Commodity } from '../types/offerta.ts';
import type { Scraper, ScrapeSource } from './types.ts';
import { EnelLuceScraper } from './enel.ts';
import { PlenitudeLuceScraper } from './plenitude.ts';
import { A2aLuceScraper } from './a2a.ts';
import { IrenLuceScraper } from './iren.ts';
import { HeraLuceScraper } from './hera.ts';
import { AceaLuceScraper } from './acea.ts';

export function createScraper(
  operatoreId: string,
  commodity: Commodity,
  source: ScrapeSource,
): Scraper | null {
  if (operatoreId === 'enel' && commodity === 'luce') {
    return new EnelLuceScraper(source);
  }
  if (operatoreId === 'plenitude' && commodity === 'luce') {
    return new PlenitudeLuceScraper(source);
  }
  if (operatoreId === 'a2a' && commodity === 'luce') {
    return new A2aLuceScraper(source);
  }
  if (operatoreId === 'iren' && commodity === 'luce') {
    return new IrenLuceScraper(source);
  }
  if (operatoreId === 'hera' && commodity === 'luce') {
    return new HeraLuceScraper(source);
  }
  if (operatoreId === 'acea' && commodity === 'luce') {
    return new AceaLuceScraper(source);
  }
  return null;
}

export { EnelLuceScraper } from './enel.ts';
export { PlenitudeLuceScraper } from './plenitude.ts';
export { A2aLuceScraper } from './a2a.ts';
export { IrenLuceScraper } from './iren.ts';
export { HeraLuceScraper } from './hera.ts';
export { AceaLuceScraper } from './acea.ts';
export type { ScrapeResult, ScrapeSource, Scraper } from './types.ts';