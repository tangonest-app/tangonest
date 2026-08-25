# TangoNest rc.12 Emergency Auth Stabilization Report

Date: 2026-08-25

## Result

`BLOCKED` until the included SQL is run in production Supabase and rc.12 is deployed.

## Root cause

1. `loadCloud()` errors from `tn_words` or `tn_playlists` were treated as Auth failure. The app cleared the user cache and reopened Login even though the Supabase session was valid.
2. `signInWithPassword()` and the Supabase `SIGNED_IN` listener both started post-login initialization, allowing duplicate cloud loads and Realtime subscriptions.
3. Production Supabase Auth is healthy, but the `authenticated` role currently receives HTTP 403 for `tn_words`. `tn_playlists` returns HTTP 200.
4. Auth, data loading, UI visibility, and cache ownership were too tightly coupled, so a schema/RLS/grant fault looked like a failed login.

## Implementation

- Kept standard Supabase email/password Auth with persistent local session storage, automatic token refresh, PKCE recovery handling, and the normal Auth state listener.
- Separated Auth state from cloud data state. A valid session now opens the app immediately; a table failure shows `Needs attention` without clearing the session or returning to Login.
- Loaded playlists and words independently. A failure in one table preserves the last valid same-account cache for that table.
- Added one initialization guard per user and one active cloud-load guard to prevent duplicate Login/listener work.
- Added specific messages for invalid credentials, existing users, unconfirmed email, weak password, rate limits, and expired sessions.
- Added Show/Hide password, Forgot password, recovery-password update, loading states, and double-submit prevention.
- Preserved GitHub Pages `/tangonest/` in password-reset redirects and route restoration.
- Kept Auth subscriptions during mobile/back-forward-cache suspension and restored them on resume.
- Added safe Auth diagnostics without exposing access or refresh tokens.

## Database repair

Run `SUPABASE_AUTH_FIX.sql` as one complete query. It is non-destructive and idempotent-oriented. It:

- creates or repairs the three TangoNest tables and required columns, including `tn_words.position`;
- enables RLS;
- replaces inconsistent policies with authenticated owner-only policies;
- revokes anonymous table access and grants required authenticated access;
- repairs Realtime publication membership;
- validates table privileges and the `position` column before commit;
- reloads the PostgREST schema cache.

No user, playlist, word, or learning-history deletion is included.

## Verification

### PASS

- Syntax checks for application, Service Worker, and integration test scripts.
- Four unit suites, including valid Login, wrong Password, existing account guidance, token refresh, password recovery, Logout/re-Login, session restore, table 403 isolation, duplicate initialization prevention, account cache isolation, and pending-change safety.
- Four static contract suites, including Auth UI, session persistence, GitHub Pages base path, non-destructive SQL, RLS/grants, and schema reload.
- Real Supabase: wrong Password rejected, existing Login accepted, token refresh accepted, Logout accepted, re-Login accepted, `tn_playlists` HTTP 200.
- In-app browser desktop and 390x844 mobile: Auth form, validation, Show/Hide password, no horizontal overflow, all seven pages, Library reload retention, zero Console errors.
- Mobile Auth screen remained at identical scroll position, dimensions, and form position for 30 seconds.
- Library benchmarks: 100 words 9.4ms, 1,000 words 2.5ms, 5,000 words 10.2ms.
- Dependency audit: zero vulnerabilities.
- CSS audit: no invalid or removable selectors found.

### FAIL / external blocker

- Real Supabase `tn_words` read: HTTP 403 `permission denied for table tn_words`.
- The rc.12 package and SQL have not yet been deployed/applied to the public GitHub Pages/Supabase environment.

### Environment-limited

- The 39 Playwright cases load successfully, but standalone Chromium and WebKit cannot start under the local macOS MachPort sandbox. Equivalent desktop/mobile navigation, reload, overflow, stability, and Console checks were performed in the Codex in-app browser. The included Playwright suite remains ready for GitHub Actions or an unrestricted machine.

## Release decision

- Code-critical Auth issues remaining: 0 found.
- Production DB blocker remaining: 1 (`tn_words` authenticated grant/policy).
- Stable release allowed now: No.
- Expected status after running `SUPABASE_AUTH_FIX.sql`, deploying rc.12, and passing the real smoke test: Ready for device acceptance.

## Required user action

1. Open Supabase SQL Editor, paste the entire `SUPABASE_AUTH_FIX.sql`, and press Run once.
2. Upload the clean rc.12 folder contents to the GitHub Pages repository.
3. Re-run the production smoke test or confirm Login, reload, Library, Logout, and re-Login on PC and phone.

## Changed files

- `README.md`
- `RELEASE_REPORT.md`
- `SUPABASE_AUTH_FIX.sql`
- `config.js`
- `index.html`
- `package-lock.json`
- `package.json`
- `sw.js`
- `tn-supabase-sync.js`
- `tests/e2e/app.spec.js`
- `tests/e2e/fixtures.js`
- `tests/e2e/pwa-harness.html`
- `tests/integration/supabase-auth-smoke.js`
- `tests/static/release-contracts.test.js`
- `tests/static/ui-contracts.test.js`
- `tests/unit/sync-regression.test.js`
