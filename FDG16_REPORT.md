# TangoNest FDG16 - Icon Fit

Version: `1.0.0-rc.19-fdg16`

## Changes

- Kept the supplied master bitmap and SVG artwork unchanged. Install icon derivatives use only a square outer-mat crop, resizing, and placement, explicitly authorized by the user. No redrawing or recoloring of the artwork.
- iOS icons trim the asymmetric mat. Android maskable artwork increases from 280px to 360px in a 512px canvas, with a dark background sampled from the original interior. New versioned icon URLs avoid reusing old install assets.
- Adjusted the in-app logo viewport to compensate for the supplied bitmap's asymmetric outer mat. One consistent frame replaces the overlapping image mat and UI frame; the original central motif is unchanged.
- Fixed logo sizes: desktop sidebar 44px, compact header 36px, login 52px. Logos no longer shrink beside text.
- Standardized navigation icons at 24px and Home destination icons at 28px, with block layout and no flex shrinking.
- Kept decorative icons out of pointer hit testing so the containing button handles the action.
- Login title can wrap when text is enlarged instead of pushing the logo or overflowing.
- Kept learning code, vocabulary, history, Random defaults, Front audio, and automatic progression unchanged.

## Verification

`tests/e2e/icon-fit.spec.js` covers login and app icons at 320, 390, 820, and 1280px on Chromium desktop/mobile profiles and WebKit. It checks square dimensions, centering, target size, login text enlargement, and horizontal overflow.

`tools/check-icon-fit.js` captures login and Home at four widths with 2x pixel density. Public checks use deployed assets with isolated fixture authentication/data, without writing production learning records.

Run the existing unit/static, browser regression, and global layout checks before publishing. The release verifier checks deployed asset hashes, offline locales, Random/Front defaults, and automatic progression defaults. Upgrade validation uses FDG15 as the baseline.

## Scope

OS launcher/PWA fitting is included. Circular safe-zone and rounded iOS-style masks are simulated and visually reviewed; physical iOS/Android/Windows launcher rendering is not claimed as tested. Existing installed icons may remain cached by the OS. No database reset or browser data deletion is required.

## Local Results So Far

- Unit/static checks passed.
- Browser regression: 393 passed, 6 skipped.
- Focused icon checks: 24 passed.
- Login/Home visual and geometry checks: 8 passed at 320, 390, 820, and 1280px.
- Global layout: 378 conditions, no failures or page errors.
- Final packaging and public verification are recorded separately in the release QA artifacts.
