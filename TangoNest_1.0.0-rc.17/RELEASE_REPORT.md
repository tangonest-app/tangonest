# TangoNest v1.0.0-rc.17 Stability Hardening Report

## RESULT

`NEEDS_ACCEPTANCE`

The release candidate passes local unit, static, database-contract, E2E, accessibility, visual, performance, and dependency checks. The production Supabase migration and physical PC/mobile two-device flow still require final acceptance.

## DEFAULT PLAYLIST ROOT CAUSE

Default-list creation existed in several independent local, cloud, migration, import, and fallback paths. Some paths selected the first list or any old `is_default` row as canonical, while concurrent cloud initialization could run an RPC and fallback behavior without one shared identity rule. This allowed legacy empty lists or user lists to be treated as the default and made duplicate generation possible.

## DEFAULT PLAYLIST FIX

- Added `default-playlist.js` as the shared, idempotent local normalization path.
- A new account is exactly `0 Words / 1 List / My Words`.
- Only `My Words` or an explicit system marker can be the canonical default; an arbitrary user playlist is never renamed into it.
- Repeated startup, reload, session restore, Add, Bulk Add, Import, and ensure calls do not create another list.
- Cloud initialization uses `tn_ensure_default_playlist()` with a per-user advisory lock and a partial unique index that allows only one default.
- The browser fallback demotes stale default flags before promoting or creating `My Words`, avoiding a uniqueness race.
- My Words remains protected from normal rename/delete operations and is the initial Add/Bulk destination.

## LEGACY CLEANUP

- Automatic deletion is restricted to empty, untouched, provably generated legacy rows with known names or markers.
- User-created `Travel`, `TOEIC`, and other lists are preserved.
- A nonempty or modified `New Playlist`, `Starter`, `Default`, or duplicate `My Words` is preserved and merely loses an incorrect default flag when needed.
- The migration performs legacy proof checks before changing timestamps or default flags.

## BUGS FOUND

- Arbitrary first/old-default playlists could become canonical.
- A missing-RPC fallback could conflict with the one-default unique rule.
- SQL recreated a composite foreign key before guaranteeing the referenced unique key.
- PL/pgSQL `FOUND` could be overwritten before the insert decision.
- Legacy cleanup evidence could be lost if default flags were updated first.
- Library search repeatedly normalized the full dataset while resolving every row's playlist name, causing near-quadratic work at 5,000 words.
- Large local datasets could exceed Safari storage quota by writing a second complete shadow copy.

## BUGS FIXED

- Canonical selection now accepts only the named/marked My Words row.
- Missing-RPC and concurrent ensure paths are guarded and idempotent.
- SQL now creates the referenced unique constraint before the foreign key.
- The RPC stores the query result before any later statement can alter `FOUND`.
- Cleanup runs before default-flag updates.
- Library filtering builds one playlist-name map and reuses one normalized source.
- Large datasets skip the redundant browser backup copy beyond the safe threshold.

## AUDIO REGRESSION CHECK

- Cards and Listen Play/Stop flows pass on Chromium, mobile Chromium, and WebKit.
- English, Chinese, and French language/voice selection code paths remain intact.
- No TTS engine, API, or voice-ranking redesign was introduced.
- Physical-device voice quality remains part of final acceptance.

## UI REGRESSION CHECK

- No redesign was introduced.
- Home, Create, Library, Cards, Quiz, Listen, and Settings retain the Study Focus UI.
- Playlist actions remain contained and responsive.
- 42 screenshots across seven viewport sizes show no horizontal overflow or structural breakage.
- Desktop and mobile Library views show exactly `1 List` in the clean QA state.

## DB / SQL CHECK

- `SUPABASE_SCHEMA_CURRENT.sql` is the canonical migration.
- Unique-key-before-foreign-key ordering is enforced by static database contracts.
- Default creation uses a transaction advisory lock and a one-default partial unique index.
- RLS policies and grants remain owner-scoped for words, playlists, and learning events.
- SQL is written to be repeatable and to preserve existing user data.
- A local PostgreSQL server is unavailable, so execution against the real Supabase database remains required.

## CACHE CLEANUP

- Asset version is `1.0.0-rc.17-pdca3`.
- Service Worker cache is `tangonest-shell-v1.0.0-rc.17-pdca3`.
- Old TangoNest shell caches are removed during activation; Auth, REST, and user data are never Service Worker cached.
- Large libraries avoid an unnecessary second full local copy while retaining normal recovery behavior.

## PDCA CYCLE 1

Found: multiple default-list creators, arbitrary canonical selection, unmarked fallback creation, and unsafe SQL dependency ordering.

Fixed: shared local normalizer, named/marked canonical identity, locked RPC, unique guard, corrected SQL ordering, and release cache/version update.

## PDCA CYCLE 2

Found: an old default flag on `Travel` could cause a user list to be renamed, E2E fixtures assumed two lists, and 5,000-word search repeated full normalization per row.

Fixed: preserved arbitrary user lists, corrected clean-state fixtures and selectors, and changed lookup to a single source plus map.

## PDCA CYCLE 3

Found: SQL `FOUND` state could change, cleanup timestamps could lose proof, and missing-RPC fallback could collide with the one-default constraint.

Fixed: captured query state explicitly, cleaned before metadata changes, inserted a nondefault candidate before promotion, demoted stale flags safely, and reran the complete suite.

## QA

| Area | Result |
|---|---|
| Auth | PASS locally with mocked Supabase; real account acceptance required |
| Session | PASS, reload x10 and restore x10 |
| Words | PASS, Add/Edit/Delete and 0/100/1,000/5,000 states |
| Playlists | PASS, one My Words default and legacy-preservation cases |
| Bulk Add | PASS, remains one list in clean state |
| Cards | PASS |
| Quiz | PASS, feedback/Next/reset/no consecutive duplicate |
| Listen | PASS in browser automation |
| Sync | PASS in concurrent mock regression; real two-device acceptance required |
| Mobile | PASS at 375/390/430 browser viewports |
| Desktop | PASS at 768/1024/1280/1440 widths |
| Database | PASS static/contract checks; real migration execution required |
| Security | PASS owner-scope contracts and `npm audit`; production RLS acceptance required |

Automated result: 37 Playwright tests passed, 5 expected project-specific skips, 0 failed. Unit/static/database suites pass. Axe serious/critical violations: 0. Dependency vulnerabilities: 0.

Performance after the Library lookup fix: 5,000-word browser load about 1.0-1.2 seconds and search about 0.22-0.24 seconds, with rendering bounded and no overflow.

Critical: `0` locally observed.

High: `0` locally observed.

Medium: `0` locally observed.

## MANUAL ACTION REQUIRED

`YES`

1. Run the complete `SUPABASE_SCHEMA_CURRENT.sql` once in the Supabase SQL Editor.
2. Deploy this package's app contents to the GitHub Pages `/tangonest/` repository.
3. With one real account on PC and mobile, verify Login, reload/session restore, Add/Bulk Add, one My Words list, Logout/re-login, and bidirectional sync.

No user-data reset or manual row deletion is required.
