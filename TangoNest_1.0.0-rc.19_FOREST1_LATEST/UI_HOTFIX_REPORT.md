# TangoNest rc.19 UI Hotfix 1

## Fixed

- The language menu now always opens in this order: English, Japanese, Korean, French, then the remaining languages.
- The hidden native macOS select no longer overlaps the custom language picker arrow.
- Library word text, meanings, examples, and metadata begin at one consistent left position.
- The Service Worker and all asset URLs use the `uihotfix1` cache version so older UI files are replaced.

## Verification

- Static, syntax, unit, sync, and database contracts: PASS
- Targeted UI E2E across Desktop Chrome, mobile Chromium, and Desktop WebKit: 18 PASS
- Full E2E suite: 63 PASS, 6 expected skips, 0 failures
- Visual measurement: word and metadata inset 68 px from the row edge; horizontal overflow 0 px

Visual evidence is in `qa/ui-hotfix1/`.
