import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { VodafoneMobileScraper } from '../src/scrapers/vodafone.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'vodafone', 'mobile.html');

test('VodafoneMobileScraper parses fixture HTML into offerte mobile', async () => {
  const scraper = new VodafoneMobileScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.offerte.length, 3);
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'mobile');
    assert.equal(o.operatore_id, 'vodafone');
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

  const easy = result.offerte.find((o) => o.nome_commerciale === 'Vodafone Easy Mobile');
  assert.ok(easy, 'expected Vodafone Easy Mobile offer');
  assert.equal(easy!.prezzo_effettivo_euro_mese, 7.99);
  assert.equal(easy!.gb, 100);
  assert.equal(easy!.minuti, -1);
  assert.equal(easy!.tecnologia, '5G');
  assert.equal(easy!.velocita_mbps, 1000);

  const red = result.offerte.find((o) => o.nome_commerciale === 'Vodafone Red Mobile');
  assert.ok(red, 'expected Vodafone Red Mobile offer');
  assert.equal(red!.prezzo_effettivo_euro_mese, 12.99);
  assert.equal(red!.gb, -1);
  assert.equal(red!.minuti, -1);
  assert.equal(red!.tecnologia, '5G+');
  assert.equal(red!.velocita_mbps, 2000);

  const smart = result.offerte.find((o) => o.nome_commerciale === 'Vodafone Smart Mobile');
  assert.ok(smart, 'expected Vodafone Smart Mobile offer');
  assert.equal(smart!.prezzo_effettivo_euro_mese, 4.99);
  assert.equal(smart!.gb, 30);
  assert.equal(smart!.minuti, -1);
  assert.equal(smart!.tecnologia, '4G');
  assert.equal(smart!.velocita_mbps, 150);
});

test('VodafoneMobileScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new VodafoneMobileScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});
