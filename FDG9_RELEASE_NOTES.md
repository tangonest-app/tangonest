# TangoNest Forest Desk Glass FDG9

## Main fixes

- Fixed the Bulk Add duplicate decision flow so `Add Both` reliably continues to destination confirmation.
- Added a sticky Bulk Add action dock, fixed confirmation overlays, bounded previews, and a progress panel for large imports.
- Verified a 1,014-word import completes without truncating the final rows.
- Changed Quiz to smart auto-advance by default: 2.2 seconds after a correct answer and 3.2 seconds after an incorrect answer.
- Kept configurable 1.5, 2.5, and 4.0 second timing options plus manual advance.
- Added a compact Home `Memory Path` for New, Learning, Review, and Mastered words.
- Collapsed advanced Settings sections to keep the page compact while preserving every existing control.
- Improved Memory Path text contrast for WCAG AA accessibility.

## Validation

- Syntax, unit, static UI, accessibility, release, and database contract tests: PASS.
- Focused Bulk Add and Quiz Playwright checks: PASS.
- Desktop, mobile, and WebKit regression checks for the final fixes: PASS.
- Visual QA captured at 1440, 1366, 1280, 1024, 768, 430, 390, and 375 pixel widths.

## Release identity

- Application: TangoNest `1.0.0-rc.19`
- UI/cache release: `fdg9`
- Service worker cache: `tangonest-shell-v1.0.0-rc.19-fdg9`
