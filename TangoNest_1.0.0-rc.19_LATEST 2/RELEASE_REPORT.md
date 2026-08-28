# TangoNest v1.0.0-rc.19 Release Report

## Result

`NEEDS_ACCEPTANCE`

The P0 account-isolation rebuild, Library alignment update, migration SQL, and
local automated QA are complete. Production Supabase migration and real
two-account RLS acceptance remain required, so this package is intentionally
not labelled READY.

## Main Changes

- Replaced global user-data persistence with strict per-user cache namespaces.
- Reset all user-owned memory, learning state, timers, pending mutations, and
  Realtime subscriptions on logout or account switch.
- Added user ID and auth-generation guards to cloud reads and mutations.
- Kept valid Auth sessions active when a data-table request fails.
- Added explicit user filters to frontend queries and Realtime.
- Consolidated the authorized data reset, non-null ownership, grants, RLS, and
  default playlist creation into one production SQL file.
- Left-aligned Library word titles, meanings, examples, and metadata on one
  readable grid; mobile actions wrap without horizontal overflow.
- Added a base-stylesheet fallback so Library alignment remains correct even if
  the optional theme stylesheet is delayed or stale in a browser cache.
- Verified the runtime language order begins English, Japanese, Korean, then
  French, regardless of which language is currently selected.

## QA

- Unit/static/schema contracts: PASS.
- Full Playwright E2E: 63 passed, 6 intentionally skipped, 0 failed.
- A/B switch x20, reload x20 each, delayed response, pending write, and
  630-word ghost-cache regressions: PASS.
- Performance at 100/1,000/5,000 words: PASS.
- Dependency audit: 0 vulnerabilities.
- Desktop/mobile account and Library screenshots: generated, including a wide
  row-alignment measurement.

## Production Acceptance

1. Run `TANGONEST_RC19_PRODUCTION_MIGRATION.sql` once in Supabase SQL Editor.
2. Deploy the reduced-file GitHub Pages package.
3. Use two real accounts to prove A-to-B and B-to-A reads return zero rows.

See `RC19_ACCOUNT_ISOLATION_QA_REPORT.md` for root cause, boundaries, test
results, screenshots, and the remaining production acceptance gate.
