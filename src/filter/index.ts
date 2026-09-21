import type { Commodity, Offerta } from '../types/offerta.ts';

export type FilterOp = '<=' | '<' | '=' | '!=' | '>' | '>=';

export interface Constraint {
  readonly field: string;
  readonly op: FilterOp;
  readonly value: number;
}

export const ALIASES: Record<Commodity, Readonly<Record<string, string>>> = {
  mobile: {
    prezzo: 'prezzo_effettivo_euro_mese',
    gb: 'gb',
  },
  fisso: {
    prezzo: 'prezzo_effettivo_euro_mese',
  },
  luce: {
    prezzo: 'prezzo_effettivo_euro_kwh',
    costo_commercializzazione: 'quota_fissa_euro_anno',
  },
  gas: {
    prezzo: 'prezzo_effettivo_euro_smc',
    costo_commercializzazione: 'quota_fissa_euro_anno',
  },
};

const MONETARY_FIELDS: ReadonlySet<string> = new Set([
  'prezzo_effettivo_euro_mese',
  'prezzo_effettivo_euro_kwh',
  'prezzo_effettivo_euro_smc',
  'quota_fissa_euro_anno',
]);

const TOLERANCE = 1e-4;

const ATOM_RE = /^([a-z_]+)(<=|!=|>=|<|>|=)(-?[\d][\d.,]*)$/;

export function parseFilter(
  commodity: Commodity,
  expr: string,
): readonly Constraint[] {
  const trimmed = expr.trim();
  if (trimmed === '') {
    throw new Error('empty filter expression');
  }
  const atoms = trimmed.split('|');
  const constraints: Constraint[] = [];
  for (const atom of atoms) {
    const m = ATOM_RE.exec(atom.trim());
    if (!m) {
      throw new Error(`invalid filter atom: "${atom}" (atteso: alias<op>valore)`);
    }
    const alias = m[1]!;
    const op = m[2] as FilterOp;
    const rawValue = m[3]!.trim().replace(',', '.');
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      throw new Error(`invalid filter value: "${rawValue}" (atteso: numero)`);
    }
    const field = ALIASES[commodity][alias];
    if (field === undefined) {
      throw new Error(
        `alias "${alias}" non valido per commodity "${commodity}" (ammessi: ${Object.keys(ALIASES[commodity]).join(', ')})`,
      );
    }
    constraints.push({ field, op, value });
  }
  return constraints;
}

export type ValidateResult =
  | { ok: true; constraints: readonly Constraint[] }
  | { ok: false; error: string };

export function validateFilter(commodity: Commodity, expr: string): ValidateResult {
  try {
    return { ok: true, constraints: parseFilter(commodity, expr) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function matchConstraint(value: number, c: Constraint, monetary: boolean): boolean {
  switch (c.op) {
    case '<':
      return value < c.value;
    case '<=':
      return value <= c.value;
    case '=':
      return monetary ? Math.abs(value - c.value) <= TOLERANCE : value === c.value;
    case '!=':
      return monetary ? Math.abs(value - c.value) > TOLERANCE : value !== c.value;
    case '>':
      return value > c.value;
    case '>=':
      return value >= c.value;
  }
}

export interface FilterOfferteInput {
  readonly commodity: Commodity;
  readonly offerte: readonly Offerta[];
  readonly constraints: readonly Constraint[];
}

export function filterOfferte(input: FilterOfferteInput): readonly Offerta[] {
  if (input.constraints.length === 0) return input.offerte;
  const byField = new Map<string, readonly Constraint[]>();
  for (const c of input.constraints) {
    const list = byField.get(c.field);
    if (list) {
      byField.set(c.field, [...list, c]);
    } else {
      byField.set(c.field, [c]);
    }
  }
  return input.offerte.filter((o) => {
    if (o.commodity !== input.commodity) return false;
    for (const [field, constraints] of byField) {
      const value = (o as unknown as Record<string, unknown>)[field];
      if (typeof value !== 'number') return false;
      const monetary = MONETARY_FIELDS.has(field);
      if (!constraints.some((c) => matchConstraint(value, c, monetary))) return false;
    }
    return true;
  });
}
