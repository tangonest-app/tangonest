# TangoNest Forest Desk Glass Release Report

## Result

`UI_READY_FOR_DEPLOYMENT`

The local release package is complete and verified. The GitHub Pages public
site does not change until the package contents are uploaded to the repository.

## What Changed

- Rebuilt the application shell around a deep forest sidebar, warm ivory paper
  surfaces, Mincho-style headings, sage and brass accents, and restrained
  botanical decoration.
- Applied one visual system to Login, Home, Create, Bulk Add, Library, Cards,
  Quiz, Listen, Settings, dialogs, empty states, and mobile navigation.
- Added a purpose-made forest study background to Login with a centered frosted
  paper panel and preserved Email, Password, Login, Create account, reset, and
  validation behavior.
- Converted Library words to a calm Word / Meaning / POS list. Rows open the
  existing detail panel instead of displaying every secondary action at once.
- Kept English, Japanese, Korean, and French at the top of every language
  picker and made open pickers close on navigation.
- Stabilized Quiz with fixed question, choice, result, and action regions. The
  layout does not move when correct or incorrect feedback appears.
- Raised mobile playlist actions to at least 44 by 44 CSS pixels and removed
  horizontal overflow.

## Files Changed

- `index.html`
- `ui/forest-desk-glass.css`
- `ui/forest-desk-glass-rc19-fdg1.css`
- `assets/forest-study-login-v1.png`
- `assets/botanical-corner.svg`
- `app.js` and `app-rc19-fdg1.js`
- `tn-library-management.js` and `tn-library-management-rc19-fdg1.js`
- `ui/runtime.js` and `ui/runtime-rc19-fdg1.js`
- `manifest.json` and `manifest-rc19-fdg1.json`
- `sw.js`
- `tests/static/*.test.js`
- `tests/e2e/ux-refinement.spec.js`
- `tools/capture-forest-desk-glass.js`
- `package.json`
- `README.md`

## Data Logic Preserved

The UI update does not clear or reseed production data. Existing Supabase Auth,
RLS, account isolation, playlists, words, learning state, sync, Cards, Quiz,
Listen, Import, Export, and Service Worker update behavior remain in place.
Automated regression coverage confirmed that a data-table failure does not
become an authentication logout.

## Quiz Stable Flow

- Question, four choices, feedback, and actions reserve stable space before the
  answer is selected.
- Correct and incorrect feedback reuse those regions without changing their
  top or bottom coordinates.
- Manual Next and smart auto timing remain supported.
- Correct answer, selected answer, learning consequence, replay, and Next are
  visible without automatic scrolling.
- Previous highlight and feedback state are cleared for the next question.

## Responsive Behavior

- Desktop uses a fixed forest sidebar, sticky paper header, and one shared
  content width.
- Mobile uses a sticky compact header and six-item bottom navigation; Create is
  reached through the Add Words action.
- Login, Library rows, playlist actions, Quiz, Cards, Listen, Settings, dialogs,
  and language pickers were verified from 320px through 1920px widths.
- No tested viewport has horizontal scrolling.

## Test Results

- Syntax, unit, sync regression, static UI, accessibility, release, and DB
  contract tests: PASS.
- Full Playwright E2E: 150 passed, 6 intentionally skipped, 0 failed.
- Browsers: Chromium desktop, Chromium mobile, and WebKit: PASS.
- Axe WCAG serious/critical checks on Login and all primary screens: PASS.
- Library 100, 1,000, and 5,000-word browser performance tests: PASS.
- Node Library benchmark: 100 words 8.3ms, 1,000 words 1.8ms, 5,000 words
  6.9ms: PASS.
- Dependency audit: 0 vulnerabilities.
- Final visual QA: 80 screenshots generated across eight desktop and mobile
  viewport profiles; representative Login, Home, Create, Bulk, Library, Cards,
  Quiz feedback, Listen, and Settings screens inspected.
- Console and uncaught page errors during E2E: 0.
- Packaged-folder smoke test: 30 seconds idle with 0px movement in header,
  sidebar, workspace, and scroll position; all seven pages had 0px horizontal
  overflow; Quiz question, choices, and actions moved 0px after answering.

## Known Issues

- No known UI release blocker remains in the verified local package.
- The production learning-data reset remains a deliberate, one-time destructive
  operation and must be confirmed immediately before it is run in Supabase.

## Manual Follow-up

1. Upload the contents of `TangoNest_ForestDeskGlass_FDG8_READY` to the GitHub
   Pages repository root.
2. Wait for GitHub Pages deployment to complete.
3. Open the public URL once with a hard reload so the new Service Worker shell
   is installed.
4. Confirm one real account on PC and mobile before treating production cloud
   acceptance as complete.

## FDG2 Navigation And Motion Refinement

- Desktop navigation now starts with Home, followed by Library and Add Words.
  Home remains the default post-login destination, while Add Words stays one
  action away from both the sidebar and Home call to action.
- Desktop Create focuses the Front field without scrolling. Successful login
  moves keyboard focus to the visible Home navigation control on desktop or
  mobile.
- Motion is restricted to local controls, quiz feedback colors, and the
  flashcard face. Main pages and layout containers never fade, translate, or
  resize during navigation.
- A first page-fade experiment was rejected during PDCA because its temporary
  opacity reduced contrast during automated accessibility inspection.
- Twelve separate learner personas used twelve isolated mock Supabase users,
  email addresses, passwords, sessions, and datasets. Desktop and mobile runs
  covered students, workers, teachers, foreign residents, commuters,
  developers, keyboard-only learners, multilingual learners, a 1,014-word
  library, and a returning learner.
- The persona fixture does not create accounts in production Supabase. A real
  second-account and cross-device production check still requires dedicated
  credentials supplied outside the repository.

## FDG7 Playlist And Learning Safety

- The single default playlist keeps its system identity while allowing the
  user-visible name to be renamed. Repeated normalization and navigation no
  longer restore the label to `My Words`.
- Bulk Add now displays the exact destination playlist, Front/Back language
  direction, and import count before any words are written. The latest import
  can be undone without deleting earlier vocabulary, including after a partial
  cloud batch failure.
- Library rendering is guarded against duplicate render passes, stale playlist
  filters are reset safely, and repeated navigation no longer creates duplicate
  mounts or layout overflow.
- Quiz distractors are limited to the current playlist's Back language. A
  Chinese to Japanese quiz can no longer fill missing choices with English or
  another language.
- Listen now uses a compact archival player with reserved text and waveform
  regions instead of the oversized circular display.
- Final FDG7 acceptance: 150 Playwright checks passed across desktop Chromium,
  mobile Chromium, and WebKit; 6 intended project-specific checks were skipped;
  0 failed. All 80 responsive QA screenshots were regenerated successfully.

## FDG8 Ordinary Playlists, Stable Auth, And Quiz Flip

- The internally selected primary playlist is no longer special in the UI.
  Every playlist, including the initial one, exposes the same Rename and Delete
  actions. Deleting it promotes another list or creates one empty `New Playlist`.
- Name-based repair and merge behavior was removed. `French`, `Chinese`, renamed
  playlists, and duplicate user-chosen names are preserved until the user acts.
- Session restoration now shows one reserved loading state. Email and password
  controls appear only after Supabase confirms there is no valid session, so the
  login form no longer flashes and disappears during startup.
- Quiz answers remain on screen until `Next now` is pressed. The fixed-size
  question surface flips to a brass-edged answer face without moving the page,
  choices, feedback area, or subsequent controls.
- `SUPABASE_FDG8_PLAYLIST_RESET.sql` contains the one-time authorized production
  reset. It keeps Auth identities, removes all words and playlists, and creates
  exactly one empty `New Playlist` per existing account, followed by verification
  counts.
- Final FDG8 acceptance: syntax/unit/static checks passed; 150 Playwright checks
  passed across desktop Chromium, mobile Chromium, and WebKit; 6 intentionally
  skipped; 0 failed. All 80 responsive QA screenshots were regenerated.
