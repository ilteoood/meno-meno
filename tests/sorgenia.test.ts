import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { SorgeniaLuceScraper } from '../src/scrapers/sorgenia.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'sorgenia', 'luce.html');

test('SorgeniaLuceScraper parses fixture HTML into offerte', async () => {
  const scraper = new SorgeniaLuceScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.ok(result.offerte.length >= 1, 'expected at least one offer');
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'luce');
    assert.equal(o.operatore_id, 'sorgenia');
    assert.ok(typeof o.codice_offerta === 'string' && o.codice_offerta.length > 0);
    assert.ok(typeof o.nome_commerciale === 'string' && o.nome_commerciale.length > 0);
    assert.ok(typeof o.url_sorgente === 'string' && o.url_sorgente.length > 0);
    assert.ok(typeof o.scraped_at === 'string' && o.scraped_at.length > 0);
    assert.ok(o.prezzo_effettivo_euro_kwh > 0);
    assert.ok(o.quota_fissa_euro_anno > 0);
    assert.ok(['fisso', 'PUN'].includes(o.meccanismo_prezzo.tipo));
    if (o.meccanismo_prezzo.tipo === 'fisso') {
      assert.equal(
        'spread_euro_kwh' in o.meccanismo_prezzo,
        false,
        'fisso offers must not carry spread_euro_kwh',
      );
    }
    if (o.meccanismo_prezzo.tipo === 'PUN') {
      const spread = (o.meccanismo_prezzo as { spread_euro_kwh: number }).spread_euro_kwh;
      assert.ok(typeof spread === 'number' && Number.isFinite(spread));
    }
    assert.ok(['A', 'B', 'C', 'D'].includes(o.green_flag));
  }
});

test('SorgeniaLuceScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new SorgeniaLuceScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});