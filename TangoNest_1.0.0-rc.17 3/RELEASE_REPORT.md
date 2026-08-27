# TangoNest v1.0.0-rc.17 Stability Hardening Report

## RESULT

`NEEDS_ACCEPTANCE`

The release candidate passes local unit, static, database-contract, E2E, accessibility, visual, performance, and dependency checks. The production Supabase migration and physical PC/mobile two-device flow still require final acceptance.

## DEFAULT PLAYLIST ROOT CAUSE

Default-list creation existed in several independent local, cloud, migration, import, and fallback paths. Some paths selected the first list or any old `is_default` row as canonical, while concurrent cloud initialization could run an RPC and fallback behavior without one shared identity rule. This allowed legacy empty lists or user lists to be treated as the default and made duplicate generation possible.

The remaining two-list case had a separate cause: the cleanup recognized an old generated `New Playlist` only while `updated_at` was still within five seconds of `created_at`. Historical default demotion updated that timestamp, so the generated row was misclassified as a modified user list and survived beside `My Words`. Some devices could also keep the previous JavaScript through the `pdca4` Service Worker cache.

## DEFAULT PLAYLIST FIX

- This release performs one explicit account-scoped clean start before the first cloud hydration: all old words and playlists are removed, then exactly one `My Words` row is created.
- The clean start is protected by a per-user advisory lock and a database migration marker, so concurrent PC/mobile startup can apply it only once.
- Obsolete local caches and pending writes are cleared before sync, preventing a deleted word or legacy playlist from being uploaded again.
- The updated release invalidates the old saved browser session once and opens at Login. Normal session persistence resumes after the user logs in.
- Added `default-playlist.js` as the shared, idempotent local normalization path.
- A new account is exactly `0 Words / 1 List / My Words`.
- Only `My Words` or an explicit system marker can be the canonical default; an arbitrary user playlist is never renamed into it.
- Repeated startup, reload, session restore, Add, Bulk Add, Import, and ensure calls do not create another list.
- Cloud initialization uses `tn_ensure_default_playlist()` with a per-user advisory lock and a partial unique index that allows only one default.
- Historical duplicate `My Words` rows are merged into the canonical row; linked words are moved before the duplicate row is removed.
- A second reserved `My Words` name is blocked in Create/Rename and by a normalized database unique index.
- The browser fallback demotes stale default flags before promoting or creating `My Words`, avoiding a uniqueness race.
- My Words remains protected from normal rename/delete operations and is the initial Add/Bulk destination.

## LEGACY CLEANUP

- For the authorized clean-start migration in this release, the current account's old words and playlists are intentionally removed once. The result is `0 Words / 1 My Words list`.
- The migration is not repeated on later launches because completion is recorded in `tn_account_migrations`.
- The conservative repair rules below remain as defense-in-depth after the clean start and for flows that do not require the destructive reset.
- Automatic deletion is restricted to empty, untouched, provably generated legacy rows with known names or markers.
- User-created `Travel`, `TOEIC`, and other lists are preserved.
- A nonempty or modified `New Playlist`, `Starter`, or `Default` is preserved and merely loses an incorrect default flag when needed.
- An empty legacy row (`New Playlist`, `Starter`, `Default`, or the historical `Chinese` demo) whose update timestamp matches the `My Words` creation/promotion transaction is now recognized and removed from both cloud and local cache.
- Duplicate `My Words` rows are safe to consolidate because the name is reserved; all attached words are retained in canonical My Words.
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
- SQL is repeatable. The authorized `account-clean-start-v1` migration intentionally resets each account once, then preserves all data created afterward.
- A local PostgreSQL server is unavailable, so execution against the real Supabase database remains required.

## CACHE CLEANUP

- Asset version is `1.0.0-rc.17-pdca6`.
- Service Worker cache is `tangonest-shell-v1.0.0-rc.17-pdca6`.
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

## PDCA CYCLE 4

Found: the one-default flag invariant did not by itself prohibit a second nondefault row named `My Words`, and preserving a nonempty duplicate could leave two visible reserved playlists.

Fixed: duplicate My Words words are reassigned before consolidation, a normalized database unique index prevents recurrence, Create/Rename rejects the reserved name, the old-schema client fallback performs the same safe merge, and the Service Worker cache advanced to `pdca4`.

## PDCA CYCLE 5

Found: historical default demotion changed the generated `New Playlist.updated_at`, defeating the original untouched-row proof; local normalization also discarded generation markers, and deployed clients could remain on cached `pdca4` logic.

Fixed: the updated release starts once at Login, discards obsolete local caches and pending writes, and runs a locked account-scoped DB migration before hydration. That migration removes all old words/playlists, creates exactly one `My Words`, records completion server-side, and advances the Service Worker cache to `pdca6`.

## QA

| Area | Result |
|---|---|
| Auth | PASS locally with mocked Supabase; real account acceptance required |
| Session | PASS, forced fresh Login plus reload/restore coverage |
| Words | PASS, Add/Edit/Delete and 0/100/1,000/5,000 states |
| Playlists | PASS, clean reset to zero words and one My Words plus concurrent clients |
| Bulk Add | PASS, remains one list in clean state |
| Cards | PASS |
| Quiz | PASS, feedback/Next/reset/no consecutive duplicate |
| Listen | PASS in browser automation |
| Sync | PASS in concurrent mock regression; real two-device acceptance required |
| Mobile | PASS at 375/390/430 browser viewports |
| Desktop | PASS at 768/1024/1280/1440 widths |
| Database | PASS static/contract checks; real migration execution required |
| Security | PASS owner-scope contracts and `npm audit`; production RLS acceptance required |

Automated result: 43 Playwright tests passed, 5 expected project-specific skips, 0 failed. Unit/static/database suites pass. Twenty reloads and twenty concurrent desktop/mobile-style clients remain at `0 Words / 1 My Words list`. Axe serious/critical violations: 0. Dependency vulnerabilities: 0.

Performance after the Library lookup fix: 5,000-word browser load about 1.0-1.2 seconds and search about 0.22-0.24 seconds, with rendering bounded and no overflow.

Critical: `0` locally observed.

High: `0` locally observed.

Medium: `0` locally observed.

## MANUAL ACTION REQUIRED

`YES`

1. Run the complete `SUPABASE_SCHEMA_CURRENT.sql` once in the Supabase SQL Editor.
2. Deploy this package's app contents to the GitHub Pages `/tangonest/` repository.
3. With one real account on PC and mobile, verify Login, reload/session restore, Add/Bulk Add, one My Words list, Logout/re-login, and bidirectional sync.

No manual row deletion is required. The first authenticated launch after deployment intentionally deletes the account's existing cloud words/playlists and recreates exactly one empty `My Words` list.
