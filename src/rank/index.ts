import type {
  Commodity,
  GreenFlag,
  MeccanismoPrezzo,
  Offerta,
} from '../types/offerta.ts';

export const CONSUMO_TIPO_KWH_LUCE = 2700;
export const CONSUMO_TIPO_SMC_GAS = 1400;

const GREEN_FLAG_ORDER: Record<GreenFlag, number> = { A: 0, B: 1, C: 2, D: 3 };

const MECCANISMO_ORDER: Record<MeccanismoPrezzo['tipo'], number> = {
  fisso: 0,
  PUN: 1,
  PSV: 2,
  altro: 3,
};

export interface ScoredOfferta {
  readonly offerta: Offerta;
  readonly costo_annuo_stimato_euro: number;
}

export interface RankInput {
  readonly commodity: Commodity;
  readonly offerte: readonly Offerta[];
}

export interface RankOutput {
  readonly commodity: Commodity;
  readonly top: readonly ScoredOfferta[];
  readonly esclusi: readonly ScoredOfferta[];
}

export function costoAnnuoStimato(o: Offerta): number {
  switch (o.commodity) {
    case 'luce':
      return (
        o.prezzo_effettivo_euro_kwh * CONSUMO_TIPO_KWH_LUCE +
        o.quota_fissa_euro_anno
      );
    case 'gas':
      return (
        o.prezzo_effettivo_euro_smc * CONSUMO_TIPO_SMC_GAS +
        o.quota_fissa_euro_anno
      );
    case 'mobile':
    case 'fisso':
      return (
        o.prezzo_effettivo_euro_mese * 12 +
        (o.costo_attivazione_euro ?? 0)
      );
  }
}

function tierCompare(a: Offerta, b: Offerta): number {
  const costoDiff = costoAnnuoStimato(a) - costoAnnuoStimato(b);
  if (costoDiff !== 0) return costoDiff;
  if (a.commodity !== b.commodity) return 0;
  switch (a.commodity) {
    case 'luce':
    case 'gas': {
      const greenDiff =
        GREEN_FLAG_ORDER[a.green_flag] - GREEN_FLAG_ORDER[b.green_flag];
      if (greenDiff !== 0) return greenDiff;
      return (
        MECCANISMO_ORDER[a.meccanismo_prezzo.tipo] -
        MECCANISMO_ORDER[b.meccanismo_prezzo.tipo]
      );
    }
    case 'mobile':
      return b.gb - a.gb;
    case 'fisso':
      return 0;
  }
}

function score(o: Offerta): ScoredOfferta {
  return { offerta: o, costo_annuo_stimato_euro: costoAnnuoStimato(o) };
}

export function rankOfferte(input: RankInput): RankOutput {
  const filtered = input.offerte.filter((o) => o.commodity === input.commodity);
  const eleggibili: Offerta[] = [];
  const esclusi: Offerta[] = [];
  for (const o of filtered) {
    if ((o.commodity === 'luce' || o.commodity === 'gas') && o.green_flag === 'D') {
      esclusi.push(o);
    } else {
      eleggibili.push(o);
    }
  }
  const sorted = [...eleggibili].sort(tierCompare);
  return {
    commodity: input.commodity,
    top: sorted.slice(0, 3).map(score),
    esclusi: esclusi.map(score),
  };
}

interface TierBaseline {
  readonly minCosto: number;
  readonly minGreen: GreenFlag | null;
  readonly minMec: MeccanismoPrezzo['tipo'] | null;
  readonly maxGb: number | null;
}

function isLuceGas(o: Offerta): boolean {
  return o.commodity === 'luce' || o.commodity === 'gas';
}

function computeBaseline(top: readonly ScoredOfferta[]): TierBaseline {
  const minCosto = Math.min(...top.map((s) => s.costo_annuo_stimato_euro));
  const sample = top[0]?.offerta;
  const tierLuceGas = sample !== undefined && isLuceGas(sample);
  const tierMobile = sample?.commodity === 'mobile';

  let minGreen: GreenFlag | null = null;
  let minMec: MeccanismoPrezzo['tipo'] | null = null;
  if (tierLuceGas) {
    minGreen = top.reduce((min: GreenFlag, s) =>
      GREEN_FLAG_ORDER[s.offerta.green_flag] < GREEN_FLAG_ORDER[min]
        ? s.offerta.green_flag
        : min,
      sample.green_flag,
    );
    minMec = top.reduce((min: MeccanismoPrezzo['tipo'], s) =>
      MECCANISMO_ORDER[s.offerta.meccanismo_prezzo.tipo] < MECCANISMO_ORDER[min]
        ? s.offerta.meccanismo_prezzo.tipo
        : min,
      sample.meccanismo_prezzo.tipo,
    );
  }

  let maxGb: number | null = null;
  if (tierMobile) {
    maxGb = Math.max(...top.map((s) => (s.offerta as { gb: number }).gb));
  }

  return { minCosto, minGreen, minMec, maxGb };
}

function diffToBaseline(
  scored: ScoredOfferta,
  baseline: TierBaseline,
): { vince: string; perde: string } {
  const wins: string[] = [];
  const losses: string[] = [];
  const o = scored.offerta;

  if (scored.costo_annuo_stimato_euro < baseline.minCosto) wins.push('costo annuo');
  else if (scored.costo_annuo_stimato_euro > baseline.minCosto) losses.push('costo annuo');

  if (isLuceGas(o)) {
    const myGreen = GREEN_FLAG_ORDER[o.green_flag];
    const baseGreen = GREEN_FLAG_ORDER[baseline.minGreen!];
    if (myGreen < baseGreen) wins.push('verde');
    else if (myGreen > baseGreen) losses.push('verde');

    const myMec = MECCANISMO_ORDER[o.meccanismo_prezzo.tipo];
    const baseMec = MECCANISMO_ORDER[baseline.minMec!];
    if (myMec < baseMec) wins.push('fissità');
    else if (myMec > baseMec) losses.push('fissità');
  } else if (o.commodity === 'mobile') {
    const myGb = o.gb;
    if (myGb > baseline.maxGb!) wins.push('GB inclusi');
    else if (myGb < baseline.maxGb!) losses.push('GB inclusi');
  }

  return {
    vince: wins.length > 0 ? wins.join(', ') : 'nessuna',
    perde: losses.length > 0 ? losses.join(', ') : 'nessuna',
  };
}

function renderTop3Fields(scored: ScoredOfferta): string {
  const o = scored.offerta;
  const costo = `€${scored.costo_annuo_stimato_euro.toFixed(0)}/anno stimato`;
  switch (o.commodity) {
    case 'luce':
    case 'gas':
      return `${costo}, Verde: [${o.green_flag}], Fissità: [${o.meccanismo_prezzo.tipo}]`;
    case 'mobile':
      return `${costo}, GB inclusi: ${o.gb}, Velocità: ${o.velocita_mbps} Mbps`;
    case 'fisso':
      return `${costo}, Tecnologia: [${o.tecnologia}], Velocità: ${o.velocita_mbps} Mbps`;
  }
}

export interface RankedSections {
  readonly tradeOffs: string;
  readonly top3: string;
  readonly esclusi: string;
}

export function renderRankedSections(rank: RankOutput): RankedSections {
  const tradeOffsLines: string[] = ['## Trade-off per offerta top-3', ''];
  if (rank.top.length === 0) {
    tradeOffsLines.push('Nessuna offerta eleggibile.');
  } else {
    const baseline = computeBaseline(rank.top);
    for (const scored of rank.top) {
      const o = scored.offerta;
      tradeOffsLines.push(`### ${o.operatore_id} — ${o.nome_commerciale}`);
      const diff = diffToBaseline(scored, baseline);
      tradeOffsLines.push(`- **Vince su**: ${diff.vince}`);
      tradeOffsLines.push(`- **Perde su**: ${diff.perde}`);
      tradeOffsLines.push('');
    }
  }

  const top3Lines: string[] = ['## Top-3 motivata', ''];
  if (rank.top.length === 0) {
    top3Lines.push('Nessuna offerta eleggibile.');
  } else {
    rank.top.forEach((scored, i) => {
      const o = scored.offerta;
      top3Lines.push(
        `${i + 1}. **${o.operatore_id} — ${o.nome_commerciale}** — ${renderTop3Fields(scored)}`,
      );
    });
  }
  top3Lines.push('');

  const esclusiLines: string[] = [];
  if (rank.esclusi.length > 0) {
    esclusiLines.push('## Esclusi D', '');
    esclusiLines.push(
      '_Offerte escluse dal ranking per green_flag=D (claim probabilmente falso)._',
    );
    esclusiLines.push('');
    for (const scored of rank.esclusi) {
      const o = scored.offerta;
      esclusiLines.push(`- ${o.operatore_id} — ${o.nome_commerciale}`);
    }
    esclusiLines.push('');
  }

  return {
    tradeOffs: tradeOffsLines.join('\n'),
    top3: top3Lines.join('\n'),
    esclusi: esclusiLines.join('\n'),
  };
}