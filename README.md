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

FDG10 release tests were run in the development workspace: two full E2E runs each passed 195 tests with 6 intentional skips, and the syntax, unit, and static suites passed. Public-site verification passed 40 checks. See `FDG10_PUBLICATION.md` for the scope and evidence.

This repository's current GitHub Pages job publishes the site; it does not run those full product tests. Older source and test files retained in this repository are not the FDG10 test evidence. Active production asset paths are listed in `index.html` and `sw.js`.

## Supabase

Browser code reads the project URL and publishable key from `config-rc19-fdg1.js`. Never add a `service_role` key to this repository.

`SUPABASE_FDG10_SAFETY.sql` was applied to the current production database on September 6, 2026. It disables two legacy automatic reset RPCs without deleting or changing words, playlists, learning events, or Auth accounts. Users of the public app do not need to execute SQL again.

Older full-schema and reset SQL files remain in the repository history and archived source. They are not FDG10 update instructions and may contain destructive resets. Do not run them to update this app. The only SQL included in the tested FDG10 publication package is `SUPABASE_FDG10_SAFETY.sql`.

Real Auth, RLS, RPC, Realtime, and cross-device acceptance tests require a configured Supabase project. Local E2E uses an isolated browser fixture and never writes production cloud data.

## PWA and deployment

`manifest-rc19-fdg1.json` and `sw.js` use relative paths so the app works below a GitHub Pages project path such as `/tangonest/`. The Service Worker caches only the static app shell. Supabase, Auth, API responses, and user data are never cached by the Service Worker.

The active `*-rc19-fdg1` filenames are compatibility names; their published contents are FDG10. Do not regenerate them from older unsuffixed source files retained in this repository. Future releases should be generated and tested in the current development workspace before replacing the complete runtime package.

The Supabase browser SDK is pinned locally under `vendor/` and included in the offline shell. Auth and REST responses are never included. A waiting Service Worker is activated only after the user accepts the update banner.

See `FDG10_UPDATE_GUIDE.md` for safe deployment and acceptance steps. The
`TangoNest_FDG10_REVIEW_CANDIDATE` package is deliberately not labeled READY:
production Auth/RLS acceptance and physical-device PWA icon checks require
access outside the local fixture. Never deploy `qa/`, `node_modules`, or
`test-results`. The mock fixture is test-only and is not included in that package.

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
- `SUPABASE_FDG10_SAFETY.sql` - applied non-destructive compatibility fix
- `FDG10_AUDIT_NOTES.md` - historical pre-publication audit and release limitations
- `FDG10_PUBLICATION.md` - current publication evidence and acceptance limits
- `FDG10_UPDATE_GUIDE.md` - deployment and verification instructions
