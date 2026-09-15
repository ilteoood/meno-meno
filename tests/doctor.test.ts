import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { runDoctor, doctorToMarkdown } from '../src/doctor.ts';
import { V1_FIXTURE_SOURCES } from '../scripts/v1-sources.ts';

const enelFixture = (): { kind: 'fixture'; path: string } => ({
  kind: 'fixture',
  path: resolve(import.meta.dirname, '..', 'fixtures', 'enel', 'luce.html'),
});

test('runDoctor returns one row per v1 operator+commodity', async () => {
  const report = await runDoctor({ source: enelFixture() });
  assert.equal(report.rows.length, V1_FIXTURE_SOURCES.length);
  assert.equal(report.rows.length, 24);
  for (const src of V1_FIXTURE_SOURCES) {
    const row = report.rows.find((r) => r.operatore_id === src.operatore);
    assert.ok(row, `missing row for ${src.operatore}`);
    assert.equal(row!.commodity, src.commodity);
  }
});

test('runDoctor({ operatore: "enel" }) returns the enel/luce row only', async () => {
  const report = await runDoctor({ operatore: 'enel', source: enelFixture() });
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0]!.operatore_id, 'enel');
  assert.equal(report.rows[0]!.commodity, 'luce');
});

test('registered windtre operator parses the windtre fixture and reports OK', async () => {
  const windtreFixture = (): { kind: 'fixture'; path: string } => ({
    kind: 'fixture',
    path: resolve(import.meta.dirname, '..', 'fixtures', 'windtre', 'mobile.html'),
  });
  const report = await runDoctor({ operatore: 'windtre', source: windtreFixture() });
  assert.equal(report.rows.length, 1);
  const row = report.rows[0]!;
  assert.equal(row.parse_ok, true);
  assert.ok(row.offerte_count > 0, `expected parsed offerte > 0, got ${row.offerte_count}`);
  assert.equal(row.note, 'OK');
});

test('runDoctor parses the enel fixture and marks parse_ok=true', async () => {
  const report = await runDoctor({ operatore: 'enel', source: enelFixture() });
  assert.equal(report.rows.length, 1);
  const row = report.rows[0]!;
  assert.equal(row.http_status, 200);
  assert.equal(row.parse_ok, true);
  assert.ok(row.offerte_count > 0, `expected parsed offerte > 0, got ${row.offerte_count}`);
  assert.equal(row.note, 'OK');
});

test('doctor CLI exits 0 for an unregistered operator (no live network needed)', async () => {
  const proc = spawn(
    'node',
    ['--experimental-strip-types', 'src/cli/doctor-cli.ts', '--operatore', 'edison'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const exitCode = await new Promise<number>((resolveRun, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill();
        reject(new Error('cli spawn timeout'));
      }
    }, 10_000);
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
        resolveRun(code ?? 1);
      }
    });
  });
  assert.equal(exitCode, 0);
});

test('doctor CLI exits 2 on an unknown flag', async () => {
  const proc = spawn(
    'node',
    ['--experimental-strip-types', 'src/cli/doctor-cli.ts', '--bogus'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const exitCode = await new Promise<number>((resolveRun) => {
    proc.on('exit', (code) => resolveRun(code ?? 1));
  });
  assert.equal(exitCode, 2);
});

test('markdown report header carries the operator table', async () => {
  const report = await runDoctor({ source: enelFixture() });
  const md = doctorToMarkdown(report);
  assert.match(md, /\|\s*Operatore\s*\|\s*Commodity\s*\|\s*HTTP\s*\|\s*Offerte\s*\|\s*Parse\s*\|\s*Note\s*\|/);
  assert.match(md, /\|\s*enel\s*\|\s*luce\s*\|/);
  assert.match(md, /\|\s*edison\s*\|\s*luce\s*\|/);
});