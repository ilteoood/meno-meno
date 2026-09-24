import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Commodity, Offerta, OffertaBundle } from '../src/types/offerta.ts';
import { format } from '../src/formatters/index.ts';
import { createScraper } from '../src/scrapers/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FIXTURES_DIR = resolve(ROOT, 'fixtures');
const EXAMPLES_DIR = resolve(ROOT, 'examples');
const BUNDLES_FIXTURE = resolve(FIXTURES_DIR, 'bundles', 'luce-gas.json');
const SCRAPED_AT = '2026-09-13T10:00:00.000Z';

interface ExampleSpec {
  readonly operatore: string;
  readonly commodity: Commodity;
}

// ponytail: a handful of operators (acea, nen) ship fixtures as JSON
// rather than HTML because their scrapers speak JSON APIs instead of scraping markup.
const JSON_FIXTURES: ReadonlySet<string> = new Set(['acea', 'nen']);

async function pickFixture(operatore: string, commodity: Commodity): Promise<string | null> {
  const dir = resolve(FIXTURES_DIR, operatore);
  const ext = JSON_FIXTURES.has(operatore) ? 'json' : 'html';
  const candidate = resolve(dir, `${commodity}.${ext}`);
  try {
    const s = await stat(candidate);
    return s.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

async function writeExample(
  base: string,
  content: { markdown: string; csv: string; json: string },
): Promise<void> {
  await mkdir(EXAMPLES_DIR, { recursive: true });
  await writeFile(resolve(EXAMPLES_DIR, `${base}.md`), content.markdown, 'utf8');
  await writeFile(resolve(EXAMPLES_DIR, `${base}.csv`), content.csv, 'utf8');
  await writeFile(resolve(EXAMPLES_DIR, `${base}.json`), content.json, 'utf8');
}

async function renderExample(spec: ExampleSpec): Promise<number> {
  const fixture = await pickFixture(spec.operatore, spec.commodity);
  if (!fixture) throw new Error(`no fixture for ${spec.operatore}/${spec.commodity}`);
  const scraper = createScraper(spec.operatore, spec.commodity, { kind: 'fixture', path: fixture });
  if (!scraper) throw new Error(`no scraper for ${spec.operatore}/${spec.commodity}`);
  const result = await scraper.scrape();
  if (!result.ok) throw new Error(`scrape failed for ${spec.operatore}/${spec.commodity}: ${result.error}`);
  const offerte: readonly Offerta[] = result.offerte.map((o) => ({ ...o, scraped_at: SCRAPED_AT }));
  const base = `${spec.operatore}-${spec.commodity}`;
  const output = format({
    commodity: spec.commodity,
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample(base, output);
  process.stdout.write(`rendered examples/${base}.{md,csv,json} (${offerte.length} offerte)\n`);
  return offerte.length;
}

async function renderBundleExample(): Promise<void> {
  const raw = await readFile(BUNDLES_FIXTURE, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('bundles fixture must be an array');
  const bundle = parsed as readonly OffertaBundle[];
  const output = format({
    commodity: 'luce',
    scrapedAt: SCRAPED_AT,
    offerte: [],
    bundle,
    warnings: [],
    sourceCount: { ok: 0, total: 0 },
  });
  await writeExample('luce-gas-bundle-proof', output);
  process.stdout.write(`rendered examples/luce-gas-bundle-proof.{md,csv,json} (${bundle.length} bundle)\n`);
}

const LUCE_OPS: readonly ExampleSpec[] = [
  { operatore: 'enel', commodity: 'luce' },
  { operatore: 'edison', commodity: 'luce' },
  { operatore: 'plenitude', commodity: 'luce' },
  { operatore: 'a2a', commodity: 'luce' },
  { operatore: 'iren', commodity: 'luce' },
  { operatore: 'hera', commodity: 'luce' },
  { operatore: 'acea', commodity: 'luce' },
  { operatore: 'sorgenia', commodity: 'luce' },
  { operatore: 'illumia', commodity: 'luce' },
  { operatore: 'engie', commodity: 'luce' },
  { operatore: 'octopus', commodity: 'luce' },
  { operatore: 'nen', commodity: 'luce' },
];

const MOBILE_OPS: readonly ExampleSpec[] = [
  { operatore: 'tim', commodity: 'mobile' },
  { operatore: 'vodafone', commodity: 'mobile' },
  { operatore: 'iliad', commodity: 'mobile' },
  { operatore: 'fastweb', commodity: 'mobile' },
  { operatore: 'skywifi', commodity: 'mobile' },
  { operatore: 'postemobile', commodity: 'mobile' },
  { operatore: 'ho', commodity: 'mobile' },
  { operatore: 'kena', commodity: 'mobile' },
  { operatore: 'very', commodity: 'mobile' },
  { operatore: 'tiscali', commodity: 'mobile' },
  { operatore: 'dimensione', commodity: 'mobile' },
  { operatore: 'windtre', commodity: 'mobile' },
];

const FISSO_OPS: readonly ExampleSpec[] = [
  { operatore: 'tim', commodity: 'fisso' },
  { operatore: 'vodafone', commodity: 'fisso' },
  { operatore: 'iliad', commodity: 'fisso' },
  { operatore: 'skywifi', commodity: 'fisso' },
  { operatore: 'tiscali', commodity: 'fisso' },
  { operatore: 'windtre', commodity: 'fisso' },
  { operatore: 'eolo', commodity: 'fisso' },
  { operatore: 'linkem', commodity: 'fisso' },
];

async function safeRender(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    process.stderr.write(`skip ${label}: ${(err as Error).message}\n`);
  }
}

async function main(): Promise<void> {
  for (const spec of LUCE_OPS) {
    await safeRender(`${spec.operatore}-${spec.commodity}`, () => renderExample(spec).then(() => undefined));
  }
  for (const spec of MOBILE_OPS) {
    await safeRender(`${spec.operatore}-${spec.commodity}`, () => renderExample(spec).then(() => undefined));
  }
  for (const spec of FISSO_OPS) {
    await safeRender(`${spec.operatore}-${spec.commodity}`, () => renderExample(spec).then(() => undefined));
  }
  await safeRender('luce-gas-bundle', renderBundleExample);
}

void main();
