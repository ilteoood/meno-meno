import type { Commodity } from '../types/offerta.ts';
import type { Scraper, ScrapeSource } from './types.ts';
import { EnelLuceScraper } from './enel.ts';
import { EdisonLuceScraper } from './edison.ts';
import { EoloFissoScraper } from './eolo.ts';
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
import { TimMobileScraper, TimFissoScraper } from './tim.ts';
import { VodafoneMobileScraper, VodafoneFissoScraper } from './vodafone.ts';
import { IliadMobileScraper, IliadFissoScraper } from './iliad.ts';
import { FastwebMobileScraper, FastwebFissoScraper } from './fastweb.ts';
import { SkywifiMobileScraper, SkywifiFissoScraper } from './skywifi.ts';
import { PostemobileMobileScraper } from './postemobile.ts';
import { HoMobileScraper } from './ho.ts';
import { KenaMobileScraper } from './kena.ts';
import { VeryMobileScraper } from './very.ts';
import { TiscaliMobileScraper, TiscaliFissoScraper } from './tiscali.ts';
import { DimensioneMobileScraper } from './dimensione.ts';
import { WindtreMobileScraper } from './windtre.ts';
import { WindtreFissoScraper } from './windtre.ts';

export function createScraper(
  operatoreId: string,
  commodity: Commodity,
  source: ScrapeSource,
): Scraper | null {
  if (operatoreId === 'enel' && commodity === 'luce') {
    return new EnelLuceScraper(source);
  }
  if (operatoreId === 'edison' && commodity === 'luce') {
    return new EdisonLuceScraper(source);
  }
  if (operatoreId === 'eolo' && commodity === 'fisso') {
    return new EoloFissoScraper(source);
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
  if (operatoreId === 'tim' && commodity === 'fisso') {
    return new TimFissoScraper(source);
  }
  if (operatoreId === 'vodafone' && commodity === 'mobile') {
    return new VodafoneMobileScraper(source);
  }
  if (operatoreId === 'vodafone' && commodity === 'fisso') {
    return new VodafoneFissoScraper(source);
  }
  if (operatoreId === 'iliad' && commodity === 'mobile') {
    return new IliadMobileScraper(source);
  }
  if (operatoreId === 'iliad' && commodity === 'fisso') {
    return new IliadFissoScraper(source);
  }
  if (operatoreId === 'fastweb' && commodity === 'mobile') {
    return new FastwebMobileScraper(source);
  }
  if (operatoreId === 'fastweb' && commodity === 'fisso') {
    return new FastwebFissoScraper(source);
  }
  if (operatoreId === 'skywifi' && commodity === 'mobile') {
    return new SkywifiMobileScraper(source);
  }
  if (operatoreId === 'skywifi' && commodity === 'fisso') {
    return new SkywifiFissoScraper(source);
  }
  if (operatoreId === 'postemobile' && commodity === 'mobile') {
    return new PostemobileMobileScraper(source);
  }
  if (operatoreId === 'ho' && commodity === 'mobile') {
    return new HoMobileScraper(source);
  }
  if (operatoreId === 'kena' && commodity === 'mobile') {
    return new KenaMobileScraper(source);
  }
  if (operatoreId === 'very' && commodity === 'mobile') {
    return new VeryMobileScraper(source);
  }
  if (operatoreId === 'tiscali' && commodity === 'mobile') {
    return new TiscaliMobileScraper(source);
  }
  if (operatoreId === 'tiscali' && commodity === 'fisso') {
    return new TiscaliFissoScraper(source);
  }
  if (operatoreId === 'dimensione' && commodity === 'mobile') {
    return new DimensioneMobileScraper(source);
  }
  if (operatoreId === 'windtre' && commodity === 'mobile') {
    return new WindtreMobileScraper(source);
  }
  if (operatoreId === 'windtre' && commodity === 'fisso') {
    return new WindtreFissoScraper(source);
  }
  return null;
}

export { EnelLuceScraper } from './enel.ts';
export { EdisonLuceScraper } from './edison.ts';
export { EoloFissoScraper } from './eolo.ts';
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
export { TimFissoScraper } from './tim.ts';
export { VodafoneMobileScraper, VodafoneFissoScraper } from './vodafone.ts';
export { IliadMobileScraper, IliadFissoScraper } from './iliad.ts';
export { FastwebMobileScraper, FastwebFissoScraper } from './fastweb.ts';
export { SkywifiMobileScraper, SkywifiFissoScraper } from './skywifi.ts';
export { PostemobileMobileScraper } from './postemobile.ts';
export { HoMobileScraper } from './ho.ts';
export { KenaMobileScraper } from './kena.ts';
export { VeryMobileScraper } from './very.ts';
export { TiscaliMobileScraper, TiscaliFissoScraper } from './tiscali.ts';
export { DimensioneMobileScraper } from './dimensione.ts';
export { WindtreMobileScraper, WindtreFissoScraper } from './windtre.ts';
export type { ScrapeResult, ScrapeSource, Scraper } from './types.ts';