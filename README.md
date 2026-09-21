# meno-meno

Skill Claude Code per confrontare le offerte di utility e telco nel mercato italiano.

Stato: in fase di pianificazione. Vedi [issue #1](https://github.com/ilteoood/meno-meno/issues/1) per la mappa wayfinding.

## Panoramica

`meno-meno` è una skill Claude Code che confronta le offerte pubblicate dagli operatori italiani di utility (luce, gas) e telco (mobile, fisso). Aggrega i dati per commodity, li normalizza in EUR/kWh, EUR/Smc, e quota fissa, e li emette in Markdown, CSV, e JSON. Non serve un profilo di consumo: ogni offerta è elencata con le sue metriche base così l'utente può ordinare e confrontare senza dover inserire kWh o GB/mese.

## Installazione

La skill si installa copiando il contenuto della repo nella directory delle skill Claude Code:

```sh
git clone https://github.com/ilteoood/meno-meno.git
mkdir -p ~/.claude/skills/meno-meno
cp -r meno-meno/. ~/.claude/skills/meno-meno/
cd ~/.claude/skills/meno-meno && npm ci
```

Dopo l'installazione, la skill è invocabile da Claude Code con `Skill name: meno-meno` (vedi `SKILL.md` per il dettaglio delle flag e degli esempi).

## Utilizzo

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

## Filtro multi-operatore

Combinando `--commodity` con uno o più `--filter`, senza specificare `--operatore`, la skill fa fan-out su tutti gli operatori registrati per quella commodity, applica il vincolo sulle offerte, e produce l'output con `rankOfferte()` (top-3 + trade-off). Path mono-operatore (`--operatore X`) resta backward-compat.

### Esempi

```sh
# Offerte mobile con prezzo <= 7 €/mese E (gb >= 50 OR gb = -1 per illimitati)
npm run start -- --commodity mobile --filter "prezzo<=7" --filter "gb>=50|gb=-1"
```

```sh
# Solo offerte mobile con almeno 100 GB (o illimitate)
npm run start -- --commodity mobile --filter "gb>=100|gb=-1"
```

### Alias del filtro per commodity

| Commodity | Alias                       | Schema field                  |
|-----------|-----------------------------|-------------------------------|
| `mobile`  | `prezzo`                    | `prezzo_effettivo_euro_mese`  |
| `mobile`  | `gb`                        | `gb`                          |
| `fisso`   | `prezzo`                    | `prezzo_effettivo_euro_mese`  |
| `luce`    | `prezzo`                    | `prezzo_effettivo_euro_kwh`   |
| `luce`    | `costo_commercializzazione` | `quota_fissa_euro_anno`       |
| `gas`     | `prezzo`                    | `prezzo_effettivo_euro_smc`   |
| `gas`     | `costo_commercializzazione` | `quota_fissa_euro_anno`       |

Operatori: `<`, `<=`, `=`, `>=`, `>`, `!=`. Tolleranza ±0.0001 SOLO sui campi monetari. AND tra flag distinti, OR entro lo stesso flag via `|`. Nessun match → exit 0 con tabella vuota + warning. `OffertaBundle` è escluso dal filtro (entità separata). Reference completa del DSL: [ADR 0013](docs/adr/0013-filter-dsl.md).

## Troubleshooting

- **Scraper rotto** (output vuoto, parse failure, HTTP error) → esegui `skill doctor` (sub-skill di T5, #20) per la diagnosi automatica su tutti gli operatori. Reference: [ADR 0007](docs/adr/0007-skill-doctor-cli-e-sub-skill.md).
- **Fixture vecchia** (offerte non aggiornate, drift rispetto al sito live) → rigenera le fixture con `scripts/download-fixtures.ts`. Reference: [ADR 0006](docs/adr/0006-fixture-refresh-weekly-github-action.md) e workflow `.github/workflows/fixture-refresh.yml`.
- **CI live gate fallisce** (drift o regressione live su PR che tocca scraper o fixture) → il workflow `live-gate` gira solo sui PR che toccano `src/scrapers/**/*.ts` o `fixtures/**/*.html`. Per debug locale: `export CI_PR_NUMBER=42 && npm run ci:live-gate`. Reference: [ADR 0002](docs/adr/0002-scraping-live-senza-cache.md).

## Architettura

Skill NodeJS TypeScript con `--experimental-strip-types`, `cheerio` per il parsing HTML, e `playwright` lazy (opt-in) per Edison + WindTre. Scope v1: 8+ operatori (luce + gas + telco), cap 3 scraper concorrenti, solo test su fixture mock in CI, `--live` gating sui PR agli scraper, degradazione graceful, monitor `skill doctor` schedulato.

Le decisioni di design sono documentate in [`docs/adr/`](docs/adr/) (tredici ADR accettate al momento della v6). Eventuale materiale di ricerca di mercato va in `docs/research/` (creato on-demand).

## Prossimo passo

Segui la mappa wayfinding su https://github.com/ilteoood/meno-meno/issues/1.

## CI live gate

GitHub Actions esegue due workflow a ogni PR:

- `ci` (`.github/workflows/ci.yml`) — esegue `npm ci && npm run lint && npm test` sulle fixture mock. Deve passare prima del merge.
- `live-gate` (`.github/workflows/live-gate.yml`) — si attiva solo quando i path matchano `src/scrapers/**/*.ts` o `fixtures/**/*.html`. Per ogni operatore coinvolto, esegue `npm run ci:live-gate`, che estrae gli ID operatore dai file della PR tramite `gh pr view`, poi esegue `node --experimental-strip-types src/index.ts --operatore <id> --commodity <commodity> --live` per ciascuno. Qualsiasi exit non-zero fa fallire il gate.

Debug locale:

```sh
export CI_PR_NUMBER=42
npm run ci:live-gate
```

Operatori senza una sorgente live registrata (oggi: tutti tranne `enel/luce`) vengono skippati, non falliti.