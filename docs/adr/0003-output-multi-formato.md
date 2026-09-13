# Output della skill in Markdown, CSV e JSON

La skill produce tre rappresentazioni della stessa uscita nella stessa invocazione: una tabella Markdown per la lettura nel terminale Claude Code, un CSV per la rielaborazione in fogli di calcolo, e un JSON strutturato con le offerte normalizzate per integrazioni future.

L'alternativa rifiutata — solo Markdown — avrebbe privilegiato la leggibilità conversazionale ma avrebbe costretto l'utente a ricopiare o riparsare l'output per qualsiasi uso non discorsivo (confronto storico, condivisione, import in altri tool).

Il prezzo di questa scelta è la presenza di tre formatters nel codice (uno per destinazione) e la necessità che gli scraper producano dati sufficientemente strutturati da alimentare tutti e tre senza perdita di informazione — il che a sua volta giustifica la separazione tra scrapers e formatters come strati distinti.

## CLI surface (canonical)

La superficie CLI è fissata da questa ADR per evitare drift tra codice, `SKILL.md` e `README.md` (vedi ticket #36). Qualunque modifica a flag o exit code richiede update coordinato dei tre file.

### Flag

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--operatore <id>` | sì | — | ID operatore registrato (es. `enel`, `edison`, `windtre`). |
| `--commodity <c>` | sì | — | Una tra `luce`, `gas`, `mobile`, `fisso`. |
| `--fixture <path>` | no | — | Path a file HTML locale da usare come sorgente di scrape (modalità offline). Mutualmente esclusivo con `--live`. |
| `--live` | no | `false` | Esegue scraping live dal sito operatore invece di leggere da fixture. Solo per operatori con sorgente live registrata in `scripts/v1-sources.ts`. |
| `--format <fmt>` | no | `all` | Filtra i formati emessi. Valori: `all`, `markdown`, `csv`, `json`. Default `all` rispetta la tesi "tre rappresentazioni nella stessa invocazione" di questa ADR. |

### Exit codes

| Code | Significato |
|------|-------------|
| 0 | Successo, output emesso su stdout (formato Markdown, CSV, JSON secondo `--format`). |
| 1 | Errore di scrape/aggregate (es. fixture mancante, operatore live non raggiungibile). |
| 2 | Errore di uso CLI (es. `--operatore` mancante, commodity non valida, operatore non registrato). |

### Esempi

```sh
# Tutti i formati (default), da fixture locale
node --experimental-strip-types src/index.ts \
  --operatore enel --commodity luce \
  --fixture fixtures/enel/luce.html

# Solo JSON, live (richiede sorgente live registrata)
node --experimental-strip-types src/index.ts \
  --operatore enel --commodity luce --live --format json
```