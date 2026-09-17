import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { V1_FIXTURE_SOURCES } from '../scripts/v1-sources.ts';

test('V1 fixture sources cover exactly 33 entries: 17 single-commodity (12 luce + 5 telco mobile) + 14 multi-commodity (fastweb, tim, vodafone, windtre, iliad, skywifi, tiscali — each mobile+fisso) + 2 FWA puro (eolo, linkem)', () => {
  assert.equal(V1_FIXTURE_SOURCES.length, 33);
  const ids = new Set(V1_FIXTURE_SOURCES.map((s) => s.operatore));
  assert.equal(ids.size, 26, 'duplicate operatore entries');
});

test('Playwright-flagged sources match ADR 0006 §Supported transports (Edison + WindTre + Vodafone mobile+fisso)', () => {
  const playwrightIds = V1_FIXTURE_SOURCES.filter((s) => s.playwright)
    .map((s) => `${s.operatore}/${s.commodity}`)
    .sort();
  assert.deepEqual(playwrightIds, ['edison/luce', 'linkem/fisso', 'vodafone/fisso', 'vodafone/mobile', 'windtre/fisso', 'windtre/mobile']);
});

test('Luce+gas operators are pinned to luce, telco to mobile (fastweb + tim + vodafone + windtre + iliad + skywifi + tiscali are multi-commodity; eolo is FWA puro fisso)', () => {
  const luceGas = ['enel', 'edison', 'plenitude', 'hera', 'iren', 'a2a', 'acea', 'sorgenia', 'illumia', 'engie', 'octopus', 'nen'];
  const mobileTelco = ['postemobile', 'ho', 'kena', 'very', 'dimensione'];
  const multiCommodityTelco: Record<string, readonly string[]> = { fastweb: ['mobile', 'fisso'], tim: ['mobile', 'fisso'], vodafone: ['mobile', 'fisso'], windtre: ['mobile', 'fisso'], iliad: ['mobile', 'fisso'], skywifi: ['mobile', 'fisso'], tiscali: ['mobile', 'fisso'] };
  const fwaPuro = ['eolo', 'linkem'];
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
    } else if (fwaPuro.includes(spec.operatore)) {
      assert.equal(spec.commodity, 'fisso', `${spec.operatore} should map to fisso (FWA puro)`);
    } else {
      assert.fail(`unknown operatore ${spec.operatore} not in v1 list (luceGas/mobileTelco/multiCommodityTelco/fwaPuro)`);
    }
  }
});