# TangoNest v1.0.0-rc.16 Study Focus Release Report

## RESULT

`NEEDS_ACCEPTANCE`

The release candidate is complete and passes local automated and visual QA. Only the deployed Supabase account flow and two-device live sync require final acceptance.

## MAJOR UI CHANGES

- Rebuilt desktop around a fixed Study Focus sidebar and one stable workspace.
- Reworked Home into a real-data learning dashboard with Today's Focus, review priorities, quick actions, progress, mistakes, and list shortcuts.
- Rebuilt Library as a dense desktop collection list and a touch-friendly mobile list; rendering is bounded to 100 rows for large libraries.
- Focused Cards, Quiz, and Listen on the current learning task while preserving their existing engines.
- Converted Settings to restrained list-style sections and retained account, sync, audio, import/export, and data actions.
- Added six-item mobile navigation with a contextual Add Words action and 44px minimum touch targets.

## PLAYLIST BUG ROOT CAUSE

Legacy code could create fallback lists independently during local startup, delete-last-list, delete-all, empty import, and cloud initialization. Local and cloud paths had no shared default marker or concurrency guard, so session restore and repeated fallback paths could produce multiple generated lists such as New Playlist, Starter, or Chinese.

## PLAYLIST FIX

- New state is exactly `0 Words / 1 List / My Words`.
- Local normalization has one default path and removes only known generated legacy IDs; arbitrary user-named lists are never deleted.
- Cloud creation is centralized in `tn_ensure_default_playlist()` with a per-user transaction lock and a unique partial index.
- Login, reload, empty import, delete-all, and concurrent ensure calls remain idempotent.
- My Words is protected from rename/delete and is selected by default for Add, Bulk Add, and Edit.

## CSS REBUILD

- Added `ui/study-focus.css` as the token, shell, component, and responsive layer.
- Consolidated colors, spacing, radii, borders, shadows, typography, layout widths, and sidebar sizing into design tokens.
- Removed all presentation-layer `!important` declarations; CSS audit reports zero removable selectors.
- Active UI uses no gradients, glow, glassmorphism, layout animation, or horizontal overflow.
- Final asset build is `1.0.0-rc.16-pdca6`.

## CACHE CLEANUP

- Service Worker cache bumped to `tangonest-shell-v1.0.0-rc.16-pdca6`.
- Activation deletes only older `tangonest-shell-*` caches.
- Shell assets use network-first behavior; Supabase Auth and REST requests are never cached.
- CSS and JS URLs use the matching `pdca6` cache-busting suffix.
- Removed the archived superseded SQL files so only `SUPABASE_SCHEMA_CURRENT.sql` can be mistaken for the deployment migration.
- User words, playlists, learning history, account session, and settings are retained.
- Large local libraries no longer attempt a second full shadow copy when it would risk Safari localStorage quota failure.

## PDCA CYCLE 1

Found: legacy shell hierarchy, oversized Home presentation, duplicate default-list creation paths.

Fixed: Study Focus shell/Home rebuild and centralized My Words initialization.

## PDCA CYCLE 2

Found: dense mobile filters, word-row alignment issues, playlist action wrapping risk, inconsistent mobile Add access.

Fixed: responsive Library rows, contained/wrapped playlist actions, contextual Add button, 44px controls.

## PDCA CYCLE 3

Found: stale cascade rules, excessive `!important`, active legacy gradient, unstable route handler ownership.

Fixed: clean cascade, zero `!important`, flat surfaces, stable navigation and deep-link restoration.

## PDCA CYCLE 4

Found: first Add/Bulk/Edit render could select No playlist, mobile word rows were taller than necessary, stale assets persisted during repeated QA.

Fixed: My Words initial selection, compact desktop rows, explicit selection-state guard, asset cache busting.

## PDCA CYCLE 5

Found: muted text contrast, outdated mobile E2E selectors, Safari quota failure at 5,000 words.

Fixed: WCAG-compliant muted text, visible-navigation test helper, quota-aware local backup behavior.

## PDCA CYCLE 6

Found: Settings tab vertical misalignment and truncated Settings sync status during screenshot inspection.

Fixed: centered six-tab mobile navigation and unrestricted Settings status-pill width.

## SCREENSHOT QA

42 final screenshots are included under `qa/screenshots/`.

| Viewport | Home | Library | Cards | Quiz | Listen | Settings | Overflow |
|---|---|---|---|---|---|---|---|
| 1440x1000 | PASS | PASS | PASS | PASS | PASS | PASS | None |
| 1280x900 | PASS | PASS | PASS | PASS | PASS | PASS | None |
| 1024x900 | PASS | PASS | PASS | PASS | PASS | PASS | None |
| 768x900 | PASS | PASS | PASS | PASS | PASS | PASS | None |
| 430x932 | PASS | PASS | PASS | PASS | PASS | PASS | None |
| 390x844 | PASS | PASS | PASS | PASS | PASS | PASS | None |
| 375x812 | PASS | PASS | PASS | PASS | PASS | PASS | None |

## FUNCTIONAL QA

| Area | Result |
|---|---|
| Auth UI, validation, wrong password, existing-account guidance | PASS |
| Session restore and reload persistence | PASS with mocked Supabase E2E |
| Data fetch failure does not become logout | PASS |
| Add, edit/delete contracts, favorite, language persistence | PASS |
| Playlist create, rename, delete protection, wrapped actions | PASS |
| Cards, manual Quiz feedback/Next, Listen | PASS |
| Local/cloud sync regression and default-list concurrency | PASS |
| Real deployed Supabase login and two-device sync | UNVERIFIED |

Automated results:

- Syntax/unit/static/DB contracts: PASS.
- Playwright desktop Chrome, mobile Chrome, and desktop WebKit: 34 PASS, 5 expected project skips, 0 FAIL.
- Axe serious/critical violations: 0 across login and all primary screens.
- 5,000-word WebKit load: about 1.1 seconds; search: about 0.6 seconds; 100 rendered rows; no overflow.
- Dependency audit: 0 vulnerabilities.
- CSS audit: 0 removable selectors.

## VISUAL QA

- Reference similarity: PASS. Study Focus shell, density, spacing, typography, and learning hierarchy are clearly implemented.
- AI feeling removed: PASS. No active gradient, neon, glow, glass, oversized hero, or decorative card pile.
- Responsive: PASS at all seven required widths.
- Layout consistency: PASS across Home, Create, Library, Cards, Quiz, Listen, and Settings.

## FILES CHANGED

`index.html`, `style.css`, `ui/study-focus.css`, `ui/runtime.js`, `app.js`, `tn-library-management.js`, `tn-supabase-sync.js`, `SUPABASE_SCHEMA_CURRENT.sql`, `sw.js`, `package.json`, E2E/static/unit tests, `tools/capture-study-focus.js`, and this report.

## REMAINING

- Critical remaining: 0.
- High remaining: 0.
- Medium remaining: 0 locally observed.
- External acceptance: deployed real-account Auth/session and PC/mobile live sync.

## MANUAL ACTION REQUIRED

`YES`

1. Run the complete `SUPABASE_SCHEMA_CURRENT.sql` once in Supabase SQL Editor. It is idempotent and includes the default-playlist marker, unique guard, RPC, RLS, grants, and required word schema.
2. Deploy the package contents to the GitHub Pages `/tangonest/` repository.
3. With one real account, verify Login, reload/session restore, Logout/re-login, and PC-to-mobile/mobile-to-PC sync.

No user data reset or manual row deletion is required.
