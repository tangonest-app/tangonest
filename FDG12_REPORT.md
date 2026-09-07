# TangoNest FDG12: Focused Learning UX

Version: 1.0.0-rc.19-fdg12

## Changes

1. Home: retained the forest study, promoted Continue learning ahead of Add Words, removed the duplicate desktop summary, and bounded the tagline width. Mobile retains its useful summary.
2. Brand language: Home, Library, Cards, Quiz, Listen, Settings, Add Words, Bulk Add, Language and the central product taglines remain English. Functional explanations, validation, feedback, dialogs and accessible control labels follow the selected interface language. Vocabulary is never translated by the interface layer.
3. Quiz: one question counter and a thin native progress bar; the prompt remains visible after answering. Removed the duplicate flip-side answer and learning-engine status from the question flow. End session and a labeled Skip icon live in the header.
4. Timing: automatic correct = 800ms, incorrect = 1250ms. Existing slower/manual preferences remain available. Next now cancels pending progression. Playing the answer or focusing a feedback control pauses automatic progression so the control cannot disappear during deliberate review.
5. Other audit findings: long German navigation labels and narrow-phone feedback controls required layout refinements. Listening Quiz had untranslated replay/time text and a duplicated instruction.
6. Proactive fixes: compact two-button mobile feedback row, English mobile navigation without word splitting, localized password-toggle labels, and keyboard shortcut guards for composition, editable fields, modifiers and repeated keys. An actual IME-Enter submission bug was reproduced and fixed. English brand spans now have English language/LTR metadata, preventing reversed punctuation in Arabic UI; the Home copy stays over the readable dark part of the photograph.
7. Responsive: target widths 1440, 1280, 1024, 834, 768, 430, 390, 375, 320. Active Quiz also checked at heights 768, 800 and 900. Long content grows in the document rather than a nested feedback scrollbar.
8. Languages: visual/layout audit in English, Japanese, German, Spanish, Simplified Chinese and Arabic. All 16 dictionaries contain 688 canonical keys with matching placeholders. This is not native-speaker editorial certification.
9. Motion: a 240ms opacity-only question transition preserves physical positions. No flip, bounce, particle effect or new continuous animation in Quiz. Reduced motion disables the transition.
10. Performance: no new framework, animation dependency or background loop. Existing bounded Library rendering and speech cancellation remain intact.
11. Accessibility: native progress, a single live feedback region, text and check/cross indications in addition to color, 44px Quiz controls, keyboard Next and Skip, Escape focusing End session without unexpectedly ending study, and localized accessible labels.
12. PDCA: baseline runtime audit; Quiz/brand implementation; full-product and language audit; narrow-screen refinements; unchanged-runtime verification. Intermediate failures and superseded runs are retained in qa rather than counted as successful verification.

## Verification Status

Two consecutive full verification rounds passed on unchanged runtime. Each round passed 243 browser tests with 6 intentional project-specific skips, 378 full-screen layout combinations and 162 active-Quiz combinations. Syntax, unit, static, language, motion, performance and FDG11 upgrade checks passed in both rounds. Evidence is recorded in `qa/fdg12-full-verification.json` and the per-step logs in the development workspace.

13. Remaining issues: no known actionable issues remain within the verified scope. No detected nested Quiz scrolling, duplicate answer surface, known layout break, blocking console error or core regression remains in that scope. Platform and editorial limits below remain unverified rather than being represented as passed.
14. Release readiness: the verified FDG12 runtime is ready for GitHub Pages publication. Publication hash and deployed-file verification are recorded separately after deployment; no database migration is required.

## Scope And Limits

Browser automation uses Chromium desktop/mobile emulation and WebKit. Persona and account isolation journeys use isolated fixture accounts, not newly created production accounts. Real Windows/Android/iOS hardware, OS-specific voice quality, battery measurements and installed-PWA platform UI are not certified. No production word, playlist, account or schema was deleted or changed for testing.

## Update

The release increments the application shell cache to FDG12. FDG11-to-FDG12 upgrade verification checks removal of the old shell while preserving local storage and the saved interface language. No database reset or SQL migration is required.

Public URL: https://tangonest-app.github.io/tangonest/

After deployment, reload the page. If an already open installed app still displays the previous version, close and reopen it while online. Do not erase site data or account storage to update this release.
