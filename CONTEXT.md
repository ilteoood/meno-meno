# CONTEXT.md

> Glossario puro + link alle ADR. Single source of truth per le ADR resta `docs/adr/`. Questo file si consulta per primo quando si apre una sessione sul progetto.

## §1 Glossario

### §1.1 Dominio (utility italiane luce/gas + telco)

- **Arera** — Autorità di Regolazione per Energia Reti e Ambiente, regolatore italiano del settore energetico. `ilportaleofferte.it` è usato come fallback neutrale per la disclosure PLACET.
- **bundle luce+gas** — entità di prima classe (`OffertaBundle`) che combina più servizi dello stesso operatore, con `sconto_bundle_euro_anno: number | null` che misura il risparmio rispetto alla somma delle singole offerte (vedi ADR 0003).
- **durata** (mesi) — vincoli temporali dell'offerta, espressi in mesi. `null` su un bundle indica durata aperta, senza vincoli di permanenza.
- **FTTH / FTTC / ADSL** — tecnologie di rete fissa italiana: FTTH (Fiber To The Home, fibra ottica fino all'abitazione), FTTC (Fiber To The Cabinet, fibra fino all'armadio stradale + rame), ADSL (Asymmetric Digital Subscriber Line, tutto rame, legacy).
- **Garanzia di Origine (GO)** — certificazione ufficiale emessa da GSE sull'energia rinnovabile immessa in rete. Unica con valore legale in Italia (art. 46 D.Lgs 199/2021), usata come hard evidence per il green flag di livello A.
- **green flag** — tassonomia interna a 4 livelli (A/B/C/D) che classifica il soft signal di sostenibilità di un'offerta. A = GO ufficiale + addizionalità ARERA, D = hard-exclude (esclude l'offerta dal ranking).
- **mix energetico** (o **mix rinnovabile**) — composizione delle fonti usate per generare l'energia elettrica di un'offerta, espressa in percentuale rinnovabili vs fossili. Disclosure obbligatoria per legge italiana (D.Lgs 210/2021 + D.M. MASE 224/2023).
- **MNO / MVNO** — Mobile Network Operator (TIM, WindTre, Vodafone, Iliad: operatori con rete propria) e Mobile Virtual Network Operator (Kena, ho. e altri: operatori virtuali che affittano rete da un MNO).
- **offerta** — contratto di vendita tra operatore e cliente domestico, caratterizzato da prezzo + quota fissa + durata + (opzionale) green flag. Normalizzato nel modello come `Offerta` (discriminato per commodity: Luce/Gas/Mobile/Fisso) o `OffertaBundle` (per combinazioni multi-servizio).
- **penali uscita** — fee di uscita anticipata applicata quando il cliente recede prima della scadenza naturale dell'offerta. Campo opzionale sull'entità offerta.
- **PSV** (Punto di Scambio Virtuale) — indice di prezzo all'ingrosso del gas sul mercato italiano, analogo del PUN per l'elettricità. Quotato in €/Smc con spread applicato dalle offerte gas variabili.
- **PUN** (Prezzo Unico Nazionale) — indice di prezzo all'ingrosso dell'energia elettrica sul mercato italiano, usato come reference per le offerte variabili luce. Quotato in €/kWh con spread.
- **quota fissa** — componente annuale fatturata anche in assenza di consumo, espressa in €/anno. Disclosure obbligatoria per legge ARERA; presente su tutte le offerte Luce/Gas.
- **spread** — differenza rispetto all'indice di riferimento (PUN per luce, PSV per gas), espressa in €/kWh o €/Smc. Componente variabile del prezzo finale.
- **vincoli** — stringa opzionale su `OffertaBase` che indica requisiti aggiuntivi (es. "richiede FTTH attiva", "riservato a nuovi clienti"). Campo libero, non strutturato.

### §1.2 Interni del progetto

- **--doctor** — sub-command CLI invocato dalla skill come `Skill: meno-meno doctor`, lancia `runDoctor()` per diagnosticare la salute degli scraper (vedi ADR 0007).
- **--live** — flag che forza scrape live contro gli operatori, ignorando le fixture HTML committate. Gate in CI per PR che toccano `src/scrapers/**/*.ts` o `fixtures/**/*.html` (vedi ADR 0006).
- **live-correctness** — `npm run scrape -- --operatore <op> --commodity <c> --live` ritorna `count >= 1` con exit 0 per tutte le 24 coppie (op, c). È ciò che v2 destination reached misura (issue #90). Da non confondere con fixture-compliance.
- **aggregator** — modulo `src/aggregator.ts` che unisce i risultati di più scraper in un `AggregateResult` con `bundle: readonly OffertaBundle[]`. Punto di ingresso unificato per i formatters.
- **bundle** — entità `OffertaBundle`, first-class sister di `Offerta`. NON è union member di `Offerta`: i due tipi convivono come entità distinte nel modello dati.
- **commodity** — tipo letterale `'luce' | 'gas' | 'mobile' | 'fisso'`. Lo schema input del CLI accetta una sola commodity per invocazione, ridotto da un precedente schema multi-commodity.
- **destination reached** — concetto che misura shape-of-done di un wayfinder map. Per v1 significava "24/24 fixture-compliance verde" (vedi ADR 0008 per l'erratum); per v2 significa "24/24 live-correctness verde con test strutturali" (issue #90).
- **doctor** — comando per diagnosticare la salute degli scraper: esegue scrape live + parse + verifica HTTP status per ogni operatore v1. Produce un report Markdown.
- **fixture** — snapshot HTML committato in `fixtures/<operatore>/<commodity>.html` per test mock deterministici. Aggiornato settimanalmente dalla GitHub Action (ADR 0006).
- **fixture-compliance** — verde-ness del test suite misurata su fixture (sintetiche o reali). È ciò che v1 destination reached misurava. In v2 le fixture sintetiche sono sostituite da snapshot reali, atomicamente per operatore (v2 map #90).
- **formatter** — modulo `src/formatters/{markdown,csv,json}.ts` che produce output da `Offerta[]` + `OffertaBundle[]`. CSV: righe_bundle con discriminatore `tipo`. JSON: struttura nested `offerte.singole` + `offerte.bundle`. Markdown: sezione `## Bundle luce+gas` dopo le singole.
- **green flag** — vedi §1.1. Nel progetto è anche nome del campo discriminatore dell'entità offerta, popolato dagli scraper.
- **hardcoded assert** — filosofia test di v1: assert letterali su nomi commerciali e prezzi offerta. Locks i test al contenuto della fixture. Superseduta da structural assert in v2 (ADR 0009).
- **Offerta** — tipo discriminato union per commodity: `OffertaLuce | OffertaGas | OffertaMobile | OffertaFisso`. Provenance garantita dai campi `operatore_id + codice_offerta + url_sorgente + scraped_at`.
- **OffertaBundle** — entità first-class con `componenti: (Offerta | ComponenteServizio)[]` e `sconto_bundle_euro_anno`. Sister entity di `Offerta`, non suo membro.
- **playwright** — lazy import opt-in riservato ai soli scraper Edison e WindTre (vedi ADR 0004). Tutti gli altri operatori usano cheerio puro sul DOM statico.
- **render-examples** — script `scripts/render-examples.ts` che rigenera `examples/*.md,csv,json` a partire dalle fixture, con timestamp deterministico per output riproducibile.
- **Scraper** — interface `src/scrapers/types.ts` con metodo `scrape()` async che restituisce `ScrapeResult` discriminato (ok/fail). Un modulo TS per operatore (vedi ADR 0001).
- **scraper rewrite** — azione per-operatore in v2 (issue #90): riscrittura `src/scrapers/<op>.ts` contro selettori reali, swap di `fixtures/<op>/<commodity>.html` con snapshot reale, refactor del test in structurale, cancellazione della fixture sintetica. Tutto stesso PR (atomic swap).
- **Soft signal** — segnale non-deterministico (es. green flag) usato come peso nel ranking LLM, NON come filtro hard. Da non confondere con gli hard exclude (green flag = D).
- **structural assert** — filosofia test canonical per v2 (ADR 0009): `count >= 1` + campi richiesti non vuoti su `OffertaMobile` / `OffertaFisso` / `OffertaBundle`. Robusto a fixture churn; signal per-offerta più debole di hardcoded assert. Trade-off codificato in ADR 0009.
- **subagent** — istanza Claude spawnata via Paseo MCP (`create_agent`) per eseguire un singolo ticket wayfinder in autonomia. Ciclo di vita: dispacciata con prompt iniziale, monitorata via notification.
- **ticket** — Wayfinder child issue del map #1, etichettato `wayfinder:<tipo>`. Tipi: `research`, `prototype`, `grilling`, `task`.
- **v2 map** — issue #90 (`wayfinder:map`) per "Live scraping correctness". Tickets: #91 ADR 0006 commit, #92 ADR 0009 grilling, #93 fastweb PoC, #94 mobile fan-out, #95 luce+gas fan-out, #96 doctor --live, #97 ADR 0006 update. Catena di blocking: #91 + #92 → #93 → #94, #95 → #96, #97.

## §2 ADR (single source of truth: docs/adr/)

- [ADR 0001 — Scraper per operatore hardcoded](docs/adr/0001-scraper-per-operatore-hardcoded.md): un modulo TS per operatore, no config-driven, no plugin loader.
- [ADR 0002 — Scraping live senza cache](docs/adr/0002-scraping-live-senza-cache.md): ogni invocazione scrape live, timeout 15s, no retry, no cache su disco.
- [ADR 0003 — Output della skill in Markdown, CSV e JSON](docs/adr/0003-output-multi-formato.md): output multi-formato; bundle luce+gas è entità first-class `OffertaBundle`.
- [ADR 0004 — Eccezione Playwright per Edison e WindTre](docs/adr/0004-eccezione-playwright-edison-windtre.md): lazy import opt-in solo per Edison + WindTre, tutti gli altri operatori usano cheerio puro.
- [ADR 0005 — Schema OffertaMobile + OffertaFisso](docs/adr/0005-schema-offerta-mobile-fisso.md): aggiunta discriminazione mobile/fisso allo schema `Offerta` (union a 4 membri).
- [ADR 0006 — Fixture refresh settimanale via GitHub Action](docs/adr/0006-fixture-refresh-weekly-github-action.md): lunedì 06:00 UTC + manual dispatch, PR automatica su drift tra fixture e live.
- [ADR 0007 — Skill doctor: CLI standalone + sub-skill Claude Code](docs/adr/0007-skill-doctor-cli-e-sub-skill.md): comando per diagnosticare salute scraper; doppio entry point CLI + sub-skill.
- [ADR 0008 — Scraping `--live` non funzionante: fixture sintetiche ≠ siti reali](docs/adr/0008-scraping-live-non-funzionante-fixture-sintetiche.md): 12/12 mobile live scraper sono rotti per disallineamento architetturale al bootstrap; fix demandato a v2 (issue #90).
- [ADR 0009 — Test strutturali vs hardcoded](docs/adr/0009-test-strutturali-vs-hardcoded.md): filosofia test canonical per v2 — `count >= 1` + campi richiesti non vuoti su `OffertaLuce | OffertaGas | OffertaMobile | OffertaFisso | OffertaBundle`. Lista field-required demandata ai singoli per-operatore PR (#93+).
- [ADR 0010 — Drop `velocita_mbps` da `OffertaMobile` + drop `'5G+'` da `TecnologiaMobile`](docs/adr/0010-rimozione-velocita-mbps-mobile.md): il campo `velocita_mbps` mobile è fabbricato (12 scraper, costanti copia-incolla `{5G+: 2000, 5G: 1000, 4G: 150}`) e decorativo (non entra in `score()`/aggregator); rimosso invece di estrarlo. `'5G+'` rimosso dal union perché non matcha offerte reali, solo copy marketing. Path A (estrazione per-offer) e path C (hybrid) respinti. `OffertaFisso` invariato. Scopo v3 map (#134).