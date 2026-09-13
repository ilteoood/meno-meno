# meno-meno

Italian utility/telco price comparison Claude Code skill.

Status: in planning phase. See [issue #1](https://github.com/ilteoood/meno-meno/issues/1) for the wayfinding map.

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