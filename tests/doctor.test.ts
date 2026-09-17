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
  assert.equal(report.rows.length, 29);
  for (const src of V1_FIXTURE_SOURCES) {
    const row = report.rows.find(
      (r) => r.operatore_id === src.operatore && r.commodity === src.commodity,
    );
    assert.ok(row, `missing row for ${src.operatore}/${src.commodity}`);
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
  assert.equal(report.rows.length, 2);
  for (const row of report.rows) {
    assert.equal(row.parse_ok, true, `${row.operatore_id}/${row.commodity} should parse OK`);
    assert.ok(row.offerte_count > 0, `expected parsed offerte > 0 for ${row.operatore_id}/${row.commodity}, got ${row.offerte_count}`);
    assert.equal(row.note, 'OK', `${row.operatore_id}/${row.commodity} note`);
  }
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

test('doctor CLI exits 1 for an unregistered operator (no live network needed)', async () => {
  const proc = spawn(
    'node',
    ['--experimental-strip-types', 'src/cli/doctor-cli.ts', '--operatore', 'fakeoperator'],
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
  assert.equal(exitCode, 1);
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

test('runDoctor default mode resolves each row against its per-operator <op>/<commodity>.html fixture', async () => {
  const report = await runDoctor();
  assert.equal(report.rows.length, 29);
  const expectedDegraded = new Set(['acea', 'nen']);
  let parsedOkCount = 0;
  for (const row of report.rows) {
    assert.notEqual(row.note, 'scraper not yet registered for v1', `${row.operatore_id}/${row.commodity} not registered`);
    if (expectedDegraded.has(row.operatore_id)) {
      assert.equal(row.parse_ok, false, `${row.operatore_id}/${row.commodity} should be degraded in default fixture mode (acea/nen consume JSON fixtures, not <commodity>.html)`);
      continue;
    }
    assert.equal(row.http_status, 200);
    assert.equal(row.parse_ok, true);
    assert.ok(row.offerte_count > 0, `${row.operatore_id}/${row.commodity} parsed 0 offers from its fixture`);
    parsedOkCount += 1;
  }
  assert.equal(parsedOkCount, 27);
  assert.equal(report.ok, false);
});

test('runDoctor({ live: true, operatore: "enel" }) parses the live v1 URL', async () => {
  const enelLiveUrl = V1_FIXTURE_SOURCES.find((s) => s.operatore === 'enel')!.url;
  const report = await runDoctor({ live: true, operatore: 'enel', timeoutMs: 5_000 });
  assert.equal(report.rows.length, 1);
  const row = report.rows[0]!;
  if (row.note.startsWith('timeout')) return;
  assert.equal(row.http_status, 200);
  assert.equal(row.parse_ok, true);
  assert.ok(row.offerte_count > 0);
  assert.equal(enelLiveUrl, 'https://www.enel.it/it-it/offerte-luce');
});

test('runDoctor({ operatore: "fakeoperator" }) yields zero rows and ok=false', async () => {
  const report = await runDoctor({ operatore: 'fakeoperator' });
  assert.equal(report.rows.length, 0);
  assert.equal(report.ok, false);
});

test('runDoctor({ source: ... }) keeps the documented richer DoctorRow schema', async () => {
  const report = await runDoctor({ source: enelFixture() });
  const row = report.rows[0]!;
  for (const key of ['operatore_id', 'commodity', 'http_status', 'offerte_count', 'parse_ok', 'note'] as const) {
    assert.ok(key in row, `DoctorRow missing field: ${key}`);
  }
});

test('doctor CLI --live spawns runDoctor in live mode for a single operator', async () => {
  const proc = spawn(
    'node',
    ['--experimental-strip-types', 'src/cli/doctor-cli.ts', '--operatore', 'enel', '--live', '--json'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stdout = '';
  proc.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString('utf8');
  });
  const exitCode = await new Promise<number>((resolveRun, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill();
        reject(new Error('cli --live spawn timeout'));
      }
    }, 20_000);
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
  const payload = JSON.parse(stdout) as {
    ok: boolean;
    rows: { operatore_id: string; offerte_count: number; parse_ok: boolean; note: string }[];
  };
  assert.equal(payload.rows.length, 1);
  assert.equal(payload.rows[0]!.operatore_id, 'enel');
  if (payload.rows[0]!.note.startsWith('timeout')) {
    assert.equal(exitCode, 1);
    return;
  }
  assert.equal(payload.rows[0]!.parse_ok, true);
  assert.ok(payload.rows[0]!.offerte_count > 0);
  assert.equal(payload.ok, true);
  assert.equal(exitCode, 0);
});
