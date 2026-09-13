# Skill doctor: CLI standalone + sub-skill Claude Code

`skill doctor` è il comando che esegue scraping live di tutti gli operatori v1 e segnala salute (HTTP status, numero offerte parsate, drift, parse failure). L'utente deve poterlo invocare sia come script shell standalone (per debug rapido, cron job locale, script CI) sia come sub-skill Claude Code (per invocazione conversazionale senza uscire dalla sessione). La decisione è di esporre entrambe le entry point sopra lo stesso modulo `src/doctor.ts`.

## Status

Accepted. Risolve il dubbio "Definizione di skill doctor" del wayfinder map (#1) + completa T5 (#20).

## Considered Options

- **(a) Solo CLI standalone.** `node --experimental-strip-types src/doctor.ts`. Semplice ma perde l'integrazione conversazionale: per controllare la salute degli scraper l'utente deve uscire da Claude Code.
- **(b) Solo GitHub Action daily.** Nessuna CLI locale, solo GitHub Action schedulata. Zero interazione locale ma niente debug manuale rapido (loop lungo: modifica scraper → push → attendere CI → leggere report).
- **(c) CLI standalone + sub-skill Claude Code.** Stessa logica in `src/doctor.ts`, due entry point: invocazione diretta da terminale + entry nella SKILL.md frontmatter `commands:` per sub-skill. Massima flessibilità.
- **(d) CLI + GitHub Action daily.** Come (c) + Action schedulata. Più coverage ma richiede secrets GITHUB_TOKEN, secrets management, e una Action che potrebbe divergere dalla CLI locale se non mantenuta identica.

Scelta: **(c)**. CLI locale dà il loop di feedback rapido (debug subito), sub-skill dà l'integrazione conversazionale (l'utente può chiedere "come stanno gli scraper?" senza uscire). L'automazione CI si aggiunge solo se necessario in futuro (segnalazione proattiva di drift non urgente), non ora.

## Module structure

```
src/doctor.ts                    # logica principale, invocabile da entrambe le entry point
src/cli/doctor-cli.ts            # arg parsing (--operator, --json), stdout formatting
src/skills/doctor.ts             # wrapper che espone la stessa logica come sub-skill
```

Il modulo `src/doctor.ts` espone:

```typescript
export async function runDoctor(opts: {
  operator?: OperatorId;       // singolo operatore o tutti
  format: 'markdown' | 'json';
  outputPath?: string;         // se assente → stdout
}): Promise<DoctorReport>
```

`src/cli/doctor-cli.ts` chiama `runDoctor()` e gestisce `process.argv`. `src/skills/doctor.ts` chiama `runDoctor()` e formatta l'output come risposta conversazionale.

## SKILL.md entry

La SKILL.md (T3, #18) include nella sezione `## Commands`:

```yaml
commands:
  - name: doctor
    description: Health check di tutti gli scraper (HTTP status, offerte parsate, parse failures)
    handler: src/skills/doctor.ts
  - name: doctor --operatore enel
    description: Health check di un singolo operatore
    handler: src/skills/doctor.ts
```

L'utente può quindi invocare `/meno-meno doctor` da Claude Code, che esegue `src/skills/doctor.ts`, che chiama `runDoctor()` di `src/doctor.ts`. Stessa logica, stesso output, due entry point.

## Output format

Report Markdown (default):

```markdown
# Skill doctor — 2026-09-13T10:38:00Z

| Operatore | Commodity | HTTP | Offerte | Parse | Note |
|-----------|-----------|------|---------|-------|------|
| enel | luce | 200 | 12 | ✅ | OK |
| edison | luce | 200 | 8 | ⚠️ | Playwright fallback, 5s |
| windtre | mobile | 200 | 6 | ❌ | Parse error: campo X mancante |
```

Salvataggio: di default su stdout. Con `--output logs/doctor-<timestamp>.md` scrive su file. Stesso path usato dal doctor in modalità CLI.

## Failure mode

- Operatore irraggiungibile → riga con HTTP `ERR` + nota timeout/retry. Non blocca gli altri operatori.
- Parse failure su un operatore → riga con `❌` + messaggio di errore. Non blocca gli altri operatori.
- Tutti gli operatori falliti → report emesso comunque (nessun crash), sezione "Tutti gli operatori degraded" in testa al report.
- Playwright fallisce per Edison/WindTre → riga con `⚠️` + nota "Playwright non disponibile, offerta marcata non_disponibile" (coerente con ADR 0004).

## Consequences

- Zero nuove dipendenze: `src/doctor.ts` riusa `src/scrapers/`, `src/formatters/`, `src/types/`. Il doctor è un composition root sopra l'architettura esistente.
- Loop di debug locale: modifica scraper → `node --experimental-strip-types src/cli/doctor-cli.ts --operatore enel` → verifica fix → commit.
- Loop conversazionale: stessa cosa ma con `/meno-meno doctor --operatore enel` da Claude Code, lettura risposta inline.
- L'automazione GitHub Action daily (opzione d) resta un follow-on possibile se il volume di drift diventa ingestibile manualmente, ma non è in scope per v1.