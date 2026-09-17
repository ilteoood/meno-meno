# Fixture refresh settimanale via GitHub Action

I siti degli operatori cambiano di frequente (refresh layout, A/B test, copy, microcopy) e le fixture HTML committate in `fixtures/<operatore>/<commodity>.html` diventano obsolete. Quando uno scraper si rompe su un sito che ha cambiato layout, lo sviluppatore deve sapere subito se la causa è la fixture vecchia (siti cambiati) o un bug dello scraper. Refresh on-demand via `scripts/download-fixtures.ts` (previsto da T1) non basta: scopri il drift solo quando qualcuno esegue il comando, spesso dopo ore di debug. La decisione è di schedulare una GitHub Action weekly che scarica le fixture, le confronta con quelle committate, e apre una PR automatica se rileva drift.

## Status

Accepted. Risolve il dubbio "Strategia di aggiornamento delle fixture HTML" del wayfinder map (#1).

## Considered Options

- **(a) Manual on-demand only.** Script `scripts/download-fixtures.ts` invocato dallo sviluppatore quando lo scraper si rompe. Drift scoperto tardi, dipende dalla disciplina manuale.
- **(b) GitHub Action weekly.** Schedulato ogni lunedì alle 06:00 UTC. Se le fixture cambiano, apre una PR automatica con il diff. Lo sviluppatore vede il drift in review queue senza dover scoprire il problema.
- **(c) Doctor on-demand only.** Nessuno script di refresh dedicato. Il refresh avviene solo quando skill doctor segnala drift e l'utente rilancia manualmente. Workflow implicito non documentato, discovery ancora più tardiva di (a).

Scelta: **(b)**. Catch del drift proattivo con costo operativo minimo (una PR/settimana di rumore accettabile). Lo sviluppatore resta in controllo: la PR è solo informativa, il merge è manuale.

## Workflow

File `.github/workflows/fixture-refresh.yml`:

- **Trigger**: schedule `cron: '0 6 * * 1'` (lunedì 06:00 UTC) + `workflow_dispatch` per run manuale.
- **Job**:
  1. Checkout del repo.
  2. Setup Node 22 + `npm ci`.
  3. `npx playwright install --with-deps chromium` (richiesto dagli operatori Playwright in §Supported transports).
  4. `node --experimental-strip-types scripts/download-fixtures.ts` (scrive in working tree).
  5. `git diff --exit-code fixtures/` per rilevare cambiamenti.
  6. Se diff non vuoto: `peter-evans/create-pull-request` con titolo `chore(fixtures): refresh settimanale YYYY-MM-DD` e body che elenca i file modificati e le dimensioni prima/dopo.
  7. Se diff vuoto: exit 0, nessuna PR.

## Supported transports

`scripts/download-fixtures.ts` dispatcha per operatore in base al flag `playwright` in `scripts/v1-sources.ts`. La lista corrente (post-v2 fan-out #94/#95) è la single source of truth per il mapping operatore → trasporto:

| Operatore | Commodity | Trasporto | Motivo |
|-----------|-----------|-----------|--------|
| Enel | luce | cheerio (HTTP) | HTML statico, anti-bot Imperva gestibile con cookie session |
| Edison | luce | **Playwright** | Angular SPA puro, offerte rese solo dopo hydration |
| Plenitude | luce | cheerio (HTTP) | HTML statico, anti-bot Akamai + Gigya gestibile con cookie session |
| Hera | luce | cheerio (HTTP) | Liferay, HTML statico |
| Iren | luce | cheerio (HTTP) | AEM, HTML statico |
| A2A | luce | cheerio (HTTP) | Gatsby SSR shell, offerte in HTML statico |
| Acea | luce | cheerio (HTTP) | JSON endpoint statico parsato come HTML wrapping |
| Sorgenia | luce | cheerio (HTTP) | Drupal 10, AJAX endpoint statico |
| Illumia | luce | cheerio (HTTP) | WordPress, blocchi `.mcl-price/.mcl-unit` statici |
| Engie | luce | cheerio (HTTP) | HTML statico |
| Octopus | luce | cheerio (HTTP) | HTML statico |
| Nen | luce | cheerio (HTTP) | JSON catalog API parsato come HTML wrapping |
| TIM | mobile | cheerio (HTTP) | HTML statico custom |
| WindTre | mobile | **Playwright** | Radware Bot Manager challenge richiede esecuzione JS |
| Vodafone | mobile | **Playwright** | Next.js SSR ma `__NEXT_DATA__` non renderizzato lato server, idratazione JS obbligatoria (scoperto durante v2 #94 fan-out, estende ADR 0004) |
| Iliad | mobile | cheerio (HTTP) | HTML statico |
| Fastweb | mobile | cheerio (HTTP) | HTML statico |
| Sky Wifi | mobile | cheerio (HTTP) | HTML statico |
| PosteMobile | mobile | cheerio (HTTP) | HTML statico |
| ho. | mobile | cheerio (HTTP) | HTML statico |
| Kena | mobile | cheerio (HTTP) | HTML statico |
| Very | mobile | cheerio (HTTP) | HTML statico |
| Tiscali | mobile | cheerio (HTTP) | HTML statico |
| Dimensione | mobile | cheerio (HTTP) | HTML statico |

Razionale dell'eccezione Playwright: ADR 0004 (Edison + WindTre). Vodafone è stato aggiunto a questa lista durante il v2 fan-out (#94) dopo che lo scraper Next.js ha richiesto idratazione JS per esporre `__NEXT_DATA__`. La modifica al flag `playwright` in `scripts/v1-sources.ts` è il vincolo canonico — qualsiasi futuro scraper Playwright-richiede aggiornamento di entrambi i file.

## Cadence

Weekly (lunedì 06:00 UTC) resta la cadenza di default. v2 destination acceptance #6 ("fixture-refresh GitHub Action produce diff non-vuoti") si valuta sulle prime run post-merge: se i diff clusterano su una finestra sub-weekly (es. drift concentrato a metà settimana), la cadenza va rivalutata. Nessuna evidenza di clustering al commit di questo ADR — un eventuale passaggio a sub-weekly va motivato con dati di drift effettivo, non anticipato.

## Permission model

- La workflow usa `GITHUB_TOKEN` con `contents: write` + `pull-requests: write` (default per GitHub Actions).
- Nessun secret custom.
- Le PR sono etichettate automaticamente via labeler (`area: fixtures`) per renderle filtrabili.

## Failure mode

- Se `scripts/download-fixtures.ts` fallisce su uno o più operatori (sito irraggiungibile, timeout), gli operatori riusciti vengono committati e la PR elenca gli operatori falliti nella descrizione. La PR viene aperta ugualmente.
- Se tutti gli operatori falliscono, la workflow exit code != 0, GitHub Actions mostra il fallimento nella tab Actions, nessuna PR.

## Consequences

- Costo operativo: ~1 PR/settimana, contenuto basso (diff HTML auto-generato). Il merge è a carico dello sviluppatore, decisione consapevole.
- Il refresh non sostituisce `scripts/download-fixtures.ts` locale: lo sviluppatore può ancora rilanciarlo manualmente per casi urgenti (es. sito rotto oggi, refresh weekly domani).
- `scripts/check-fixtures.ts` (previsto da T1) resta utile per debug locale: confronta working tree vs HEAD per identificare drift non ancora committato.
- La cadenza weekly è un trade-off consapevole: troppo frequente genera rumore, troppo rara perde il vantaggio di scoperta proattiva. Rivedibile se il tasso di drift reale si discosta significativamente dalle attese.