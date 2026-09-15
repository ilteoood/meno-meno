# Test strutturali vs hardcoded: la filosofia canonical per v2

La v1 ha consegnato 99/99 test verdi usando assert hardcoded su nomi commerciali, prezzi, GB, minuti per ogni operatore (es. `tests/fastweb.test.ts` riga 33-55 asserisce `Fastweb Mobile 100`, `prezzo_effettivo_euro_mese === 7.95`, `gb === 100`, `tecnologia === '5G'`). Funzionava perché le fixture in `fixtures/<op>/<commodity>.html` erano sintetiche: 3-4 `<article data-offer>` scritti a mano per matchare i selettori degli scraper, identiche per tutti i 24 operatori, timestamp di bootstrap 2026-09-13. La v2 destination (issue #90) chiede che ogni scraper funzioni davvero sui siti reali (ADR 0008) e che le fixture diventino snapshot reali catturati da `scripts/download-fixtures.ts`. Su una fixture reale, ogni refresh settimanale (ADR 0006) porta con sé microcopy, prezzi aggiornati, A/B test, offerte stagionali: assert hardcoded su `nome_commerciale` e `prezzo_effettivo_euro_mese` rompono ad ogni drift di marketing. Il trade-off da chiudere è: cosa afferma un test per-scraper in v2 — il nome/importo dell'offerta (signal tight, fragile) o la shape strutturale del payload (signal debole per offerta, robusto al churn)?

## Status

Accepted. Risolve la decisione "filosofia test per-scraper" dentro lo scope del wayfinder v2 map (#90), ticket #92.

## Considered Options

- **(a) Assert strutturali canonical per v2.** Per ogni `tests/<op>.test.ts`: `result.offerte.length >= 1` + ogni offerta ha i campi richiesti non vuoti (`operatore_id`, `codice_offerta`, `nome_commerciale`, `url_sorgente`, `scraped_at`, `commodity`, campi specifici del commodity type discriminato) + dove applicabile discriminatore commodity corretto. Niente assert su nomi commerciali, prezzi, GB, minuti specifici. Robusto al churn di marketing: il sito può cambiare copia e prezzi senza toccare i test. Signal per-offerta più debole di hardcoded (un calo di qualità del parsing su una singola offerta non sempre si vede), ma il pattern `count >= 1` cattura la classe di regressione che conta: scraper che restituisce zero offerte, o campo richiesto vuoto (segno che il selettore reale ha cambiato shape).
- **(b) Hybrid strutturale + spot-check.** Assert strutturale come green-light del test + un secondo snapshot di fixture per operatore con un piccolo set di assert su nomi noti (es. `Fastweb Mobile 100`) come tripwire per regressioni grosse. Due test shapes, due lifecycle: il per-scraper test muta indipendentemente dallo spot-check. Reintroduce esattamente la frattura di v1 — quando il sito cambia un nome commerciale, due file da toccare invece di uno, e la coerenza tra i due assert decade silenziosamente.
- **(c) Hardcoded preservato per operatore.** Ogni test continua ad asserire nomi/prezzi/GB noti dalla fixture reale aggiornata. Signal per-offerta tight (test sbaglia se il selettore droppa una offerta o ne scambia i valori), ma il lock-in al contenuto della fixture è esattamente la fragilità che v2 vuole eliminare. Significa che la GitHub Action di ADR 0006 produce PR settimanali che rompono test invece di produrre drift informativi — i test diventano macchine da manutenzione invece che contratti sul contratto (parsing → shape valida).

Scelta: **(a)**. È coerente con il testo letterale della v2 destination: *"Each per-scraper test asserts structural invariants (`count >= 1`, required fields non-empty) against the operator's real fixture snapshot."*. La specifica dei campi richiesti per commodity è demandata al singolo PR per-operatore (#93 fastweb PoC, #94 mobile fan-out, #95 luce+gas fan-out) — l'ADR codifica la filosofia, ogni scraper-rewrite fissa la lista concreta contro il proprio tipo `OffertaLuce | OffertaGas | OffertaMobile | OffertaFisso | OffertaBundle`.

## Campo richiesto: definizione operativa

Per un test in v2, un campo è "non vuoto" se:

- stringa: `typeof v === 'string' && v.length > 0`
- number: `typeof v === 'number' && !Number.isNaN(v)` (per GB/minuti il valore di business può essere 0 o -1 per "illimitato" secondo lo schema `OffertaMobile`, vedi ADR 0005)
- literal discriminator: `value === expectedLiteral` (es. `commodity === 'mobile'`, `tecnologia ∈ {'4G', '5G', '5G+'}`, `meccanismo_prezzo.tipo ∈ {'fisso', 'PUN'}`)

La lista concreta dei "campi richiesti" per commodity è responsabilità del singolo per-operatore PR, perché dipende da cosa il modello `Offerta*` rende obbligatorio in TS (ADR 0005). L'ADR 0009 non duplica lo schema: usa `node:test` + `node:assert/strict` come già oggi, ma sugli invarianti di shape invece che sui valori.

## Trade-off esplicito

- **(a) guadagna**: zero manutenzione test su churn di marketing, la GitHub Action di ADR 0006 è puramente informativa (PR con diff ma niente test rossi), lo scraper può evolvere il selettore reale senza che il test gridi per microcopy.
- **(a) perde**: regressione silenziosa se lo scraper smette di catturare 2 offerte su 3 (passa da 3 a 2 ma `>= 1` è ancora verde). Mitigation: il contract `count === <expected>` è sostituibile dal contratto `count >= 1`, e la destra "expected" è documentata come baseline osservata nel commento del PR per-operatore (es. "fastweb mobile: observed 3-4 offerte nel refresh 2026-09-15"). Se il refresh scende sotto osservato in modo consistente, `doctor --live` (#96) lo segnala come drift sul numero — non sul nome.
- **(a) si sposa con**: `--live` flag (ADR 0006) — i test girano sullo scraper wrappato in fixture reale, ma la verifica `count >= 1` + shape valida è la stessa che `npm run scrape -- --live` deve passare. Stesso contract, due finestre (offline vs online).

## Conseguenze

- Il per-operatore atomic cycle (issue #90, Q16) diventa: scraper rewrite + real fixture + structural test rewrite + delete synthetic, stesso PR. Il PR template per ciascuno dei 24 operatori è dunque auto-similar: cambiano selettore e fields, non cambia il pattern di assert.
- `tests/fixtures.test.ts` (se esiste come collettivo) resta utile per asserire che `fixtures/**/*.html` siano ben formate e `grep`-abili, ma non viene toccato da questo ADR.
- Il debug di "perché questo scraper ritorna 0 offerte" diventa un'operazione di due livelli: prima `doctor --live` (issue #96), poi `npm run scrape -- --operatore <op> --commodity <c> --live` con `SCRAPER_DEBUG=1` (futuro). L'ADR non aggiunge tooling in questo scope.
- I 24 test esistenti in v1 sono tutti hardcoded — verranno rifatti atomicamente nei PR per-operatore di v2. Questo ADR **non** li tocca ora: il refactor dei test vive nei PR #93+ come parte del cycle di rewrite.
- ADR 0006 (refresh weekly) resta valida e ora ha una proprietà nuova: la PR automatica di drift non rompe più i test, perché gli assert non sono più lockati al contenuto.

## Out of scope

- Lista field-required per commodity. Demandata ai singoli per-operator PR (#93+). L'ADR fissa la filosofia; i PR fissano l'inventario campo-per-campo contro il TS schema di ADR 0005.
- Test property-based o fuzz. (a) è una filosofia deterministic, non property-based. Una explore separata potrebbe valutare `fast-check` in un eventuale v3 — non v2.
- Mutation testing dei scraper (es. Stryker). Non in scope: aggiungerebbe dipendenze e runtime a una suite che oggi gira in <5s.
- Test di regressione su offerte specifiche note. Se in futuro serve (es.regulation check su una offerta regolamentata), aggiungere in un secondo momento come *(b)-like* layer dentro `tests/<op>-regression.test.ts`, separato dal primary test strutturale. Non blocca l'adozione di (a).

## Reference

- Issue: #92 (questo ADR), #90 (v2 map, destination), #93-95 (per-operator rewrites dove (a) viene applicato), #96 (doctor --live).
- ADR correlati: 0001 (scraper per operatore hardcoded), 0002 (scraping live senza cache, `--live` e `--fixture` path), 0005 (`OffertaMobile | OffertaFisso` schema), 0006 (refresh weekly GitHub Action), 0008 (synthetic fixtures ≠ siti reali, da cui nasce la necessità di (a)).
- Memory: `feedback-destination-vs-frontiera`, `project-v2-map-charted`.
