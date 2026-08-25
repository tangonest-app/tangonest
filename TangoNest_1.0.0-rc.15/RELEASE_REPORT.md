# TangoNest rc.15 Study Focus UI/UX Report

## RESULT

`NEEDS_ACCEPTANCE`

The UI/UX package is complete and locally verified. The live Supabase account flow and two-device sync still require acceptance after this build is deployed.

## CHANGES

- Replaced the desktop top-navigation layout with a fixed 240px sidebar and one stable content workspace.
- Rebuilt Home as a compact learning start point with Today's Focus, primary actions, progress, review, and list shortcuts.
- Kept direct access to Home, Create, Library, Cards, Quiz, Listen, and Settings.
- Added a five-tab mobile navigation bar and made Add Words a contextual Library action.
- Reworked Library into a scalable list with persistent search, collapsible mobile filters, restrained metadata, and overflow-safe playlist actions.
- Simplified Cards, Quiz, and Listen into focused learning surfaces without changing their learning logic.
- Organized Settings into calm list-style sections and retained every account, sync, import, export, voice, and data action.
- Added `ui/study-focus.css` as the central design-token and responsive component layer.
- Removed 12,086 bytes of obsolete hero/mockup CSS and all 113 selectors reported unused by the repository CSS audit.
- Preserved true zero-data behavior: no demo words and no generated Chinese or New Playlist data.

## FILES CHANGED

`index.html`, `ui/study-focus.css`, `style.css`, `ui/runtime.js`, `app.js`, `tn-library-management.js`, `tn-supabase-sync.js`, `manifest.json`, `sw.js`, `config.js`, `package.json`, `package-lock.json`, `README.md`, `RELEASE_REPORT.md`, and focused E2E/static fixtures and contracts under `tests/`.

## PDCA

Cycle 1: The first shell pass exposed mismatched desktop widths and an oversized legacy Home hero. Replaced them with one fixed sidebar/workspace system and a compact Study Focus start screen.

Cycle 2: Mobile review exposed dense Library controls, a centered word checkbox caused by a legacy flex rule, playlist-action wrapping risk, and an always-visible Add button. Added collapsible filters, explicit row grids, flexible action wrapping, and Library-only Add visibility.

Cycle 3: Final 375px testing found 36-40px secondary touch targets and old Settings colors overriding the new theme. Raised mobile controls to 44px, normalized semantic button colors, removed the obsolete sync-summary wording, and reran regression and layout checks.

## QA

| Area | Result | Evidence |
|---|---|---|
| Syntax, unit, static contracts | PASS | Learning engine/flow/presentation, sync regression, UI, accessibility, release, and DB contracts passed. |
| CSS audit | PASS | 0 unused selectors remain after cleanup. |
| Dependency audit | PASS | 0 vulnerabilities. |
| Large Library | PASS | 100, 1,000, and 5,000-word benchmark passed; UI renders a bounded list. |
| Desktop | PASS | 1440x900: all seven pages, fixed 240px sidebar, stable workspace, 0 horizontal overflow. |
| Tablet | PASS | 1024px and 768px manual browser checks, all seven pages, 0 horizontal overflow. |
| Mobile | PASS | 375x812 and 390x844: all seven pages, 0 horizontal overflow, primary visible controls at least 44px. |
| Layout stability | PASS | Desktop shell/header/main geometry and scroll position remained identical during a five-second idle check. |
| Quiz feedback | PASS | Manual Next, correct/incorrect feedback, state reset, and no consecutive duplicate when multiple words exist. |
| Console | PASS | No warning or error entries during final browser pass. |
| Auth/session architecture | PASS | Existing unit/static regression coverage remains green; UI gate explicitly removes `inert` only after app entry. |
| Live Login/Supabase | UNVERIFIED | Requires the deployed build and a real QA account. No Auth or database contract was changed in this UI release. |
| PC/mobile live sync | UNVERIFIED | Requires one deployed account on two physical devices. |

Standalone Playwright is blocked by this macOS execution sandbox (`MachPortRendezvousServer: Permission denied`) before any test code runs. Equivalent desktop, tablet, mobile, navigation, overflow, Quiz, and stability checks were completed in the Codex in-app browser. This is an environment limitation, not an observed app failure.

## DATABASE

This UI release introduces no schema, RLS, policy, Auth, or sync data-model change. `SUPABASE_SCHEMA_CURRENT.sql` remains the canonical migration from rc.14 and is unchanged.

## MANUAL ACCEPTANCE

1. Deploy the rc.15 folder contents to the GitHub Pages `/tangonest/` repository.
2. If the canonical schema from rc.14 has not already been applied, run `SUPABASE_SCHEMA_CURRENT.sql` once in Supabase SQL Editor.
3. Confirm Login, reload/session restore, Logout/re-login, and PC-to-mobile/mobile-to-PC sync with one real account.

Known package-level critical or high UI defects: 0.
