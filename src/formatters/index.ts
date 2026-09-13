import type { Commodity, Offerta, OffertaBundle } from '../types/offerta.ts';
import { toMarkdown } from './markdown.ts';
import { toCsv } from './csv.ts';
import { toJson } from './json.ts';

export interface FormattedOutput {
  readonly markdown: string;
  readonly csv: string;
  readonly json: string;
}

export interface FormatInput {
  readonly commodity: Commodity;
  readonly scrapedAt: string;
  readonly offerte: readonly Offerta[];
  readonly bundle?: readonly OffertaBundle[];
  readonly warnings?: readonly string[];
  readonly sourceCount: { readonly ok: number; readonly total: number };
}

export function format(input: FormatInput): FormattedOutput {
  return {
    markdown: toMarkdown({
      commodity: input.commodity,
      scrapedAt: input.scrapedAt,
      offerte: input.offerte,
      bundle: input.bundle,
      warnings: input.warnings,
      sourceCount: input.sourceCount,
    }),
    csv: toCsv(input.offerte, input.commodity),
    json: toJson(input.offerte, input.commodity, input.scrapedAt, input.bundle),
  };
}

export { toMarkdown, toCsv, toJson };
