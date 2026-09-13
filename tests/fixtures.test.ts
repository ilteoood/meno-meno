import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { V1_FIXTURE_SOURCES } from '../scripts/v1-sources.ts';

test('V1 fixture sources cover exactly the 24 v1 operators from G1', () => {
  assert.equal(V1_FIXTURE_SOURCES.length, 24);
  const ids = new Set(V1_FIXTURE_SOURCES.map((s) => s.operatore));
  assert.equal(ids.size, 24, 'duplicate operatore entries');
});

test('Playwright-flagged sources match ADR 0004 (Edison + WindTre)', () => {
  const playwrightIds = V1_FIXTURE_SOURCES.filter((s) => s.playwright)
    .map((s) => s.operatore)
    .sort();
  assert.deepEqual(playwrightIds, ['edison', 'windtre']);
});

test('Luce+gas operators are pinned to luce commodity, telco to mobile', () => {
  const luceGas = ['enel', 'edison', 'plenitude', 'hera', 'iren', 'a2a', 'acea', 'sorgenia', 'illumia', 'engie', 'octopus', 'nen'];
  const telco = ['tim', 'windtre', 'vodafone', 'iliad', 'fastweb', 'skywifi', 'postemobile', 'ho', 'kena', 'very', 'tiscali', 'dimensione'];
  for (const spec of V1_FIXTURE_SOURCES) {
    if (luceGas.includes(spec.operatore)) {
      assert.equal(spec.commodity, 'luce', `${spec.operatore} should map to luce`);
    } else if (telco.includes(spec.operatore)) {
      assert.equal(spec.commodity, 'mobile', `${spec.operatore} should map to mobile`);
    } else {
      assert.fail(`unknown operatore ${spec.operatore} not in G1 list`);
    }
  }
});