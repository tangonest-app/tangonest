# TangoNest development

This Git checkout is the canonical development source after the 2026-10-11 reconciliation. Follow DEVELOPMENT.md. The sibling TangoNest_Living_Library is a preserved FDG16 reference, not a second writable source.

- Edit the source side of tools/runtime-pairs.json (app.js, etc.). The compatibility filenames on the right are generated, even though they are tracked and loaded by index.html.
- Never recreate runtime outputs from archived folders or older hotfix files. index.html and sw.js define the active loading path.
- After editing sources, run npm run build, npm test, and relevant browser tests. npm run check:runtime must pass before packaging. Test the generated app, not a separate source-only harness.
- Build/packaging must not write or execute SQL. Root SQL files are preserved historical artifacts. docs/reference/fdg16-schema.sql is an offline contract reference, not deployment instructions or proof of the live database schema.
- Never reset user/browser/cloud data to update the application. Browser tests use isolated fixtures.
- Runtime changes require a new release.json version before publication. Keep user-approved PWA activation behavior intact.
- Publish only the package:release artifact, never the full source checkout. Pages uses GitHub Actions and the manual pages-candidate.yml workflow on main. Production publication requires explicit authorization; local preparation alone does not authorize publishing.
