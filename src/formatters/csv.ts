import type { Commodity, Offerta, OffertaBundle } from '../types/offerta.ts';

const COLUMNS = [
  'tipo',
  'commodity',
  'operatore_id',
  'codice_offerta',
  'bundle_id',
  'nome_commerciale',
  'prezzo_effettivo',
  'unita_prezzo',
  'quota_fissa_euro_anno',
  'meccanismo_prezzo',
  'green_flag',
  'gb',
  'minuti',
  'tipo_sim',
  'tecnologia',
  'costo_attivazione_euro',
  'durata_mesi',
  'sconto_bundle_euro_anno',
  'url_sorgente',
  'scraped_at',
] as const;

const IDX = {
  tipo: 0,
  commodity: 1,
  operatore_id: 2,
  codice_offerta: 3,
  bundle_id: 4,
  nome_commerciale: 5,
  prezzo_effettivo: 6,
  unita_prezzo: 7,
  quota_fissa_euro_anno: 8,
  meccanismo_prezzo: 9,
  green_flag: 10,
  gb: 11,
  minuti: 12,
  tipo_sim: 13,
  tecnologia: 14,
  costo_attivazione_euro: 15,
  durata_mesi: 16,
  sconto_bundle_euro_anno: 17,
  url_sorgente: 18,
  scraped_at: 19,
} as const;

function escapeCsv(value: string | number | undefined): string {
  if (value === undefined) return '';
  const s = String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowFor(o: Offerta): readonly string[] {
  const out: string[] = new Array(COLUMNS.length).fill('');
  out[IDX.tipo] = 'Offerta';
  out[IDX.commodity] = o.commodity;
  out[IDX.operatore_id] = o.operatore_id;
  out[IDX.codice_offerta] = o.codice_offerta;
  out[IDX.nome_commerciale] = o.nome_commerciale;
  out[IDX.quota_fissa_euro_anno] = String(o.quota_fissa_euro_anno);
  out[IDX.durata_mesi] = o.durata_mesi !== undefined ? String(o.durata_mesi) : '';
  out[IDX.url_sorgente] = o.url_sorgente;
  out[IDX.scraped_at] = o.scraped_at;

  switch (o.commodity) {
    case 'luce':
      out[IDX.prezzo_effettivo] = String(o.prezzo_effettivo_euro_kwh);
      out[IDX.unita_prezzo] = 'EUR/kWh';
      out[IDX.meccanismo_prezzo] = o.meccanismo_prezzo.tipo;
      out[IDX.green_flag] = o.green_flag;
      break;
    case 'gas':
      out[IDX.prezzo_effettivo] = String(o.prezzo_effettivo_euro_smc);
      out[IDX.unita_prezzo] = 'EUR/Smc';
      out[IDX.meccanismo_prezzo] = o.meccanismo_prezzo.tipo;
      out[IDX.green_flag] = o.green_flag;
      break;
    case 'mobile':
      out[IDX.prezzo_effettivo] = String(o.prezzo_effettivo_euro_mese);
      out[IDX.unita_prezzo] = 'EUR/mese';
      out[IDX.gb] = String(o.gb);
      out[IDX.minuti] = String(o.minuti);
      out[IDX.tipo_sim] = o.tipo_sim;
      out[IDX.tecnologia] = o.tecnologia;
      if (o.costo_attivazione_euro !== undefined) {
        out[IDX.costo_attivazione_euro] = String(o.costo_attivazione_euro);
      }
      break;
    case 'fisso':
      out[IDX.prezzo_effettivo] = String(o.prezzo_effettivo_euro_mese);
      out[IDX.unita_prezzo] = 'EUR/mese';
      out[IDX.tecnologia] = o.tecnologia;
      if (o.costo_attivazione_euro !== undefined) {
        out[IDX.costo_attivazione_euro] = String(o.costo_attivazione_euro);
      }
      break;
  }
  return out.map(escapeCsv);
}

function rowForBundle(b: OffertaBundle): readonly string[] {
  const out: string[] = new Array(COLUMNS.length).fill('');
  out[IDX.tipo] = 'Bundle';
  out[IDX.operatore_id] = b.operatore_id;
  out[IDX.bundle_id] = b.bundle_id;
  out[IDX.nome_commerciale] = b.nome_commerciale;
  out[IDX.durata_mesi] = b.durata_mesi !== null ? String(b.durata_mesi) : '';
  out[IDX.sconto_bundle_euro_anno] = b.sconto_bundle_euro_anno !== null
    ? String(b.sconto_bundle_euro_anno)
    : '';
  out[IDX.url_sorgente] = b.url_sorgente;
  out[IDX.scraped_at] = b.scraped_at;
  return out.map(escapeCsv);
}

export function toCsv(
  offerte: readonly Offerta[],
  _commodity: Commodity,
  bundle?: readonly OffertaBundle[],
): string {
  const lines: string[] = [COLUMNS.join(',')];
  for (const o of offerte) lines.push(rowFor(o).join(','));
  if (bundle) {
    for (const b of bundle) lines.push(rowForBundle(b).join(','));
  }
  return lines.join('\n') + '\n';
}
