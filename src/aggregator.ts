import type { Commodity } from '../types/offerta.ts';
import type { Offerta, OffertaBundle } from '../types/offerta.ts';
import type { Scraper, ScrapeResult } from './scrapers/types.ts';

export interface AggregateInput {
  readonly commodity: Commodity;
  readonly scrapers: readonly Scraper[];
}

export interface AggregateOk {
  readonly ok: true;
  readonly commodity: Commodity;
  readonly scrapedAt: string;
  readonly offerte: readonly Offerta[];
  readonly bundle: readonly OffertaBundle[];
  readonly warnings: readonly string[];
}

export interface AggregateFail {
  readonly ok: false;
  readonly commodity: Commodity;
  readonly scrapedAt: string;
  readonly error: string;
}

export type AggregateResult = AggregateOk | AggregateFail;

function nowIso(): string {
  return new Date().toISOString();
}

export async function aggregate(input: AggregateInput): Promise<AggregateResult> {
  const scrapedAt = nowIso();
  const results = await Promise.all(input.scrapers.map((s) => s.scrape()));

  const offerte: Offerta[] = [];
  const warnings: string[] = [];

  for (const result of results) {
    if (result.ok) {
      for (const offer of result.offerte) {
        if (offer.commodity === input.commodity) offerte.push(offer);
      }
    } else {
      const label =
        result.source.kind === 'live'
          ? result.source.url
          : `fixture:${result.source.path}`;
      warnings.push(`${label}: ${result.error}`);
    }
  }

  if (offerte.length === 0 && warnings.length > 0) {
    return {
      ok: false,
      commodity: input.commodity,
      scrapedAt,
      error: `all scrapers failed: ${warnings.join('; ')}`,
    };
  }

  return {
    ok: true,
    commodity: input.commodity,
    scrapedAt,
    offerte,
    bundle: [],
    warnings,
  };
}
