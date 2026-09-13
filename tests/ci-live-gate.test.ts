import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractAffectedOperators, requiresPlaywright } from '../scripts/ci-live-gate.ts';

test('extractAffectedOperators picks scraper files under src/scrapers/<id>.ts', () => {
  const ops = extractAffectedOperators([
    'src/scrapers/enel.ts',
    'src/scrapers/edison.ts',
    'src/index.ts',
  ]);
  assert.ok(ops.has('enel'));
  assert.ok(ops.has('edison'));
  assert.ok(!ops.has('index'), 'src/index.ts should not match the scraper regex');
  assert.equal(ops.size, 2);
});

test('extractAffectedOperators picks fixture HTML files under fixtures/<id>/*.html', () => {
  const ops = extractAffectedOperators([
    'fixtures/enel/luce.html',
    'fixtures/bundles/luce-gas.json',
    'fixtures/enel/gas.html',
  ]);
  assert.ok(ops.has('enel'));
  assert.ok(!ops.has('bundles'), 'fixtures/bundles/luce-gas.json must not match (json, not html)');
  assert.equal(ops.size, 1);
});

test('extractAffectedOperators deduplicates ids seen via both scraper and fixture paths', () => {
  const ops = extractAffectedOperators([
    'src/scrapers/enel.ts',
    'fixtures/enel/luce.html',
  ]);
  assert.deepEqual([...ops], ['enel']);
});

test('extractAffectedOperators returns every regex match (registry filtering is the runner job)', () => {
  const ops = extractAffectedOperators([
    'README.md',
    'package.json',
    'fixtures/bundles/luce-gas.json',
    'src/scrapers/index.ts',
    'src/scrapers/types.ts',
  ]);
  assert.equal(ops.size, 2);
  assert.ok(ops.has('index'));
  assert.ok(ops.has('types'));
});

test('requiresPlaywright flags edison and windtre, not cheerio operators', () => {
  assert.equal(requiresPlaywright('edison'), true);
  assert.equal(requiresPlaywright('windtre'), true);
  assert.equal(requiresPlaywright('enel'), false);
  assert.equal(requiresPlaywright('vodafone'), false);
  assert.equal(requiresPlaywright('unknown'), false);
});
