import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { V1_FIXTURE_SOURCES } from '../scripts/v1-sources.ts';

test('V1 fixture sources cover exactly 25 entries: 24 single-commodity + 1 fisso (fastweb)', () => {
  assert.equal(V1_FIXTURE_SOURCES.length, 25);
  const ids = new Set(V1_FIXTURE_SOURCES.map((s) => s.operatore));
  assert.equal(ids.size, 24, 'duplicate operatore entries');
});

test('Playwright-flagged sources match ADR 0006 §Supported transports (Edison + WindTre + Vodafone)', () => {
  const playwrightIds = V1_FIXTURE_SOURCES.filter((s) => s.playwright)
    .map((s) => s.operatore)
    .sort();
  assert.deepEqual(playwrightIds, ['edison', 'vodafone', 'windtre']);
});

test('Luce+gas operators are pinned to luce, telco to mobile (fastweb is multi-commodity)', () => {
  const luceGas = ['enel', 'edison', 'plenitude', 'hera', 'iren', 'a2a', 'acea', 'sorgenia', 'illumia', 'engie', 'octopus', 'nen'];
  const mobileTelco = ['tim', 'windtre', 'vodafone', 'iliad', 'skywifi', 'postemobile', 'ho', 'kena', 'very', 'tiscali', 'dimensione'];
  const multiCommodityTelco: Record<string, readonly string[]> = { fastweb: ['mobile', 'fisso'] };
  for (const spec of V1_FIXTURE_SOURCES) {
    if (luceGas.includes(spec.operatore)) {
      assert.equal(spec.commodity, 'luce', `${spec.operatore} should map to luce`);
    } else if (mobileTelco.includes(spec.operatore)) {
      assert.equal(spec.commodity, 'mobile', `${spec.operatore} should map to mobile`);
    } else if (spec.operatore in multiCommodityTelco) {
      assert.ok(
        multiCommodityTelco[spec.operatore]!.includes(spec.commodity),
        `${spec.operatore} should map to one of ${multiCommodityTelco[spec.operatore]!.join('|')}`,
      );
    } else {
      assert.fail(`unknown operatore ${spec.operatore} not in v1 list`);
    }
  }
});