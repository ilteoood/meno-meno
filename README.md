# meno-meno

Italian utility/telco price comparison Claude Code skill.

Status: in planning phase. See [issue #1](https://github.com/ilteoood/meno-meno/issues/1) for the wayfinding map.

## Overview

`meno-meno` è una skill Claude Code che confronta le offerte pubblicate dagli operatori italiani di utility (luce, gas) e telco (mobile, fisso). Aggrega i dati per commodity, li normalizza in EUR/kWh, EUR/Smc, e quota fissa, e li emette in Markdown, CSV, e JSON. Non serve un profilo di consumo: ogni offerta è elencata con le sue metriche base così l'utente può ordinare e confrontare senza dover inserire kWh o GB/mese.

## Installation

La skill si installa copiando il contenuto della repo nella directory delle skill Claude Code:

```sh
git clone https://github.com/ilteoood/meno-meno.git
mkdir -p ~/.claude/skills/meno-meno
cp -r meno-meno/. ~/.claude/skills/meno-meno/
cd ~/.claude/skills/meno-meno && npm ci
```

Dopo l'installazione, la skill è invocabile da Claude Code con `Skill name: meno-meno` (vedi `SKILL.md` per il dettaglio delle flag e degli esempi).

## Usage

Quattro esempi, uno per commodity. Adatta operatore e commodity a quelli che ti interessano.

### Luce

```
Usa la skill meno-meno per confrontare le offerte luce di enel.
```

### Gas

```
Usa la skill meno-meno per confrontare le offerte gas di enel con --fixture fixtures/enel/luce.html --format csv.
```

### Mobile

```
Usa la skill meno-meno per confrontare le offerte mobile di windtre.
```

### Fisso

```
Usa la skill meno-meno per confrontare le offerte fisso di windtre con --live.
```

Per la reference completa di flag e formati vedi [SKILL.md](SKILL.md).

## Troubleshooting

- **Scraper rotto** (output vuoto, parse failure, HTTP error) → esegui `skill doctor` (sub-skill di T5, #20) per la diagnosi automatica su tutti gli operatori. Reference: [ADR 0007](docs/adr/0007-skill-doctor-cli-e-sub-skill.md).
- **Fixture vecchia** (offerte non aggiornate, drift rispetto al sito live) → rigenera le fixture con `scripts/download-fixtures.ts`. Reference: [ADR 0006](docs/adr/0006-fixture-refresh-weekly-github-action.md) e workflow `.github/workflows/fixture-refresh.yml`.
- **CI live gate fallisce** (drift o regressione live su PR che tocca scraper o fixture) → il workflow `live-gate` gira solo sui PR che toccano `src/scrapers/**/*.ts` o `fixtures/**/*.html`. Per debug locale: `export CI_PR_NUMBER=42 && npm run ci:live-gate`. Reference: [ADR 0002](docs/adr/0002-scraping-live-senza-cache.md).

## Architecture

Skill NodeJS TypeScript con `--experimental-strip-types`, `cheerio` per il parsing HTML, e `playwright` lazy (opt-in) per Edison + WindTre. Scope v1: 8+ operatori (luce + gas + telco), cap 3 scraper concorrenti, solo test su fixture mock in CI, `--live` gating sui PR agli scraper, degradazione graceful, monitor `skill doctor` schedulato.

Le decisioni di design sono documentate in [`docs/adr/`](docs/adr/) (sette ADR accettate al momento della v1). Eventuale materiale di ricerca di mercato va in `docs/research/` (creato on-demand).

## Architecture (locked)

- Three ADRs in `docs/adr/`:
  - `0001-scraper-per-operatore-hardcoded.md`
  - `0002-scraping-live-senza-cache.md`
  - `0003-output-multi-formato.md`
- Stack: NodeJS TypeScript with `--experimental-strip-types`, `cheerio` for HTML parsing.
- Scope v1: 8+ operatori (luce + gas + telco), cap 3 concurrent scrapers, only mock tests in CI, `--live` gating on scraper PRs, graceful degradation, scheduled `skill doctor` monitor.

## Next step

Follow the wayfinding map at https://github.com/ilteoood/meno-meno/issues/1.

## CI live gate

GitHub Actions runs two workflows on every PR:

- `ci` (`.github/workflows/ci.yml`) — runs `npm ci && npm run lint && npm test` against fixture mocks. Must pass before merge.
- `live-gate` (`.github/workflows/live-gate.yml`) — triggers only when paths match `src/scrapers/**/*.ts` or `fixtures/**/*.html`. For each affected operator, it runs `npm run ci:live-gate`, which extracts operator IDs from PR files via `gh pr view`, then runs `node --experimental-strip-types src/index.ts --operatore <id> --commodity <commodity> --live` for each. Any non-zero exit fails the gate.

Local debug:

```sh
export CI_PR_NUMBER=42
npm run ci:live-gate
```

Operators without a registered live source (today: every operator except `enel/luce`) are skipped, not failed.
