---
name: meno-meno
description: Skill per confrontare le offerte di utility e telco nel mercato italiano. Compara le offerte di luce, gas, mobile e fisso degli operatori registrati ed emette EUR/kWh, EUR/Smc e quota fissa in Markdown, CSV e JSON. Non richiede un profilo di consumo.
commands:
  doctor: Esegue la diagnosi su tutti gli operatori v1 (o su uno solo con --operatore). Usalo quando gli scraper falliscono o le fixture sembrano vecchie.
---

# meno-meno

Skill per confrontare le offerte di utility (luce, gas) e telco (mobile, fisso) degli operatori registrati nel mercato italiano. Aggrega i dati pubblicati dai singoli operatori in un formato neutro (Markdown, CSV, JSON) pronto per essere analizzato, ordinato per tier di ranking, o esportato.

## Comandi

### Comando principale — `Skill name: meno-meno`

Invoca la skill dal prompt di Claude Code con `Skill name: meno-meno` oppure chiedendo direttamente il confronto. La skill gira lo scraper registrato per l'operatore e la commodity richiesti e restituisce l'output formattato in-line. Di default vengono emessi tutti e tre i formati (Markdown, CSV, JSON) nello stesso messaggio.

### Sotto-comando: `doctor`

Sotto-comando `doctor` (T5, #20). Esegue un health check di tutti gli scraper registrati: HTTP status, numero di offerte parsate, parse failures, e drift rispetto all'ultimo run noto. Output come tabella Markdown con una riga per operatore. Operatori senza scraper registrato (oggi 23 su 24, enel è l'unico live) vengono marcati con `scraper not yet registered for v1` invece di un errore — è il comportamento v1 corretto, non un fallimento. Per il reference completo vedi [ADR 0007](docs/adr/0007-skill-doctor-cli-e-sub-skill.md).

Invocabile in due modi:
- Standalone CLI: `node --experimental-strip-types src/cli/doctor-cli.ts [--operatore <id>] [--output <path>] [--json]`
- Come sub-skill Claude Code: `runSkillDoctor({ operatore: 'enel' })` (vedi `src/skills/doctor.ts`)

## Flag

| Flag | Obbligatorio | Predefinito | Descrizione |
|------|----------|---------|-------------|
| `--operatore` | no* | — | ID operatore registrato (es. `enel`, `edison`, `windtre`). *Richiesto solo per il path mono-operatore; omettendolo con `--commodity` la skill fa fan-out su tutti gli operatori registrati per quella commodity (vedi sotto). |
| `--commodity` | sì | — | Una tra `luce`, `gas`, `mobile`, `fisso`. |
| `--fixture` | no | — | Path a un file HTML locale da usare come sorgente di scrape (modalità offline). |
| `--live` | no | `false` | Esegue scraping live dal sito operatore invece di leggere da fixture. Solo per operatori con sorgente live registrata in `scripts/v1-sources.ts`. |
| `--format` | no | `all` | Filtra i formati emessi: `all`, `markdown`, `csv`, o `json`. Default `all` emette tutti e tre (Markdown, CSV, JSON) nella stessa invocazione, come da ADR 0003. |
| `--filter` | no | — | Vincolo numerico commodity-aware, ripetibile. Espressione: `alias<op>valore` con `<op>` ∈ `< <= = >= > !=`. AND tra flag, OR entro lo stesso flag via `|` (es. `gb>=50|gb=-1`). Alias: `prezzo`, `gb`, `costo_commercializzazione` (mappati a schema field per commodity — vedi sotto). Solo con `--commodity`. Ignorato nel path mono-operatore implicito via `[ci-live-gate]` per backward compat. Reference: [ADR 0013](docs/adr/0013-filter-dsl.md). |

Exit codes: `0` successo, `1` errore scrape/aggregate, `2` errore di uso (argomento mancante, non valido, o operatore non registrato). Reference completa: [ADR 0003](docs/adr/0003-output-multi-formato.md).

### Multi-operator fan-out

Senza `--operatore` e con `--commodity` (escludendo il path mono-op di `[ci-live-gate]`) la skill itera `aggregate()` su tutti gli operatori registrati per quella commodity, applica `rankOfferte()` (top-3 + trade-off) sui superstiti, ed emette markdown/csv/json con l'espressione del filtro nell'header. Il path mono-operatore (con `--operatore X`) resta bit-identical al precedente — backward compat con ADR 0002 e `[ci-live-gate]`.

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

## Esempi

Esempi di invocazione da chat Claude Code. Adatta operatore e commodity a quelli che ti interessano.

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