# TangoNest

TangoNest is a vocabulary library for collecting, organizing, reviewing, quizzing, and listening to words. This repository is the `1.0.0-rc.11` final-acceptance candidate.

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

GitHub Actions runs unit, static, performance, desktop, mobile, WebKit, accessibility, and visual checks on pushes and pull requests.

## Supabase

Browser code reads the project URL and publishable key from `config.js`. Never add a `service_role` key to this repository.

For a new Supabase project, run `SUPABASE_SQL_RUN_ONCE.sql` once in the Supabase SQL Editor. Existing projects that already applied the rc.9 acceptance schema do not need to run it again for rc.11. The migration preserves vocabulary data while adding the Realtime publication guard, explicit anonymous-access revocation, and stale-learning-event protection.

Real Auth, RLS, RPC, Realtime, and cross-device acceptance tests require a configured Supabase project. Local E2E uses an isolated browser fixture and never writes production cloud data.

## PWA and deployment

`manifest.json` and `sw.js` use relative paths so the app works below a GitHub Pages project path such as `/tangonest/`. The Service Worker caches only the static app shell. Supabase, Auth, API responses, and user data are never cached by the Service Worker.

Each release must update the version in `config.js`, asset query parameters in `index.html`, and `CACHE_VERSION` in `sw.js`. A waiting Service Worker is activated only after the user accepts the update banner.

Deploy the repository contents to the GitHub Pages branch. Do not include `node_modules`, `test-results`, local screenshots, or temporary QA artifacts.

## Main files

- `index.html` - semantic application shell
- `style.css` - design tokens and responsive UI
- `app.js` - local data and core feature behavior
- `learning-engine.js` - learning state transitions
- `tn-supabase-sync.js` - Auth, cloud CRUD, queue, and Realtime integration
- `tn-library-management.js` - Library and playlist UI
- `tn-learning-flow.js` - learning workflow coordination
- `ui/` - presentation and PWA runtime helpers
- `tests/` - unit, static, E2E, accessibility, visual, and performance QA
