# TangoNest Task 11 Final Acceptance Closure Report

Date: 2026-08-24

## RESULT

BLOCKED

## VERSION

- Before: `1.0.0-rc.10`
- After: `1.0.0-rc.11`
- Release artifact: `TangoNest_v1.0.0-rc11_Task11_FinalAcceptance_BLOCKED.zip`

## FIXED

- Replaced misleading session-restore text that told users to log in again when online sync itself was unavailable. The app now states that locally saved data is safe and suggests retrying later.
- Removed implementation-specific Supabase wording from normal Settings, Auth, import, delete, and sync error messages.
- Added static regression coverage for the new offline-safe and user-readable messages.
- Added Desktop Safari WebKit to the Playwright project matrix.
- Updated GitHub Actions to install and run Chromium and WebKit acceptance tests.
- Updated app, fixture, asset, Service Worker, README, and package version identifiers to rc.11.

## NEWLY DISCOVERED

- Critical external blocker: `bkbteylavujkfiwuqwdq.supabase.co` returns public DNS `NXDOMAIN`. The configured production backend currently does not exist on public DNS, so real Auth and cloud sync cannot operate.
- The canonical GitHub Pages site still serves the older July 4 build, not rc.11.
- The public repository exposes only Pages deployment history. The included `TangoNest QA` workflow is not deployed to the repository.
- Standalone Playwright WebKit installs correctly but aborts before page execution under the local macOS MachPort sandbox. WebKit is now covered by the included Linux CI workflow, but that workflow has not been deployed.

## PRODUCTION ACCEPTANCE

- Auth: BLOCKED - production backend hostname is NXDOMAIN.
- Session: BLOCKED - local session, reload, and route retention PASS; production session restore cannot be exercised.
- CRUD: BLOCKED - local Create, Read, Update/Rename, and delete-confirmation path PASS; real cloud CRUD cannot run.
- RLS: BLOCKED - schema and policy contracts PASS; live two-account attacks cannot run without the backend.
- RPC: BLOCKED - learning and SQL contracts PASS; production RPC cannot run.
- Learning: PASS - Cards, Quiz feedback, manual Next, state reset, non-consecutive questions, and Listen passed locally.
- Realtime: BLOCKED - unit/schema/client lifecycle contracts PASS; live delivery cannot run.
- PC to Mobile: BLOCKED - the backend required for device sync is unavailable.
- Mobile to PC: BLOCKED - the backend required for device sync is unavailable.
- Account isolation: BLOCKED - local account-scoped queue/cache regressions PASS; live two-account verification cannot run.
- Data loss: BLOCKED - local persistence and shadow-copy regressions PASS; production logout/login, account switch, and cloud recovery cannot run.
- PWA: PASS - active rc.11 Service Worker, 27 cached shell assets, and zero external/Auth/API cache entries.
- Desktop: PASS - all seven pages, playlist Create/Rename, language selection, Add Word, Library All, Cards, Quiz, Listen, and reload retention passed in the in-app browser.
- Mobile: PASS - all seven pages passed at 390 x 844 with no document overflow; playlist actions remained inside both cards.
- WebKit: BLOCKED - project and CI coverage added; local executable was stopped by the macOS browser sandbox and remote CI is absent.
- Accessibility: PASS - desktop app, mobile app, and login axe audits reported zero Critical/Serious violations.
- Security: BLOCKED for production - dependency/secret/XSS/cache/schema scans PASS; live RLS isolation cannot run.
- CI: BLOCKED - workflow is included in the package but not present in the public repository.

## FINAL QA

- Pass 1, core and identity: PASS. TangoNest naming, empty demo-free state, navigation, routes, CRUD UI, and learning modes passed.
- Pass 2, Auth/RLS/RPC: BLOCKED. Static and unit contracts pass; production DNS prevents real execution.
- Pass 3, cloud CRUD/Realtime: BLOCKED. Local and mocked regressions pass; production endpoint is unavailable.
- Pass 4, data safety/account switching: BLOCKED. Local persistence, retry, ownership, and shadow-data tests pass; real accounts cannot run.
- Pass 5, devices/PWA/WebKit: BLOCKED. Desktop, 390 x 844 mobile, and PWA pass; real WebKit and signed-in devices remain blocked.
- Pass 6, security/accessibility/performance: PASS locally. Zero dependency vulnerabilities, zero serious axe violations, no service key, no cloud entries in PWA cache, and 15.9ms/5.1ms/11.1ms for 100/1,000/5,000-word benchmarks.
- Pass 7, CI/deployment: BLOCKED. The package contains the QA workflow, but the public repository and Pages site have not been updated.
- Regression suites: PASS for syntax, four unit suites, four static suites, CSS audit, dependency audit, benchmark, manual browser journeys, responsive overflow, accessibility harnesses, and PWA harness.
- Known code-critical issues remaining: 0.
- Critical external/configuration issues remaining: 1, the production Supabase hostname is NXDOMAIN.
- High deployment issues remaining: 1, rc.11 and the QA workflow are not deployed.
- Medium acceptance gaps remaining: 1, physical Safari and bidirectional signed-in device verification after backend restoration.

## RELEASE DECISION

- Stable release allowed: NO
- `1.0.0` stable tag allowed: NO
- Decision: keep `1.0.0-rc.11` as a BLOCKED release candidate.

The final stable gate cannot pass while the configured production backend is absent from public DNS. This is not inferred from a local network failure: an independent public DNS-over-HTTPS lookup also returned `NXDOMAIN`.

## REMAINING

- Restore the existing Supabase project or create a replacement project and update `config.js` with its Project URL and publishable key.
- Run `SUPABASE_SQL_RUN_ONCE.sql` in the restored/replacement project.
- Deploy the exact rc.11 package, including `.github/workflows/qa.yml`, to `tangonest-app/tangonest`.
- Re-run Auth, CRUD, RLS, RPC, Realtime, account isolation, data-loss, WebKit, and bidirectional PC/phone acceptance against the working backend.

## MANUAL ACTION

1. In Supabase, restore `bkbteylavujkfiwuqwdq` if it was paused/deleted, or create a new TangoNest project. Provide the new Project URL and publishable key if the identifier changes.
2. Run `SUPABASE_SQL_RUN_ONCE.sql` once in that project.
3. Upload the exact rc.11 folder contents to `tangonest-app/tangonest`, including `.github/workflows/qa.yml`. Do not upload `node_modules` or local test output.
4. Confirm `TangoNest QA` is green and the Pages source contains `appVersion:"1.0.0-rc.11"`.
5. With two temporary accounts and PC plus phone, complete Add/Edit/Favorite/Playlist Rename/Cards/Quiz/Delete in both directions, verify Account B never sees Account A data, and verify logout/login, offline/reconnect, reload, and PWA reopen without loss.

## POST-1.0

- Further CSS architecture cleanup and `!important` reduction.
- Continue splitting legacy `app.js` into isolated modules.
- Optional visual refinement after production stability is proven.
- External dictionary/translation integrations and TTS upgrades.

## CHANGED FILES

- `.github/workflows/qa.yml`
- `README.md`
- `RELEASE_REPORT.md`
- `app.js`
- `config.js`
- `index.html`
- `package-lock.json`
- `package.json`
- `playwright.config.js`
- `sw.js`
- `tn-supabase-sync.js`
- `tests/e2e/fixtures.js`
- `tests/e2e/pwa-harness.html`
- `tests/static/release-contracts.test.js`
- `tests/static/ui-contracts.test.js`
