# TangoNest FDG11 Audit Notes

## Scope

Incremental FDG10 upgrade, not a rewrite. Forest Desk Glass 2.0 adds a static forest-study image, ivory study surfaces, quiet native motion, a shelf/list library, atmospheric time preferences and lightweight internationalization. Existing authentication, synchronization, bulk import/undo, study flows and premium icons are retained.

## Language Coverage

37 study-language definitions share stable BCP-47 identifiers. English, Japanese and Korean remain first. Study language, interface locale and content direction are separate.

16 interface locales: English, Japanese, Spanish, French, German, Korean, Simplified Chinese, Traditional Chinese, Portuguese, Italian, Russian, Arabic, Hindi, Indonesian, Turkish and Vietnamese. Each non-English catalog contains all 686 canonical keys with matching placeholders. Optional Dutch, Polish and Thai interface catalogs are deferred and are not offered in Settings; they remain available as study languages.

Catalog completeness is not a claim of native-speaker editorial approval. Vocabulary, playlist names and canonical copy-format columns are intentionally not auto-translated.

## Behavioral Safeguards

- Listen waits for actual speech completion before advancing; stop/pause cancels pending pairs and autoplay.
- Missing speech voices produce honest unavailable feedback without changing study data.
- Arabic UI does not force Japanese or Latin vocabulary into RTL; dynamic Quiz answers have independent content direction.
- Bulk import reports actual processed counts, preserves duplicate decisions and undo, and does not animate 1000 rows individually.
- Motion respects reduced-motion preferences. Discovery parallax is event-driven and disabled during study. No perpetual idle requestAnimationFrame loop is used.
- Atmosphere changes follow local-time boundaries or saved manual choice. Study surfaces retain readable contrast.

## Verification Evidence

Final verification results are recorded in the development workspace under qa/living-final-*.log, qa/motion-budget.json and qa/i18n-coverage.json. Release completion requires two consecutive clean functional, locale, responsive and motion runs. This document alone is not evidence of a successful public deployment.

## Limits and Follow-Up

Browser regression uses isolated fixture accounts and controlled speech synthesis, not production account mutation. Real cloud permission acceptance, physical-device speech/PWA behavior, battery impact, sustained 60fps and native translation review are not certified by these tests. Production vocabulary has not been deleted or rewritten for this upgrade.

The static background is generated artwork. Navigation icons use Lucide and retain assets/ui/LICENSE. Existing Supabase attribution is included. No paid AI API, video background, large animation framework or WebGL dependency is added.
