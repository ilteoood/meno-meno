import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { WindtreMobileScraper } from '../src/scrapers/windtre.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'windtre', 'mobile.html');

test('WindtreMobileScraper parses fixture HTML into offerte mobile', async () => {
  const scraper = new WindtreMobileScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.offerte.length, 3);
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'mobile');
    assert.equal(o.operatore_id, 'windtre');
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

  const go100 = result.offerte.find((o) => o.nome_commerciale === 'WindTre GO 100');
  assert.ok(go100, 'expected WindTre GO 100 offer');
  assert.equal(go100!.prezzo_effettivo_euro_mese, 7.99);
  assert.equal(go100!.gb, 100);
  assert.equal(go100!.minuti, -1);
  assert.equal(go100!.tecnologia, '5G');
  assert.equal(go100!.velocita_mbps, 1000);

  const unlimited = result.offerte.find((o) => o.nome_commerciale === 'WindTre GO Unlimited');
  assert.ok(unlimited, 'expected WindTre GO Unlimited offer');
  assert.equal(unlimited!.prezzo_effettivo_euro_mese, 9.99);
  assert.equal(unlimited!.gb, -1);
  assert.equal(unlimited!.minuti, -1);
  assert.equal(unlimited!.tecnologia, '5G');
  assert.equal(unlimited!.velocita_mbps, 1000);

  const young = result.offerte.find((o) => o.nome_commerciale === 'WindTre GO Young');
  assert.ok(young, 'expected WindTre GO Young offer');
  assert.equal(young!.prezzo_effettivo_euro_mese, 5.99);
  assert.equal(young!.gb, 50);
  assert.equal(young!.minuti, -1);
  assert.equal(young!.tecnologia, '5G');
  assert.equal(young!.velocita_mbps, 1000);
});

test('WindtreMobileScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new WindtreMobileScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});