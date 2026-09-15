import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { EdisonLuceScraper } from '../src/scrapers/edison.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'edison', 'luce.html');

test('EdisonLuceScraper parses fixture HTML into offerte', async () => {
  const scraper = new EdisonLuceScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.offerte.length, 3);
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'luce');
    assert.equal(o.operatore_id, 'edison');
    assert.ok(typeof o.codice_offerta === 'string' && o.codice_offerta.length > 0);
    assert.ok(o.prezzo_effettivo_euro_kwh > 0);
    assert.ok(o.quota_fissa_euro_anno > 0);
    assert.ok(['fisso', 'PUN'].includes(o.meccanismo_prezzo.tipo));
  }

  const fix = result.offerte.find((o) => o.nome_commerciale === 'Edison Energia Fix Luce');
  assert.ok(fix, 'expected Edison Energia Fix Luce offer');
  assert.equal(fix!.meccanismo_prezzo.tipo, 'fisso');
  assert.equal(fix!.prezzo_effettivo_euro_kwh, 0.13);
  assert.equal(fix!.quota_fissa_euro_anno, 96);

  const variabile = result.offerte.find((o) => o.nome_commerciale === 'Edison Energia Variabile Luce');
  assert.ok(variabile, 'expected Edison Energia Variabile Luce offer');
  assert.equal(variabile!.meccanismo_prezzo.tipo, 'PUN');
});

test('EdisonLuceScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new EdisonLuceScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});
