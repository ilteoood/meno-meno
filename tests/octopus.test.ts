import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { OctopusLuceScraper } from '../src/scrapers/octopus.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'octopus', 'luce.html');

const MECCANISMO_TIPI = ['fisso', 'PUN'] as const;
const GREEN_FLAGS = ['A', 'B', 'C', 'D'] as const;

test('OctopusLuceScraper parses fixture HTML into one or more offerte luce', async () => {
  const scraper = new OctopusLuceScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.ok(
    result.offerte.length >= 1,
    `expected at least 1 offerta, got ${result.offerte.length}`,
  );

  for (const o of result.offerte) {
    assert.equal(o.commodity, 'luce');
    assert.equal(o.operatore_id, 'octopus');
    assert.ok(typeof o.codice_offerta === 'string' && o.codice_offerta.length > 0);
    assert.ok(typeof o.nome_commerciale === 'string' && o.nome_commerciale.length > 0);
    assert.ok(typeof o.url_sorgente === 'string' && o.url_sorgente.length > 0);
    assert.ok(typeof o.scraped_at === 'string' && o.scraped_at.length > 0);
    assert.ok(typeof o.prezzo_effettivo_euro_kwh === 'number' && o.prezzo_effettivo_euro_kwh > 0);
    assert.ok(typeof o.quota_fissa_euro_anno === 'number' && o.quota_fissa_euro_anno > 0);
    assert.ok(
      MECCANISMO_TIPI.includes(o.meccanismo_prezzo.tipo as typeof MECCANISMO_TIPI[number]),
      `meccanismo_prezzo.tipo must be one of ${MECCANISMO_TIPI.join(', ')}`,
    );
    assert.ok(GREEN_FLAGS.includes(o.green_flag), `green_flag must be one of ${GREEN_FLAGS.join(', ')}`);
  }
});

test('OctopusLuceScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new OctopusLuceScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});