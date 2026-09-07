# TangoNest Forest Desk Glass

TangoNest is a vocabulary library for collecting, organizing, reviewing,
quizzing, and listening to words. The `1.0.0-rc.19-fdg12` release refines Quiz focus, timing, keyboard input and brand language while retaining
Forest Desk Glass 2.0, quiet native motion, 37 study languages and 16 interface locales and preserving the existing account-scoped data,
learning, playlist, Auth, sync, and PWA behavior.

FDG12 was verified in the development workspace on September 7, 2026. See [the refinement report](FDG12_REPORT.md) for changes, evidence scope and physical-device acceptance limits. Historical publication records are retained as history, not current instructions.

## Run locally

The production app has no build step. Serve this directory over HTTP:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`.

## Automated QA

FDG12 passed two consecutive full verification rounds on unchanged runtime. Each passed 243 E2E tests with 6 intentional project-specific skips and zero failures. Syntax, unit, static, locale, motion, performance and old-shell upgrade checks passed twice. Each round covered 378 full-screen combinations and 162 active-Quiz combinations. Catalogs have 688/688 canonical keys in all 16 published UI locales. Brand names remain English; functional copy follows the interface language.

This repository's current GitHub Pages job publishes the site; it does not run those full product tests. Older source and test files retained in this repository are not FDG12 test evidence. Active production asset paths are listed in `index.html` and `sw.js`. Final tests and canonical development sources are maintained in the TangoNest_Living_Library development workspace.

## Supabase

Browser code reads the project URL and publishable key from `config-rc19-fdg1.js`. Never add a `service_role` key to this repository.

`SUPABASE_FDG10_SAFETY.sql` was applied to the current production database on September 6, 2026. It disables two legacy automatic reset RPCs without deleting or changing words, playlists, learning events, or Auth accounts. Users of the public app do not need to execute SQL again.

Older full-schema and reset SQL files remain in the repository history and archived source. They are not FDG10 update instructions and may contain destructive resets. Do not run them to update this app. The only SQL included in the tested FDG10 publication package is `SUPABASE_FDG10_SAFETY.sql`.

Real Auth, RLS, RPC, Realtime, and cross-device acceptance tests require a configured Supabase project. Local E2E uses an isolated browser fixture and never writes production cloud data.

## PWA and deployment

`manifest-rc19-fdg1.json` and `sw.js` use relative paths so the app works below a GitHub Pages project path such as `/tangonest/`. The Service Worker caches only the static app shell. Supabase, Auth, API responses, and user data are never cached by the Service Worker.

The active `*-rc19-fdg1` filenames are compatibility names; their contents are FDG12. Do not regenerate them from older unsuffixed source files retained in this repository. Future releases should be generated and tested in the current development workspace before replacing the complete runtime package.

The Supabase browser SDK is pinned locally under `vendor/` and included in the offline shell. Auth and REST responses are never included. A waiting Service Worker is activated only after the user accepts the update banner.

See `FDG12_REPORT.md` for update and acceptance scope. The FDG12 runtime package contains 67 files and retains the existing premium icon family. No database reset or migration is required. Physical-device speech/PWA behavior, battery use and native-language editorial review are not certified by browser fixtures. Never deploy `qa/`, `node_modules`, or `test-results`.

## Main files

- `index.html` - semantic application shell
- `style-rc19-fdg1.css` - active base and feature styles
- `ui/forest-desk-glass-rc19-fdg1.css` - active Forest Desk Glass theme
- `app-rc19-fdg1.js` - active data and core feature behavior
- `bulk-format.js` - shared Bulk Add fields, parser, validation, samples, and prompt
- `release.json` - release version, icon directory, and pinned SDK version
- `default-playlist-rc19-fdg1.js` - shared, idempotent default-playlist normalization
- `learning-engine-rc19-fdg1.js` - learning state transitions
- `tn-supabase-sync-rc19-fdg1.js` - Auth, cloud CRUD, queue, and Realtime integration
- `tn-library-management-rc19-fdg1.js` - Library and playlist UI
- `tn-learning-flow-rc19-fdg1.js` - learning workflow coordination
- `ui/` - presentation and PWA runtime helpers
- `ui/living-library.css` and `ui/living-library.js` - current materials, motion and atmosphere
- `ui/i18n.js`, `locales/` and `languages.js` - interface locale and separate study-language definitions
- `FDG11_AUDIT_NOTES.md` and `FDG11_UPDATE_GUIDE.md` - current update scope and instructions
- `SUPABASE_FDG10_SAFETY.sql` - applied non-destructive compatibility fix
- `FDG10_AUDIT_NOTES.md` - historical pre-publication audit and release limitations
- `FDG10_PUBLICATION.md` - current publication evidence and acceptance limits
- `FDG10_UPDATE_GUIDE.md` - deployment and verification instructions
