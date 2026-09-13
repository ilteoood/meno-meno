import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { PostemobileMobileScraper } from '../src/scrapers/postemobile.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'postemobile', 'mobile.html');

test('PostemobileMobileScraper parses fixture HTML into offerte mobile', async () => {
  const scraper = new PostemobileMobileScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.offerte.length, 3);
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'mobile');
    assert.equal(o.operatore_id, 'postemobile');
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

  const wow100 = result.offerte.find((o) => o.nome_commerciale === 'PosteMobile Creami WOW 100');
  assert.ok(wow100, 'expected PosteMobile Creami WOW 100 offer');
  assert.equal(wow100!.prezzo_effettivo_euro_mese, 7.99);
  assert.equal(wow100!.gb, 100);
  assert.equal(wow100!.minuti, -1);
  assert.equal(wow100!.tecnologia, '5G');
  assert.equal(wow100!.velocita_mbps, 1000);

  const wow50 = result.offerte.find((o) => o.nome_commerciale === 'PosteMobile Creami WOW 50');
  assert.ok(wow50, 'expected PosteMobile Creami WOW 50 offer');
  assert.equal(wow50!.prezzo_effettivo_euro_mese, 5.99);
  assert.equal(wow50!.gb, 50);
  assert.equal(wow50!.minuti, -1);
  assert.equal(wow50!.tecnologia, '5G');
  assert.equal(wow50!.velocita_mbps, 1000);

  const wow20 = result.offerte.find((o) => o.nome_commerciale === 'PosteMobile Creami WOW 20');
  assert.ok(wow20, 'expected PosteMobile Creami WOW 20 offer');
  assert.equal(wow20!.prezzo_effettivo_euro_mese, 3.99);
  assert.equal(wow20!.gb, 20);
  assert.equal(wow20!.minuti, -1);
  assert.equal(wow20!.tecnologia, '4G');
  assert.equal(wow20!.velocita_mbps, 150);
});

test('PostemobileMobileScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new PostemobileMobileScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});