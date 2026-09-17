import { resolve } from 'node:path';
import type { Commodity } from './types/offerta.ts';
import { createScraper } from './scrapers/index.ts';
import type { ScrapeSource } from './scrapers/types.ts';
import { aggregate } from './aggregator.ts';
import { format } from './formatters/index.ts';

const VALID_COMMODITIES: readonly Commodity[] = ['luce', 'gas', 'mobile', 'fisso'];

type OutputFormat = 'all' | 'markdown' | 'csv' | 'json';

const VALID_FORMATS: readonly OutputFormat[] = ['all', 'markdown', 'csv', 'json'];

function parseFormat(value: string | null): OutputFormat {
  if (value !== null && !VALID_FORMATS.includes(value as OutputFormat)) {
    throw new Error(
      `invalid --format: ${value} (atteso: ${VALID_FORMATS.join(', ')})`,
    );
  }
  return (value as OutputFormat | null) ?? 'all';
}

type ParsedArgs = {
  operatore: string | null;
  commodity: Commodity | null;
  fixture: string | null;
  live: boolean;
  format: OutputFormat;
};

function parseArgs(argv: readonly string[]): ParsedArgs {
  let operatore: string | null = null;
  let commodity: Commodity | null = null;
  let fixture: string | null = null;
  let live = false;
  let rawFormat: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--operatore':
        operatore = argv[++i] ?? null;
        break;
      case '--commodity':
        commodity = (argv[++i] ?? null) as Commodity | null;
        break;
      case '--fixture':
        fixture = argv[++i] ?? null;
        break;
      case '--live':
        live = true;
        break;
      case '--format':
        rawFormat = argv[++i] ?? null;
        break;
    }
  }
  return { operatore, commodity, fixture, live, format: parseFormat(rawFormat) };
}

function validateCommodity(value: string | null): Commodity {
  if (value === null || !VALID_COMMODITIES.includes(value as Commodity)) {
    throw new Error(
      `commodity_required: specifica una commodity: ${VALID_COMMODITIES.join(', ')}.`,
    );
  }
  return value as Commodity;
}

function buildSource(
  operatore: string,
  commodity: Commodity,
  fixture: string | null,
  live: boolean,
): ScrapeSource {
  if (fixture) {
    return { kind: 'fixture', path: resolve(fixture) };
  }
  if (live && operatore === 'enel' && commodity === 'luce') {
    return { kind: 'live', url: 'https://www.enel.it/it-it/offerte-luce' };
  }
  if (live && operatore === 'edison' && commodity === 'luce') {
    return { kind: 'live', url: 'https://www.edisonenergia.it/edison/casa/luce' };
  }
  if (live && operatore === 'plenitude' && commodity === 'luce') {
    return { kind: 'live', url: 'https://eniplenitude.com/offerta/casa/gas-e-luce/offerte-energia-elettrica' };
  }
  if (live && operatore === 'a2a' && commodity === 'luce') {
    return { kind: 'live', url: 'https://www.a2a.it/casa/offerte-luce-gas' };
  }
  if (live && operatore === 'iren' && commodity === 'luce') {
    return { kind: 'live', url: 'https://www.irenlucegas.it/casa/offerte-luce' };
  }
  if (live && operatore === 'hera' && commodity === 'luce') {
    return { kind: 'live', url: 'https://heracomm.gruppohera.it/casa/offerte-luce-gas' };
  }
  if (live && operatore === 'acea' && commodity === 'luce') {
    return { kind: 'live', url: 'https://www.aceaenergia.it/elenco-offerte' };
  }
  if (live && operatore === 'sorgenia' && commodity === 'luce') {
    return { kind: 'live', url: 'https://www.sorgenia.it/sites/default/themes/sorgenia/modules/preprod_dynamic_card.php?offert=43124&commodity=ELE&consume=medium' };
  }
  if (live && operatore === 'illumia' && commodity === 'luce') {
    return { kind: 'live', url: 'https://www.illumia.it/casa/luce/' };
  }
  if (live && operatore === 'engie' && commodity === 'luce') {
    return { kind: 'live', url: 'https://www.engie.it/casa/offerte-luce-gas/' };
  }
  if (live && operatore === 'octopus' && commodity === 'luce') {
    return { kind: 'live', url: 'https://octopusenergy.it/offerta/tariffe' };
  }
  if (live && operatore === 'nen' && commodity === 'luce') {
    return { kind: 'live', url: 'https://nen.it/landing/migliore-offerta-luce' };
  }
  if (live && operatore === 'tim' && commodity === 'mobile') {
    return { kind: 'live', url: 'https://www.tim.it/fisso-e-mobile/mobile' };
  }
  if (live && operatore === 'tim' && commodity === 'fisso') {
    return { kind: 'live', url: 'https://www.tim.it/fisso-e-mobile/fibra-e-adsl' };
  }
  if (live && operatore === 'vodafone' && commodity === 'mobile') {
    return { kind: 'live', url: 'https://privati.vodafone.it/mobile/telefonia-mobile' };
  }
  if (live && operatore === 'iliad' && commodity === 'mobile') {
    return { kind: 'live', url: 'https://www.iliad.it/offerte-iliad-mobile.html' };
  }
  if (live && operatore === 'fastweb' && commodity === 'mobile') {
    return { kind: 'live', url: 'https://www.fastweb.it/adsl-fibra-ottica/offerta-mobile' };
  }
  if (live && operatore === 'fastweb' && commodity === 'fisso') {
    return { kind: 'live', url: 'https://www.fastweb.it/adsl-fibra-ottica/' };
  }
  if (live && operatore === 'skywifi' && commodity === 'mobile') {
    return { kind: 'live', url: 'https://www.sky.it/mobile' };
  }
  if (live && operatore === 'postemobile' && commodity === 'mobile') {
    return { kind: 'live', url: 'https://www.postemobile.it/privati/offerte-telefonia-mobile' };
  }
  if (live && operatore === 'ho' && commodity === 'mobile') {
    return { kind: 'live', url: 'https://www.ho-mobile.it/tutte-le-offerte' };
  }
  if (live && operatore === 'kena' && commodity === 'mobile') {
    return { kind: 'live', url: 'https://www.kenamobile.it/offerte/' };
  }
  if (live && operatore === 'very' && commodity === 'mobile') {
    return { kind: 'live', url: 'https://verymobile.it/offerte' };
  }
  if (live && operatore === 'tiscali' && commodity === 'mobile') {
    return { kind: 'live', url: 'https://casa.tiscali.it/mobile/' };
  }
  if (live && operatore === 'dimensione' && commodity === 'mobile') {
    return { kind: 'live', url: 'https://www.dimensione.com/portale/sim-mobile/index.php' };
  }
  if (live && operatore === 'windtre' && commodity === 'mobile') {
    return { kind: 'live', url: 'https://www.windtre.it/offerte-mobile' };
  }
  throw new Error(`unknown source for ${operatore}/${commodity}; pass --fixture PATH or --live (live source required)`);
}

function emit(label: string, content: string): void {
  process.stdout.write(`\n=== ${label} ===\n${content}`);
}

async function main(argv: readonly string[]): Promise<number> {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }
  if (!args.operatore) {
    process.stderr.write('Missing --operatore\n');
    return 2;
  }
  const commodity = validateCommodity(args.commodity);
  let source: ScrapeSource;
  try {
    source = buildSource(args.operatore, commodity, args.fixture, args.live);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  const scraper = createScraper(args.operatore, commodity, source);
  if (!scraper) {
    process.stderr.write(`no scraper registered for ${args.operatore}/${commodity}\n`);
    return 2;
  }

  const result = await aggregate({ commodity, scrapers: [scraper] });
  if (!result.ok) {
    process.stderr.write(`aggregate failed: ${result.error}\n`);
    return 1;
  }

  const output = format({
    commodity,
    scrapedAt: result.scrapedAt,
    offerte: result.offerte,
    bundle: result.bundle,
    warnings: result.warnings,
    sourceCount: { ok: result.warnings.length === 0 ? 1 : 0, total: 1 },
  });

  if (args.format === 'all' || args.format === 'markdown') emit('MARKDOWN', output.markdown);
  if (args.format === 'all' || args.format === 'csv') emit('CSV', output.csv);
  if (args.format === 'all' || args.format === 'json') emit('JSON', output.json);
  return 0;
}

const exitCode = await main(process.argv.slice(2));
process.exit(exitCode);
