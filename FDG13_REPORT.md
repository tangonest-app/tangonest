# TangoNest FDG13: Adopted UX Evolution

Release: `1.0.0-rc.19-fdg13`  
Date: 2026-09-08  
Status: Final unchanged-runtime verification passed in two consecutive rounds. Public deployment is verified separately in `qa/fdg13-release-verification.json`.

## Scope and Authority

Implemented proposals 01, 03, 04, 05, 06, 07, 08, and 09 from the supplied evolution material. The user's subsequent Quiz auto-advance specification takes precedence over the older Next-button proposal. Proposals 02 and 10 were not adopted as independent redesigns. The existing Forest Desk/Living Library visual identity, icons, vocabulary, and account data are preserved.

## Eight Changes and Reasons

| Proposal | Implemented change | Reason |
| --- | --- | --- |
| 01 Quiz Focus | Single feedback region; correct 1.2 s / incorrect 2.5 s automatic progression after paint; selected and correct answers on errors; final answer opens results; optional explanation and explicit pause/resume | Complete a mixed session without repeatedly pressing Next, while preserving time to read |
| 03 Paper Reveal | First card prepared on entry; meaningful empty/start states; upright 180 ms reveal instead of a 180-degree flip; rating enabled only after reveal and accepted once | Avoid unexplained placeholders, inverted reading, and accidental duplicate study results |
| 04 Home Continuity | Account-scoped checkpoint with playlist, mode, position, and last-used time; completed sessions cleared; changed/deleted data invalidates unsafe restoration | Continue actual unfinished work instead of starting an unrelated new session |
| 05 Library Context | Wide-screen list/detail split; narrow-screen detail; browser Back restores context; stable word IDs and search caret/focus retained on rerender | Inspect and edit vocabulary without losing search context |
| 06 Reachable Study | Study actions remain below content; mobile navigation height measured; wrapping controls and natural long-content growth | Keep actions reachable without covering content at narrow widths, large text, or short viewports |
| 07 Listen Reading | Status follows speech start/end/error events; browsable queue; explicit return to current item after manual browsing; failed speech can retry the same item | Make playback state trustworthy without fabricated progress animation |
| 08 Bulk Add Review | Desktop source/preview side by side; mobile sequential; source-row issue links and selection; edits invalidate preview approval | Correct large inputs without scrolling through the entire preview or importing stale text |
| 09 Language Clarity | English screen-brand names retained; functional Add Words label translated; localized accessible navigation hints; 16 complete locale bundles | Separate brand labels from instructions and study-language data |

Home's redundant quick-start statistics were already hidden in the current source and remain hidden. Existing bulk confirmation, progress, retry/idempotency, undo, synchronization, and playlist operations were retained rather than replaced.

## Quiz Safety Details

- The default auto setting uses 1.2/2.5 seconds, measured after feedback is painted. Existing manual and custom delay preferences remain available.
- Correct-answer speech and minimum reading time must both finish. Speech has a bounded 20-second fallback, a visible failure state, and renewed reading time before continuation.
- Explanation opening pauses synchronously. Hidden tabs pause and require explicit Resume; returning never immediately advances. Hard-mode hidden time does not consume the response deadline.
- Normal unanswered questions never advance automatically. Skip remains an explicit operation.
- First-question input is immediate. Newly displayed subsequent choices have a short 350 ms input lock to prevent trailing taps. Old detached controls, repeated keys, obsolete timers, and stale audio callbacks are ignored.
- Each answered question has one result event ID. Restoring a checkpoint does not save old answers again.
- Result accuracy uses answered questions, not the planned count. Zero-answer sessions do not display praise or claim untouched words improved.

## Evidence: Current vs Updated

Before images use the archived FDG12 application. After images use FDG13. Both use the same six-word fixture, viewport, language, and morning atmosphere. They are actual browser screenshots, not design mockups or unimplemented proposals.

For each of `home`, `cards`, `quiz`, `library`, `listen`, `create`, and `settings`:

- Desktop: `qa/fdg13-evidence/before-{screen}-1440.png` and `after-{screen}-1440.png`
- Mobile: `qa/fdg13-evidence/before-{screen}-390.png` and `after-{screen}-390.png`

Short interaction recordings:

- `qa/fdg13-evidence/cards-interaction.webm`: reveal and rate three cards.
- `qa/fdg13-evidence/quiz-interaction.webm`: mixed correct/incorrect three-question session, no Next clicks.
- `qa/fdg13-evidence/listen-interaction.webm`: start, pause, resume, queue, next.

Recording speech events are controlled test events, not proof of real device voice output. Screenshot tests show the same six-word data and do not alter production vocabulary.

## Verification

Final unchanged-runtime two-round verification passed. Machine-readable results are in `qa/fdg13-full-verification.json`; per-step logs are in `qa/fdg13-verified-*.log`. Runtime SHA-256: `da777600c58064ebc5d1421973121f2e975a702614f014e6139f07f6b7e5f84d`.

Each round passed the unit/static checks, 285 browser tests (6 pre-existing project-specific skips), 378 global layout checks, 162 active-Quiz layout checks, and 336 evolution layout checks. Motion/reduced-motion checks, 100/1,000/5,000-word processing benchmark, all 16 locale bundles (695 keys each), and the FDG12-to-FDG13 cache upgrade test also passed in both rounds. These are repeat runs, not independent human usability studies.

Targeted evolution suite: 42 passed across Chromium desktop, Chromium mobile emulation, and WebKit before the final full run. Coverage includes mixed auto completion, speech timing/failure, hidden state, pause, repeated input, partial results, restored sessions, account isolation, Cards rating, Library Back/search caret, Bulk Add source editing, and Listen stale events.

Layout matrix: 336 combinations passed after fixes, using EN/JA/DE/AR, normal/doubled text, 1440x900, 820x1180, 1180x820, 390x844, 320x844, 844x390, and a 390x430 keyboard-like viewport. Checks detect horizontal overflow and clipped page controls. Additional global and active-Quiz matrices are included in final verification.

## PDCA Findings Fixed

1. An initial anti-repeat lock also delayed the first answer. Limited it to subsequent questions and visibly disabled controls during that short interval.
2. An asynchronous details toggle could pause too late. Added synchronous pause on explanation opening; repeated targeted tests passed.
3. Narrow Library split-view columns clipped row text. Changed columns to shrinkable tracks with natural wrapping.
4. Doubled text clipped buttons and crowded mobile navigation. Enabled wrapping and reserved actual measured mobile navigation height.
5. Search rerender could move focus to the detail Close control and lose the caret. Retained focused element and selection, with a dedicated three-browser regression test.
6. Zero-answer results could still show an encouraging wrong-answer empty state. Removed that state for zero recorded answers.

## Limitations and Unverified Conditions

- Viewport/device tests are browser emulation, not physical iPhone/iPad/Android or Windows hardware certification.
- Doubled text is computed-font-size emulation; the short viewport simulates keyboard-reduced space. Actual OS keyboard, text scaling, and assistive-technology sessions remain unverified.
- Speech control is tested with deterministic start/end/error and hung-audio fixtures. Real installed voices, Bluetooth devices, interruption policies, and OS background audio need device testing.
- Account isolation, persistence, partial failures, and retries are exercised with test fixtures. No new production accounts were created, and production words/playlists were not deleted or rewritten.
- Checkpoints are local to the browser and scoped to the account; they do not provide cross-device session-position synchronization.
- Timing values are initial product defaults, not a measured claim of optimal learning outcomes or user-study effectiveness.
- Public verification checks exact shipped assets, login shell, locale persistence, and cached offline shell. It is not a live authenticated production study-session test.

## Main Files

- `app.js`: Quiz state/timers/audio, Cards lifecycle, results, bulk review links.
- `ui/study-continuity.js`: account-scoped checkpoint validation and restoration.
- `ui/listen-reading.js`: speech state, queue browsing, current-item follow.
- `tn-library-management.js`: contextual details, history, focus, navigation hooks.
- `ui/runtime.js`: history integration and measured mobile navigation clearance.
- `ui/living-library.css`: upright reveal, stable controls, responsive split panes, wrapping.
- `index.html`: script wiring, Quiz controls, Bulk Add source/preview structure.
- `ui/i18n.js`, `locales/evolution.js`, `locales/*.json`: functional labels and accessible names.
- `tests/e2e/evolution.spec.js`: new behavioral regression coverage.
- `tools/check-evolution-layout.js`, `tools/capture-evolution.js`, `tools/verify-ux-release.js`: repeatable evidence and verification.

## Deployment

The target remains https://tangonest-app.github.io/tangonest/ on the existing GitHub Pages main-branch deployment. Publication is checked against the exact package inventory; the outcome is recorded separately in `qa/fdg13-release-verification.json`. The release upgrade test passed for FDG12 shell-cache replacement while preserving saved locale and browser data. No broad browser-storage deletion is performed. Verification evidence is kept in the development workspace, not bundled into the production app shell.
