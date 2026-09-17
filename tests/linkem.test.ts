import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { LinkemFissoScraper } from '../src/scrapers/linkem.ts';

const fissoFixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'linkem', 'fisso.html');

const TECNOLOGIA_FISSO_VALUES = ['FTTH', 'FTTC', 'ADSL'] as const;

test('LinkemFissoScraper parses fixture HTML into one or more offerte fisso', async () => {
  const scraper = new LinkemFissoScraper({ kind: 'fixture', path: fissoFixturePath });
  const result = await scraper.scrape();

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.ok(
    result.offerte.length >= 1,
    `expected at least 1 offerta, got ${result.offerte.length}`,
  );

  for (const o of result.offerte) {
    assert.equal(o.commodity, 'fisso');
    assert.equal(o.operatore_id, 'linkem');
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

test('LinkemFissoScraper returns ok=false when fixture path is missing', async () => {
  const scraper = new LinkemFissoScraper({ kind: 'fixture', path: '/nope/missing.html' });
  const result = await scraper.scrape();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /ENOENT|no such file/);
});
