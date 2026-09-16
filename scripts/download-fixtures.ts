import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { V1_FIXTURE_SOURCES, type V1FixtureSource } from './v1-sources.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FIXTURES_DIR = resolve(ROOT, 'fixtures');
const FETCH_TIMEOUT_MS = 30_000;
const PAGE_SETTLE_TIMEOUT_MS = 5_000;

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

async function writeFixture(
  operatore: string,
  commodity: string,
  body: string,
): Promise<DownloadResult> {
  if (body.length === 0) {
    return { ok: false, reason: 'empty response body' };
  }
  const dir = resolve(FIXTURES_DIR, operatore);
  await mkdir(dir, { recursive: true });
  const file = resolve(dir, `${commodity}.html`);
  await writeFile(file, body, 'utf8');
  return { ok: true, bytes: body.length };
}

async function downloadViaCheerio(
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
    return await writeFixture(operatore, commodity, await response.text());
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function downloadViaPlaywright(
  operatore: string,
  commodity: string,
  url: string,
): Promise<DownloadResult> {
  const { launchBrowser } = await import('../src/browser/playwright.ts');
  let context;
  try {
    const browser = await launchBrowser();
    context = await browser.newContext({ userAgent: DESKTOP_UA, locale: 'it-IT' });
    const page = await context.newPage();
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: FETCH_TIMEOUT_MS,
    });
    await page
      .waitForLoadState('networkidle', { timeout: FETCH_TIMEOUT_MS })
      .catch(() => {});
    await page.waitForTimeout(PAGE_SETTLE_TIMEOUT_MS);
    return await writeFixture(operatore, commodity, await page.content());
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    if (context) await context.close();
  }
}

async function downloadSpec(spec: V1FixtureSource): Promise<DownloadResult> {
  return spec.playwright
    ? downloadViaPlaywright(spec.operatore, spec.commodity, spec.url)
    : downloadViaCheerio(spec.operatore, spec.commodity, spec.url);
}

async function main(): Promise<void> {
  let succeeded = 0;
  let failed = 0;
  for (const spec of V1_FIXTURE_SOURCES) {
    const transport = spec.playwright ? 'PW' : 'http';
    const result = await downloadSpec(spec);
    if (result.ok) {
      process.stdout.write(
        `OK   [${transport}] ${spec.operatore}/${spec.commodity} (${result.bytes} bytes)\n`,
      );
      succeeded++;
    } else {
      process.stderr.write(
        `FAIL [${transport}] ${spec.operatore}/${spec.commodity}: ${result.reason}\n`,
      );
      failed++;
    }
  }
  process.stdout.write(`done: ${succeeded} ok, ${failed} failed\n`);
  if (succeeded === 0 && failed > 0) {
    process.exit(1);
  }
}

void main();
