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

async function main(): Promise<void> {
  await renderEnelExample();
  await renderPlenitudeExample();
  await renderA2aExample();
  await renderIrenExample();
  await renderHeraExample();
  await renderBundleExample();
}

void main();
