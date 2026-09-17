import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { TimMobileScraper, TimFissoScraper } from '../src/scrapers/tim.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'tim', 'mobile.html');
const fissoFixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'tim', 'fisso.html');

const TIPO_SIM_VALUES = ['eSIM', 'fisica', 'entrambe'] as const;
const TECNOLOGIA_MOBILE_VALUES = ['4G', '5G'] as const;
const TECNOLOGIA_FISSO_VALUES = ['FTTH', 'FTTC', 'ADSL'] as const;

test('TimMobileScraper parses fixture HTML into one or more offerte mobile', async () => {
  const scraper = new TimMobileScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.ok(
    result.offerte.length >= 1,
    `expected at least 1 offerta, got ${result.offerte.length}`,
  );

  for (const o of result.offerte) {
    assert.equal(o.commodity, 'mobile');
    assert.equal(o.operatore_id, 'tim');
    assert.ok(typeof o.codice_offerta === 'string' && o.codice_offerta.length > 0);
    assert.ok(typeof o.nome_commerciale === 'string' && o.nome_commerciale.length > 0);
    assert.ok(typeof o.url_sorgente === 'string' && o.url_sorgente.length > 0);
    assert.ok(typeof o.scraped_at === 'string' && o.scraped_at.length > 0);
    assert.ok(typeof o.prezzo_effettivo_euro_mese === 'number' && !Number.isNaN(o.prezzo_effettivo_euro_mese));
    assert.ok(typeof o.gb === 'number' && !Number.isNaN(o.gb));
    assert.ok(typeof o.minuti === 'number' && !Number.isNaN(o.minuti));
    assert.ok(TIPO_SIM_VALUES.includes(o.tipo_sim), `tipo_sim must be one of ${TIPO_SIM_VALUES.join(', ')}`);
    assert.ok(TECNOLOGIA_MOBILE_VALUES.includes(o.tecnologia), `tecnologia must be one of ${TECNOLOGIA_MOBILE_VALUES.join(', ')}`);
    assert.equal(
      (o as { quota_fissa_euro_anno?: unknown }).quota_fissa_euro_anno,
      undefined,
      'mobile offerte must not carry luce/gas quota_fissa_euro_anno',
    );
  }
});

test('TimMobileScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new TimMobileScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});

test('TimFissoScraper parses fixture HTML into one or more offerte fisso', async () => {
  const scraper = new TimFissoScraper({ kind: 'fixture', path: fissoFixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.ok(
    result.offerte.length >= 1,
    `expected at least 1 offerta, got ${result.offerte.length}`,
  );

  for (const o of result.offerte) {
    assert.equal(o.commodity, 'fisso');
    assert.equal(o.operatore_id, 'tim');
    assert.ok(typeof o.codice_offerta === 'string' && o.codice_offerta.length > 0);
    assert.ok(typeof o.nome_commerciale === 'string' && o.nome_commerciale.length > 0);
    assert.ok(typeof o.url_sorgente === 'string' && o.url_sorgente.length > 0);
    assert.ok(typeof o.scraped_at === 'string' && o.scraped_at.length > 0);
    assert.ok(typeof o.prezzo_effettivo_euro_mese === 'number' && !Number.isNaN(o.prezzo_effettivo_euro_mese));
    assert.ok(typeof o.velocita_mbps === 'number' && !Number.isNaN(o.velocita_mbps));
    assert.ok(TECNOLOGIA_FISSO_VALUES.includes(o.tecnologia), `tecnologia must be one of ${TECNOLOGIA_FISSO_VALUES.join(', ')}`);
    assert.equal(
      (o as { gb?: unknown }).gb,
      undefined,
      'fisso offerte must not carry mobile gb',
    );
  }
});

test('TimFissoScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new TimFissoScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});
