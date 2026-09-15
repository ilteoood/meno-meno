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
  2. Setup Node 22.
  3. `node --experimental-strip-types scripts/download-fixtures.ts` (scrive in working tree).
  4. `git diff --exit-code fixtures/` per rilevare cambiamenti.
  5. Se diff non vuoto: `peter-evans/create-pull-request` con titolo `chore(fixtures): refresh settimanale YYYY-MM-DD` e body che elenca i file modificati e le dimensioni prima/dopo.
  6. Se diff vuoto: exit 0, nessuna PR.

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