import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import type { Commodity, Offerta, OffertaBundle } from '../src/types/offerta.ts';
import { format } from '../src/formatters/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const EXAMPLES_DIR = resolve(ROOT, 'examples');
const ENEL_FIXTURE = resolve(ROOT, 'fixtures/enel/luce.html');
const PLENITUDE_FIXTURE = resolve(ROOT, 'fixtures/plenitude/luce.html');
const A2A_FIXTURE = resolve(ROOT, 'fixtures/a2a/luce.html');
const IREN_FIXTURE = resolve(ROOT, 'fixtures/iren/luce.html');
const HERA_FIXTURE = resolve(ROOT, 'fixtures/hera/luce.html');
const ACEA_FIXTURE = resolve(ROOT, 'fixtures/acea/luce.html');
const SORGENIA_FIXTURE = resolve(ROOT, 'fixtures/sorgenia/luce.html');
const ILLUMIA_FIXTURE = resolve(ROOT, 'fixtures/illumia/luce.html');
const ENGIE_FIXTURE = resolve(ROOT, 'fixtures/engie/luce.html');
const OCTOPUS_FIXTURE = resolve(ROOT, 'fixtures/octopus/luce.html');
const NEN_FIXTURE = resolve(ROOT, 'fixtures/nen/luce.html');
const TIM_FIXTURE = resolve(ROOT, 'fixtures/tim/mobile.html');
const VODAFONE_FIXTURE = resolve(ROOT, 'fixtures/vodafone/mobile.html');
const ILIAD_FIXTURE = resolve(ROOT, 'fixtures/iliad/mobile.html');
const FASTWEB_FIXTURE = resolve(ROOT, 'fixtures/fastweb/mobile.html');
const SKYWIFI_FIXTURE = resolve(ROOT, 'fixtures/skywifi/mobile.html');
const POSTEMOBILE_FIXTURE = resolve(ROOT, 'fixtures/postemobile/mobile.html');
const HO_FIXTURE = resolve(ROOT, 'fixtures/ho/mobile.html');
const BUNDLES_FIXTURE = resolve(ROOT, 'fixtures/bundles/luce-gas.json');
const SCRAPED_AT = '2026-09-13T10:00:00.000Z';

// ponytail: parse is duplicated from src/scrapers/enel.ts to keep example timestamps deterministic.
// Upgrade: inject clock into scraper when more scrapers need deterministic examples.
function parseEnelFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${ENEL_FIXTURE}`;
  $('[data-offer-code], article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const quotaText = $el.find('.offer-fee, .fee').first().text();
    if (!codice || !nome) return;
    const prezzo = parsePrice(prezzoText);
    const quota = parsePrice(quotaText);
    if (prezzo === null || quota === null) return;
    const isFisso = nome.toLowerCase().includes('fix');
    cards.push({
      commodity: 'luce' satisfies Commodity,
      operatore_id: 'enel',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      meccanismo_prezzo: isFisso
        ? { tipo: 'fisso' }
        : { tipo: 'PUN', spread_euro_kwh: 0 },
      green_flag: 'C',
    });
  });
  return cards;
}

function parsePrice(text: string): number | null {
  const match = text.match(/(\d{1,4}(?:[.,]\d{2})?)/);
  if (!match) return null;
  return Number(match[1].replace(',', '.'));
}

// ponytail: parse duplicated from src/scrapers/plenitude.ts for deterministic timestamps.
function parsePlenitudeFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${PLENITUDE_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const quotaText = $el.find('.offer-fee, .fee').first().text();
    if (!codice || !nome) return;
    const prezzo = parsePrice(prezzoText);
    const quota = parsePrice(quotaText);
    if (prezzo === null || quota === null) return;
    const isFisso = nome.toLowerCase().includes('fix');
    cards.push({
      commodity: 'luce' satisfies Commodity,
      operatore_id: 'plenitude',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      meccanismo_prezzo: isFisso
        ? { tipo: 'fisso' }
        : { tipo: 'PUN', spread_euro_kwh: 0 },
      green_flag: 'C',
    });
  });
  return cards;
}

// ponytail: parse duplicated from src/scrapers/a2a.ts for deterministic timestamps.
function parseA2aFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${A2A_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const quotaText = $el.find('.offer-fee, .fee').first().text();
    if (!codice || !nome) return;
    const prezzo = parsePrice(prezzoText);
    const quota = parsePrice(quotaText);
    if (prezzo === null || quota === null) return;
    const isFisso = nome.toLowerCase().includes('fix');
    cards.push({
      commodity: 'luce' satisfies Commodity,
      operatore_id: 'a2a',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      meccanismo_prezzo: isFisso
        ? { tipo: 'fisso' }
        : { tipo: 'PUN', spread_euro_kwh: 0 },
      green_flag: 'C',
    });
  });
  return cards;
}

async function loadBundles(path: string): Promise<readonly OffertaBundle[]> {
  const raw = await readFile(path, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('bundles fixture must be an array');
  return parsed as readonly OffertaBundle[];
}

async function writeExample(
  base: string,
  content: { markdown: string; csv: string; json: string },
): Promise<void> {
  await mkdir(EXAMPLES_DIR, { recursive: true });
  await writeFile(resolve(EXAMPLES_DIR, `${base}.md`), content.markdown, 'utf8');
  await writeFile(resolve(EXAMPLES_DIR, `${base}.csv`), content.csv, 'utf8');
  await writeFile(resolve(EXAMPLES_DIR, `${base}.json`), content.json, 'utf8');
}

async function renderEnelExample(): Promise<void> {
  const html = await readFile(ENEL_FIXTURE, 'utf8');
  const offerte = parseEnelFixture(html);
  const output = format({
    commodity: 'luce',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('enel-luce', output);
  process.stdout.write(`rendered examples/enel-luce.{md,csv,json} (${offerte.length} offerte)\n`);
}

async function renderPlenitudeExample(): Promise<void> {
  const html = await readFile(PLENITUDE_FIXTURE, 'utf8');
  const offerte = parsePlenitudeFixture(html);
  const output = format({
    commodity: 'luce',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('plenitude-luce', output);
  process.stdout.write(`rendered examples/plenitude-luce.{md,csv,json} (${offerte.length} offerte)\n`);
}

async function renderA2aExample(): Promise<void> {
  const html = await readFile(A2A_FIXTURE, 'utf8');
  const offerte = parseA2aFixture(html);
  const output = format({
    commodity: 'luce',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('a2a-luce', output);
  process.stdout.write(`rendered examples/a2a-luce.{md,csv,json} (${offerte.length} offerte)\n`);
}

function parseIrenFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${IREN_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const quotaText = $el.find('.offer-fee, .fee').first().text();
    if (!codice || !nome) return;
    const prezzo = parsePrice(prezzoText);
    const quota = parsePrice(quotaText);
    if (prezzo === null || quota === null) return;
    const isFisso = nome.toLowerCase().includes('fix');
    cards.push({
      commodity: 'luce' satisfies Commodity,
      operatore_id: 'iren',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      meccanismo_prezzo: isFisso
        ? { tipo: 'fisso' }
        : { tipo: 'PUN', spread_euro_kwh: 0 },
      green_flag: 'C',
    });
  });
  return cards;
}

async function renderIrenExample(): Promise<void> {
  const html = await readFile(IREN_FIXTURE, 'utf8');
  const offerte = parseIrenFixture(html);
  const output = format({
    commodity: 'luce',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('iren-luce', output);
  process.stdout.write(`rendered examples/iren-luce.{md,csv,json} (${offerte.length} offerte)\n`);
}

async function renderBundleExample(): Promise<void> {
  const bundle = await loadBundles(BUNDLES_FIXTURE);
  const output = format({
    commodity: 'luce',
    scrapedAt: SCRAPED_AT,
    offerte: [],
    bundle,
    warnings: [],
    sourceCount: { ok: 0, total: 0 },
  });
  await writeExample('luce-gas-bundle-proof', output);
  process.stdout.write(`rendered examples/luce-gas-bundle-proof.{md,csv,json} (${bundle.length} bundle)\n`);
}

async function renderHeraExample(): Promise<void> {
  const html = await readFile(HERA_FIXTURE, 'utf8');
  const offerte = parseHeraFixture(html);
  const output = format({
    commodity: 'luce',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('hera-luce', output);
  process.stdout.write(`rendered examples/hera-luce.{md,csv,json} (${offerte.length} offerte)\n`);
}

function parseHeraFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${HERA_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const quotaText = $el.find('.offer-fee, .fee').first().text();
    if (!codice || !nome) return;
    const prezzo = parsePrice(prezzoText);
    const quota = parsePrice(quotaText);
    if (prezzo === null || quota === null) return;
    const isFisso = nome.toLowerCase().includes('fix');
    cards.push({
      commodity: 'luce' satisfies Commodity,
      operatore_id: 'hera',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      meccanismo_prezzo: isFisso
        ? { tipo: 'fisso' }
        : { tipo: 'PUN', spread_euro_kwh: 0 },
      green_flag: 'C',
    });
  });
  return cards;
}

function parseAceaFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${ACEA_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const quotaText = $el.find('.offer-fee, .fee').first().text();
    if (!codice || !nome) return;
    const prezzo = parsePrice(prezzoText);
    const quota = parsePrice(quotaText);
    if (prezzo === null || quota === null) return;
    const isFisso = nome.toLowerCase().includes('fix');
    cards.push({
      commodity: 'luce' satisfies Commodity,
      operatore_id: 'acea',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      meccanismo_prezzo: isFisso
        ? { tipo: 'fisso' }
        : { tipo: 'PUN', spread_euro_kwh: 0 },
      green_flag: 'C',
    });
  });
  return cards;
}

async function renderAceaExample(): Promise<void> {
  const html = await readFile(ACEA_FIXTURE, 'utf8');
  const offerte = parseAceaFixture(html);
  const output = format({
    commodity: 'luce',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('acea-luce', output);
  process.stdout.write(`rendered examples/acea-luce.{md,csv,json} (${offerte.length} offerte)\n`);
}

function parseSorgeniaFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${SORGENIA_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const quotaText = $el.find('.offer-fee, .fee').first().text();
    if (!codice || !nome) return;
    const prezzo = parsePrice(prezzoText);
    const quota = parsePrice(quotaText);
    if (prezzo === null || quota === null) return;
    const isFisso = nome.toLowerCase().includes('fix');
    cards.push({
      commodity: 'luce' satisfies Commodity,
      operatore_id: 'sorgenia',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      meccanismo_prezzo: isFisso
        ? { tipo: 'fisso' }
        : { tipo: 'PUN', spread_euro_kwh: 0 },
      green_flag: 'C',
    });
  });
  return cards;
}

async function renderSorgeniaExample(): Promise<void> {
  const html = await readFile(SORGENIA_FIXTURE, 'utf8');
  const offerte = parseSorgeniaFixture(html);
  const output = format({
    commodity: 'luce',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('sorgenia-luce', output);
  process.stdout.write(`rendered examples/sorgenia-luce.{md,csv,json} (${offerte.length} offerte)\n`);
}

function parseIllumiaFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${ILLUMIA_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const quotaText = $el.find('.offer-fee, .fee').first().text();
    if (!codice || !nome) return;
    const prezzo = parsePrice(prezzoText);
    const quota = parsePrice(quotaText);
    if (prezzo === null || quota === null) return;
    const isFisso = nome.toLowerCase().includes('fix');
    cards.push({
      commodity: 'luce' satisfies Commodity,
      operatore_id: 'illumia',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      meccanismo_prezzo: isFisso
        ? { tipo: 'fisso' }
        : { tipo: 'PUN', spread_euro_kwh: 0 },
      green_flag: 'C',
    });
  });
  return cards;
}

async function renderIllumiaExample(): Promise<void> {
  const html = await readFile(ILLUMIA_FIXTURE, 'utf8');
  const offerte = parseIllumiaFixture(html);
  const output = format({
    commodity: 'luce',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('illumia-luce', output);
  process.stdout.write(`rendered examples/illumia-luce.{md,csv,json} (${offerte.length} offerte)\n`);
}

function parseEngieFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${ENGIE_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const quotaText = $el.find('.offer-fee, .fee').first().text();
    if (!codice || !nome) return;
    const prezzo = parsePrice(prezzoText);
    const quota = parsePrice(quotaText);
    if (prezzo === null || quota === null) return;
    const isFisso = nome.toLowerCase().includes('fix');
    cards.push({
      commodity: 'luce' satisfies Commodity,
      operatore_id: 'engie',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      meccanismo_prezzo: isFisso
        ? { tipo: 'fisso' }
        : { tipo: 'PUN', spread_euro_kwh: 0 },
      green_flag: 'C',
    });
  });
  return cards;
}

async function renderEngieExample(): Promise<void> {
  const html = await readFile(ENGIE_FIXTURE, 'utf8');
  const offerte = parseEngieFixture(html);
  const output = format({
    commodity: 'luce',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('engie-luce', output);
  process.stdout.write(`rendered examples/engie-luce.{md,csv,json} (${offerte.length} offerte)\n`);
}

function parseOctopusFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${OCTOPUS_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const quotaText = $el.find('.offer-fee, .fee').first().text();
    if (!codice || !nome) return;
    const prezzo = parsePrice(prezzoText);
    const quota = parsePrice(quotaText);
    if (prezzo === null || quota === null) return;
    const isFisso = nome.toLowerCase().includes('fix');
    cards.push({
      commodity: 'luce' satisfies Commodity,
      operatore_id: 'octopus',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      meccanismo_prezzo: isFisso
        ? { tipo: 'fisso' }
        : { tipo: 'PUN', spread_euro_kwh: 0 },
      green_flag: 'C',
    });
  });
  return cards;
}

async function renderOctopusExample(): Promise<void> {
  const html = await readFile(OCTOPUS_FIXTURE, 'utf8');
  const offerte = parseOctopusFixture(html);
  const output = format({
    commodity: 'luce',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('octopus-luce', output);
  process.stdout.write(`rendered examples/octopus-luce.{md,csv,json} (${offerte.length} offerte)\n`);
}

function parseNenFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${NEN_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const quotaText = $el.find('.offer-fee, .fee').first().text();
    if (!codice || !nome) return;
    const prezzo = parsePrice(prezzoText);
    const quota = parsePrice(quotaText);
    if (prezzo === null || quota === null) return;
    const isFisso = nome.toLowerCase().includes('fix');
    cards.push({
      commodity: 'luce' satisfies Commodity,
      operatore_id: 'nen',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_kwh: prezzo,
      quota_fissa_euro_anno: quota,
      meccanismo_prezzo: isFisso
        ? { tipo: 'fisso' }
        : { tipo: 'PUN', spread_euro_kwh: 0 },
      green_flag: 'C',
    });
  });
  return cards;
}

async function renderNenExample(): Promise<void> {
  const html = await readFile(NEN_FIXTURE, 'utf8');
  const offerte = parseNenFixture(html);
  const output = format({
    commodity: 'luce',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('nen-luce', output);
  process.stdout.write(`rendered examples/nen-luce.{md,csv,json} (${offerte.length} offerte)\n`);
}

// ponytail: parse duplicated from src/scrapers/tim.ts for deterministic timestamps.
function parseTimFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${TIM_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const gbText = $el.find('.offer-gb').first().text();
    const minutiText = $el.find('.offer-minuti').first().text();
    const techText = $el.find('.offer-tech').first().text();
    if (!codice || !nome) return;
    const match = prezzoText.match(/(\d{1,4}(?:[.,]\d{2})?)/);
    if (!match) return;
    const prezzo = Number(match[1].replace(',', '.'));
    const isIllimitato = (text: string): boolean => text.toLowerCase().includes('illimitat');
    const gbNumber = isIllimitato(gbText) ? -1 : Number(gbText.match(/(\d+)/)?.[1] ?? '0');
    const minuti = isIllimitato(minutiText) ? -1 : Number(minutiText.match(/(\d+)/)?.[1] ?? '0');
    const tecnologia = (() => {
      const v = techText.trim().toUpperCase();
      if (v === '5G+' || v === '5G PLUS') return '5G+' as const;
      if (v === '5G') return '5G' as const;
      return '4G' as const;
    })();
    const velocita = tecnologia === '5G+' ? 2000 : tecnologia === '5G' ? 1000 : 150;
    cards.push({
      commodity: 'mobile' satisfies Commodity,
      operatore_id: 'tim',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_mese: prezzo,
      gb: gbNumber,
      minuti,
      tipo_sim: 'entrambe',
      tecnologia,
      velocita_mbps: velocita,
    });
  });
  return cards;
}

async function renderTimExample(): Promise<void> {
  const html = await readFile(TIM_FIXTURE, 'utf8');
  const offerte = parseTimFixture(html);
  const output = format({
    commodity: 'mobile',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('tim-mobile', output);
  process.stdout.write(`rendered examples/tim-mobile.{md,csv,json} (${offerte.length} offerte)\n`);
}

// ponytail: parse duplicated from src/scrapers/vodafone.ts for deterministic timestamps.
function parseVodafoneFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${VODAFONE_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const gbText = $el.find('.offer-gb').first().text();
    const minutiText = $el.find('.offer-minuti').first().text();
    const techText = $el.find('.offer-tech').first().text();
    if (!codice || !nome) return;
    const match = prezzoText.match(/(\d{1,4}(?:[.,]\d{2})?)/);
    if (!match) return;
    const prezzo = Number(match[1].replace(',', '.'));
    const isIllimitato = (text: string): boolean => text.toLowerCase().includes('illimitat');
    const gbNumber = isIllimitato(gbText) ? -1 : Number(gbText.match(/(\d+)/)?.[1] ?? '0');
    const minuti = isIllimitato(minutiText) ? -1 : Number(minutiText.match(/(\d+)/)?.[1] ?? '0');
    const tecnologia = (() => {
      const v = techText.trim().toUpperCase();
      if (v === '5G+' || v === '5G PLUS') return '5G+' as const;
      if (v === '5G') return '5G' as const;
      return '4G' as const;
    })();
    const velocita = tecnologia === '5G+' ? 2000 : tecnologia === '5G' ? 1000 : 150;
    cards.push({
      commodity: 'mobile' satisfies Commodity,
      operatore_id: 'vodafone',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_mese: prezzo,
      gb: gbNumber,
      minuti,
      tipo_sim: 'entrambe',
      tecnologia,
      velocita_mbps: velocita,
    });
  });
  return cards;
}

async function renderVodafoneExample(): Promise<void> {
  const html = await readFile(VODAFONE_FIXTURE, 'utf8');
  const offerte = parseVodafoneFixture(html);
  const output = format({
    commodity: 'mobile',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('vodafone-mobile', output);
  process.stdout.write(`rendered examples/vodafone-mobile.{md,csv,json} (${offerte.length} offerte)\n`);
}

// ponytail: parse duplicated from src/scrapers/iliad.ts for deterministic timestamps.
function parseIliadFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${ILIAD_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const gbText = $el.find('.offer-gb').first().text();
    const minutiText = $el.find('.offer-minuti').first().text();
    const techText = $el.find('.offer-tech').first().text();
    if (!codice || !nome) return;
    const match = prezzoText.match(/(\d{1,4}(?:[.,]\d{2})?)/);
    if (!match) return;
    const prezzo = Number(match[1].replace(',', '.'));
    const isIllimitato = (text: string): boolean => text.toLowerCase().includes('illimitat');
    const gbNumber = isIllimitato(gbText) ? -1 : Number(gbText.match(/(\d+)/)?.[1] ?? '0');
    const minuti = isIllimitato(minutiText) ? -1 : Number(minutiText.match(/(\d+)/)?.[1] ?? '0');
    const tecnologia = (() => {
      const v = techText.trim().toUpperCase();
      if (v === '5G+' || v === '5G PLUS') return '5G+' as const;
      if (v === '5G') return '5G' as const;
      return '4G' as const;
    })();
    const velocita = tecnologia === '5G+' ? 2000 : tecnologia === '5G' ? 1000 : 150;
    cards.push({
      commodity: 'mobile' satisfies Commodity,
      operatore_id: 'iliad',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_mese: prezzo,
      gb: gbNumber,
      minuti,
      tipo_sim: 'entrambe',
      tecnologia,
      velocita_mbps: velocita,
    });
  });
  return cards;
}

async function renderIliadExample(): Promise<void> {
  const html = await readFile(ILIAD_FIXTURE, 'utf8');
  const offerte = parseIliadFixture(html);
  const output = format({
    commodity: 'mobile',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('iliad-mobile', output);
  process.stdout.write(`rendered examples/iliad-mobile.{md,csv,json} (${offerte.length} offerte)\n`);
}

// ponytail: parse duplicated from src/scrapers/fastweb.ts for deterministic timestamps.
function parseFastwebFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${FASTWEB_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const gbText = $el.find('.offer-gb').first().text();
    const minutiText = $el.find('.offer-minuti').first().text();
    const techText = $el.find('.offer-tech').first().text();
    if (!codice || !nome) return;
    const match = prezzoText.match(/(\d{1,4}(?:[.,]\d{2})?)/);
    if (!match) return;
    const prezzo = Number(match[1].replace(',', '.'));
    const isIllimitato = (text: string): boolean => text.toLowerCase().includes('illimitat');
    const gbNumber = isIllimitato(gbText) ? -1 : Number(gbText.match(/(\d+)/)?.[1] ?? '0');
    const minuti = isIllimitato(minutiText) ? -1 : Number(minutiText.match(/(\d+)/)?.[1] ?? '0');
    const tecnologia = (() => {
      const v = techText.trim().toUpperCase();
      if (v === '5G+' || v === '5G PLUS') return '5G+' as const;
      if (v === '5G') return '5G' as const;
      return '4G' as const;
    })();
    const velocita = tecnologia === '5G+' ? 2000 : tecnologia === '5G' ? 1000 : 150;
    cards.push({
      commodity: 'mobile' satisfies Commodity,
      operatore_id: 'fastweb',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_mese: prezzo,
      gb: gbNumber,
      minuti,
      tipo_sim: 'entrambe',
      tecnologia,
      velocita_mbps: velocita,
    });
  });
  return cards;
}

async function renderFastwebExample(): Promise<void> {
  const html = await readFile(FASTWEB_FIXTURE, 'utf8');
  const offerte = parseFastwebFixture(html);
  const output = format({
    commodity: 'mobile',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('fastweb-mobile', output);
  process.stdout.write(`rendered examples/fastweb-mobile.{md,csv,json} (${offerte.length} offerte)\n`);
}

// ponytail: parse duplicated from src/scrapers/skywifi.ts for deterministic timestamps.
function parseSkywifiFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${SKYWIFI_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const gbText = $el.find('.offer-gb').first().text();
    const minutiText = $el.find('.offer-minuti').first().text();
    const techText = $el.find('.offer-tech').first().text();
    if (!codice || !nome) return;
    const match = prezzoText.match(/(\d{1,4}(?:[.,]\d{2})?)/);
    if (!match) return;
    const prezzo = Number(match[1].replace(',', '.'));
    const isIllimitato = (text: string): boolean => text.toLowerCase().includes('illimitat');
    const gbNumber = isIllimitato(gbText) ? -1 : Number(gbText.match(/(\d+)/)?.[1] ?? '0');
    const minuti = isIllimitato(minutiText) ? -1 : Number(minutiText.match(/(\d+)/)?.[1] ?? '0');
    const tecnologia = (() => {
      const v = techText.trim().toUpperCase();
      if (v === '5G+' || v === '5G PLUS') return '5G+' as const;
      if (v === '5G') return '5G' as const;
      return '4G' as const;
    })();
    const velocita = tecnologia === '5G+' ? 2000 : tecnologia === '5G' ? 1000 : 150;
    cards.push({
      commodity: 'mobile' satisfies Commodity,
      operatore_id: 'skywifi',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_mese: prezzo,
      gb: gbNumber,
      minuti,
      tipo_sim: 'entrambe',
      tecnologia,
      velocita_mbps: velocita,
    });
  });
  return cards;
}

async function renderSkywifiExample(): Promise<void> {
  const html = await readFile(SKYWIFI_FIXTURE, 'utf8');
  const offerte = parseSkywifiFixture(html);
  const output = format({
    commodity: 'mobile',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('skywifi-mobile', output);
  process.stdout.write(`rendered examples/skywifi-mobile.{md,csv,json} (${offerte.length} offerte)\n`);
}

// ponytail: parse duplicated from src/scrapers/postemobile.ts for deterministic timestamps.
function parsePostemobileFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${POSTEMOBILE_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const gbText = $el.find('.offer-gb').first().text();
    const minutiText = $el.find('.offer-minuti').first().text();
    const techText = $el.find('.offer-tech').first().text();
    if (!codice || !nome) return;
    const match = prezzoText.match(/(\d{1,4}(?:[.,]\d{2})?)/);
    if (!match) return;
    const prezzo = Number(match[1].replace(',', '.'));
    const isIllimitato = (text: string): boolean => text.toLowerCase().includes('illimitat');
    const gbNumber = isIllimitato(gbText) ? -1 : Number(gbText.match(/(\d+)/)?.[1] ?? '0');
    const minuti = isIllimitato(minutiText) ? -1 : Number(minutiText.match(/(\d+)/)?.[1] ?? '0');
    const tecnologia = (() => {
      const v = techText.trim().toUpperCase();
      if (v === '5G+' || v === '5G PLUS') return '5G+' as const;
      if (v === '5G') return '5G' as const;
      return '4G' as const;
    })();
    const velocita = tecnologia === '5G+' ? 2000 : tecnologia === '5G' ? 1000 : 150;
    cards.push({
      commodity: 'mobile' satisfies Commodity,
      operatore_id: 'postemobile',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_mese: prezzo,
      gb: gbNumber,
      minuti,
      tipo_sim: 'entrambe',
      tecnologia,
      velocita_mbps: velocita,
    });
  });
  return cards;
}

async function renderPostemobileExample(): Promise<void> {
  const html = await readFile(POSTEMOBILE_FIXTURE, 'utf8');
  const offerte = parsePostemobileFixture(html);
  const output = format({
    commodity: 'mobile',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('postemobile-mobile', output);
  process.stdout.write(`rendered examples/postemobile-mobile.{md,csv,json} (${offerte.length} offerte)\n`);
}

// ponytail: parse duplicated from src/scrapers/ho.ts for deterministic timestamps.
function parseHoFixture(html: string): readonly Offerta[] {
  const $ = load(html);
  const cards: Offerta[] = [];
  const url = `file://${HO_FIXTURE}`;
  $('article[data-offer]').each((_, el) => {
    const $el = $(el);
    const codice = $el.attr('data-offer-code');
    const nome = $el.find('.offer-name, h3').first().text().trim();
    const prezzoText = $el.find('.offer-price, .price').first().text();
    const gbText = $el.find('.offer-gb').first().text();
    const minutiText = $el.find('.offer-minuti').first().text();
    const techText = $el.find('.offer-tech').first().text();
    if (!codice || !nome) return;
    const match = prezzoText.match(/(\d{1,4}(?:[.,]\d{2})?)/);
    if (!match) return;
    const prezzo = Number(match[1].replace(',', '.'));
    const isIllimitato = (text: string): boolean => text.toLowerCase().includes('illimitat');
    const gbNumber = isIllimitato(gbText) ? -1 : Number(gbText.match(/(\d+)/)?.[1] ?? '0');
    const minuti = isIllimitato(minutiText) ? -1 : Number(minutiText.match(/(\d+)/)?.[1] ?? '0');
    const tecnologia = (() => {
      const v = techText.trim().toUpperCase();
      if (v === '5G+' || v === '5G PLUS') return '5G+' as const;
      if (v === '5G') return '5G' as const;
      return '4G' as const;
    })();
    const velocita = tecnologia === '5G+' ? 2000 : tecnologia === '5G' ? 1000 : 150;
    cards.push({
      commodity: 'mobile' satisfies Commodity,
      operatore_id: 'ho',
      codice_offerta: codice,
      nome_commerciale: nome,
      url_sorgente: url,
      scraped_at: SCRAPED_AT,
      prezzo_effettivo_euro_mese: prezzo,
      gb: gbNumber,
      minuti,
      tipo_sim: 'entrambe',
      tecnologia,
      velocita_mbps: velocita,
    });
  });
  return cards;
}

async function renderHoExample(): Promise<void> {
  const html = await readFile(HO_FIXTURE, 'utf8');
  const offerte = parseHoFixture(html);
  const output = format({
    commodity: 'mobile',
    scrapedAt: SCRAPED_AT,
    offerte,
    bundle: [],
    warnings: [],
    sourceCount: { ok: 1, total: 1 },
  });
  await writeExample('ho-mobile', output);
  process.stdout.write(`rendered examples/ho-mobile.{md,csv,json} (${offerte.length} offerte)\n`);
}

async function main(): Promise<void> {
  await renderEnelExample();
  await renderPlenitudeExample();
  await renderA2aExample();
  await renderIrenExample();
  await renderHeraExample();
  await renderAceaExample();
  await renderSorgeniaExample();
  await renderIllumiaExample();
  await renderEngieExample();
  await renderOctopusExample();
  await renderNenExample();
  await renderTimExample();
  await renderVodafoneExample();
  await renderIliadExample();
  await renderFastwebExample();
  await renderSkywifiExample();
  await renderPostemobileExample();
  await renderHoExample();
  await renderBundleExample();
}

void main();
