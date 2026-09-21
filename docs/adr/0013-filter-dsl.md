# Filtro multi-operatore su offerte (prezzo, gb, costo commercializzazione) + top-3 ranking — DSL CLI

Il CLI di `meno-meno` (oggi `src/index.ts`) accetta solo `--operatore X --commodity Y` ed emette l'unione delle offerte di un singolo operatore. Non esiste un path per chiedere "tutte le offerte mobile con prezzo ≤ 7 €/mese" o "tutte le offerte luce+gas con costo commercializzazione ≤ 80 €/anno". L'utente che vuole confrontare tra operatori diversi deve lanciare il comando N volte, parsarsi N output, e ri-incrodare i risultati a mano. L'aggregato `aggregate()` in `src/index.ts` già itera N scraper per commodity — il fan-out c'è, gli manca solo un vincolo di filtro prima del `rankOfferte()`. Il trade-off da chiudere è: come esprimere il vincolo nel CLI (un DSL inline, una query language strutturata, una libreria esterna, una UI) e dove piazzare il modulo che lo valuta (dentro `src/index.ts`, in una nuova libreria `src/filter/`, in `src/rank/`).

## Status

Accepted (pending v6 implementation). Risolve "esposizione CLI multi-operatore con vincoli numerici" dentro lo scope del wayfinder v6 map (#169), ticket #171. L'implementazione è demandata ai ticket figli #172 (library `src/filter/`), #173 (extension `src/index.ts` CLI), #174 (docs); questo ADR fissa il contratto che quei ticket realizzano.

## Considered Options

- **(a) `--filter` ripetibile inline con DSL commodity-aware.** Flag ripetibile, AND tra flag, OR entro lo stesso flag via `|`. Alias per commodity (`prezzo`, `gb`, `costo_commercializzazione` → schema field). Operatori `< <= = >= > !=`. Tolleranza ±0.0001 su monetari per `=`. No-match → exit 0 + tabella vuota + warning. Header markdown include l'espressione del filtro. `OffertaBundle` escluso dal filtro (entità separata). CLI estende `src/index.ts` esistente (nessun nuovo file CLI). `[CHOSEN]`
- **(b) Append `--filter` al CLI mono-operatore.** Un operatore ha già 2-9 offerte dopo `rankOfferte()` — filtrare ulteriormente è raramente utile (top-3 è già stretto). Aggiunge complessità di parsing per un caso d'uso debole. **[RESPINTO]**
- **(c) Libreria pura senza CLI.** Esporre `filterOfferte(offerta[], expr)` come API riusabile da script esterni, senza toccare il CLI. Mancano end-to-end test (lo skill è CLI-first, vedi ADR 0001 e ADR 0009 test philosophy). L'utente non ha un "prodotto" da usare, solo una primitiva. **[RESPINTO]**
- **(d) DSL con AND/OR/NOT espliciti come query string.** `?filter=prezzo<=7 AND (gb>=50 OR gb=-1)`. Più espressivo ma over-engineering per il dominio: nessun consumer noto chiede NOT, e l'OR è già coperto dalla pipe entro flag. Aggiunge grammar parser senza casi d'uso. **[RESPINTO]**
- **(e) Filtrare anche `OffertaBundle` (bundle luce+gas).** Il bundle è entità separata (`OffertaBundle` in `src/types/offerta.ts`, emesso in `src/index.ts` sezione dedicata). Filtrare bundle per stesso DSL richiede di definire i campi bundle (`costo_totale_euro_mese?`, lista componenti) come filterable, scope creep rispetto alla richiesta originale. **[RESPINTO]**
- **(f) Operator subsetting `--operatore enel,edison`.** Filtrare per subset di operatori invece che per valori numerici. Scope diverso: `--operatore X` esiste già mono (path implicito), un subset esplicito multi è un'altra feature, fuori scope v6 (vedi map #169 §Out of scope). **[RESPINTO]**

Scelta: **(a)**. Razionale: la richiesta originale (`npm run start -- --commodity mobile --filter "prezzo<=7"`) è multi-operatore + vincolo numerico. Il DSL inline commodity-aware è il minimo che soddisfa senza introdurre grammatiche, e riusa `aggregate()` (giù presente) + `rankOfferte()` (giù presente) senza riscrivere la pipeline.

## Decision: DSL locked

### CLI surface

- `--filter "<expr>"`: flag ripetibile. AND tra flag distinti. OR entro lo stesso flag via pipe `|`.
- Espressione: `<alias>[<op>]<value>[|<alias>[<op>]<value>...]`.
- Operatori ammessi: `<`, `<=`, `=`, `>=`, `>`, `!=`.
- `<alias>` è commodity-aware, mappato a schema field (vedi tabella sotto).
- `<value>` per numerici: intero o decimale con `.` come separatore (CLI normalizza `,` → `.` per ergonomic italiana).
- Senza `--operatore` e con `--commodity` → fan-out su tutti gli operatori registrati per quella commodity. Con `--operatore X` (anche + `--filter`) → mono-operatore, backward compat.
- `--filter` senza `--commodity` → errore di usage (il filtro è commodity-aware per design).
- Esempio canonico: `npm run start -- --commodity mobile --filter "prezzo<=7" --filter "gb>=50|gb=-1"`.

### Tabella alias

| Commodity  | Alias                       | Schema field                  |
|------------|-----------------------------|-------------------------------|
| `mobile`   | `prezzo`                    | `prezzo_effettivo_euro_mese`  |
| `mobile`   | `gb`                        | `gb`                          |
| `fisso`    | `prezzo`                    | `prezzo_effettivo_euro_mese`  |
| `luce`     | `prezzo`                    | `prezzo_effettivo_euro_kwh`   |
| `luce`     | `costo_commercializzazione` | `quota_fissa_euro_anno`       |
| `gas`      | `prezzo`                    | `prezzo_effettivo_euro_smc`   |
| `gas`      | `costo_commercializzazione` | `quota_fissa_euro_anno`       |

Alias non in tabella → errore di usage esplicito (no silent skip).

### Operatori e tolleranza

- `<`, `>`, `<=`, `>=`: confronto diretto, no tolleranza.
- `=`, `!=`: tolleranza ±0.0001 SOLO sui campi monetari (`prezzo_effettivo_euro_*`, `quota_fissa_euro_anno`). Sugli interi (`gb`) confronto esatto.
- `gb = -1` è il sentinel per "illimitato" (`OffertaMobile.gb === -1` per ADR 0005 schema mobile). Trattato come intero letterale.

### Composizione

- **AND tra flag distinti**: `npm run ... --filter "prezzo<=7" --filter "gb>=50"` → offerte con `prezzo <= 7 AND gb >= 50`.
- **OR entro lo stesso flag via pipe**: `--filter "gb>=50|gb=-1"` → offerte con `gb >= 50 OR gb === -1` (illimitato).
- Annidamento: non supportato. Le pipe non si annidano (no `a|b|c|d` con sub-grouping). Per condizioni complesse, multipli `--filter` + AND esterno.

### No-match behavior

- Zero offerte dopo filtro → exit code `0` (successo, non errore), tabella markdown vuota (o CSV/JSON con header + zero righe), warning su stderr: `warning: no offerte match the filter`.
- Failure mode esplicito: il warning dice all'utente "il filtro non ha match" senza dover leggere il payload vuoto.

### Output

- Riusa `--format all|markdown|csv|json` esistente.
- Header markdown: include l'espressione del filtro come riga di metadata, es. `Filter: prezzo<=7 AND gb>=50|gb=-1`.
- CSV/JSON: filtro va nei metadata o come commento (CSV) / campo top-level (JSON), secondo la convenzione che il ticket #173 fisserà guardando i formatters esistenti.
- Le sezioni `top-3` e `trade-off` di `renderRankedSections()` sono applicate DOPO il filtro: filtro → `rankOfferte()` → `renderRankedSections()`. Se il filtro produce 0-2 offerte, le sezioni top-3/trade-off si adattano (già empty-safe, coperto dal caveat A di #170 research).

### Esclusione di `OffertaBundle`

Il filtro opera solo su `Offerta[]` (discriminated union luce/gas/mobile/fisso). `OffertaBundle` è entità separata emessa in sezione dedicata di `src/index.ts`. Il filtro non tocca bundle: un comando come `--filter "prezzo<=7"` non include/Esclude bundle in alcun modo. Razionale: bundle è prodotto commerciale diverso (combo luce+gas, gestione marketing separata), semantica di filtro incompatibile con i campi `Offerta*`.

### Backward compat

- `ci-live-gate.ts` passa sempre `--operatore X --commodity Y` (mono-operatore). Non passa mai `--filter`. Quindi il path ci-live-gate non è toccato dal DSL. Test #173 deve verificare che `npm run start -- --operatore X --commodity Y --format markdown` continui a produrre lo stesso output di oggi.
- `scripts/render-examples.ts` produce esempi per singolo operatore. Non chiama `--filter`. Backward compat confermata.

## Trade-off esplicito

- **(a) guadagna**: confronto multi-operatore senza scripting esterno (l'utente CLI ottiene tabella aggregata con un comando), riuso totale di `aggregate()` + `rankOfferte()` (nessuna nuova pipeline), backward compat con ci-live-gate (path mono-operatore invariato), output parla il dominio italiano (alias `prezzo`, `gb`, `costo_commercializzazione`).
- **(a) perde**: nessuna NOT/AND-NOT (accettabile: nessun consumer noto), nessun filtro su bundle (demandato a ticket futuro se emerge), no annidamento pipe (accettabile: AND tra flag sufficienti).
- **(a) si sposa con**: ADR 0009 (structural asserts — i test del filtro asseriscono shape, non valori specifici: "offerta con `prezzo 6.99` matcha `prezzo<=7`" è structural; "offerta con `prezzo 7.0001` NON matcha `prezzo<=7`" è structural), ADR 0006 (fixtures canoniche — i test del filtro girano su fixture reali, niente synthetic), ADR 0012 (TecnologiaFisso FWA — il filtro non lo tocca direttamente ma se mai in futuro `--filter "tecnologia=FWA"` venisse aggiunto, l'enum FWA è già lì).

## Conseguenze

- Nuovo modulo `src/filter/` (vedi ticket #172): `parseFilterExpression()` (CLI string → AST), `evaluateFilter()` (AST + offerta → boolean), `applyFilter()` (Offerta[] + AST → Offerta[] filtered). Tipi: `FilterExpression`, `FilterAtom`, `FilterOp`. Zero dipendenze esterne (TS stdlib).
- `src/index.ts`: branch aggiuntivo dopo `aggregate()` e prima di `rankOfferte()`. CLI parsing esteso (nuovo flag `--filter` ripetibile, validazione alias per commodity). Nessun nuovo file CLI.
- `src/rank/index.ts`: invariato. `rankOfferte()` e `renderRankedSections()` empty-safe (caveat A di #170 già coperto in #172 spike).
- `src/formatters/{markdown,csv,json}.ts`: `markdown.ts` aggiunge riga `Filter: <expr>` nell'header. `csv.ts` aggiunge commento `# filter: <expr>` come prima riga. `json.ts` aggiunge campo top-level `filter: string | null`. Modifiche additive, backward compat per output senza filtro.
- `scripts/render-examples.ts`: se piazzato il filtro a livello CLI di `src/index.ts`, render-examples NON chiama `--filter` (gli esempi sono per operatore singolo). Se mai futuro render-examples volesse produrre esempi filtrati, sarebbe un'estensione — non blocca questo ADR.
- Test: `tests/filter.test.ts` (unit del parser + evaluator), `tests/cli-filter.test.ts` (integration end-to-end via `npm run start -- --commodity mobile --filter "prezzo<=7"` su fixture). Structural asserts ADR 0009: niente assert su valori specifici, niente assert su nomi commerciali.
- `CONTEXT.md` §2: aggiungere riferimento ad ADR 0013.

## Out of scope

- **Operator subsetting `--operatore enel,edison`**: scope diverso, fuori mappa v6. Ottenibile oggi passando il comando N volte o tramite script esterno.
- **Filtro su `OffertaBundle`**: bundle è entità separata. Se un futuro consumer vorrà filtrare bundle per componente o costo totale, ticket separato.
- **Filtro multi-commodity combinato (`--commodity luce,gas`)**: altra feature, fuori scope.
- **NOT/AND-NOT**: nessun consumer noto chiede negazione. Se emerge, ticket separato con ADR.
- **Preset salvati / file di configurazione**: CLI rimane self-contained per design.
- **Web UI / filtro interattivo**: il contratto del repo è CLI (vedi ADR 0001, ADR 0008).
- **Modifica allo schema `Offerta` o `OffertaBundle`**: il filtro si appoggia ai campi esistenti di ADR 0005 + ADR 0012.
- **Filtri su campi non monetari non-interi** (es. `--filter "tipo_sim=eSIM"`, `--filter "tecnologia=5G"`): scope creep. `--filter` è numerico per design (la richiesta originale è "prezzo, gb, costo commercializzazione" — tutti numerici). Filtri su enum restano fuori.

## Compliance

- **ADR 0009** (structural asserts canonical): i test del filtro asseriscono shape del matching, non valori specifici. `prezzo 6.99 matcha prezzo<=7` è structural (uno specifico valore match/no-match); `tutte le 5 offerte con prezzo ≤ 7 matchano` è structural (proprietà della popolazione). Mai assert su singola offerta specifica per nome commerciale.
- **ADR 0006** (fixtures canoniche): i test del filtro girano su fixture reali settimanali. Un drift di prezzo in una fixture non rompe i test del filtro se la soglia è ragionevole (i test usano soglie di `±1` o `±10%` rispetto al baseline documentato).
- **ADR 0012** (TecnologiaFisso FWA): non direttamente toccato. Se mai futuro `--filter "tecnologia=FWA"` venisse aggiunto, l'enum FWA è già nell'OffertaFisso.
- **ADR 0005** (schema Offerta*): il filtro legge i campi dello schema esistente. Nessun campo nuovo introdotto.
- **Backward compat `ci-live-gate`**: il gate passa sempre `--operatore`, mai `--filter`. Il path mono-operatore resta verde. Test #173 verifica con assertion `output ci-live-gate pre-v6 === post-v6` su un campione di operatori.

## Reference

- Issue: #171 (questo ADR + ticket), #169 (v6 map, destination + notes), #170 (research verificato, ADR sbloccato), #172 (library `src/filter/`), #173 (CLI extension `src/index.ts`), #174 (docs).
- ADR correlati: 0001 (scraper per operatore, monolitico CLI), 0005 (schema Offerta* discriminated union), 0006 (fixture refresh weekly — i test del filtro si appoggiano), 0009 (test strutturali canonical — i test del filtro sono structural), 0012 (TecnologiaFisso FWA — non direttamente toccato).
- Memory: `project-v6-map-charted` (mappa chartata), `project-v6-ticket-170-closed` (research chiusa, questo ADR sbloccato).
