import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { PlenitudeLuceScraper } from '../src/scrapers/plenitude.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'plenitude', 'luce.html');

test('PlenitudeLuceScraper parses fixture HTML into offerte', async () => {
  const scraper = new PlenitudeLuceScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.offerte.length, 3);
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'luce');
    assert.equal(o.operatore_id, 'plenitude');
    assert.ok(typeof o.codice_offerta === 'string' && o.codice_offerta.length > 0);
    assert.ok(o.prezzo_effettivo_euro_kwh > 0);
    assert.ok(o.quota_fissa_euro_anno > 0);
    assert.ok(['fisso', 'PUN'].includes(o.meccanismo_prezzo.tipo));
  }

  const flex = result.offerte.find((o) => o.nome_commerciale === 'Plenitude Flex Luce');
  assert.ok(flex, 'expected Plenitude Flex Luce offer');
  assert.equal(flex!.meccanismo_prezzo.tipo, 'PUN');
  assert.equal(flex!.prezzo_effettivo_euro_kwh, 0.14);
  assert.equal(flex!.quota_fissa_euro_anno, 96);
});

test('PlenitudeLuceScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new PlenitudeLuceScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});