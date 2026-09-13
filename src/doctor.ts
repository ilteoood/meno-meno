import type { Commodity } from './types/offerta.ts';
import { createScraper } from './scrapers/index.ts';
import type { ScrapeSource, Scraper } from './scrapers/types.ts';
import { V1_FIXTURE_SOURCES } from '../scripts/v1-sources.ts';

export interface DoctorOptions {
  readonly operatore?: string;
  readonly source?: ScrapeSource;
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

export async function runDoctor(opts: DoctorOptions = {}): Promise<DoctorReport> {
  const generated_at = new Date().toISOString();
  const targets = opts.operatore
    ? V1_FIXTURE_SOURCES.filter((s) => s.operatore === opts.operatore)
    : V1_FIXTURE_SOURCES;

  const rows: DoctorRow[] = [];
  for (const target of targets) {
    rows.push(await checkOne(target.operatore, target.commodity, opts.source));
  }

  const hasReal = rows.some((r) => r.note !== NOT_REGISTERED_NOTE);
  return { ok: hasReal, generated_at, rows };
}

async function checkOne(
  operatoreId: string,
  commodity: Commodity,
  overrideSource: ScrapeSource | undefined,
): Promise<DoctorRow> {
  const source = overrideSource ?? { kind: 'live', url: v1Url(operatoreId, commodity) };
  const scraper = createScraper(operatoreId, commodity, source);
  if (scraper === null) {
    return unregisteredRow(operatoreId, commodity);
  }
  return scrapeRow(scraper, operatoreId, commodity);
}

async function scrapeRow(scraper: Scraper, operatoreId: string, commodity: Commodity): Promise<DoctorRow> {
  const scraped = await scraper.scrape();
  if (!scraped.ok) {
    return {
      operatore_id: operatoreId,
      commodity,
      http_status: null,
      offerte_count: 0,
      parse_ok: false,
      note: scraped.error ?? 'scrape failed',
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

function unregisteredRow(operatoreId: string, commodity: Commodity): DoctorRow {
  return {
    operatore_id: operatoreId,
    commodity,
    http_status: null,
    offerte_count: 0,
    parse_ok: false,
    note: NOT_REGISTERED_NOTE,
  };
}

function v1Url(operatoreId: string, commodity: Commodity): string {
  const src = V1_FIXTURE_SOURCES.find((s) => s.operatore === operatoreId && s.commodity === commodity);
  if (src) return src.url;
  throw new Error(`no v1 source for ${operatoreId}/${commodity}`);
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
    lines.push('_Nessuno scraper registrato per v1 — solo fixtures._');
  }
  return lines.join('\n') + '\n';
}