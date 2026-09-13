import type { Browser } from 'playwright';

let cached: Browser | null = null;

export async function launchBrowser(): Promise<Browser> {
  if (cached) return cached;
  const { chromium } = await import('playwright');
  cached = await chromium.launch();
  return cached;
}