import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { V1_FIXTURE_SOURCES } from './v1-sources.ts';

const pexecFile = promisify(execFile);

const SCRAPER_PATH_REGEX = /^src\/scrapers\/([^/]+)\.ts$/;
const FIXTURE_PATH_REGEX = /^fixtures\/([^/]+)\/[^/]+\.html$/;

export function extractAffectedOperators(files: readonly string[]): Set<string> {
  const ids = new Set<string>();
  for (const file of files) {
    const scraperMatch = SCRAPER_PATH_REGEX.exec(file);
    if (scraperMatch) {
      ids.add(scraperMatch[1]!);
      continue;
    }
    const fixtureMatch = FIXTURE_PATH_REGEX.exec(file);
    if (fixtureMatch) {
      ids.add(fixtureMatch[1]!);
    }
  }
  return ids;
}

function lookupCommodity(operatorId: string): string | null {
  const source = V1_FIXTURE_SOURCES.find((s) => s.operatore === operatorId);
  return source ? source.commodity : null;
}

function runLive(operatorId: string, commodity: string): Promise<number> {
  return new Promise((resolveRun, reject) => {
    const proc = spawn(
      'node',
      [
        '--experimental-strip-types',
        'src/index.ts',
        '--operatore', operatorId,
        '--commodity', commodity,
        '--live',
      ],
      { stdio: 'inherit' },
    );
    proc.on('error', reject);
    proc.on('exit', (code) => resolveRun(code ?? 1));
  });
}

async function getPrFiles(prNumber: string): Promise<readonly string[] | null> {
  try {
    const { stdout } = await pexecFile('gh', [
      'pr', 'view', prNumber, '--json', 'files', '--jq', '.files[].path',
    ]);
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch (err) {
    process.stderr.write(`gh pr view failed: ${err instanceof Error ? err.message : String(err)}\n`);
    return null;
  }
}

async function main(): Promise<void> {
  const prNumber = process.env.CI_PR_NUMBER ?? '';
  if (!prNumber) {
    process.stderr.write('CI_PR_NUMBER env var is required (e.g. export CI_PR_NUMBER=42)\n');
    process.exit(2);
  }

  const files = await getPrFiles(prNumber);
  if (files === null) {
    process.exit(1);
  }

  const operators = extractAffectedOperators(files);
  if (operators.size === 0) {
    process.stdout.write('ci-live-gate: no scraper/fixture files touched, skipping\n');
    return;
  }

  const sortedOperators = [...operators].sort();
  process.stdout.write(`ci-live-gate: affected operators from PR ${prNumber}: ${sortedOperators.join(', ')}\n`);

  let anyFailed = false;
  for (const id of sortedOperators) {
    const commodity = lookupCommodity(id);
    if (commodity === null) {
      process.stdout.write(`ci-live-gate: skip ${id} (not in v1 operator registry)\n`);
      continue;
    }
    process.stdout.write(`\n--- ci-live-gate: ${id}/${commodity} ---\n`);
    const exitCode = await runLive(id, commodity);
    if (exitCode !== 0) {
      process.stderr.write(`ci-live-gate: FAILED ${id}/${commodity} (exit ${exitCode})\n`);
      anyFailed = true;
    }
  }

  if (anyFailed) {
    process.stderr.write('ci-live-gate: at least one operator failed --live run\n');
    process.exit(1);
  }
  process.stdout.write('\nci-live-gate: all affected operators passed\n');
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  void main();
}
