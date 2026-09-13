import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { format } from '../src/formatters/index.ts';
import type { Offerta, OffertaBundle } from '../src/types/offerta.ts';

const sampleOfferte: readonly Offerta[] = [
  {
    commodity: 'luce',
    operatore_id: 'enel',
    codice_offerta: 'EN-FIX-WEB-LUCE-001',
    nome_commerciale: 'Enel Fix Web Luce',
    url_sorgente: 'https://example.test/enel-fix',
    scraped_at: '2026-09-13T10:00:00.000Z',
    prezzo_effettivo_euro_kwh: 0.12,
    quota_fissa_euro_anno: 84,
    meccanismo_prezzo: { tipo: 'fisso' },
    green_flag: 'C',
  },
];

const sampleBundle: OffertaBundle = {
  bundle_id: 'edison-world-luce-gas',
  operatore_id: 'edison',
  nome_commerciale: 'Edison World Luce e Gas',
  url_sorgente: 'https://www.edison.it/casa/luce-gas/offerta-world',
  scraped_at: '2026-09-13T10:00:00.000Z',
  durata_mesi: 12,
  componenti: [
    {
      commodity: 'luce',
      operatore_id: 'edison',
      codice_offerta: 'ED-WORLD-LUCE-001',
      nome_commerciale: 'Edison World Luce',
      url_sorgente: 'https://www.edison.it/casa/luce-gas/offerta-world',
      scraped_at: '2026-09-13T10:00:00.000Z',
      prezzo_effettivo_euro_kwh: 0.13,
      quota_fissa_euro_anno: 96,
      meccanismo_prezzo: { tipo: 'fisso' },
      green_flag: 'C',
    },
  ],
  sconto_bundle_euro_anno: 80,
};

const input = {
  commodity: 'luce' as const,
  scrapedAt: '2026-09-13T10:00:00.000Z',
  offerte: sampleOfferte,
  bundle: [] as readonly OffertaBundle[],
  warnings: [] as readonly string[],
  sourceCount: { ok: 1, total: 1 },
};

const inputWithBundle = {
  ...input,
  bundle: [sampleBundle] as readonly OffertaBundle[],
};

test('format emits markdown with header, table, and trade-off placeholders', () => {
  const out = format(input);
  assert.match(out.markdown, /^# Confronto luce — /m);
  assert.match(out.markdown, /\| Operatore \| Offerta \| €/);
  assert.match(out.markdown, /Enel Fix Web Luce/);
  assert.match(out.markdown, /LLM: genera blocco Trade-off/);
  assert.match(out.markdown, /LLM: genera top-3 motivata/);
  assert.match(out.markdown, /Fonte: live scrape di 1\/1/);
});

test('format emits csv with header row and one data row', () => {
  const out = format(input);
  const firstLine = out.csv.split('\n')[0];
  assert.match(firstLine, /^tipo,commodity,operatore_id,/);
  assert.match(out.csv, /Offerta,luce,enel,EN-FIX-WEB-LUCE-001/);
});

test('format emits JSON with commodity, count, and offerte.singole array', () => {
  const out = format(input);
  const parsed = JSON.parse(out.json);
  assert.equal(parsed.commodity, 'luce');
  assert.equal(parsed.count, 1);
  assert.equal(parsed.offerte.singole.length, 1);
  assert.equal(parsed.offerte.singole[0].codice_offerta, 'EN-FIX-WEB-LUCE-001');
  assert.deepEqual(parsed.offerte.bundle, []);
});

test('markdown includes warnings section when scraper fails', () => {
  const out = format({
    ...input,
    warnings: ['fixture:/nope: ENOENT'],
    sourceCount: { ok: 0, total: 1 },
  });
  assert.match(out.markdown, /## Non disponibili/);
  assert.match(out.markdown, /fixture:\/nope: ENOENT/);
});

test('markdown includes Bundle section after Non disponibili when bundle present', () => {
  const out = format(inputWithBundle);
  const warningsIdx = out.markdown.indexOf('## Non disponibili');
  const bundleIdx = out.markdown.indexOf('## Bundle luce+gas');
  assert.notEqual(bundleIdx, -1);
  assert.match(out.markdown, /- edison — Edison World Luce e Gas: 1 componenti/);
  if (warningsIdx === -1) {
    assert.ok(bundleIdx > (out.markdown.indexOf('## Top-3 motivata') ?? 0));
  } else {
    assert.ok(bundleIdx > warningsIdx);
  }
});

test('csv emits tipo=Bundle row with bundle_id and sconto_bundle_euro_anno', () => {
  const out = format(inputWithBundle);
  const lines = out.csv.split('\n');
  const bundleRow = lines.find((l) => l.startsWith('Bundle,'));
  assert.ok(bundleRow, 'expected a Bundle row in CSV');
  assert.match(bundleRow!, /edison/);
  assert.match(bundleRow!, /edison-world-luce-gas/);
  assert.match(bundleRow!, /Edison World Luce e Gas/);
  assert.match(bundleRow!, /,12,/);
  assert.match(bundleRow!, /,80,/);
});

test('json nests bundles under offerte.bundle', () => {
  const out = format(inputWithBundle);
  const parsed = JSON.parse(out.json);
  assert.equal(parsed.offerte.bundle.length, 1);
  assert.equal(parsed.offerte.bundle[0].bundle_id, 'edison-world-luce-gas');
  assert.equal(parsed.offerte.bundle[0].sconto_bundle_euro_anno, 80);
  assert.equal(parsed.offerte.singole.length, 1);
});
