# Drop `velocita_mbps` da `OffertaMobile` + drop `'5G+'` da `TecnologiaMobile`

Issue #129 / PR #130 hanno surfacesato che ho. Mobile 4G (60 Mbps documentati in `fixtures/ho/mobile.html:1385`) usciva come 150 Mbps dallo scraper. Causa: tutti i 12 scraper mobile definiscono una `velocitaPerTecnologia(tech)` locale con costanti copia-incolla — `{5G+: 2000, 5G: 1000, 4G: 150}` su 11 di essi, `{5G+: 2000, 5G: 1000, 4G: 60}` su ho. dopo il fix di PR #130. Il numero è fabbricato: nessuna delle pagine condizioni degli operatori italiani pubblica Mbps per offerta, e i 12 scraper non lo estraggono — lo coniano dalla `tecnologia` che invece è reale. Il campo è decorativo: `velocita_mbps` non partecipa a `score()` in `src/rank/index.ts`, non è filtro, non entra in `aggregator.ts`, vive solo come colonna CSV/Markdown e token nella riga mobile del rank top-3 (`renderTop3Fields`, riga 185). Classe di bug che affligge 12 scraper senza via di fuga per-operatore (path A richiederebbe parser nuovi per ogni sito, fragili e churn-bound). Domain check: `'5G+'` nel union `TecnologiaMobile` (ADR 0005) non matcha mai un'offerta reale — i 9 scraper con ramo `5G+` (`tim`, `dimensione`, `fastweb`, `skywifi`, `windtre`, `ho`, `kena`, `very`, `tiscali`) producono il valore solo da label marketing tipo "5G Plus" / "5G Full Speed" / "5G PLUS". `'5G+'` come categoria di mercato non esiste.

## Status

Accepted. Risolve il blocco "velocità fabbricata mobile" dentro lo scope del wayfinder v3 map (#134), ticket #131. Supersede PR #130 (fix puntuale di ho. 4G→60) e chiude #129 — non serve più un fix per operatore se il campo sparisce.

## Considered Options

- **(a) Estrazione per-offer dalla pagina condizioni di ogni operatore.** Per ogni (op, commodity) pair, parsing della sezione "velocità" nella pagina di dettaglio offerta, con selector e assertion dedicati. Alta fedeltà, ma 12 selettori nuovi, 12 parser fragili, una nuova coppia fixture/assertion per operatore, e ogni refresh weekly (ADR 0006) può rompere uno qualunque di questi 12 selettori indipendentemente. Lavoro che il domain modeling marcherebbe come fragile-by-design: la velocità è copy di marketing, non specifica tecnica vincolante.
- **(b) Drop del campo. Tieni solo `tecnologia`.** Rimuovi `velocita_mbps` da `OffertaMobile`, rimuovi `'5G+'` da `TecnologiaMobile` (offers etichettate "5G Full Speed" / "5G Plus" collassano in `'5G'`). CSV/MD/rank perdono la colonna/token; i 12 scraper perdono `velocitaPerTecnologia()` e il ramo regex `'5G+'`; i test strutturali (ADR 0009) rimangono verdi senza il campo. **[CHOSEN]**
- **(c) Hybrid: estrai dove il parser è cheap, droppa dove non lo è.** Per 2-3 operatori con sezione velocità parser-friendly (es. Vodafone dettaglio offerta) tieni `velocita_mbps`; per gli altri 9 omettilo. Schema inconsistente tra operatori — la downstream (CSV/MD/rank) non sa quando il campo c'è e quando no, e il bug "150 Mbps fabbricati" resta su 9 scraper.

Scelta: **(b)**. Razionale: il campo non è load-bearing (verificato: `score()`, filtri, aggregator non lo leggono), la classe di bug è strutturale (costanti copia-incolla in 12 funzioni), e il dominio ("5G+" come categoria di offerta) non esiste — è solo un artefatto di pattern-matching lasco su copy di marketing.

## Schema locked (delta da ADR 0005)

```ts
export type TecnologiaMobile = '4G' | '5G';

export interface OffertaMobile extends OffertaBase {
  commodity: 'mobile';
  prezzo_effettivo_euro_mese: number;
  gb: number;
  minuti: number;
  tipo_sim: TipoSim;
  costo_attivazione_euro?: number;
  tecnologia: TecnologiaMobile;
}
```

`OffertaFisso.velocita_mbps` resta intatto: zero scraper esistenti, zero bug attuale, simmetria interfaccia non richiesta da questo ADR.

## Trade-off esplicito

- **(b) guadagna**: classe di bug rimossa alla fonte (12 funzioni locali cancellate, non 12 funzioni locali da mantenere allineate), CSV mobile shrink by 1 colonna, rank mobile top-3 line shrink by 1 token, test strutturali più puliti (`tecnologia ∈ {'4G', '5G'}` è un'invariante di 2 valori, non di 3 + un numero fabbricato).
- **(b) perde**: informazione "Mbps offerti" non più in output. Mitigation: la velocità non era un segnale di decisione (chi sceglie un'offerta mobile guarda GB/minuti/prezzo, non Mbps nominali di picco), e i 60/1000 Mbps reali non erano raggiungibili in nessuna offerta — erano numeri di marketing.
- **(b) si sposa con**: ADR 0009 (structural asserts canonical) — il campo rimosso era l'unico punto in cui i test per-scraper diventavano quasi-hardcoded (alcuni assertavano `velocita_mbps > 0`, uno assertava `velocita_mbps === 60` per 4G). Tolto il campo, ADR 0009 vale senza eccezioni.

## Conseguenze

- `src/types/offerta.ts`: `OffertaMobile.velocita_mbps` rimosso, `TecnologiaMobile` ridotto a `'4G' | '5G'`.
- `src/formatters/csv.ts` + `src/formatters/markdown.ts`: colonna `velocita_mbps` rimossa dall'output mobile. `OffertaFisso` resta intatto.
- `src/rank/index.ts:185` (mobile top-3 line): `Velocità: ${o.velocita_mbps} Mbps` rimosso; candidato `${costo}, GB inclusi: ${o.gb}, Rete: ${o.tecnologia}` (GB resta, Tecnologia sostituisce Velocità come terzo token). Riga 187 (fisso) invariata.
- 12 scraper mobile (`ho`, `fastweb`, `tim`, `vodafone`, `windtre`, `dimensione`, `iliad`, `skywifi`, `tiscali`, `kena`, `very`, `postemobile`): rimuovere `function velocitaPerTecnologia()` definition, rimuovere il ramo `/5G\+/` da `tecnologiaFromCard()`, rimuovere `velocita_mbps:` dalla chiamata offer-builder. Per-operatore PR, sequenziale (memoria `feedback-one-subagent-at-a-time`).
- `tests/<op>.test.ts` per ogni mobile: rimuovere l'assertion `velocita_mbps > 0` (riga ~35 di ogni file), confermare `TECNOLOGIA_VALUES.includes(o.tecnologia)` come structural assertion (riga ~34 — già esiste, va ridotta a `['4G', '5G']`). Drive-by specifico: `tests/rank.test.ts:94-95` (synthetic con `tecnologia: '5G+', velocita_mbps: 1500`) → riscrivere a `'5G'`, rimuovere il campo.
- `tests/ho.test.ts:42-48` (blocco `if (o.tecnologia === '4G') assert.equal(o.velocita_mbps, 60)`): rimosso — non c'è più il campo.
- `fixtures/very/mobile.html` marketing "5G Full Speed": offers etichettate così riportano `'5G'` invece di `'5G+'`. Cambio intenzionale, documentato.
- Drive-by su PR #130: commento di supersede + chiusura. Issue #129 chiusa dalla PR atomica #132.
- `CONTEXT.md` §2: aggiungere riferimento ad ADR 0010. §1.2: no-op (nessuna voce di glossario menziona `5G+` o `velocita_mbps` come termine di progetto).

## Out of scope

- `OffertaFisso.velocita_mbps`: zero scraper esistenti, zero bug attuale. Quando il primo scraper fisso arriva, decide per sé.
- Per-offer speed extraction (path A): respinta come destination. L'ADR codifica il rifiuto: il campo non è load-bearing, l'estrazione è fragile-by-design.
- `'FWA'` come estensione di `TecnologiaFisso` (citata come futuro in ADR 0005): non toccata.
- Bundle luce+telco: il drop di `velocita_mbps` cascata naturale su `componenti: (Offerta | ComponenteServizio)[]`, nessuna azione richiesta.

## Reference

- Issue: #131 (questo ADR), #132 (schema+ho. PoC atomic PR), #133 (11 mobile fan-out), #134 (v3 map, destination), #129 (superseded), #130 (superseded).
- ADR correlati: 0005 (`OffertaMobile`/`OffertaFisso` schema originario — `velocita_mbps` required su entrambi + `TecnologiaMobile = '4G' | '5G' | '5G+'`), 0009 (structural asserts canonical — questo ADR rimuove l'ultimo punto in cui i test diventavano quasi-hardcoded), 0008 (synthetic fixtures ≠ siti reali, contesto del bug class).
- Memory: `feedback-one-subagent-at-a-time` (v3 #133 sequenziale, non parallelo), `feedback-destination-vs-frontiera` (chiusura map ≠ destinazione raggiunta finché `npm run scrape -- --live` non è verde sui 12 mobile post-drop).
