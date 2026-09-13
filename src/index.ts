import { resolve } from 'node:path';
import type { Commodity } from './types/offerta.ts';
import { createScraper } from './scrapers/index.ts';
import type { ScrapeSource } from './scrapers/types.ts';
import { aggregate } from './aggregator.ts';
import { format } from './formatters/index.ts';

const VALID_COMMODITIES: readonly Commodity[] = ['luce', 'gas', 'mobile', 'fisso'];

function parseArgs(argv: readonly string[]): {
  operatore: string | null;
  commodity: Commodity | null;
  fixture: string | null;
  format: 'all' | 'markdown' | 'csv' | 'json';
} {
  let operatore: string | null = null;
  let commodity: Commodity | null = null;
  let fixture: string | null = null;
  let fmt: 'all' | 'markdown' | 'csv' | 'json' = 'all';

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
      case '--format':
        fmt = (argv[++i] ?? 'all') as 'all' | 'markdown' | 'csv' | 'json';
        break;
    }
  }
  return { operatore, commodity, fixture, format: fmt };
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
): ScrapeSource {
  if (fixture) {
    return { kind: 'fixture', path: resolve(fixture) };
  }
  if (operatore === 'enel' && commodity === 'luce') {
    return { kind: 'live', url: 'https://www.enel.it/it-it/luce-gas/offerte-luce' };
  }
  throw new Error(`unknown live source for ${operatore}/${commodity}; pass --fixture PATH`);
}

function emit(label: string, content: string): void {
  process.stdout.write(`\n=== ${label} ===\n${content}`);
}

async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  if (!args.operatore) {
    process.stderr.write('Missing --operatore\n');
    return 2;
  }
  const commodity = validateCommodity(args.commodity);
  const source = buildSource(args.operatore, commodity, args.fixture);

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
