# FDG18 Quiz learning upgrade

FDG18 improves the existing Quiz flow without a database migration, dependency change, or new learning mode. FDG17 remains the production release until this candidate receives separate publication authorization.

## Source and data contracts

- Edit `app.js`, `ui/runtime.js`, the other source sides of `tools/runtime-pairs.json`, and the direct `ui/living-library.css` / `ui/study-continuity.js` sources. `npm run build` generates the compatibility files actually loaded by `index.html`; all 12 pairs must match before packaging.
- Quiz preferences use `tangonest_quiz_preferences_v1:<account-id>` (or `:qa` only in isolated local tests). All 16 current controls save on change, with numeric controls also saving on input. Settings survive logout, remain private to the account, and restore after the owner's vocabulary has loaded. Missing playlists and languages fall back to All. Storage failures produce translated feedback.
- The previous device-wide advance-speed setting migrates to one owner, then account preferences take precedence. New accounts receive independent defaults. Existing per-format directions are preserved; unsaved Typing defaults to Back → Front and Choice retains Front → Back.
- Existing Supabase infrastructure synchronizes vocabulary and learning events, with no established safe UI-preference store. Settings are local to this browser/account; cross-device Quiz-setting synchronization is not added.
- Actual word fields are `front`, `back`, `frontLang`, `backLang`, `pronunciation` (Front pronunciation, including legacy aliases), and `memo` (example). There is no separate registered example-pronunciation field. Quiz displays registered information, labels Chinese Front pronunciation as Pinyin when it belongs to the answer, otherwise identifies it as Front pronunciation. It never infers missing pronunciation or mislabels English IPA as Chinese Pinyin.
- Answer records snapshot the question, submitted answer, correct answer/language, registered pronunciation, and example. Feedback and Review use the same snapshot. Correct/Incorrect keep the existing learning-event path; Skipped has its own status and does not create a false incorrect learning update or distort accuracy.
- Completed sessions have unique IDs and separate scores. Up to 20 recent result snapshots use the existing account learning-session cache and its existing logout lifecycle. Existing cloud learning history and checkpoint behavior are preserved. No SQL, reset, or production data mutation is part of this change.

## Behavior

Typing focuses inside Start/Retry/Continue gestures and on each question. The next input stays editable, preserving normal mobile keyboard behavior. IME and held Enter are ignored; an empty Enter records Skipped, shows the correct answer, and follows the same configured delay as Correct/Incorrect. Rapid empty Enter cannot accidentally skip the following question, while a newly typed answer can be submitted immediately. Explicit Next cancels old timers.

The existing default remains two seconds, with all existing speed/manual choices respected. Automatic audio cannot stall this delay. Explicit Play answer can temporarily hold progression; Pause and hidden-tab protections remain. Quiz TTS uses the correct answer's language rather than always Front. Cards and Listen keep their existing contracts.

Review uses compact expandable rows, status filters, registered pronunciation/examples, answer audio, Save and Word Detail. Expanded information uses the document's natural scroll. Results present Retry Mistakes (Incorrect + Skipped), Continue Quiz, Review All and Finish, with Back to setup retained separately. Continue retains the original full configuration even after Retry, starts a new session, shuffles, reduces immediate overlap when enough eligible words exist, and caps only to the actual available pool.

VisualViewport handling follows real input focus and usable viewport changes. It reduces Quiz chrome while a keyboard is detected, and scrolls the input only when outside the usable area. It does not synthesize gestures or force a restricted mobile keyboard to open. The existing Forest Desk Glass/Living Library brand and FDG16 icon assets remain.

## Verification and publication preparation

Use `npm run build`, `npm test`, `npm run audit:i18n:release`, `npm audit --audit-level=high`, the library benchmark, and `npx playwright test --workers=2`. New browser tests exercise complete settings persistence/account isolation, fast Enter, Skip timing/data protection, pronunciation snapshots, Review actions, Retry/Continue, all nine required widths and seven UI languages across Chromium desktop/mobile and WebKit. Existing accessibility, auth/sync, Cards, Listen, Bulk Add, Library, performance, and visual checks remain in the suite. The former single 27-size layout test is divided by width, preserving all size checks. The whole-app learning journey receives a separate 90-second functional-test budget; performance assertions remain unchanged.

Four PDCA areas are Quiz correctness, Review/Continue, mobile/tablet/keyboard layout, and whole-app regression. Issues discovered during verification include same-owner logout restoration, a legacy speed preference leaking between accounts, and an overly broad 350ms input guard. Each has a dedicated regression case. Review's redundant heading/large summary, outdated audio wording in 16 locales, and unconditional post-answer Front audio were also corrected.

Package only with `npm run package:release -- <fresh-directory>` and verify the package's 66 files and the 18 browser-loaded script hashes. Exercise offline startup and explicit FDG17 → FDG18 PWA update acceptance in isolated browsers, retaining account data, locale, existing learning updates, and legacy checkpoints. Do not publish the full checkout, merge to main, or dispatch Pages without separate authorization.

Real iOS/Android/iPad hardware keyboards, installed-device PWA behavior, physical speakers/voice quality, production Supabase write paths, and cross-device preferences are not claimed as verified. Browser emulation and WebKit are useful coverage, not proof of physical-device behavior.
