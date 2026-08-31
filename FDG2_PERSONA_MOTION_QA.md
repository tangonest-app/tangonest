# TangoNest FDG2 Persona And Motion QA

## Product Decisions

- Home is first on desktop because it answers the returning learner's first
  question: what should I do now?
- Library is second because collection review is the core product workflow.
- Add Words is third and remains visually prominent. It is also available from
  Home and the mobile add action, so capture stays fast without displacing Home.
- Page navigation is intentionally motionless. Smoothness is applied only to
  controls, feedback color, and flashcard rotation so text and controls never
  move while a learner is reading.

## Persona Matrix

1. New student with an empty library.
2. High-school learner starting Quiz.
3. University language learner using Cards.
4. Busy office worker using Home recommendations.
5. Language teacher entering Create.
6. Foreign resident changing language direction.
7. Commuter opening Listen.
8. Application developer inspecting Settings and export.
9. Keyboard-only learner entering after Login.
10. Multilingual learner changing language direction.
11. Power user loading a 1,014-word Library.
12. Returning learner restoring a session after reload.

Each persona signs in with a distinct mock email, password, user ID, access
token, playlist, and word dataset. The mock follows the Supabase Auth and REST
contracts but never writes production data.

## PDCA Findings

- Plan: introduce Apple-like smoothness without changing learning or database
  behavior.
- Do: add restrained local transitions and a smoother flashcard rotation.
- Check: the initial page-wide fade caused transient Axe contrast failures.
- Act: remove page-wide opacity animation and enforce a static contract against
  page animation.
- Check: login left keyboard focus behind when the Auth screen disappeared.
- Act: focus the visible Home navigation control, selecting desktop or mobile
  by viewport.

## Final Results

- Unit, syntax, static, sync, release, accessibility, and DB contracts: PASS.
- Playwright desktop, mobile, and WebKit: 105 passed, 6 intentional skips,
  0 failed.
- Axe serious and critical checks: PASS on Login and primary app screens.
- Performance: PASS at 100, 1,000, and 5,000 words with no horizontal overflow.
- Dependency audit: 0 vulnerabilities.
- Visual matrix: 80 screenshots generated and representative screens inspected.

## Production Boundary

The automated accounts are isolated test doubles. Production Supabase was not
seeded with twelve QA users. Real cross-device account acceptance should use
dedicated production QA credentials and must not reuse a personal password.
