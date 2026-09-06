# FDG10 Publication Record

- Public app: https://tangonest-app.github.io/tangonest/
- Version: `1.0.0-rc.19-fdg10`
- Runtime commit: `a064f171feaecf2ce2eaaaffdc2c3d15b86402b5`
- Pages deployment: https://github.com/tangonest-app/tangonest/actions/runs/34027601311
- Deployment completed successfully on September 6, 2026 at 19:30 JST.

## Verified on the Public Site

- All 37 packaged public files returned HTTP 200 and matched the expected SHA-256 hashes.
- Desktop Chromium (1440x900), mobile Chromium (390x844), and tablet WebKit (834x1194) passed login-screen, SDK, Service Worker scope, reload, and overflow checks. No uncaught JavaScript errors or HTTP errors occurred in these checks.
- Total automated publication checks: 40 passed, 0 failed.
- The existing signed-in Chrome session survived the update and reload. Settings showed FDG10 and Synced.
- Home, Library, Bulk Add, Cards, Quiz settings, Listen controls, and Settings were reachable. This read-only check did not rate cards or submit quiz answers.
- The real account's `tn_playlists`, default-playlist RPC, and both `tn_words` pages (offset 0 and offset 1000) returned HTTP 200. Console showed 0 messages after reload.
- Existing vocabulary and playlists were retained. No learning-data reset was performed.

## Database Safety

The non-destructive `SUPABASE_FDG10_SAFETY.sql` compatibility change was applied and verified. Both legacy automatic-reset endpoints now leave user data intact; authentication and existing execution restrictions remain in place. Users do not need to run reset SQL.

## Acceptance Limits

`FDG10_AUDIT_NOTES.md` is the historical pre-publication audit, not the current deployment status. Its pending-publication and pending-safety-SQL statements are superseded by this record.

The earlier candidate passed two full E2E runs (195 passed, 6 intentional skips per run), two 99-check browser runs, and the local syntax/unit/static suites. Fresh signup, password recovery, and cross-account real-Supabase acceptance were not repeated during this publication. Physical iPad PWA icon rendering and locked-screen speech still require hardware acceptance.

## Updating an Existing Installation

Open the app and accept the Update notification when no import is running, then check Settings for `1.0.0-rc.19-fdg10`. Do not clear all site storage or run historical reset SQL to update the interface.
