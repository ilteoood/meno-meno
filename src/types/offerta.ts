export const ILLIMITATO = -1;
export const NON_INCLUSO = 0;

export type Commodity = 'luce' | 'gas' | 'telco';
export type GreenFlag = 'A' | 'B' | 'C' | 'D';
export type TipoSim = 'eSIM' | 'fisica' | 'entrambe';

export type MeccanismoPrezzo =
  | { tipo: 'fisso' }
  | { tipo: 'PUN'; spread_euro_kwh: number }
  | { tipo: 'PSV'; spread_euro_smc: number }
  | { tipo: 'altro'; descrizione: string };

export interface OffertaBase {
  operatore_id: string;
  codice_offerta: string;
  nome_commerciale: string;
  url_sorgente: string;
  scraped_at: string;
  durata_mesi?: number;
  vincoli?: string;
  penali_uscita?: string;
  note?: string;
}

export interface OffertaLuce extends OffertaBase {
  commodity: 'luce';
  prezzo_effettivo_euro_kwh: number;
  quota_fissa_euro_anno: number;
  meccanismo_prezzo: MeccanismoPrezzo;
  green_flag: GreenFlag;
}

export interface OffertaGas extends OffertaBase {
  commodity: 'gas';
  prezzo_effettivo_euro_smc: number;
  quota_fissa_euro_anno: number;
  meccanismo_prezzo: MeccanismoPrezzo;
  green_flag: GreenFlag;
}

export interface OffertaTelco extends OffertaBase {
  commodity: 'telco';
  prezzo_effettivo_euro_mese: number;
  gb: number;
  minuti: number;
  tipo_sim: TipoSim;
  costo_attivazione_euro?: number;
}

export type Offerta = OffertaLuce | OffertaGas | OffertaTelco;
