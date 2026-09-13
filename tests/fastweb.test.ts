import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { FastwebMobileScraper } from '../src/scrapers/fastweb.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'fastweb', 'mobile.html');

test('FastwebMobileScraper parses fixture HTML into offerte mobile', async () => {
  const scraper = new FastwebMobileScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.offerte.length, 3);
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'mobile');
    assert.equal(o.operatore_id, 'fastweb');
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

  const mobile100 = result.offerte.find((o) => o.nome_commerciale === 'Fastweb Mobile 100');
  assert.ok(mobile100, 'expected Fastweb Mobile 100 offer');
  assert.equal(mobile100!.prezzo_effettivo_euro_mese, 7.95);
  assert.equal(mobile100!.gb, 100);
  assert.equal(mobile100!.minuti, -1);
  assert.equal(mobile100!.tecnologia, '5G');
  assert.equal(mobile100!.velocita_mbps, 1000);

  const mobile50 = result.offerte.find((o) => o.nome_commerciale === 'Fastweb Mobile 50');
  assert.ok(mobile50, 'expected Fastweb Mobile 50 offer');
  assert.equal(mobile50!.prezzo_effettivo_euro_mese, 5.95);
  assert.equal(mobile50!.gb, 50);
  assert.equal(mobile50!.minuti, -1);
  assert.equal(mobile50!.tecnologia, '5G');
  assert.equal(mobile50!.velocita_mbps, 1000);

  const mobileLight = result.offerte.find((o) => o.nome_commerciale === 'Fastweb Mobile Light');
  assert.ok(mobileLight, 'expected Fastweb Mobile Light offer');
  assert.equal(mobileLight!.prezzo_effettivo_euro_mese, 3.95);
  assert.equal(mobileLight!.gb, 20);
  assert.equal(mobileLight!.minuti, -1);
  assert.equal(mobileLight!.tecnologia, '4G');
  assert.equal(mobileLight!.velocita_mbps, 150);
});

test('FastwebMobileScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new FastwebMobileScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});
