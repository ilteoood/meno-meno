import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { format } from '../src/formatters/index.ts';
import type { Offerta } from '../src/types/offerta.ts';

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

const input = {
  commodity: 'luce' as const,
  scrapedAt: '2026-09-13T10:00:00.000Z',
  offerte: sampleOfferte,
  bundle: [],
  warnings: [],
  sourceCount: { ok: 1, total: 1 },
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
  assert.match(firstLine, /^commodity,operatore_id,codice_offerta/);
  assert.match(out.csv, /enel,EN-FIX-WEB-LUCE-001/);
});

test('format emits JSON with commodity, count, and offerte array', () => {
  const out = format(input);
  const parsed = JSON.parse(out.json);
  assert.equal(parsed.commodity, 'luce');
  assert.equal(parsed.count, 1);
  assert.equal(parsed.offerte.length, 1);
  assert.equal(parsed.offerte[0].codice_offerta, 'EN-FIX-WEB-LUCE-001');
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
