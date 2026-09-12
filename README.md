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