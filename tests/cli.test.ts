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

test('CLI missing --operatore exits 2 with usage error', async () => {
  const { exitCode, stderr } = await runCli(['--commodity', 'luce']);
  assert.equal(exitCode, 2);
  assert.match(stderr, /Missing --operatore/);
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
    'edison',
    '--commodity',
    'luce',
  ]);
  assert.equal(exitCode, 2);
  assert.match(stderr, /unknown source for edison\/luce/);
});

test('CLI --operatore with valid source but no scraper registered exits 2', async () => {
  const { exitCode, stderr } = await runCli([
    '--operatore',
    'edison',
    '--commodity',
    'luce',
    '--fixture',
    FIXTURE_PATH,
  ]);
  assert.equal(exitCode, 2);
  assert.match(stderr, /no scraper registered for edison\/luce/);
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