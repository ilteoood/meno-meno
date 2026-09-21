import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const FIXTURE_PATH = resolve(
  import.meta.dirname,
  '..',
  'fixtures',
  'enel',
  'luce.html',
);

const TIM_MOBILE_FIXTURE = resolve(
  import.meta.dirname,
  '..',
  'fixtures',
  'tim',
  'mobile.html',
);

type CliResult = { exitCode: number; stdout: string; stderr: string };

async function runCli(args: readonly string[]): Promise<CliResult> {
  const proc = spawn(
    'node',
    ['--experimental-strip-types', 'src/index.ts', ...args],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return new Promise((resolveRun, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill();
        reject(new Error(`cli timeout: ${args.join(' ')}`));
      }
    }, 10_000);
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    proc.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
    proc.on('exit', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolveRun({ exitCode: code ?? 1, stdout, stderr });
      }
    });
  });
}

function countSections(stdout: string): number {
  return (stdout.match(/^=== [A-Z]+ ===$/gm) ?? []).length;
}

test('CLI happy path (no --format) emits all three sections', async () => {
  const { exitCode, stdout } = await runCli([
    '--operatore',
    'enel',
    '--commodity',
    'luce',
    '--fixture',
    FIXTURE_PATH,
  ]);
  assert.equal(exitCode, 0, `stderr: ${''}`);
  assert.equal(countSections(stdout), 3);
  assert.match(stdout, /=== MARKDOWN ===/);
  assert.match(stdout, /=== CSV ===/);
  assert.match(stdout, /=== JSON ===/);
});

test('CLI --format markdown emits only the MARKDOWN section', async () => {
  const { exitCode, stdout } = await runCli([
    '--operatore',
    'enel',
    '--commodity',
    'luce',
    '--fixture',
    FIXTURE_PATH,
    '--format',
    'markdown',
  ]);
  assert.equal(exitCode, 0);
  assert.equal(countSections(stdout), 1);
  assert.match(stdout, /=== MARKDOWN ===/);
});

test('CLI --format csv emits only the CSV section', async () => {
  const { exitCode, stdout } = await runCli([
    '--operatore',
    'enel',
    '--commodity',
    'luce',
    '--fixture',
    FIXTURE_PATH,
    '--format',
    'csv',
  ]);
  assert.equal(exitCode, 0);
  assert.equal(countSections(stdout), 1);
  assert.match(stdout, /=== CSV ===/);
});

test('CLI --format json emits only the JSON section', async () => {
  const { exitCode, stdout } = await runCli([
    '--operatore',
    'enel',
    '--commodity',
    'luce',
    '--fixture',
    FIXTURE_PATH,
    '--format',
    'json',
  ]);
  assert.equal(exitCode, 0);
  assert.equal(countSections(stdout), 1);
  assert.match(stdout, /=== JSON ===/);
  const jsonBlock = stdout.split(/=== JSON ===\n/)[1] ?? '';
  assert.ok(jsonBlock.length > 0);
  const parsed: unknown = JSON.parse(jsonBlock);
  assert.ok(parsed && typeof parsed === 'object');
});

test('CLI no args exits 2 with usage error', async () => {
  const { exitCode, stderr } = await runCli([]);
  assert.equal(exitCode, 2);
  assert.match(stderr, /Missing --operatore or --commodity/);
});

test('CLI missing --commodity exits 1 with commodity_required', async () => {
  const { exitCode, stderr } = await runCli(['--operatore', 'enel']);
  assert.equal(exitCode, 1);
  assert.match(stderr, /commodity_required/);
});

test('CLI invalid --commodity exits 1 with commodity_required', async () => {
  const { exitCode, stderr } = await runCli([
    '--operatore',
    'enel',
    '--commodity',
    'telco',
  ]);
  assert.equal(exitCode, 1);
  assert.match(stderr, /commodity_required/);
});

test('CLI unknown --operatore exits 2 with usage error (no source registered)', async () => {
  const { exitCode, stderr } = await runCli([
    '--operatore',
    'unknown-op',
    '--commodity',
    'luce',
  ]);
  assert.equal(exitCode, 2);
  assert.match(stderr, /unknown source for unknown-op\/luce/);
});

test('CLI --operatore with valid source but no scraper registered exits 2', async () => {
  const { exitCode, stderr } = await runCli([
    '--operatore',
    'unknown-op',
    '--commodity',
    'luce',
    '--fixture',
    FIXTURE_PATH,
  ]);
  assert.equal(exitCode, 2);
  assert.match(stderr, /no scraper registered for unknown-op\/luce/);
});

test('CLI invalid --format value exits 2 with usage error', async () => {
  const { exitCode, stderr } = await runCli([
    '--operatore',
    'enel',
    '--commodity',
    'luce',
    '--format',
    'yaml',
  ]);
  assert.equal(exitCode, 2);
  assert.match(stderr, /invalid --format/);
});

test('CLI --filter requires --commodity exits 2', async () => {
  const { exitCode, stderr } = await runCli(['--filter', 'prezzo<=7']);
  assert.equal(exitCode, 2);
  assert.match(stderr, /--filter requires --commodity/);
});

test('CLI --filter invalid value exits 2', async () => {
  const { exitCode, stderr } = await runCli([
    '--commodity',
    'mobile',
    '--filter',
    'prezzo<=abc',
  ]);
  assert.equal(exitCode, 2);
  assert.match(stderr, /invalid --filter/);
});

test('CLI --filter invalid alias for commodity exits 2', async () => {
  const { exitCode, stderr } = await runCli([
    '--commodity',
    'mobile',
    '--filter',
    'costo_commercializzazione<=10',
  ]);
  assert.equal(exitCode, 2);
  assert.match(stderr, /invalid --filter/);
});

test('CLI fan-out luce aggregates all operators', async () => {
  const { exitCode, stdout } = await runCli(['--commodity', 'luce']);
  assert.equal(exitCode, 0, `stderr: ${''}`);
  assert.match(stdout, /=== MARKDOWN ===/);
  assert.match(stdout, /=== CSV ===/);
  assert.match(stdout, /=== JSON ===/);
});

test('CLI fan-out luce with filter emits filter header and only matching offers', async () => {
  const { exitCode, stdout } = await runCli([
    '--commodity',
    'luce',
    '--filter',
    'prezzo<=0.05',
  ]);
  assert.equal(exitCode, 0);
  assert.match(stdout, /## Filtro applicato: prezzo<=0.05/);
  const jsonBlock = stdout.split(/=== JSON ===\n/)[1] ?? '';
  const parsed = JSON.parse(jsonBlock) as { offerte: { singole: readonly { prezzo_effettivo_euro_kwh: number }[] } };
  for (const o of parsed.offerte.singole) {
    assert.ok(o.prezzo_effettivo_euro_kwh <= 0.05, `outlier: ${o.prezzo_effettivo_euro_kwh}`);
  }
});

test('CLI fan-out luce with no-match exits 0 + warning + skips ranking', async () => {
  const { exitCode, stdout, stderr } = await runCli([
    '--commodity',
    'luce',
    '--filter',
    'prezzo<=0.001',
  ]);
  assert.equal(exitCode, 0);
  assert.match(stderr, /0 offerte corrispondono al filtro/);
  assert.match(stdout, /## Filtro applicato: prezzo<=0.001/);
  assert.doesNotMatch(stdout, /## Trade-off per offerta top-3/);
});

test('CLI fan-out mobile with two filters applies AND across fields', async () => {
  const { exitCode, stdout } = await runCli([
    '--commodity',
    'mobile',
    '--filter',
    'prezzo<=20',
    '--filter',
    'gb>=50',
  ]);
  assert.equal(exitCode, 0);
  assert.match(stdout, /## Filtro applicato: prezzo<=20 & gb>=50/);
  const jsonBlock = stdout.split(/=== JSON ===\n/)[1] ?? '';
  const parsed = JSON.parse(jsonBlock) as { offerte: { singole: readonly { prezzo_effettivo_euro_mese: number; gb: number }[] } };
  for (const o of parsed.offerte.singole) {
    assert.ok(o.prezzo_effettivo_euro_mese <= 20, `prezzo outlier: ${o.prezzo_effettivo_euro_mese}`);
    assert.ok(o.gb >= 50 || o.gb === -1, `gb outlier: ${o.gb}`);
  }
});

test('CLI fan-out mobile with OR pipe includes illimitati (-1)', async () => {
  const { exitCode, stdout } = await runCli([
    '--commodity',
    'mobile',
    '--filter',
    'gb>=100 | gb=-1',
  ]);
  assert.equal(exitCode, 0);
  assert.match(stdout, /## Filtro applicato: gb>=100 \| gb=-1/);
  const jsonBlock = stdout.split(/=== JSON ===\n/)[1] ?? '';
  const parsed = JSON.parse(jsonBlock) as { offerte: { singole: readonly { gb: number }[] } };
  assert.ok(parsed.offerte.singole.length > 0, 'expected at least one mobile offer');
  for (const o of parsed.offerte.singole) {
    assert.ok(o.gb >= 100 || o.gb === -1, `gb outlier: ${o.gb}`);
  }
});

test('CLI backward compat: --operatore path is fan-out-immune (--filter ignored in single-op mode per ADR 0013 ticket #173)', async () => {
  const { exitCode, stdout, stderr } = await runCli([
    '--operatore',
    'tim',
    '--commodity',
    'mobile',
    '--fixture',
    TIM_MOBILE_FIXTURE,
    '--filter',
    'prezzo<=7',
  ]);
  assert.equal(exitCode, 0, `stderr: ${stderr}`);
  assert.match(stdout, /=== MARKDOWN ===/);
  assert.doesNotMatch(stdout, /## Filtro applicato/);
});