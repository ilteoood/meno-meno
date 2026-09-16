import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Commodity } from './types/offerta.ts';
import { createScraper } from './scrapers/index.ts';
import type { ScrapeSource, Scraper, ScrapeResult } from './scrapers/types.ts';
import { V1_FIXTURE_SOURCES } from '../scripts/v1-sources.ts';

export interface DoctorOptions {
  readonly operatore?: string;
  readonly source?: ScrapeSource;
  readonly live?: boolean;
  readonly timeoutMs?: number;
}

export interface DoctorRow {
  readonly operatore_id: string;
  readonly commodity: Commodity;
  readonly http_status: number | null;
  readonly offerte_count: number;
  readonly parse_ok: boolean;
  readonly note: string;
}

export interface DoctorReport {
  readonly ok: boolean;
  readonly generated_at: string;
  readonly rows: readonly DoctorRow[];
}

const NOT_REGISTERED_NOTE = 'scraper not yet registered for v1';
const FIXTURE_MISSING_NOTE = 'fixture file not found for v1';
const DEFAULT_TIMEOUT_MS = 15_000;
const REPO_ROOT = resolve(import.meta.dirname, '..');

export async function runDoctor(opts: DoctorOptions = {}): Promise<DoctorReport> {
  const generated_at = new Date().toISOString();
  const targets = opts.operatore
    ? V1_FIXTURE_SOURCES.filter((s) => s.operatore === opts.operatore)
    : V1_FIXTURE_SOURCES;

  const live = opts.live === true;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const rows: DoctorRow[] = [];
  for (const target of targets) {
    rows.push(await checkOne(target.operatore, target.commodity, opts.source, live, timeoutMs));
  }

  const ok = rows.length > 0 && rows.every((r) => r.parse_ok && r.offerte_count > 0);
  return { ok, generated_at, rows };
}

async function checkOne(
  operatoreId: string,
  commodity: Commodity,
  overrideSource: ScrapeSource | undefined,
  live: boolean,
  timeoutMs: number,
): Promise<DoctorRow> {
  const source = overrideSource ?? defaultSource(operatoreId, commodity, live);
  if (source === null) {
    return {
      operatore_id: operatoreId,
      commodity,
      http_status: null,
      offerte_count: 0,
      parse_ok: false,
      note: FIXTURE_MISSING_NOTE,
    };
  }
  const scraper = createScraper(operatoreId, commodity, source);
  if (scraper === null) {
    return {
      operatore_id: operatoreId,
      commodity,
      http_status: null,
      offerte_count: 0,
      parse_ok: false,
      note: NOT_REGISTERED_NOTE,
    };
  }
  return scrapeRow(scraper, operatoreId, commodity, source, timeoutMs);
}

function defaultSource(operatoreId: string, commodity: Commodity, live: boolean): ScrapeSource | null {
  if (live) {
    return { kind: 'live', url: v1Url(operatoreId, commodity) };
  }
  const path = resolve(REPO_ROOT, 'fixtures', operatoreId, `${commodity}.html`);
  return isFile(path) ? { kind: 'fixture', path } : null;
}

function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}

function v1Url(operatoreId: string, commodity: Commodity): string {
  const src = V1_FIXTURE_SOURCES.find((s) => s.operatore === operatoreId && s.commodity === commodity);
  if (src) return src.url;
  throw new Error(`no v1 source for ${operatoreId}/${commodity}`);
}

async function scrapeRow(
  scraper: Scraper,
  operatoreId: string,
  commodity: Commodity,
  source: ScrapeSource,
  timeoutMs: number,
): Promise<DoctorRow> {
  const scraped = await scrapeWithTimeout(scraper, timeoutMs);
  if (!scraped.ok) {
    return {
      operatore_id: operatoreId,
      commodity,
      http_status: null,
      offerte_count: 0,
      parse_ok: false,
      note: scraped.error,
    };
  }
  const count = scraped.offerte.length;
  return {
    operatore_id: operatoreId,
    commodity,
    http_status: 200,
    offerte_count: count,
    parse_ok: count > 0,
    note: count > 0 ? 'OK' : 'no offer cards parsed from source',
  };
}

// ponytail: per-row live-mode safeguard so WindTre Perfdrive can't hang the
// whole doctor run; abandoned scrape keeps running in background but doctor moves on.
async function scrapeWithTimeout(scraper: Scraper, timeoutMs: number): Promise<ScrapeResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([scraper.scrape(), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function doctorToMarkdown(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(`# Skill doctor — ${report.generated_at}`);
  lines.push('');
  lines.push('| Operatore | Commodity | HTTP | Offerte | Parse | Note |');
  lines.push('|-----------|-----------|------|---------|-------|------|');
  for (const row of report.rows) {
    const http = row.http_status === null ? '—' : String(row.http_status);
    const offerte = String(row.offerte_count);
    const parse = row.parse_ok ? 'OK' : 'FAIL';
    lines.push(`| ${row.operatore_id} | ${row.commodity} | ${http} | ${offerte} | ${parse} | ${row.note} |`);
  }
  if (!report.ok) {
    lines.push('');
    lines.push('_Almeno un operatore degradato — verifica `npm run doctor -- --live`._');
  }
  return lines.join('\n') + '\n';
}
