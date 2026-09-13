# Schema OffertaMobile + OffertaFisso

ADR 0002 ha stabilito il pattern Luce/Gas/Telco a 3 vie via discriminator `commodity` (commit di G2 #9). G4 (weighting soft signal, #11) ha richiesto 4 tracks di ranking separate (Luce, Gas, Mobile, Fisso), esponendo che `OffertaTelco` raggruppava due tipi di offerta semanticamente distinti: mobile (con `gb`/`minuti`/`tipo_sim`) e fisso (con `velocita`/`tecnologia`). Il discriminatore `commodity: 'telco'` era troppo grossolano per alimentare 4 ranking track indipendenti, e i campi specialty di ciascun tipo non erano catturabili senza rumore (sentinelle `NON_INCLUSO` su `gb`/`minuti` per offerte FTTH/FTTC/ADSL, o perdita di `velocita_mbps`/`tecnologia` su mobile). La decisione è di spezzare `OffertaTelco` in `OffertaMobile` + `OffertaFisso` come sibling di `OffertaLuce`/`OffertaGas`, estendendo `Commodity` da 3 a 4 valori, e introducendo due nuovi tipi `TecnologiaMobile` e `TecnologiaFisso` per catturare la rete/tecnologia di accesso rispettivamente su mobile e fisso. `velocita_mbps: number` è required su entrambi.

## Status

Accepted. Risolve G2.1 (#25) del wayfinder map (#1).

## Considered Options

- **(a) Euristica lato ranking sui campi esistenti.** `gb > 0 → mobile`, `gb = 0 → fisso`. Zero modifiche schema. Fragile: un'offerta "mobile senza GB" rompe la regola; inoltre `gb`/`minuti` su fisso sono solo sentinelle mai usate per filtrare.
- **(b) Tag implicito lato scraper.** Ogni scraper telco marca i suoi record (es. `scrapers/tim/mobile.ts`, `scrapers/tim/fisso.ts`). Coerente con ADR 0001 "scraper per operatore", ma si scontra con operatori misti (TIM, WindTre, Vodafone hanno sia mobile sia fisso nello stesso sito) — duplica scraper o richiede routing interno.
- **(c) Schema-level extension con discriminator split.** Scioglie `OffertaTelco` in `OffertaMobile` + `OffertaFisso`, estende `Commodity` a 4 valori, allinea 1:1 con input schema G5 (che già chiede `'mobile' | 'fisso'` granulari). Type-safe via discriminated union su `commodity`, mapping input→record è 1:1 senza tabelle di traduzione.

Scelta: **(c)**. Elimina fragilità, type-safe by construction (un `OffertaMobile` non può avere `tecnologia='FTTH'`), mapping input→record è 1:1.

## Schema locked

```ts
export type Commodity = 'luce' | 'gas' | 'mobile' | 'fisso';
export type TecnologiaMobile = '4G' | '5G' | '5G+';
export type TecnologiaFisso = 'FTTH' | 'FTTC' | 'ADSL';

export interface OffertaMobile extends OffertaBase {
  commodity: 'mobile';
  prezzo_effettivo_euro_mese: number;
  gb: number;
  minuti: number;
  tipo_sim: TipoSim;
  costo_attivazione_euro?: number;
  tecnologia: TecnologiaMobile;
  velocita_mbps: number;
}

export interface OffertaFisso extends OffertaBase {
  commodity: 'fisso';
  prezzo_effettivo_euro_mese: number;
  costo_attivazione_euro?: number;
  tecnologia: TecnologiaFisso;
  velocita_mbps: number;
}

export type Offerta = OffertaLuce | OffertaGas | OffertaMobile | OffertaFisso;
```

## Scope

| Componente | Decisione | Razionale |
|---|---|---|
| `Commodity` | esteso a 4 valori | 1:1 con G5 input schema (commodity 4-valori granulari), niente tabella di traduzione |
| `OffertaTelco` | sciolto in `OffertaMobile` + `OffertaFisso` | campi specialty incompatibili (`gb`/`minuti`/`tipo_sim` vs `velocita`/`tecnologia`); G4 richiede 4 ranking tracks |
| `TecnologiaMobile` | enum separato `'4G' \| '5G' \| '5G+'` | type-safe by construction |
| `TecnologiaFisso` | enum separato `'FTTH' \| 'FTTC' \| 'ADSL'` | dominio disgiunto da TecnologiaMobile |
| `velocita_mbps` | required su entrambi | simmetria interfaccia, sempre presente nei listini |
| `gb`, `minuti`, `tipo_sim` | solo su `OffertaMobile` | mai significativi su FTTH/FTTC/ADSL, cancellati da `OffertaFisso` |
| `costo_attivazione_euro` | optional su entrambi | simmetria con G2 |

## Impatto 12 scraper telco (G1 v1)

Da verificare a scraper-design time, ma inventario preliminare da R2:

- **Misti** (producono sia `OffertaMobile` sia `OffertaFisso`): TIM, WindTre, Vodafone, Iliad, Tiscali, Dimensione (~6).
- **Mobile-only** (`OffertaMobile`): PosteMobile, ho., Kena, Very (~4).
- **Fisso-only** (`OffertaFisso`): Fastweb, SkyWiFi (~2).

## Trade-off accettati

- `velocita_mbps` required su mobile costringe scraper a gestire dati mancanti: MVNO come ho./Kena/Very elencano "5G" senza Mbps nei listini pubblici. Scelte ammesse per lo scraper: skip offerta o default documentato per operatore. Da rivedere in v1 se troppe offerte vengono scartate per questa ragione.
- Simmetria interfaccia `OffertaMobile`/`OffertaFisso` rotta: campi diversi per commodity (`gb`/`minuti`/`tipo_sim` solo mobile). È esattamente ciò che il discriminator split esprime; simmetria forzata sarebbe rumore.
- `TecnologiaFisso` enum limitato a 3 valori. Se emerge `'FWA'` (Fixed Wireless Access) serve estensione — non coperto in v1.
- Bundle luce+telco (es. TIM Energia + TIM WiFi Fibra con sconto cross) non coperto dal discriminator `commodity`: è un `OffertaBundle` separato (G3, #10), non toccato da questa ADR.

## Consequences

- Skill input schema G5 (commodity 4-valori granulari) matcha 1:1 con `Offerta.commodity`. Niente tabella di traduzione.
- Ranking G4 può fare `Offerta.filter(o => o.commodity === 'mobile' | 'fisso')` direttamente, senza euristiche.
- Scraper telco deve importare i nuovi type `TecnologiaMobile`/`TecnologiaFisso` ed emettere i campi specialty corretti. Esempio: `scrapers/tim.ts` produce un array misto di `OffertaMobile` e `OffertaFisso`, identificando il tipo dalla pagina (offerte mobile sotto `/mobile/`, offerte fibra sotto `/fibra/`).
- Aggiungere un futuro operatore che offre solo mobile o solo fisso: nessuna modifica schema, solo lo scraper rilevante.
- Se in futuro serve discriminare `5G-standalone` vs `5G-NSA`, estendere `TecnologiaMobile` — non impatta altre parti dello schema.
