import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const modulePath = resolve(import.meta.dirname, '..', 'src', 'browser', 'playwright.ts');

test('playwright module loads without top-level side effects', async () => {
  const mod = await import('../src/browser/playwright.ts');
  assert.equal(typeof mod.launchBrowser, 'function');
});

test('playwright is loaded via dynamic import, not top-level import', async () => {
  const source = await readFile(modulePath, 'utf8');
  assert.ok(
    !/^import\s+(?!type\b)\S+.*from\s+['"]playwright['"]/m.test(source),
    'top-level `import ... from "playwright"` would defeat lazy loading (type-only imports are stripped at runtime)',
  );
  assert.ok(
    /await\s+import\(\s*['"]playwright['"]\s*\)/.test(source),
    'expected `await import("playwright")` inside launchBrowser for lazy loading',
  );
});