import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { EngieLuceScraper } from '../src/scrapers/engie.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'engie', 'luce.html');

test('EngieLuceScraper parses fixture HTML into luce offerte (ADR 0009 structural)', async () => {
  const scraper = new EngieLuceScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.ok(result.offerte.length >= 1, 'expected at least one offer');

  const validGreenFlags = new Set(['A', 'B', 'C', 'D']);
  const validMeccanismo = new Set(['fisso', 'PUN']);

  for (const o of result.offerte) {
    assert.equal(o.commodity, 'luce');
    assert.equal(o.operatore_id, 'engie');
    assert.equal(typeof o.codice_offerta, 'string');
    assert.ok(o.codice_offerta.length > 0, 'codice_offerta must be non-empty');
    assert.equal(typeof o.nome_commerciale, 'string');
    assert.ok(o.nome_commerciale.length > 0, 'nome_commerciale must be non-empty');
    assert.equal(typeof o.url_sorgente, 'string');
    assert.ok(o.url_sorgente.length > 0, 'url_sorgente must be non-empty');
    assert.equal(typeof o.scraped_at, 'string');
    assert.ok(o.scraped_at.length > 0, 'scraped_at must be non-empty');
    assert.ok(o.prezzo_effettivo_euro_kwh > 0, 'prezzo_effettivo_euro_kwh must be > 0');
    assert.ok(o.quota_fissa_euro_anno > 0, 'quota_fissa_euro_anno must be > 0');
    assert.ok(validMeccanismo.has(o.meccanismo_prezzo.tipo), `meccanismo_prezzo.tipo invalid: ${o.meccanismo_prezzo.tipo}`);
    if (o.meccanismo_prezzo.tipo === 'fisso') {
      assert.equal(
        'spread_euro_kwh' in o.meccanismo_prezzo,
        false,
        'fisso offers must not have spread_euro_kwh',
      );
    }
    assert.ok(validGreenFlags.has(o.green_flag), `green_flag invalid: ${o.green_flag}`);
  }
});

test('EngieLuceScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new EngieLuceScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});
