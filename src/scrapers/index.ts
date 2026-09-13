import type { Commodity } from '../types/offerta.ts';
import type { Scraper, ScrapeSource } from './types.ts';
import { EnelLuceScraper } from './enel.ts';
import { PlenitudeLuceScraper } from './plenitude.ts';
import { A2aLuceScraper } from './a2a.ts';
import { IrenLuceScraper } from './iren.ts';
import { HeraLuceScraper } from './hera.ts';
import { AceaLuceScraper } from './acea.ts';
import { SorgeniaLuceScraper } from './sorgenia.ts';
import { IllumiaLuceScraper } from './illumia.ts';
import { EngieLuceScraper } from './engie.ts';
import { OctopusLuceScraper } from './octopus.ts';
import { NenLuceScraper } from './nen.ts';
import { TimMobileScraper } from './tim.ts';
import { VodafoneMobileScraper } from './vodafone.ts';
import { IliadMobileScraper } from './iliad.ts';
import { FastwebMobileScraper } from './fastweb.ts';
import { SkywifiMobileScraper } from './skywifi.ts';

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
  if (operatoreId === 'sorgenia' && commodity === 'luce') {
    return new SorgeniaLuceScraper(source);
  }
  if (operatoreId === 'illumia' && commodity === 'luce') {
    return new IllumiaLuceScraper(source);
  }
  if (operatoreId === 'engie' && commodity === 'luce') {
    return new EngieLuceScraper(source);
  }
  if (operatoreId === 'octopus' && commodity === 'luce') {
    return new OctopusLuceScraper(source);
  }
  if (operatoreId === 'nen' && commodity === 'luce') {
    return new NenLuceScraper(source);
  }
  if (operatoreId === 'tim' && commodity === 'mobile') {
    return new TimMobileScraper(source);
  }
  if (operatoreId === 'vodafone' && commodity === 'mobile') {
    return new VodafoneMobileScraper(source);
  }
  if (operatoreId === 'iliad' && commodity === 'mobile') {
    return new IliadMobileScraper(source);
  }
  if (operatoreId === 'fastweb' && commodity === 'mobile') {
    return new FastwebMobileScraper(source);
  }
  if (operatoreId === 'skywifi' && commodity === 'mobile') {
    return new SkywifiMobileScraper(source);
  }
  return null;
}

export { EnelLuceScraper } from './enel.ts';
export { PlenitudeLuceScraper } from './plenitude.ts';
export { A2aLuceScraper } from './a2a.ts';
export { IrenLuceScraper } from './iren.ts';
export { HeraLuceScraper } from './hera.ts';
export { AceaLuceScraper } from './acea.ts';
export { SorgeniaLuceScraper } from './sorgenia.ts';
export { IllumiaLuceScraper } from './illumia.ts';
export { EngieLuceScraper } from './engie.ts';
export { OctopusLuceScraper } from './octopus.ts';
export { NenLuceScraper } from './nen.ts';
export { TimMobileScraper } from './tim.ts';
export { VodafoneMobileScraper } from './vodafone.ts';
export { IliadMobileScraper } from './iliad.ts';
export { FastwebMobileScraper } from './fastweb.ts';
export { SkywifiMobileScraper } from './skywifi.ts';
export type { ScrapeResult, ScrapeSource, Scraper } from './types.ts';