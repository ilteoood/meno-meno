import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { TiscaliMobileScraper } from '../src/scrapers/tiscali.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'tiscali', 'mobile.html');

test('TiscaliMobileScraper parses fixture HTML into offerte mobile', async () => {
  const scraper = new TiscaliMobileScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.offerte.length, 3);
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'mobile');
    assert.equal(o.operatore_id, 'tiscali');
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

  const offer100 = result.offerte.find((o) => o.nome_commerciale === 'Tiscali Mobile 100');
  assert.ok(offer100, 'expected Tiscali Mobile 100 offer');
  assert.equal(offer100!.prezzo_effettivo_euro_mese, 7.99);
  assert.equal(offer100!.gb, 100);
  assert.equal(offer100!.minuti, -1);
  assert.equal(offer100!.tecnologia, '5G');
  assert.equal(offer100!.velocita_mbps, 1000);

  const offer50 = result.offerte.find((o) => o.nome_commerciale === 'Tiscali Mobile 50');
  assert.ok(offer50, 'expected Tiscali Mobile 50 offer');
  assert.equal(offer50!.prezzo_effettivo_euro_mese, 5.99);
  assert.equal(offer50!.gb, 50);
  assert.equal(offer50!.minuti, -1);
  assert.equal(offer50!.tecnologia, '5G');
  assert.equal(offer50!.velocita_mbps, 1000);

  const offer20 = result.offerte.find((o) => o.nome_commerciale === 'Tiscali Mobile 20');
  assert.ok(offer20, 'expected Tiscali Mobile 20 offer');
  assert.equal(offer20!.prezzo_effettivo_euro_mese, 3.99);
  assert.equal(offer20!.gb, 20);
  assert.equal(offer20!.minuti, -1);
  assert.equal(offer20!.tecnologia, '4G');
  assert.equal(offer20!.velocita_mbps, 150);
});

test('TiscaliMobileScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new TiscaliMobileScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});