---
name: meno-meno
description: Italian utility and telco market comparison. Compares luce, gas, mobile, and fisso offers from registered operators and outputs EUR/kWh, EUR/Smc, and quota fissa in Markdown, CSV, and JSON. No consumption profile required.
---

# meno-meno

Skill per confrontare le offerte di utility (luce, gas) e telco (mobile, fisso) degli operatori registrati nel mercato italiano. Aggrega i dati pubblicati dai singoli operatori in un formato neutro (Markdown, CSV, JSON) pronto per essere analizzato, ordinato per tier di ranking, o esportato.

## Commands

### Main command — `Skill name: meno-meno`

Invoca la skill dal prompt di Claude Code con `Skill name: meno-meno` oppure chiedendo direttamente il confronto. La skill gira lo scraper registrato per l'operatore e la commodity richiesti e restituisce l'output formattato in-line. Di default vengono emessi tutti e tre i formati (Markdown, CSV, JSON) nello stesso messaggio.

### Sub-command: `doctor`

Placeholder per il sub-command `doctor` (T5, #20). Esegue un health check di tutti gli scraper registrati: HTTP status, numero di offerte parsate, parse failures, e drift rispetto all'ultimo run noto. Output come tabella Markdown con una riga per operatore. Per il reference completo vedi [ADR 0007](docs/adr/0007-skill-doctor-cli-e-sub-skill.md).

## Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--operatore` | yes | ID operatore registrato (es. `enel`, `edison`, `windtre`). |
| `--commodity` | yes | Una tra `luce`, `gas`, `mobile`, `fisso`. |
| `--live` | no | Esegue scraping live dal sito operatore invece di leggere da fixture locale. Solo per operatori con sorgente live registrata in `scripts/v1-sources.ts`. |
| `--output` | no | Path del file dove salvare l'output. Default: stdout (emesso nel messaggio di Claude Code). |
| `--json` | no | Emette solo output JSON invece di tutti e tre i formati. |

## Examples

Esempi di invocazione da chat Claude Code. Adatta operatore e commodity a quelli che ti interessano.

### Luce

```
Usa la skill meno-meno per confrontare le offerte luce di enel.
```

### Gas

```
Usa la skill meno-meno per confrontare le offerte gas di enel con --output reports/enel-gas.json --json.
```

### Mobile

```
Usa la skill meno-meno per confrontare le offerte mobile di windtre.
```

### Fisso

```
Usa la skill meno-meno per confrontare le offerte fisso di windtre con --live.
```
