# v6 ticket #170 — filter design assumptions verification

Branch: `research/170-filter-design` (from main @ `3826c42`).

## 1. `aggregate()` handles N scrapers per commodity

Evidence: `src/aggregator.ts:32-70`.

- `Promise.all(input.scrapers.map((s) => s.scrape()))` — runs N scrapers in parallel.
- Loops results, keeps only offerte with `offer.commodity === input.commodity`, collects failures as `warnings`.
- Returns `{ ok: true, ..., offerte, bundle: [], warnings }` on partial/full success.
- Returns `{ ok: false, ..., error: 'all scrapers failed: ...' }` only when EVERY scraper fails.
- Always emits `bundle: []` (bundle composition is not the aggregator's job).
- Edge case `offerte.length === 0 && warnings.length === 0` returns `ok: true` with empty `offerte` — empty array is allowed.

Tested in `tests/aggregator.test.ts` (3 tests). N>1 scrapers is NOT currently exercised, but the implementation is data-shape agnostic. Recommendation: add a multi-scraper case in the ticket #172 spike.

**Verdict**: ✓ assumption holds.

## 2. `rankOfferte()` + `renderRankedSections()` on arbitrary subset / `top.length === 0`

Evidence: `src/rank/index.ts`.

- `rankOfferte()` filters by commodity, splits D-flagged to `esclusi`, sorts by tier. `top` is `sorted.slice(0, 3)` — works for any length, returns 0..3.
- `renderRankedSections()`:
  - `if (rank.top.length === 0)` → pushes `'Nessuna offerta eleggibile.'` (lines 199-200, 214-215). Safe.
  - `if (rank.esclusi.length > 0)` → emits `## Esclusi D` section (line 227); otherwise leaves it empty string. Safe.
  - `computeBaseline(top)` calls `Math.min(...top.map(...))` only when `top.length > 0` (the early-return guarantees this).
- Empty `offerte[]` covered: `tests/rank.test.ts:215-219` + `:310-319` (empty + all-D cases).

**Verdict**: ✓ assumption holds. Already exercised in tests.

## 3. Formatters (`toMarkdown`, `toCsv`, `toJson`) on empty `offerte[]`

Evidence: `src/formatters/{markdown,csv,json}.ts`.

- `toCsv([], commodity, undefined)` — `lines = [header]; for (const o of []) {}` → returns header-only CSV, no error.
- `toJson([], commodity, timestamp, undefined)` — `payload.count = 0; offerte.singole = []; bundle = []` → `'{"count":0,"offerte":{"singole":[], "bundle":[]}, ...}'`, no error.
- `toMarkdown({ with input.offerte = [] })` — `for (const o of []) {}` produces no rows; calls `rankOfferte({ offerte: [] })` → `top: []`; `renderRankedSections` falls into the `top.length === 0` branch → `'Nessuna offerta eleggibile.'`. No error.

EMPTY array tests are NOT currently present in `tests/formatters.test.ts`. The `bundle: []` / `warnings: []` defaults are tested, but the `offerte: []` edge case is not. **Gap**: ticket #172 (or a follow-up) should add `format({ offerte: [], ... })` assertions for all three formatters.

**Verdict**: ⚠ functional — no runtime error. Test coverage gap: empty-offerte not explicitly asserted. Cheap to add in #172.

## 4. `scripts/ci-live-gate.ts` backward-compat with new fan-out mode

Evidence: `scripts/ci-live-gate.ts:39-59` and `src/index.ts:31-58, 193-210`.

- `runLive()` hardcodes `--operatore operatorId --commodity commodity --live`.
- `src/index.ts:193` requires `--operatore` (returns exit 2 if missing).
- Any new "fan-out mode" would presumably add a code path that does NOT require `--operatore` (e.g., when missing, aggregate all operators of a commodity).
- The `for (const arg of argv)` loop in `parseArgs` is opt-in per flag; adding a new `--filter` flag or a "no `--operatore`" branch is additive and won't affect ci-live-gate's command shape.
- ci-live-gate never passes `--filter` either, so a runtime filter flag would also be backward-compat.

**Verdict**: ✓ invariant holds. ci-live-gate always passes `--operatore`, fan-out mode never triggers from this path.

## 5. Hooks with `scripts/render-examples.ts`

Evidence: `scripts/render-examples.ts` (full read).

- Standalone script invoked via `npm run render-examples`. Calls `format()` with hardcoded `offerte` arrays derived from parsing fixtures.
- No shared runtime state with `src/index.ts` — only the `format()` formatter API.
- Examples are committed files under `examples/` and are regenerated only by this script.
- If the filter is applied AT THE FORMATTER LEVEL (`toMarkdown`/`toCsv`/`toJson`), then `render-examples.ts` outputs would silently change (filtered subset).
- If the filter is applied BEFORE the formatter (e.g., a `parseFilter()` step before `aggregate()` or between `aggregate()` and `format()`), examples are unaffected.

Recommendation: ADR 0013 must explicitly locate the filter step. If formatter-level, `render-examples.ts` needs an explicit no-filter path (e.g., pass `filter: null` or equivalent). If pre-formatter, no change needed.

**Verdict**: ⚠ depends on filter location. Verify in ADR 0013.

## 6. Test count and target files

Evidence: `tests/*.test.ts` (34 files).

- `grep -hE "^test\(['\"]" tests/*.ts | wc -l` → **129**.
- `tests/filter.test.ts` does NOT exist yet — created in ticket #172 spike.
- `tests/cli.test.ts` already has 10 tests covering happy path + format flags + missing/invalid args. New CLI flags (e.g., `--filter`) can be added here.
- New test placement convention: per-component file under `tests/` (`tests/filter.test.ts`).

**Verdict**: ✓ 129 tests confirmed. File targets confirmed.

---

## Summary

ALL ASSUMPTIONS HOLD (with two minor caveats to address in ADR 0013 / #172 spike):
- **Caveat A** (formatters empty edge case): no runtime error, but no explicit empty-offerte assertion — add in #172.
- **Caveat B** (render-examples hook): only relevant if filter is formatter-level — document placement in ADR 0013.