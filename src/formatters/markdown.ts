import type { Offerta, OffertaBundle } from '../types/offerta.ts';
import type { Commodity } from '../types/offerta.ts';

function csvSafe(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function formatPrice(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function header(commodity: Commodity, timestamp: string): string {
  return `# Confronto ${commodity} — ${timestamp}`;
}

function tableHeader(commodity: Commodity): string {
  switch (commodity) {
    case 'luce':
      return '| Operatore | Offerta | €/kWh | Quota fissa €/anno | Verde | Meccanismo |';
    case 'gas':
      return '| Operatore | Offerta | €/Smc | Quota fissa €/anno | Verde | Meccanismo |';
    case 'mobile':
      return '| Operatore | Offerta | €/mese | GB | Minuti | Velocità |';
    case 'fisso':
      return '| Operatore | Offerta | €/mese | Tecnologia | Velocità Mbps |';
  }
}

function separator(): string {
  return '| --- | --- | --- | --- | --- | --- |';
}

function rowFor(o: Offerta): string {
  switch (o.commodity) {
    case 'luce':
      return `| ${csvSafe(o.operatore_id)} | ${csvSafe(o.nome_commerciale)} | ${formatPrice(o.prezzo_effettivo_euro_kwh)} | ${formatPrice(o.quota_fissa_euro_anno)} | [${o.green_flag}] | ${o.meccanismo_prezzo.tipo} |`;
    case 'gas':
      return `| ${csvSafe(o.operatore_id)} | ${csvSafe(o.nome_commerciale)} | ${formatPrice(o.prezzo_effettivo_euro_smc)} | ${formatPrice(o.quota_fissa_euro_anno)} | [${o.green_flag}] | ${o.meccanismo_prezzo.tipo} |`;
    case 'mobile':
      return `| ${csvSafe(o.operatore_id)} | ${csvSafe(o.nome_commerciale)} | ${formatPrice(o.prezzo_effettivo_euro_mese)} | ${o.gb} | ${o.minuti === -1 ? 'ILLIMITATO' : o.minuti} | ${o.velocita_mbps} |`;
    case 'fisso':
      return `| ${csvSafe(o.operatore_id)} | ${csvSafe(o.nome_commerciale)} | ${formatPrice(o.prezzo_effettivo_euro_mese)} | ${o.tecnologia} | ${o.velocita_mbps} |`;
  }
}

function bundleSection(bundle: readonly OffertaBundle[]): string {
  if (bundle.length === 0) return '';
  const lines = ['## Bundle luce+gas', ''];
  for (const b of bundle) {
    lines.push(`- ${b.operatore_id} — ${b.nome_commerciale}: componenti ${b.componenti.length}`);
  }
  return lines.join('\n');
}

export interface MarkdownInput {
  readonly commodity: Commodity;
  readonly scrapedAt: string;
  readonly offerte: readonly Offerta[];
  readonly bundle?: readonly OffertaBundle[];
  readonly warnings?: readonly string[];
  readonly sourceCount: { readonly ok: number; readonly total: number };
}

export function toMarkdown(input: MarkdownInput): string {
  const parts: string[] = [header(input.commodity, input.scrapedAt), ''];
  parts.push('## Tabella completa', '');
  parts.push(tableHeader(input.commodity));
  parts.push(separator());
  for (const o of input.offerte) parts.push(rowFor(o));
  parts.push('');
  parts.push('## Trade-off per offerta top-3');
  parts.push('');
  parts.push('<!-- LLM: genera blocco Trade-off per top-3 -->');
  parts.push('');
  parts.push('## Top-3 motivata');
  parts.push('');
  parts.push('<!-- LLM: genera top-3 motivata con 3 campi (Costo, Verde, Fissità) -->');
  parts.push('');
  if (input.warnings && input.warnings.length > 0) {
    parts.push('## Non disponibili', '');
    for (const w of input.warnings) parts.push(`- ${w}`);
    parts.push('');
  }
  if (input.bundle && input.bundle.length > 0) {
    parts.push(bundleSection(input.bundle));
    parts.push('');
  }
  parts.push(
    `Fonte: live scrape di ${input.sourceCount.ok}/${input.sourceCount.total} operatori.`,
  );
  return parts.join('\n');
}
