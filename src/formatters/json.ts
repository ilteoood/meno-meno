import type { Commodity, Offerta, OffertaBundle } from '../types/offerta.ts';

export interface JsonOutput {
  readonly commodity: Commodity;
  readonly scraped_at: string;
  readonly count: number;
  readonly offerte: {
    readonly singole: readonly Offerta[];
    readonly bundle: readonly OffertaBundle[];
  };
}

export function toJson(
  offerte: readonly Offerta[],
  commodity: Commodity,
  scrapedAt: string,
  bundle?: readonly OffertaBundle[],
): string {
  const payload: JsonOutput = {
    commodity,
    scraped_at: scrapedAt,
    count: offerte.length,
    offerte: {
      singole: offerte,
      bundle: bundle ?? [],
    },
  };
  return JSON.stringify(payload, null, 2) + '\n';
}
