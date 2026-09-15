import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { KenaMobileScraper } from '../src/scrapers/kena.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'kena', 'mobile.html');

test('KenaMobileScraper parses fixture HTML into offerte mobile', async () => {
  const scraper = new KenaMobileScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.offerte.length, 3);
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'mobile');
    assert.equal(o.operatore_id, 'kena');
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

  const star100 = result.offerte.find((o) => o.nome_commerciale === 'Kena Star 100');
  assert.ok(star100, 'expected Kena Star 100 offer');
  assert.equal(star100!.prezzo_effettivo_euro_mese, 6.99);
  assert.equal(star100!.gb, 100);
  assert.equal(star100!.minuti, -1);
  assert.equal(star100!.tecnologia, '5G');
  assert.equal(star100!.velocita_mbps, 1000);

  const star50 = result.offerte.find((o) => o.nome_commerciale === 'Kena Star 50');
  assert.ok(star50, 'expected Kena Star 50 offer');
  assert.equal(star50!.prezzo_effettivo_euro_mese, 4.99);
  assert.equal(star50!.gb, 50);
  assert.equal(star50!.minuti, -1);
  assert.equal(star50!.tecnologia, '5G');
  assert.equal(star50!.velocita_mbps, 1000);

  const piano299 = result.offerte.find((o) => o.nome_commerciale === 'Kena 2.99');
  assert.ok(piano299, 'expected Kena 2.99 offer');
  assert.equal(piano299!.prezzo_effettivo_euro_mese, 2.99);
  assert.equal(piano299!.gb, 20);
  assert.equal(piano299!.minuti, -1);
  assert.equal(piano299!.tecnologia, '4G');
  assert.equal(piano299!.velocita_mbps, 150);
});

test('KenaMobileScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new KenaMobileScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});