import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { VeryMobileScraper } from '../src/scrapers/very.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'very', 'mobile.html');

test('VeryMobileScraper parses fixture HTML into offerte mobile', async () => {
  const scraper = new VeryMobileScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.offerte.length, 3);
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'mobile');
    assert.equal(o.operatore_id, 'very');
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

  const offer999 = result.offerte.find((o) => o.nome_commerciale === 'Very 9.99');
  assert.ok(offer999, 'expected Very 9.99 offer');
  assert.equal(offer999!.prezzo_effettivo_euro_mese, 9.99);
  assert.equal(offer999!.gb, 100);
  assert.equal(offer999!.minuti, -1);
  assert.equal(offer999!.tecnologia, '5G');
  assert.equal(offer999!.velocita_mbps, 1000);

  const offer699 = result.offerte.find((o) => o.nome_commerciale === 'Very 6.99');
  assert.ok(offer699, 'expected Very 6.99 offer');
  assert.equal(offer699!.prezzo_effettivo_euro_mese, 6.99);
  assert.equal(offer699!.gb, 50);
  assert.equal(offer699!.minuti, -1);
  assert.equal(offer699!.tecnologia, '5G');
  assert.equal(offer699!.velocita_mbps, 1000);

  const offer499 = result.offerte.find((o) => o.nome_commerciale === 'Very 4.99');
  assert.ok(offer499, 'expected Very 4.99 offer');
  assert.equal(offer499!.prezzo_effettivo_euro_mese, 4.99);
  assert.equal(offer499!.gb, 30);
  assert.equal(offer499!.minuti, -1);
  assert.equal(offer499!.tecnologia, '4G');
  assert.equal(offer499!.velocita_mbps, 150);
});

test('VeryMobileScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new VeryMobileScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});
