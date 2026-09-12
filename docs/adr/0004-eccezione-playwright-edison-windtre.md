# Eccezione Playwright per Edison e WindTre

ADR 0001 ha stabilito che ogni operatore ha uno scraper hardcoded; l'architettura di base usa `cheerio` per il parsing HTML statico, senza dipendenze da browser headless. R5 (site rendering survey) ha verificato che Edison (Angular SPA puro, offerte rese solo dopo hydration) e WindTre (Radware Bot Manager challenge su ogni GET, risolvibile solo con esecuzione JS) non sono parsabili con cheerio né con richieste HTTP statiche, e che entrambi sono critici per la copertura v1 — Edison è nel top 5 luce/gas per quote cumulative, WindTre è il primo operatore mobile italiano per quote di mercato. La decisione è di derogare al vincolo "no headless browser" limitatamente a questi due operatori, usando Playwright come modulo isolato caricato lazy e scaricando Chromium on-demand al primo utilizzo (`npx playwright install chromium`); tutti gli altri scraper restano cheerio puro, e l'aggiunta di Playwright non si propaga oltre Edison e WindTre.

## Status

Accepted. Risolve G7 (#21) del wayfinder map (#1).

## Considered Options

- **(a) Esclusione Edison + WindTre da v1.** Accettabile per Edison (top 5 ma sacrificabile), inaccettabile per WindTre che è uno dei 4 MNO principali e garantirebbe un gap visibile nel confronto telco.
- **(b) Eccezione mirata Playwright per Edison + WindTre.** Modulo Playwright isolato, lazy import, browser Chromium scaricato on-demand. Complessità localizzata in due file `scrapers/edison.ts` e `scrapers/windtre.ts`.
- **(c) Deroga completa: ADR 0001 abolito, ogni scraper può usare qualsiasi tecnologia.** Aumenta la complessità operativa (browser service per tutti gli scraper, containerizzazione) senza un reale beneficio — gli altri 9 operatori target sono parsabili con cheerio.

Scelta: **(b)**. Edison e WindTre sono abbastanza critici da giustificare un modulo Playwright isolato; la complessità resta localizzata.

## Scope

| Operatore | Tecnologia scraper | Motivo |
|-----------|-------------------|--------|
| Enel | cheerio | HTML statico, anti-bot Imperva gestibile con cookie session |
| Eni Plenitude | cheerio | HTML statico, anti-bot Akamai + Gigya gestibile con cookie session |
| A2A | cheerio | Gatsby SSR shell, offerte in HTML statico |
| Iren | cheerio | AEM, HTML statico |
| Hera | cheerio | Liferay, HTML statico |
| Acea | cheerio | Da verificare, atteso HTML statico |
| Sorgenia | cheerio | Drupal 10, HTML statico |
| Illumia | cheerio | Da verificare, atteso HTML statico |
| Engie Italia | cheerio | Da verificare, atteso HTML statico |
| Edison | **Playwright** | Angular SPA puro, offerte rese solo dopo hydration |
| TIM | cheerio | HTML statico custom |
| Vodafone | cheerio | Next.js SSR, anti-bot Imperva gestibile con cookie session |
| WindTre | **Playwright** | Radware Bot Manager challenge richiede esecuzione JS |

## Browser management

- **Modulo**: `src/browser/playwright.ts` espone `getBrowser(): Promise<Browser>` che scarica Chromium on-demand al primo utilizzo (`npx playwright install chromium`) e poi riusa l'istanza Singleton per invocazione.
- **Download**: one-time, ~150MB, idempotente. Cached in `~/.cache/ms-playwright/` dopo il primo download.
- **Failure mode**: se il download o il launch fallisce, lo scraper Edison/WindTre emette un warning nel Markdown e l'offerta viene marcata come `non_disponibile`, seguendo la degradazione graceful di ADR 0002 (no crash).
- **No Docker**: niente container sidecar, niente browser di sistema richiesto.

## Consequences

- La skill richiede Node 22+ (già requisito per `--experimental-strip-types`) e ha una dipendenza opzionale da `playwright` caricata solo per Edison/WindTre. Il primo scrape di uno di questi due operatori aggiunge ~5-10s per il launch del browser.
- Il cap di 3 scraper paralleli (decisione architetturale già presa nella mappa) regge: il launch del browser è serializzato all'interno del modulo Playwright, e solo Edison + WindTre lo pagano.
- Aggiungere un futuro operatore che richiede Playwright significa importare il modulo `src/browser/playwright.ts` esistente — niente nuova infrastruttura.
- Se in futuro Edison o WindTre diventano parsabili con cheerio (es. rilasciano una versione statica del sito), lo scraper può migrare indietro rimuovendo l'import Playwright senza toccare il resto della skill.