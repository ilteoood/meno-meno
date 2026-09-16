import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { EnelLuceScraper } from '../src/scrapers/enel.ts';
import { aggregate } from '../src/aggregator.ts';

const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'enel', 'luce.html');

test('aggregate collects offerte from a working scraper and ignores unrelated commodity', async () => {
  const result = await aggregate({
    commodity: 'luce',
    scrapers: [new EnelLuceScraper({ kind: 'fixture', path: fixturePath })],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.offerte.length >= 1);
  for (const o of result.offerte) {
    assert.equal(o.commodity, 'luce');
  }
  assert.deepEqual(result.bundle, []);
});

test('aggregate returns ok=false when all scrapers fail', async () => {
  const result = await aggregate({
    commodity: 'luce',
    scrapers: [new EnelLuceScraper({ kind: 'fixture', path: '/nope/missing.html' })],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /all scrapers failed/);
});
