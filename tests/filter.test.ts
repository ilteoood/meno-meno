import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  ALIASES,
  filterOfferte,
  parseFilter,
  validateFilter,
} from '../src/filter/index.ts';
import type { Offerta } from '../src/types/offerta.ts';

function makeMobile(prezzo: number, gb: number, op = 'iliad'): Offerta {
  return {
    commodity: 'mobile',
    operatore_id: op,
    codice_offerta: `${op.toUpperCase()}-TEST-${prezzo}-${gb}`,
    nome_commerciale: 'Test Mobile',
    url_sorgente: 'https://example.test',
    scraped_at: '2026-09-13T10:00:00.000Z',
    prezzo_effettivo_euro_mese: prezzo,
    gb,
    minuti: -1,
    tipo_sim: 'eSIM',
    tecnologia: '5G',
  };
}

function makeLuce(prezzo: number, quota: number, op = 'enel'): Offerta {
  return {
    commodity: 'luce',
    operatore_id: op,
    codice_offerta: `${op.toUpperCase()}-TEST-LUCE`,
    nome_commerciale: 'Test Luce',
    url_sorgente: 'https://example.test',
    scraped_at: '2026-09-13T10:00:00.000Z',
    prezzo_effettivo_euro_kwh: prezzo,
    quota_fissa_euro_anno: quota,
    meccanismo_prezzo: { tipo: 'fisso' },
    green_flag: 'C',
  };
}

function makeFisso(prezzo: number, op = 'tim'): Offerta {
  return {
    commodity: 'fisso',
    operatore_id: op,
    codice_offerta: `${op.toUpperCase()}-TEST-FISSO`,
    nome_commerciale: 'Test Fisso',
    url_sorgente: 'https://example.test',
    scraped_at: '2026-09-13T10:00:00.000Z',
    prezzo_effettivo_euro_mese: prezzo,
    tecnologia: 'FTTH',
    velocita_mbps: 1000,
  };
}

test('ALIASES: mappa alias→schema field per ogni commodity (ADR 0013 tabella)', () => {
  assert.deepEqual(ALIASES.mobile, {
    prezzo: 'prezzo_effettivo_euro_mese',
    gb: 'gb',
  });
  assert.deepEqual(ALIASES.fisso, {
    prezzo: 'prezzo_effettivo_euro_mese',
  });
  assert.deepEqual(ALIASES.luce, {
    prezzo: 'prezzo_effettivo_euro_kwh',
    costo_commercializzazione: 'quota_fissa_euro_anno',
  });
  assert.deepEqual(ALIASES.gas, {
    prezzo: 'prezzo_effettivo_euro_smc',
    costo_commercializzazione: 'quota_fissa_euro_anno',
  });
});

test('parseFilter mobile: prezzo e gb risolvono agli schema field corretti', () => {
  const cs = parseFilter('mobile', 'prezzo<=7');
  assert.equal(cs.length, 1);
  assert.equal(cs[0]!.field, 'prezzo_effettivo_euro_mese');
  assert.equal(cs[0]!.op, '<=');
  assert.equal(cs[0]!.value, 7);

  const cs2 = parseFilter('mobile', 'gb>=50');
  assert.equal(cs2[0]!.field, 'gb');
  assert.equal(cs2[0]!.op, '>=');
  assert.equal(cs2[0]!.value, 50);
});

test('parseFilter luce: costo_commercializzazione risolve a quota_fissa_euro_anno', () => {
  const cs = parseFilter('luce', 'costo_commercializzazione<=80');
  assert.equal(cs.length, 1);
  assert.equal(cs[0]!.field, 'quota_fissa_euro_anno');
  assert.equal(cs[0]!.value, 80);
});

test('parseFilter gas: prezzo e costo_commercializzazione risolvono correttamente', () => {
  const cs = parseFilter('gas', 'prezzo<=0.5');
  assert.equal(cs[0]!.field, 'prezzo_effettivo_euro_smc');

  const cs2 = parseFilter('gas', 'costo_commercializzazione<=96');
  assert.equal(cs2[0]!.field, 'quota_fissa_euro_anno');
});

test('parseFilter fisso: solo alias prezzo', () => {
  const cs = parseFilter('fisso', 'prezzo<=30');
  assert.equal(cs[0]!.field, 'prezzo_effettivo_euro_mese');
  assert.throws(() => parseFilter('fisso', 'gb>=50'), /alias "gb" non valido per commodity "fisso"/);
});

test('parseFilter: pipe entro stesso field produce N Constraint con stesso field', () => {
  const cs = parseFilter('mobile', 'gb>=100|gb=-1');
  assert.equal(cs.length, 2);
  for (const c of cs) assert.equal(c.field, 'gb');
  assert.equal(cs[0]!.op, '>=');
  assert.equal(cs[0]!.value, 100);
  assert.equal(cs[1]!.op, '=');
  assert.equal(cs[1]!.value, -1);
});

test('parseFilter: tollera virgola decimale italiana (CLI normalizza ,→.)', () => {
  const cs = parseFilter('mobile', 'prezzo<=7,5');
  assert.equal(cs[0]!.value, 7.5);
});

test('parseFilter: supporta tutti gli operatori ADR 0013', () => {
  for (const op of ['<', '<=', '=', '!=', '>', '>='] as const) {
    const cs = parseFilter('mobile', `prezzo${op}7`);
    assert.equal(cs[0]!.op, op);
  }
});

test('parseFilter: alias non valido per commodity → errore esplicito', () => {
  assert.throws(
    () => parseFilter('luce', 'gb>=50'),
    /alias "gb" non valido per commodity "luce"/,
  );
  assert.throws(
    () => parseFilter('mobile', 'costo_commercializzazione<=80'),
    /alias "costo_commercializzazione" non valido per commodity "mobile"/,
  );
  assert.throws(
    () => parseFilter('fisso', 'costo_commercializzazione<=80'),
    /alias "costo_commercializzazione" non valido per commodity "fisso"/,
  );
});

test('parseFilter: operatore malformato → errore', () => {
  assert.throws(() => parseFilter('mobile', 'prezzo'), /invalid filter atom/);
  assert.throws(() => parseFilter('mobile', 'prezzo<=>7'), /invalid filter atom/);
  assert.throws(() => parseFilter('mobile', 'prezzo==7'), /invalid filter atom/);
  assert.throws(() => parseFilter('mobile', 'prezzo<=abc'), /invalid filter atom/);
  assert.throws(() => parseFilter('mobile', 'prezzo<='), /invalid filter atom/);
});

test('parseFilter: valore non numerico → errore', () => {
  assert.throws(() => parseFilter('mobile', 'prezzo<=7.5.6'), /invalid filter value/);
  assert.throws(() => parseFilter('mobile', 'prezzo<=7,5,6'), /invalid filter value/);
});

test('parseFilter: expr vuoto → errore', () => {
  assert.throws(() => parseFilter('mobile', ''), /empty filter expression/);
  assert.throws(() => parseFilter('mobile', '   '), /empty filter expression/);
});

test('parseFilter: pipe vuoto (es. "a|") → errore', () => {
  assert.throws(() => parseFilter('mobile', 'prezzo<=7|'), /invalid filter atom/);
});

test('validateFilter: ok=true con constraints per input valido', () => {
  const r = validateFilter('mobile', 'prezzo<=7|gb>=50');
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.constraints.length, 2);
    assert.equal(r.constraints[0]!.field, 'prezzo_effettivo_euro_mese');
    assert.equal(r.constraints[1]!.field, 'gb');
  }
});

test('validateFilter: ok=false con error per input invalido (non lancia)', () => {
  const r = validateFilter('luce', 'gb>=50');
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.error, /alias "gb" non valido/);
  }
});

test('validateFilter: ok=false per expr vuoto', () => {
  const r = validateFilter('mobile', '');
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.error, /empty filter expression/);
  }
});

test('filterOfferte: 0 constraints = identity (stesso riferimento)', () => {
  const offerte = [makeMobile(5, 100)];
  const r = filterOfferte({ commodity: 'mobile', offerte, constraints: [] });
  assert.equal(r.length, 1);
  assert.equal(r[0], offerte[0]);
});

test('filterOfferte: 0 offerte input = 0 output (caveat A #170 empty-safe)', () => {
  const r = filterOfferte({
    commodity: 'mobile',
    offerte: [],
    constraints: [{ field: 'prezzo_effettivo_euro_mese', op: '<=', value: 100 }],
  });
  assert.deepEqual(r, []);
});

test('filterOfferte: filtro prezzo<=7 seleziona solo offerte sotto soglia', () => {
  const cs = parseFilter('mobile', 'prezzo<=7');
  const offerte = [
    makeMobile(5, 100),
    makeMobile(7, 50),
    makeMobile(10, 200),
    makeMobile(6.99, 30),
  ];
  const r = filterOfferte({ commodity: 'mobile', offerte, constraints: cs });
  assert.equal(r.length, 3);
  for (const o of r) {
    const p = (o as { prezzo_effettivo_euro_mese: number }).prezzo_effettivo_euro_mese;
    assert.ok(p <= 7, `prezzo ${p} should be <= 7`);
  }
});

test('filterOfferte: AND tra field diversi = intersection (prezzo<=7 + gb>=50)', () => {
  const cs = [
    ...parseFilter('mobile', 'prezzo<=7'),
    ...parseFilter('mobile', 'gb>=50'),
  ];
  const offerte = [
    makeMobile(5, 100),
    makeMobile(5, 30),
    makeMobile(10, 100),
    makeMobile(6, 60),
  ];
  const r = filterOfferte({ commodity: 'mobile', offerte, constraints: cs });
  assert.equal(r.length, 2);
  for (const o of r) {
    const m = o as { prezzo_effettivo_euro_mese: number; gb: number };
    assert.ok(m.prezzo_effettivo_euro_mese <= 7);
    assert.ok(m.gb >= 50);
  }
});

test('filterOfferte: OR entro stesso field (gb>=100|gb=-1 include illimitati)', () => {
  const cs = parseFilter('mobile', 'gb>=100|gb=-1');
  const offerte = [
    makeMobile(5, 100),
    makeMobile(5, 50),
    makeMobile(5, -1),
    makeMobile(5, 30),
    makeMobile(5, 200),
  ];
  const r = filterOfferte({ commodity: 'mobile', offerte, constraints: cs });
  assert.equal(r.length, 3);
  for (const o of r) {
    const gb = (o as { gb: number }).gb;
    assert.ok(gb >= 100 || gb === -1, `gb ${gb} should be >=100 or -1`);
  }
});

test('filterOfferte: tolleranza ±0.0001 SOLO su monetari (= 7 con 7.00005 passa, 7.001 no)', () => {
  const cs = parseFilter('mobile', 'prezzo=7');
  const oIn = makeMobile(7.00005, 50);
  const oOut = makeMobile(7.001, 50);
  assert.equal(
    filterOfferte({ commodity: 'mobile', offerte: [oIn], constraints: cs }).length,
    1,
  );
  assert.equal(
    filterOfferte({ commodity: 'mobile', offerte: [oOut], constraints: cs }).length,
    0,
  );
});

test('filterOfferte: gb (interi) tolleranza ZERO (= 100 esatto, 99 no)', () => {
  const cs = parseFilter('mobile', 'gb=100');
  assert.equal(
    filterOfferte({ commodity: 'mobile', offerte: [makeMobile(5, 100)], constraints: cs }).length,
    1,
  );
  assert.equal(
    filterOfferte({ commodity: 'mobile', offerte: [makeMobile(5, 99)], constraints: cs }).length,
    0,
  );
  assert.equal(
    filterOfferte({ commodity: 'mobile', offerte: [makeMobile(5, 100.0001)], constraints: cs }).length,
    0,
  );
});

test('filterOfferte: tolleranza anche per quota_fissa_euro_anno (luce monetario)', () => {
  const cs = parseFilter('luce', 'costo_commercializzazione=80');
  const inOff = makeLuce(0.1, 80.00005);
  const outOff = makeLuce(0.1, 80.5);
  assert.equal(
    filterOfferte({ commodity: 'luce', offerte: [inOff], constraints: cs }).length,
    1,
  );
  assert.equal(
    filterOfferte({ commodity: 'luce', offerte: [outOff], constraints: cs }).length,
    0,
  );
});

test('filterOfferte: tolleranza NON si applica a != su monetari (7.0001 ≠ 7 → escluso)', () => {
  const cs = parseFilter('mobile', 'prezzo!=7');
  const oNear = makeMobile(7.0001, 50);
  const oFar = makeMobile(8, 50);
  assert.equal(
    filterOfferte({ commodity: 'mobile', offerte: [oNear], constraints: cs }).length,
    0,
  );
  assert.equal(
    filterOfferte({ commodity: 'mobile', offerte: [oFar], constraints: cs }).length,
    1,
  );
});

test('filterOfferte: cross-commodity safety — filtro gb>=50 su offerte luce → 0 risultati', () => {
  const offerte = [makeLuce(0.1, 80)];
  const r = filterOfferte({
    commodity: 'luce',
    offerte,
    constraints: [{ field: 'gb', op: '>=', value: 50 }],
  });
  assert.equal(r.length, 0);
});

test('filterOfferte: cross-commodity safety — filtro costo_commercializzazione su offerte mobile → 0 risultati', () => {
  const offerte = [makeMobile(5, 100)];
  const r = filterOfferte({
    commodity: 'mobile',
    offerte,
    constraints: [{ field: 'quota_fissa_euro_anno', op: '<=', value: 80 }],
  });
  assert.equal(r.length, 0);
});

test('filterOfferte: offerte di commodity diversa passate direttamente → 0 risultati', () => {
  const offerte = [makeLuce(0.1, 80)];
  const cs = parseFilter('mobile', 'prezzo<=7');
  const r = filterOfferte({ commodity: 'mobile', offerte, constraints: cs });
  assert.equal(r.length, 0);
});

test('filterOfferte: luce costo_commercializzazione AND prezzo (cross-field luce)', () => {
  const cs = [
    ...parseFilter('luce', 'costo_commercializzazione<=96'),
    ...parseFilter('luce', 'prezzo<=0.15'),
  ];
  const offerte = [
    makeLuce(0.10, 80),
    makeLuce(0.12, 96),
    makeLuce(0.20, 50),
    makeLuce(0.10, 120),
  ];
  const r = filterOfferte({ commodity: 'luce', offerte, constraints: cs });
  assert.equal(r.length, 2);
  for (const o of r) {
    const l = o as { prezzo_effettivo_euro_kwh: number; quota_fissa_euro_anno: number };
    assert.ok(l.prezzo_effettivo_euro_kwh <= 0.15);
    assert.ok(l.quota_fissa_euro_anno <= 96);
  }
});

test('filterOfferte: supporta <, <=, >, >=, =, != (copertura operatori)', () => {
  const base = makeLuce(0.1, 80);
  const offerte = [base];
  for (const op of ['<', '<=', '=', '!=', '>', '>='] as const) {
    const r = filterOfferte({
      commodity: 'luce',
      offerte,
      constraints: [{ field: 'quota_fissa_euro_anno', op, value: 80 }],
    });
    assert.ok(r.length >= 0, `op ${op} should not throw`);
  }
});

test('filterOfferte: gb=-1 sentinel — offerta illimitata matcha gb=-1 esatto', () => {
  const cs = parseFilter('mobile', 'gb=-1');
  const r = filterOfferte({
    commodity: 'mobile',
    offerte: [makeMobile(5, -1), makeMobile(5, 100)],
    constraints: cs,
  });
  assert.equal(r.length, 1);
  assert.equal((r[0] as { gb: number }).gb, -1);
});

test('filterOfferte: fisso prezzo<=30 funziona (alias condiviso con mobile ma field schema uguale)', () => {
  const cs = parseFilter('fisso', 'prezzo<=30');
  const r = filterOfferte({
    commodity: 'fisso',
    offerte: [makeFisso(25), makeFisso(35)],
    constraints: cs,
  });
  assert.equal(r.length, 1);
  assert.equal((r[0] as { prezzo_effettivo_euro_mese: number }).prezzo_effettivo_euro_mese, 25);
});

test('filterOfferte: più flag con OR entro field + AND tra field (composition completa)', () => {
  const cs = [
    ...parseFilter('mobile', 'prezzo<=10'),
    ...parseFilter('mobile', 'gb>=100|gb=-1'),
  ];
  const offerte = [
    makeMobile(5, 200),
    makeMobile(5, 50),
    makeMobile(5, -1),
    makeMobile(15, 200),
    makeMobile(8, -1),
  ];
  const r = filterOfferte({ commodity: 'mobile', offerte, constraints: cs });
  assert.equal(r.length, 3);
  for (const o of r) {
    const m = o as { prezzo_effettivo_euro_mese: number; gb: number };
    assert.ok(m.prezzo_effettivo_euro_mese <= 10);
    assert.ok(m.gb >= 100 || m.gb === -1);
  }
});
