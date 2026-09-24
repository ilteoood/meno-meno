import { resolve } from 'node:path';
import type { Commodity } from './types/offerta.ts';
import { createScraper, listOperators } from './scrapers/index.ts';
import type { Scraper, ScrapeSource } from './scrapers/types.ts';
import { aggregate } from './aggregator.ts';
import { format } from './formatters/index.ts';
import { filterOfferte, validateFilter, type Constraint } from './filter/index.ts';
import { V1_FIXTURE_SOURCES } from '../scripts/v1-sources.ts';

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
  filters: readonly string[];
};

function parseArgs(argv: readonly string[]): ParsedArgs {
  let operatore: string | null = null;
  let commodity: Commodity | null = null;
  let fixture: string | null = null;
  let live = false;
  let rawFormat: string | null = null;
  const filters: string[] = [];

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
      case '--filter':
        filters.push(argv[++i] ?? '');
        break;
    }
  }
  return { operatore, commodity, fixture, live, format: parseFormat(rawFormat), filters };
}

function validateCommodity(value: string | null): Commodity {
  if (value === null || !VALID_COMMODITIES.includes(value as Commodity)) {
    throw new Error(
      `commodity_required: specifica una commodity: ${VALID_COMMODITIES.join(', ')}.`,
    );
  }
  return value as Commodity;
}

function liveUrl(operatore: string, commodity: Commodity): string | null {
  const src = V1_FIXTURE_SOURCES.find((s) => s.operatore === operatore && s.commodity === commodity);
  return src?.url ?? null;
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
  if (live) {
    const url = liveUrl(operatore, commodity);
    if (url) return { kind: 'live', url };
  }
  throw new Error(`unknown source for ${operatore}/${commodity}; pass --fixture PATH or --live (live source required)`);
}

function buildAllSources(
  commodity: Commodity,
  live: boolean,
  fixture: string | null,
): readonly ScrapeSource[] {
  const sources: ScrapeSource[] = [];
  for (const op of listOperators(commodity)) {
    if (fixture) {
      sources.push({ kind: 'fixture', path: resolve(fixture) });
    } else if (live) {
      const url = liveUrl(op, commodity);
      if (url) sources.push({ kind: 'live', url });
    } else {
      sources.push({ kind: 'fixture', path: resolve(`fixtures/${op}/${commodity}.html`) });
    }
  }
  return sources;
}

function emit(label: string, content: string): void {
  process.stdout.write(`\n=== ${label} ===\n${content}`);
}

function parseAndValidateFilters(
  commodity: Commodity,
  rawFilters: readonly string[],
): readonly Constraint[] | null {
  if (rawFilters.length === 0) return [];
  const all: Constraint[] = [];
  for (const expr of rawFilters) {
    const r = validateFilter(commodity, expr);
    if (!r.ok) {
      process.stderr.write(`invalid --filter "${expr}": ${r.error}\n`);
      return null;
    }
    for (const c of r.constraints) all.push(c);
  }
  return all;
}

function emitFormats(args: { format: OutputFormat }, output: { markdown: string; csv: string; json: string }): void {
  if (args.format === 'all' || args.format === 'markdown') emit('MARKDOWN', output.markdown);
  if (args.format === 'all' || args.format === 'csv') emit('CSV', output.csv);
  if (args.format === 'all' || args.format === 'json') emit('JSON', output.json);
}

async function runSingle(args: ParsedArgs, commodity: Commodity): Promise<number> {
  let source: ScrapeSource;
  try {
    source = buildSource(args.operatore!, commodity, args.fixture, args.live);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  const scraper = createScraper(args.operatore!, commodity, source);
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

  emitFormats(args, output);
  return 0;
}

async function runFanOut(
  args: ParsedArgs,
  commodity: Commodity,
  constraints: readonly Constraint[],
): Promise<number> {
  const sources = buildAllSources(commodity, args.live, args.fixture);
  if (sources.length === 0) {
    process.stderr.write(`fan-out: no operators registered for commodity "${commodity}"\n`);
    return 2;
  }

  const ops = listOperators(commodity);
  const scrapers: Scraper[] = [];
  for (let i = 0; i < sources.length; i++) {
    const scraper = createScraper(ops[i]!, commodity, sources[i]!);
    if (scraper) scrapers.push(scraper);
  }

  const result = await aggregate({ commodity, scrapers });
  if (!result.ok) {
    process.stderr.write(`aggregate failed: ${result.error}\n`);
    return 1;
  }

  const filtered = filterOfferte({ commodity, offerte: result.offerte, constraints });
  const filterExpression = args.filters.length > 0 ? args.filters.join(' & ') : undefined;

  if (args.filters.length > 0 && filtered.length === 0) {
    process.stderr.write(`0 offerte corrispondono al filtro\n`);
  }

  const ranked = filtered.length > 0;
  const okSources = sources.length - result.warnings.length;
  const output = format({
    commodity,
    scrapedAt: result.scrapedAt,
    offerte: filtered,
    bundle: result.bundle,
    warnings: result.warnings,
    sourceCount: { ok: okSources, total: sources.length },
    filterExpression,
    ranked,
  });

  emitFormats(args, output);
  return 0;
}

async function main(argv: readonly string[]): Promise<number> {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  if (args.filters.length > 0 && args.commodity === null) {
    process.stderr.write('--filter requires --commodity\n');
    return 2;
  }

  if (!args.operatore && !args.commodity) {
    process.stderr.write('Missing --operatore or --commodity\n');
    return 2;
  }

  let commodity: Commodity;
  try {
    commodity = validateCommodity(args.commodity);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }

  if (args.operatore) {
    return runSingle(args, commodity);
  }

  const constraints = parseAndValidateFilters(commodity, args.filters);
  if (constraints === null) return 2;
  return runFanOut(args, commodity, constraints);
}

const exitCode = await main(process.argv.slice(2));
process.exit(exitCode);
