import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { IliadMobileScraper } from '../src/scrapers/iliad.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'iliad', 'mobile.html');

test('IliadMobileScraper parses fixture HTML into offerte mobile', async () => {
  const scraper = new IliadMobileScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.offerte.length, 3);
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'mobile');
    assert.equal(o.operatore_id, 'iliad');
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

  const iliad150 = result.offerte.find((o) => o.nome_commerciale === 'Iliad 150');
  assert.ok(iliad150, 'expected Iliad 150 offer');
  assert.equal(iliad150!.prezzo_effettivo_euro_mese, 9.99);
  assert.equal(iliad150!.gb, 150);
  assert.equal(iliad150!.minuti, -1);
  assert.equal(iliad150!.tecnologia, '5G');
  assert.equal(iliad150!.velocita_mbps, 1000);

  const iliad100 = result.offerte.find((o) => o.nome_commerciale === 'Iliad 100');
  assert.ok(iliad100, 'expected Iliad 100 offer');
  assert.equal(iliad100!.prezzo_effettivo_euro_mese, 7.99);
  assert.equal(iliad100!.gb, 100);
  assert.equal(iliad100!.minuti, -1);
  assert.equal(iliad100!.tecnologia, '5G');
  assert.equal(iliad100!.velocita_mbps, 1000);

  const iliadFlash = result.offerte.find((o) => o.nome_commerciale === 'Iliad Flash 50');
  assert.ok(iliadFlash, 'expected Iliad Flash 50 offer');
  assert.equal(iliadFlash!.prezzo_effettivo_euro_mese, 4.99);
  assert.equal(iliadFlash!.gb, 50);
  assert.equal(iliadFlash!.minuti, -1);
  assert.equal(iliadFlash!.tecnologia, '5G');
  assert.equal(iliadFlash!.velocita_mbps, 1000);
});

test('IliadMobileScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new IliadMobileScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});