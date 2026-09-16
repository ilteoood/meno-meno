import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { AceaLuceScraper } from '../src/scrapers/acea.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'acea', 'luce.json');

const MECCANISMO_TIPI = ['fisso', 'PUN'] as const;
const GREEN_FLAGS = ['A', 'B', 'C', 'D'] as const;

test('AceaLuceScraper parses real JSON listing + detail fixture into one or more offerte luce', async () => {
  const scraper = new AceaLuceScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.ok(
    result.offerte.length >= 1,
    `expected at least 1 offerta, got ${result.offerte.length}`,
  );

  for (const o of result.offerte) {
    assert.equal(o.commodity, 'luce');
    assert.equal(o.operatore_id, 'acea');
    assert.ok(typeof o.codice_offerta === 'string' && o.codice_offerta.length > 0);
    assert.ok(typeof o.nome_commerciale === 'string' && o.nome_commerciale.length > 0);
    assert.ok(typeof o.url_sorgente === 'string' && o.url_sorgente.length > 0);
    assert.ok(typeof o.scraped_at === 'string' && o.scraped_at.length > 0);
    assert.ok(
      typeof o.prezzo_effettivo_euro_kwh === 'number'
        && Number.isFinite(o.prezzo_effettivo_euro_kwh)
        && o.prezzo_effettivo_euro_kwh > 0,
    );
    assert.ok(
      typeof o.quota_fissa_euro_anno === 'number'
        && Number.isFinite(o.quota_fissa_euro_anno)
        && o.quota_fissa_euro_anno > 0,
    );
    assert.ok(
      MECCANISMO_TIPI.includes(o.meccanismo_prezzo.tipo),
      `meccanismo_prezzo.tipo must be one of ${MECCANISMO_TIPI.join(', ')}`,
    );
    if (o.meccanismo_prezzo.tipo === 'fisso') {
      assert.equal(
        (o.meccanismo_prezzo as { spread_euro_kwh?: unknown }).spread_euro_kwh,
        undefined,
        'fisso offerte must not carry spread_euro_kwh',
      );
    }
    assert.ok(
      GREEN_FLAGS.includes(o.green_flag),
      `green_flag must be one of ${GREEN_FLAGS.join(', ')}`,
    );
    assert.equal(
      (o as { quota_fissa_euro_smc?: unknown }).quota_fissa_euro_smc,
      undefined,
      'luce offerte must not carry gas quota_fissa_euro_smc',
    );
  }
});

test('AceaLuceScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new AceaLuceScraper({ kind: 'fixture', path: '/nope/missing.json' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});