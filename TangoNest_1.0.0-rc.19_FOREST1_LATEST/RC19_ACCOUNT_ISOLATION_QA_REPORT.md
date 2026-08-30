# TangoNest rc.19 Account Isolation QA Report

RESULT:

BLOCKED (production acceptance only)

ROOT CAUSE OF CROSS-ACCOUNT DATA:

The production client stored vocabulary data under the global
`tangonest_production_stable_v1` key before authentication had established an
account boundary. The sync layer also wrote its current account data through
that global writer, and the app rendered the restored global state before cloud
hydration completed. A failed cloud read preserved that prior state. Therefore
the observed 630-word state was able to survive account changes in the browser
and appear under another signed-in account.

WHY IT HAPPENED:

Authentication, in-memory state, local persistence, pending writes, and initial
cloud hydration did not share one atomic user boundary. Library and learning
modules also had independent global-key fallbacks. An account switch could
therefore reuse old arrays or accept a late response from the previous account.

DATA RESET:

Cloud: Pending one execution of `TANGONEST_RC19_PRODUCTION_MIGRATION.sql`.

Local: Implemented. Retired global data, shadow, snapshot, pending-write, and
recent-playlist keys are deleted once without deleting Supabase Auth tokens.

IndexedDB: Not used by TangoNest.

Cache: User data is now namespaced as
`tangonest:account:v2:<user_id>:<kind>`. The Service Worker caches static
same-origin shell files only.

ACCOUNT ISOLATION FIX:

- Cache reads and writes require the active authenticated user ID.
- Ownerless or mismatched cache payloads are rejected before normalization.
- Login/account switch resets words, playlists, learning state, favorites,
  quiz/cards/listen state, filters, timers, pending runtime, and subscriptions.
- The app stays behind the auth/loading surface until current-user hydration
  finishes. A data error no longer destroys a valid Auth session.
- Every cloud operation is guarded by user ID plus auth generation.
- Late responses from a previous account are discarded.
- Realtime subscriptions and payloads are filtered and validated by user ID.
- Pending mutations are account-scoped and cannot be replayed as another user.
- User-owned queries explicitly include `.eq("user_id", currentUser.id)`.
- The canonical SQL makes `user_id` non-null, forces RLS, restricts grants, and
  creates one independent `My Words` playlist per Auth user after the reset.

RLS TEST:

A -> A: NOT RUN against production credentials.

A -> B: NOT RUN against production credentials.

B -> B: NOT RUN against production credentials.

B -> A: NOT RUN against production credentials.

Static RLS/schema contracts pass, but policy existence is not treated as proof.
Real two-token acceptance remains mandatory after the production SQL is run.

ACCOUNT SWITCH TEST:

20 cycles: PASS in automated A/B account-isolation regression. Each cycle
retained only the active account's words, playlists, cache owner, and counts.

Additional race test: PASS. A delayed Account A response arriving after Account
B login was discarded.

PC / MOBILE:

PASS in local runtime/E2E. Chromium, Firefox, and WebKit were exercised. The
Library word title, meaning, example, and metadata use a stable left-aligned
layout; mobile actions wrap inside the row with no horizontal overflow.

LANGUAGE ORDER:

Runtime verified: PASS.

English: 1.

Japanese: 2.

Korean: 3.

French: 4.

The open runtime language menu screenshot is
`qa/rc19-account-isolation/desktop-language-dropdown-open.png`.

OLD FRENCH DATA:

Local/demo source: Removed from production initialization.

Cloud: Pending the one-time production migration.

GHOST 630 WORDS:

Gone in automated local account-boundary regression, including a deliberately
injected 630-word legacy global-cache fixture. Production acceptance remains
pending deployment and SQL execution.

DEFAULT PLAYLIST:

A: 1 independent `My Words` in automated regression.

B: 1 independent `My Words` in automated regression.

AUDIO:

Regression: PASS in the main E2E learning journey.

PDCA CYCLES:

1: Confirmed the global localStorage and pre-hydration render root cause.

2: Rebuilt canonical schema, grants, non-null ownership, RLS, and reset RPC.

3: Introduced strict per-user local cache namespaces and owner validation.

4: Made login, logout, and account-switch cleanup atomic.

5: Added Realtime ownership filters and stale-request generation guards.

6: Audited the Service Worker and bumped the static shell release cache.

7: Verified runtime language order in an expanded real select control.

8: Passed A/B switching x20, delayed-response, and pending-write isolation tests.

9: Passed reload x20 for A and B plus desktop/mobile browser coverage.

10: Passed full local release tests, dependency audit, CSS audit, and performance.

Additional: Added a 630-word ghost-cache regression and left-aligned Library
visual evidence.

CRITICAL:

0 known in local automated QA.

HIGH:

1 acceptance gap: real production RLS A/B token verification cannot run until
the migration is executed and two test credentials are supplied.

MEDIUM:

0 known.

TESTS:

PASS:

- Syntax, unit, static, DB contracts: all PASS.
- Default playlist, learning engine/flow/presentation, sync regression: PASS.
- Full E2E: 63 passed, 6 intentionally skipped, 0 failed.
- Performance E2E: 3 passed at 100, 1,000, and 5,000 words.
- Dependency audit: 0 vulnerabilities.
- CSS audit: 0 invalid/dead selectors reported.
- QA evidence capture: 10 screenshots, including a wide Library alignment check.

FAIL:

- None in executable local tests.
- Real Supabase Auth/RLS smoke: NOT RUN because
  `TN_TEST_EMAIL`/`TN_TEST_PASSWORD` and a second account were unavailable.

MANUAL ACTION REQUIRED:

YES.

1. Run `TANGONEST_RC19_PRODUCTION_MIGRATION.sql` once in the Supabase SQL
   Editor. It deletes TangoNest learning data but never deletes `auth.users`.
2. Deploy the rc.19 GitHub Pages upload package.
3. Perform the final A/B production login test and confirm cross-user SELECT
   returns zero rows in both directions.

SQL FILE:

`TANGONEST_RC19_PRODUCTION_MIGRATION.sql`

ZIP:

`TangoNest_v1.0.0-rc19_AccountIsolation_NEEDS_ACCEPTANCE.zip`
