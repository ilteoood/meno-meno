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
import { LinkemFissoScraper } from './linkem.ts';

type ScraperFactory = (source: ScrapeSource) => Scraper;

interface OperatorSpec {
  readonly id: string;
  readonly commodity: Commodity;
  readonly create: ScraperFactory;
}

const OPERATORS_LIST: readonly OperatorSpec[] = [
  { id: 'enel', commodity: 'luce', create: (s) => new EnelLuceScraper(s) },
  { id: 'edison', commodity: 'luce', create: (s) => new EdisonLuceScraper(s) },
  { id: 'eolo', commodity: 'fisso', create: (s) => new EoloFissoScraper(s) },
  { id: 'plenitude', commodity: 'luce', create: (s) => new PlenitudeLuceScraper(s) },
  { id: 'a2a', commodity: 'luce', create: (s) => new A2aLuceScraper(s) },
  { id: 'iren', commodity: 'luce', create: (s) => new IrenLuceScraper(s) },
  { id: 'hera', commodity: 'luce', create: (s) => new HeraLuceScraper(s) },
  { id: 'acea', commodity: 'luce', create: (s) => new AceaLuceScraper(s) },
  { id: 'sorgenia', commodity: 'luce', create: (s) => new SorgeniaLuceScraper(s) },
  { id: 'illumia', commodity: 'luce', create: (s) => new IllumiaLuceScraper(s) },
  { id: 'engie', commodity: 'luce', create: (s) => new EngieLuceScraper(s) },
  { id: 'octopus', commodity: 'luce', create: (s) => new OctopusLuceScraper(s) },
  { id: 'nen', commodity: 'luce', create: (s) => new NenLuceScraper(s) },
  { id: 'tim', commodity: 'mobile', create: (s) => new TimMobileScraper(s) },
  { id: 'tim', commodity: 'fisso', create: (s) => new TimFissoScraper(s) },
  { id: 'vodafone', commodity: 'mobile', create: (s) => new VodafoneMobileScraper(s) },
  { id: 'vodafone', commodity: 'fisso', create: (s) => new VodafoneFissoScraper(s) },
  { id: 'iliad', commodity: 'mobile', create: (s) => new IliadMobileScraper(s) },
  { id: 'iliad', commodity: 'fisso', create: (s) => new IliadFissoScraper(s) },
  { id: 'fastweb', commodity: 'mobile', create: (s) => new FastwebMobileScraper(s) },
  { id: 'fastweb', commodity: 'fisso', create: (s) => new FastwebFissoScraper(s) },
  { id: 'skywifi', commodity: 'mobile', create: (s) => new SkywifiMobileScraper(s) },
  { id: 'skywifi', commodity: 'fisso', create: (s) => new SkywifiFissoScraper(s) },
  { id: 'postemobile', commodity: 'mobile', create: (s) => new PostemobileMobileScraper(s) },
  { id: 'ho', commodity: 'mobile', create: (s) => new HoMobileScraper(s) },
  { id: 'kena', commodity: 'mobile', create: (s) => new KenaMobileScraper(s) },
  { id: 'very', commodity: 'mobile', create: (s) => new VeryMobileScraper(s) },
  { id: 'tiscali', commodity: 'mobile', create: (s) => new TiscaliMobileScraper(s) },
  { id: 'tiscali', commodity: 'fisso', create: (s) => new TiscaliFissoScraper(s) },
  { id: 'dimensione', commodity: 'mobile', create: (s) => new DimensioneMobileScraper(s) },
  { id: 'windtre', commodity: 'mobile', create: (s) => new WindtreMobileScraper(s) },
  { id: 'windtre', commodity: 'fisso', create: (s) => new WindtreFissoScraper(s) },
  { id: 'linkem', commodity: 'fisso', create: (s) => new LinkemFissoScraper(s) },
];

const FACTORIES_BY_KEY: ReadonlyMap<string, ScraperFactory> = new Map(
  OPERATORS_LIST.map((op) => [`${op.id}/${op.commodity}`, op.create]),
);

export function createScraper(
  operatoreId: string,
  commodity: Commodity,
  source: ScrapeSource,
): Scraper | null {
  const factory = FACTORIES_BY_KEY.get(`${operatoreId}/${commodity}`);
  return factory ? factory(source) : null;
}

export function listOperators(commodity: Commodity): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const op of OPERATORS_LIST) {
    if (op.commodity === commodity && !seen.has(op.id)) {
      seen.add(op.id);
      out.push(op.id);
    }
  }
  return out;
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
export { LinkemFissoScraper } from './linkem.ts';
export type { ScrapeResult, ScrapeSource, Scraper } from './types.ts';