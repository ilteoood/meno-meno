import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { TimMobileScraper } from '../src/scrapers/tim.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'tim', 'mobile.html');

test('TimMobileScraper parses fixture HTML into offerte mobile', async () => {
  const scraper = new TimMobileScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.offerte.length, 3);
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'mobile');
    assert.equal(o.operatore_id, 'tim');
    assert.ok(typeof o.codice_offerta === 'string' && o.codice_offerta.length > 0);
    assert.ok(typeof o.prezzo_effettivo_euro_mese === 'number' && o.prezzo_effettivo_euro_mese > 0);
    assert.ok(typeof o.gb === 'number');
    assert.ok(typeof o.minuti === 'number');
    assert.ok(['eSIM', 'fisica', 'entrambe'].includes(o.tipo_sim));
    assert.ok(['4G', '5G', '5G+'].includes(o.tecnologia));
    assert.ok(typeof o.velocita_mbps === 'number' && o.velocita_mbps > 0);
    assert.equal(
      (o as { quota_fissa_euro_anno?: unknown }).quota_fissa_euro_anno,
      undefined,
      'mobile offerte must not carry luce/gas quota_fissa_euro_anno',
    );
  }

  const power = result.offerte.find((o) => o.nome_commerciale === 'TIM Power Mobile');
  assert.ok(power, 'expected TIM Power Mobile offer');
  assert.equal(power!.prezzo_effettivo_euro_mese, 9.99);
  assert.equal(power!.gb, 100);
  assert.equal(power!.minuti, -1);
  assert.equal(power!.tecnologia, '5G');
  assert.equal(power!.velocita_mbps, 1000);

  const young = result.offerte.find((o) => o.nome_commerciale === 'TIM Young Mobile');
  assert.ok(young, 'expected TIM Young Mobile offer');
  assert.equal(young!.prezzo_effettivo_euro_mese, 6.99);
  assert.equal(young!.gb, 50);
  assert.equal(young!.minuti, -1);
  assert.equal(young!.tecnologia, '5G');
  assert.equal(young!.velocita_mbps, 1000);

  const base = result.offerte.find((o) => o.nome_commerciale === 'TIM Base Mobile');
  assert.ok(base, 'expected TIM Base Mobile offer');
  assert.equal(base!.prezzo_effettivo_euro_mese, 4.99);
  assert.equal(base!.gb, 30);
  assert.equal(base!.minuti, -1);
  assert.equal(base!.tecnologia, '4G');
  assert.equal(base!.velocita_mbps, 150);
});

test('TimMobileScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new TimMobileScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});