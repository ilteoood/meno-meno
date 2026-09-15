import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { HoMobileScraper } from '../src/scrapers/ho.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'ho', 'mobile.html');

test('HoMobileScraper parses fixture HTML into offerte mobile', async () => {
  const scraper = new HoMobileScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.offerte.length, 3);
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'mobile');
    assert.equal(o.operatore_id, 'ho');
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

  const offerta999 = result.offerte.find((o) => o.nome_commerciale === 'ho. 9.99');
  assert.ok(offerta999, 'expected ho. 9.99 offer');
  assert.equal(offerta999!.prezzo_effettivo_euro_mese, 9.99);
  assert.equal(offerta999!.gb, 100);
  assert.equal(offerta999!.minuti, -1);
  assert.equal(offerta999!.tecnologia, '5G');
  assert.equal(offerta999!.velocita_mbps, 1000);

  const offerta699 = result.offerte.find((o) => o.nome_commerciale === 'ho. 6.99');
  assert.ok(offerta699, 'expected ho. 6.99 offer');
  assert.equal(offerta699!.prezzo_effettivo_euro_mese, 6.99);
  assert.equal(offerta699!.gb, 50);
  assert.equal(offerta699!.minuti, -1);
  assert.equal(offerta699!.tecnologia, '5G');
  assert.equal(offerta699!.velocita_mbps, 1000);

  const offerta499 = result.offerte.find((o) => o.nome_commerciale === 'ho. 4.99');
  assert.ok(offerta499, 'expected ho. 4.99 offer');
  assert.equal(offerta499!.prezzo_effettivo_euro_mese, 4.99);
  assert.equal(offerta499!.gb, 30);
  assert.equal(offerta499!.minuti, -1);
  assert.equal(offerta499!.tecnologia, '4G');
  assert.equal(offerta499!.velocita_mbps, 150);
});

test('HoMobileScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new HoMobileScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});
