# TangoNest Forest Desk Glass

TangoNest is a vocabulary library for collecting, organizing, reviewing,
quizzing, and listening to words. This `1.0.0-rc.19-fdg1` package applies the
Forest Desk Glass interface while preserving the existing account-scoped data,
learning, playlist, Auth, sync, and PWA behavior.

## Run locally

The production app has no build step. Serve this directory over HTTP:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`.

## Automated QA

Install development dependencies once:

```bash
npm ci
npx playwright install chromium webkit
```

Run the suites:

```bash
npm test                 # unit and static contracts
npm run test:e2e         # desktop, mobile, and WebKit Playwright journeys
npm run test:a11y        # axe WCAG checks
npm run test:visual      # layout captures and structural checks
npm run test:performance # 100/1,000/5,000-word benchmarks
npm run test:all         # full local suite
```

Run the production Auth smoke test with a dedicated QA account:

```bash
TN_TEST_EMAIL="qa@example.com" TN_TEST_PASSWORD="..." npm run test:integration:auth
```

The smoke test never stores credentials in the repository. It checks wrong-password rejection, existing-user login, both primary table reads, token refresh, logout, and re-login.

GitHub Actions runs unit, static, performance, desktop, mobile, WebKit, accessibility, and visual checks on pushes and pull requests.

## Supabase

Browser code reads the project URL and publishable key from `config.js`. Never add a `service_role` key to this repository.

Before deploying rc.19, run the root-level
`TANGONEST_RC19_PRODUCTION_MIGRATION.sql` once in the Supabase SQL Editor. It
is the release-specific copy of `SUPABASE_SCHEMA_CURRENT.sql` and performs the
authorized learning-data reset, ownership constraints, grants, RLS policies,
and one independent `My Words` playlist per Auth user. The reset deletes
TangoNest words, playlists, and learning events; it never deletes
`auth.users`. Its migration marker prevents the global reset from running
again.

Real Auth, RLS, RPC, Realtime, and cross-device acceptance tests require a configured Supabase project. Local E2E uses an isolated browser fixture and never writes production cloud data.

## PWA and deployment

`manifest.json` and `sw.js` use relative paths so the app works below a GitHub Pages project path such as `/tangonest/`. The Service Worker caches only the static app shell. Supabase, Auth, API responses, and user data are never cached by the Service Worker.

Each release must update the version in `config.js`, asset query parameters in `index.html`, and `CACHE_VERSION` in `sw.js`. A waiting Service Worker is activated only after the user accepts the update banner.

Deploy the contents of `TangoNest_ForestDeskGlass_UI_READY` to the GitHub Pages
branch. Do not upload `node_modules`, `test-results`, or temporary QA artifacts.

## Main files

- `index.html` - semantic application shell
- `style.css` - legacy-compatible base and feature styles
- `ui/forest-desk-glass.css` - Forest Desk Glass tokens, shell, responsive layout, and component theme
- `app.js` - local data and core feature behavior
- `default-playlist.js` - shared, idempotent default-playlist normalization
- `learning-engine.js` - learning state transitions
- `tn-supabase-sync.js` - Auth, cloud CRUD, queue, and Realtime integration
- `tn-library-management.js` - Library and playlist UI
- `tn-learning-flow.js` - learning workflow coordination
- `ui/` - presentation and PWA runtime helpers
- `tests/` - unit, static, E2E, accessibility, visual, and performance QA
- `SUPABASE_SCHEMA_CURRENT.sql` - canonical production schema and migration
- `RELEASE_REPORT.md` - design, regression, and deployment acceptance summary
