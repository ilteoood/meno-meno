import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import {
  costoAnnuoStimato,
  rankOfferte,
  renderRankedSections,
  CONSUMO_TIPO_KWH_LUCE,
  CONSUMO_TIPO_SMC_GAS,
} from '../src/rank/index.ts';
import type { Offerta } from '../src/types/offerta.ts';
import { EnelLuceScraper } from '../src/scrapers/enel.ts';

function luceEnelFixture(): readonly Offerta[] {
  return [
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
    {
      commodity: 'luce',
      operatore_id: 'enel',
      codice_offerta: 'EN-MESE-LIGHT-LUCE-002',
      nome_commerciale: 'Enel Mese Light',
      url_sorgente: 'https://example.test/enel-mese',
      scraped_at: '2026-09-13T10:00:00.000Z',
      prezzo_effettivo_euro_kwh: 0.18,
      quota_fissa_euro_anno: 120,
      meccanismo_prezzo: { tipo: 'PUN', spread_euro_kwh: 0.01 },
      green_flag: 'C',
    },
    {
      commodity: 'luce',
      operatore_id: 'enel',
      codice_offerta: 'EN-MOVE-LUCE-003',
      nome_commerciale: 'Enel Move',
      url_sorgente: 'https://example.test/enel-move',
      scraped_at: '2026-09-13T10:00:00.000Z',
      prezzo_effettivo_euro_kwh: 0.14,
      quota_fissa_euro_anno: 96,
      meccanismo_prezzo: { tipo: 'PUN', spread_euro_kwh: 0.01 },
      green_flag: 'C',
    },
    {
      commodity: 'luce',
      operatore_id: 'enel',
      codice_offerta: 'EN-MOVE-PLUS-LUCE-004',
      nome_commerciale: 'Enel Move Plus',
      url_sorgente: 'https://example.test/enel-move-plus',
      scraped_at: '2026-09-13T10:00:00.000Z',
      prezzo_effettivo_euro_kwh: 0.16,
      quota_fissa_euro_anno: 108,
      meccanismo_prezzo: { tipo: 'PUN', spread_euro_kwh: 0.01 },
      green_flag: 'C',
    },
  ];
}

function mobileFixtures(): readonly Offerta[] {
  return [
    {
      commodity: 'mobile',
      operatore_id: 'iliad',
      codice_offerta: 'IL-150-001',
      nome_commerciale: 'Iliad 150',
      url_sorgente: 'https://example.test/iliad-150',
      scraped_at: '2026-09-13T10:00:00.000Z',
      prezzo_effettivo_euro_mese: 9.99,
      gb: 150,
      minuti: -1,
      tipo_sim: 'eSIM',
      tecnologia: '5G',
      velocita_mbps: 1000,
    },
    {
      commodity: 'mobile',
      operatore_id: 'iliad',
      codice_offerta: 'IL-300-002',
      nome_commerciale: 'Iliad 300',
      url_sorgente: 'https://example.test/iliad-300',
      scraped_at: '2026-09-13T10:00:00.000Z',
      prezzo_effettivo_euro_mese: 14.99,
      gb: 300,
      minuti: -1,
      tipo_sim: 'eSIM',
      tecnologia: '5G+',
      velocita_mbps: 1500,
    },
    {
      commodity: 'mobile',
      operatore_id: 'tim',
      codice_offerta: 'TIM-TOP-001',
      nome_commerciale: 'TIM Top',
      url_sorgente: 'https://example.test/tim-top',
      scraped_at: '2026-09-13T10:00:00.000Z',
      prezzo_effettivo_euro_mese: 19.99,
      gb: 50,
      minuti: -1,
      tipo_sim: 'fisica',
      tecnologia: '5G',
      velocita_mbps: 1000,
    },
  ];
}

test('costoAnnuoStimato luce: prezzo × consumo tipo + quota fissa', () => {
  const o = luceEnelFixture()[0];
  assert.equal(costoAnnuoStimato(o), 0.12 * CONSUMO_TIPO_KWH_LUCE + 84);
});

test('costoAnnuoStimato gas: prezzo × consumo tipo + quota fissa', () => {
  const o: Offerta = {
    commodity: 'gas',
    operatore_id: 'a2a',
    codice_offerta: 'A2A-GAS-001',
    nome_commerciale: 'A2A Gas',
    url_sorgente: 'https://example.test/a2a-gas',
    scraped_at: '2026-09-13T10:00:00.000Z',
    prezzo_effettivo_euro_smc: 0.5,
    quota_fissa_euro_anno: 96,
    meccanismo_prezzo: { tipo: 'PSV', spread_euro_smc: 0.05 },
    green_flag: 'C',
  };
  assert.equal(costoAnnuoStimato(o), 0.5 * CONSUMO_TIPO_SMC_GAS + 96);
});

test('costoAnnuoStimato mobile/fisso: €/mese × 12 + costo attivazione', () => {
  const m = mobileFixtures()[0];
  assert.equal(costoAnnuoStimato(m), Math.round(9.99 * 12 * 100) / 100);
  const mWithAttivazione: Offerta = { ...m, costo_attivazione_euro: 10 };
  assert.equal(costoAnnuoStimato(mWithAttivazione), Math.round(9.99 * 12 * 100) / 100 + 10);
});

test('rankOfferte luce: ordina per costo annuo crescente (Enel Fix primo)', () => {
  const rank = rankOfferte({ commodity: 'luce', offerte: luceEnelFixture() });
  assert.equal(rank.top.length, 3);
  assert.equal(rank.top[0].offerta.nome_commerciale, 'Enel Fix Web Luce');
  assert.equal(rank.top[0].costo_annuo_stimato_euro, 408);
  assert.equal(rank.esclusi.length, 0);
});

test('rankOfferte esclude green_flag D in sezione separata', () => {
  const base = luceEnelFixture();
  const fakeD: Offerta = { ...base[0], nome_commerciale: 'Offerta Falsa Green', green_flag: 'D' };
  const rank = rankOfferte({ commodity: 'luce', offerte: [...base, fakeD] });
  assert.equal(rank.top.length, 3);
  assert.equal(rank.esclusi.length, 1);
  assert.equal(rank.esclusi[0].offerta.green_flag, 'D');
  assert.equal(rank.esclusi[0].offerta.nome_commerciale, 'Offerta Falsa Green');
});

test('rankOfferte filtra offerte di commodity diversa', () => {
  const base = luceEnelFixture();
  const mobileFake = mobileFixtures()[0];
  const rank = rankOfferte({ commodity: 'luce', offerte: [...base, mobileFake] });
  assert.equal(rank.top.length, 3);
  for (const s of rank.top) assert.equal(s.offerta.commodity, 'luce');
});

test('rankOfferte con < 3 offerte: top ha tutte le offerte', () => {
  const base = luceEnelFixture().slice(0, 2);
  const rank = rankOfferte({ commodity: 'luce', offerte: base });
  assert.equal(rank.top.length, 2);
  assert.equal(rank.esclusi.length, 0);
});

test('rankOfferte vuoto: top ed esclusi vuoti', () => {
  const rank = rankOfferte({ commodity: 'luce', offerte: [] });
  assert.deepEqual(rank.top, []);
  assert.deepEqual(rank.esclusi, []);
});

test('rankOfferte mobile: tier ALTO costo, tier BASSO gb', () => {
  const rank = rankOfferte({ commodity: 'mobile', offerte: mobileFixtures() });
  assert.equal(rank.top.length, 3);
  assert.equal(rank.top[0].offerta.nome_commerciale, 'Iliad 150');
  assert.equal(rank.top[0].costo_annuo_stimato_euro, Math.round(9.99 * 12 * 100) / 100);
});

test('renderRankedSections: include Top-3 motivata con 3 campi per luce', () => {
  const rank = rankOfferte({ commodity: 'luce', offerte: luceEnelFixture() });
  const sections = renderRankedSections(rank);
  assert.match(sections.top3, /^## Top-3 motivata/m);
  assert.match(sections.top3, /1\. \*\*enel — Enel Fix Web Luce\*\* — €408\/anno stimato, Verde: \[C], Fissità: \[fisso]/);
  assert.match(sections.top3, /2\. \*\*enel — Enel Move\*\* — /);
  assert.match(sections.top3, /3\. \*\*enel — Enel Move Plus\*\* — /);
});

test('renderRankedSections: trade-off section con 3 mini-blocchi Vince/Perde', () => {
  const rank = rankOfferte({ commodity: 'luce', offerte: luceEnelFixture() });
  const sections = renderRankedSections(rank);
  assert.match(sections.tradeOffs, /^## Trade-off per offerta top-3/m);
  const tradeOffBlocks = sections.tradeOffs.match(/### /g) ?? [];
  assert.equal(tradeOffBlocks.length, 3);
  assert.match(sections.tradeOffs, /- \*\*Vince su\*\*: /);
  assert.match(sections.tradeOffs, /- \*\*Perde su\*\*: /);
});

test('renderRankedSections: sezione Esclusi D solo se presenti', () => {
  const base = luceEnelFixture();
  const rankWithD = rankOfferte({
    commodity: 'luce',
    offerte: [...base, { ...base[0], nome_commerciale: 'Offerta D', green_flag: 'D' as const }],
  });
  const sectionsD = renderRankedSections(rankWithD);
  assert.match(sectionsD.esclusi, /^## Esclusi D/m);
  assert.match(sectionsD.esclusi, /Offerta D/);

  const rankClean = rankOfferte({ commodity: 'luce', offerte: base });
  const sectionsClean = renderRankedSections(rankClean);
  assert.equal(sectionsClean.esclusi, '');
});

test('renderRankedSections: mobile usa GB inclusi invece di verde/fissità', () => {
  const rank = rankOfferte({ commodity: 'mobile', offerte: mobileFixtures() });
  const sections = renderRankedSections(rank);
  assert.match(sections.top3, /GB inclusi: /);
  assert.doesNotMatch(sections.top3, /Verde:/);
});

test('renderRankedSections: top3 vuoto quando tutte D-flagged', () => {
  const base = luceEnelFixture();
  const allD: Offerta[] = base.map((o) => ({ ...o, green_flag: 'D' as const }));
  const rank = rankOfferte({ commodity: 'luce', offerte: allD });
  assert.equal(rank.top.length, 0);
  assert.equal(rank.esclusi.length, 4);
  const sections = renderRankedSections(rank);
  assert.match(sections.tradeOffs, /Nessuna offerta eleggibile/);
  assert.match(sections.top3, /Nessuna offerta eleggibile/);
});

test('Enel fixture reale: rank top-3 include Enel Fix Web Luce', async () => {
  const fixturePath = resolve(import.meta.dirname, '..', 'fixtures', 'enel', 'luce.html');
  const scraper = new EnelLuceScraper({ kind: 'fixture', path: fixturePath });
  const result = await scraper.scrape();
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const rank = rankOfferte({ commodity: 'luce', offerte: result.offerte });
  assert.equal(rank.top.length, 3);
  assert.equal(rank.top[0].offerta.nome_commerciale, 'Enel Fix Web Luce');
  assert.ok(rank.top[0].costo_annuo_stimato_euro > 0);
});