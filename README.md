# TangoNest Forest Desk Glass

TangoNest is a vocabulary library for collecting, organizing, reviewing,
quizzing, and listening to words. The published `1.0.0-rc.19-fdg10` release improves the
Forest Desk Glass interface while preserving the existing account-scoped data,
learning, playlist, Auth, sync, and PWA behavior.

Published and verified on September 6, 2026. See [the publication record](FDG10_PUBLICATION.md) for deployment evidence and the remaining physical-device acceptance limits.

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

FDG10 release tests were run in the development workspace. This repository's current GitHub Pages job publishes the site; it does not run those full product tests. Older source and test files retained in this repository are not the FDG10 test evidence. Active production asset paths are listed in `index.html` and `sw.js`.

## Supabase

Browser code reads the project URL and publishable key from `config.js`. Never add a `service_role` key to this repository.

For an existing FDG9 installation, review and execute `SUPABASE_FDG10_SAFETY.sql`
before deploying. It disables two legacy automatic reset RPCs without deleting
or changing words, playlists, learning events, or Auth accounts. It is repeatable.
Do not run historical reset scripts such as `SUPABASE_FDG8_PLAYLIST_RESET.sql`.

For a new database, `SUPABASE_SCHEMA_CURRENT.sql` is the canonical schema;
`TANGONEST_RC19_PRODUCTION_MIGRATION.sql` is its generated equivalent. Neither
performs a global learning-data reset in this release. A full schema migration
is not required merely to install the FDG10 UI or Bulk Add assistant.

Real Auth, RLS, RPC, Realtime, and cross-device acceptance tests require a configured Supabase project. Local E2E uses an isolated browser fixture and never writes production cloud data.

## PWA and deployment

`manifest.json` and `sw.js` use relative paths so the app works below a GitHub Pages project path such as `/tangonest/`. The Service Worker caches only the static app shell. Supabase, Auth, API responses, and user data are never cached by the Service Worker.

Edit `release.json`, then run `npm run prepare:release` to synchronize versions,
asset paths, active compatibility files, the manifest, and the Service Worker.
The Supabase browser SDK is pinned locally under `vendor/` and included in the
offline shell. Auth and REST responses are never included. A waiting Service
Worker is activated only after the user accepts the update banner.

See `FDG10_UPDATE_GUIDE.md` for safe deployment and acceptance steps. The
`TangoNest_FDG10_REVIEW_CANDIDATE` package is deliberately not labeled READY:
production Auth/RLS acceptance and physical-device PWA icon checks require
access outside the local fixture. Never deploy `qa/`, `node_modules`, or
`test-results`. The mock fixture is test-only and is not included in that package.

## Main files

- `index.html` - semantic application shell
- `style.css` - legacy-compatible base and feature styles
- `ui/forest-desk-glass.css` - Forest Desk Glass tokens, shell, responsive layout, and component theme
- `app.js` - local data and core feature behavior
- `bulk-format.js` - shared Bulk Add fields, parser, validation, samples, and prompt
- `release.json` - release version, icon directory, and pinned SDK version
- `default-playlist.js` - shared, idempotent default-playlist normalization
- `learning-engine.js` - learning state transitions
- `tn-supabase-sync.js` - Auth, cloud CRUD, queue, and Realtime integration
- `tn-library-management.js` - Library and playlist UI
- `tn-learning-flow.js` - learning workflow coordination
- `ui/` - presentation and PWA runtime helpers
- `tests/` - unit, static, E2E, accessibility, visual, and performance QA
- `SUPABASE_SCHEMA_CURRENT.sql` - canonical production schema and migration
- `FDG10_AUDIT_NOTES.md` - current audit, evidence, and release limitations
- `FDG10_UPDATE_GUIDE.md` - deployment and verification instructions
