import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { V1_FIXTURE_SOURCES } from './v1-sources.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FIXTURES_DIR = resolve(ROOT, 'fixtures');
const FETCH_TIMEOUT_MS = 15_000;

const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

interface DownloadOk {
  readonly ok: true;
  readonly bytes: number;
}

interface DownloadFail {
  readonly ok: false;
  readonly reason: string;
}

type DownloadResult = DownloadOk | DownloadFail;

async function downloadOne(
  operatore: string,
  commodity: string,
  url: string,
): Promise<DownloadResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': DESKTOP_UA,
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status} ${response.statusText}` };
    }
    const body = await response.text();
    if (body.length === 0) {
      return { ok: false, reason: 'empty response body' };
    }
    const dir = resolve(FIXTURES_DIR, operatore);
    await mkdir(dir, { recursive: true });
    const file = resolve(dir, `${commodity}.html`);
    await writeFile(file, body, 'utf8');
    return { ok: true, bytes: body.length };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function main(): Promise<void> {
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;
  for (const spec of V1_FIXTURE_SOURCES) {
    if (spec.playwright) {
      process.stdout.write(
        `SKIP ${spec.operatore}/${spec.commodity}: Playwright required (ADR 0004)\n`,
      );
      skipped++;
      continue;
    }
    const result = await downloadOne(spec.operatore, spec.commodity, spec.url);
    if (result.ok) {
      process.stdout.write(
        `OK   ${spec.operatore}/${spec.commodity} (${result.bytes} bytes)\n`,
      );
      succeeded++;
    } else {
      process.stderr.write(
        `FAIL ${spec.operatore}/${spec.commodity}: ${result.reason}\n`,
      );
      failed++;
    }
  }
  process.stdout.write(`done: ${succeeded} ok, ${skipped} skipped, ${failed} failed\n`);
  if (succeeded === 0 && failed > 0) {
    process.exit(1);
  }
}

void main();