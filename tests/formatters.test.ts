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

test('format emits markdown with header, table, deterministic trade-off and top-3 sections', () => {
  const out = format(input);
  assert.match(out.markdown, /^# Confronto luce — /m);
  assert.match(out.markdown, /\| Operatore \| Offerta \| €/);
  assert.match(out.markdown, /Enel Fix Web Luce/);
  assert.match(out.markdown, /## Trade-off per offerta top-3/);
  assert.match(out.markdown, /- \*\*Vince su\*\*: /);
  assert.match(out.markdown, /- \*\*Perde su\*\*: /);
  assert.match(out.markdown, /## Top-3 motivata/);
  assert.match(out.markdown, /1\. \*\*enel — Enel Fix Web Luce\*\* — €408\/anno stimato/);
  assert.doesNotMatch(out.markdown, /<!-- LLM: /);
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

const sampleFissoOfferte: readonly Offerta[] = [
  {
    commodity: 'fisso',
    operatore_id: 'tim',
    codice_offerta: 'TIM-WIFI-CASA-001',
    nome_commerciale: 'TIM WiFi Casa',
    url_sorgente: 'https://www.tim.it/fisso-e-mobile/fibra-e-adsl',
    scraped_at: '2026-09-13T10:00:00.000Z',
    prezzo_effettivo_euro_mese: 31.9,
    tecnologia: 'FTTH',
    velocita_mbps: 2500,
    costo_attivazione_euro: 0,
  },
  {
    commodity: 'fisso',
    operatore_id: 'eolo',
    codice_offerta: 'EOLO-CASA-001',
    nome_commerciale: 'EOLO Casa',
    url_sorgente: 'https://www.eolo.it/',
    scraped_at: '2026-09-13T10:00:00.000Z',
    prezzo_effettivo_euro_mese: 24.9,
    tecnologia: 'FWA',
    velocita_mbps: 100,
    costo_attivazione_euro: 0,
  },
];

const fissoInput = {
  commodity: 'fisso' as const,
  scrapedAt: '2026-09-13T10:00:00.000Z',
  offerte: sampleFissoOfferte,
  bundle: [] as readonly OffertaBundle[],
  warnings: [] as readonly string[],
  sourceCount: { ok: 1, total: 2 },
};

test('format emits fisso markdown with Tecnologia and Velocità Mbps columns', () => {
  const out = format(fissoInput);
  assert.match(out.markdown, /^# Confronto fisso — /m);
  assert.match(out.markdown, /\| Operatore \| Offerta \| €/);
  assert.match(out.markdown, /Tecnologia \| Velocità Mbps \|/);
  assert.match(out.markdown, /\| tim \| TIM WiFi Casa \|/);
  assert.match(out.markdown, /\| eolo \| EOLO Casa \|/);
  assert.match(out.markdown, /FTTH/);
  assert.match(out.markdown, /FWA/);
});

test('format emits fisso csv with tecnologia, costo_attivazione_euro cells', () => {
  const out = format(fissoInput);
  assert.match(out.csv, /Offerta,fisso,tim,TIM-WIFI-CASA-001/);
  assert.match(out.csv, /Offerta,fisso,eolo,EOLO-CASA-001/);
  assert.match(out.csv, /FTTH/);
  assert.match(out.csv, /FWA/);
  const timRow = out.csv.split('\n').find((l) => l.includes('TIM-WIFI-CASA-001'));
  assert.ok(timRow);
  assert.match(timRow!, /,31\.9,/);
  assert.match(timRow!, /,FTTH,/);
  assert.match(timRow!, /,0,/);
  const eoloRow = out.csv.split('\n').find((l) => l.includes('EOLO-CASA-001'));
  assert.ok(eoloRow);
  assert.match(eoloRow!, /,FWA,/);
});

test('format emits fisso JSON with commodity=fisso and FWA tecnologia preserved', () => {
  const out = format(fissoInput);
  const parsed = JSON.parse(out.json);
  assert.equal(parsed.commodity, 'fisso');
  assert.equal(parsed.count, 2);
  const tim = parsed.offerte.singole.find((o: Offerta) => o.operatore_id === 'tim');
  const eolo = parsed.offerte.singole.find((o: Offerta) => o.operatore_id === 'eolo');
  assert.ok(tim);
  assert.ok(eolo);
  assert.equal(tim.tecnologia, 'FTTH');
  assert.equal(tim.velocita_mbps, 2500);
  assert.equal(eolo.tecnologia, 'FWA');
  assert.equal(eolo.velocita_mbps, 100);
});
