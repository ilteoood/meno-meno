import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { SkywifiMobileScraper } from '../src/scrapers/skywifi.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'skywifi', 'mobile.html');

test('SkywifiMobileScraper parses fixture HTML into offerte mobile', async () => {
  const scraper = new SkywifiMobileScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.offerte.length, 3);
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'mobile');
    assert.equal(o.operatore_id, 'skywifi');
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

  const mobile100 = result.offerte.find((o) => o.nome_commerciale === 'Sky WiFi Mobile 100');
  assert.ok(mobile100, 'expected Sky WiFi Mobile 100 offer');
  assert.equal(mobile100!.prezzo_effettivo_euro_mese, 6.99);
  assert.equal(mobile100!.gb, 100);
  assert.equal(mobile100!.minuti, -1);
  assert.equal(mobile100!.tecnologia, '5G');
  assert.equal(mobile100!.velocita_mbps, 1000);

  const mobile50 = result.offerte.find((o) => o.nome_commerciale === 'Sky WiFi Mobile 50');
  assert.ok(mobile50, 'expected Sky WiFi Mobile 50 offer');
  assert.equal(mobile50!.prezzo_effettivo_euro_mese, 4.99);
  assert.equal(mobile50!.gb, 50);
  assert.equal(mobile50!.minuti, -1);
  assert.equal(mobile50!.tecnologia, '5G');
  assert.equal(mobile50!.velocita_mbps, 1000);

  const mobile20 = result.offerte.find((o) => o.nome_commerciale === 'Sky WiFi Mobile 20');
  assert.ok(mobile20, 'expected Sky WiFi Mobile 20 offer');
  assert.equal(mobile20!.prezzo_effettivo_euro_mese, 2.99);
  assert.equal(mobile20!.gb, 20);
  assert.equal(mobile20!.minuti, -1);
  assert.equal(mobile20!.tecnologia, '4G');
  assert.equal(mobile20!.velocita_mbps, 150);
});

test('SkywifiMobileScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new SkywifiMobileScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});