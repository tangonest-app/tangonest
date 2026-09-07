# TangoNest FDG11 Update Guide

Version: 1.0.0-rc.19-fdg11 (Living Library).

## Data Safety

This UI update does not reset accounts, words, playlists or learning history. No new database schema is required. Do not run old RESET scripts or clear all browser site data. The retained FDG10 safety SQL is for installations that have not disabled historical reset RPCs; it is not a new FDG11 migration.

## Deploy

Publish the contents of TangoNest_FDG11_REVIEW_CANDIDATE to the existing GitHub Pages source. Do not upload node_modules, qa, tests, source translation tables or the ZIP itself. Preserve Pages workflows, CNAME and repository configuration. The package inventory is generated from the service-worker shell with file hashes and stays below 100 files.

## Confirm

1. Wait for the Pages deployment to succeed.
2. Open the existing public URL. Finish or stop any active import before accepting an update notification.
3. Confirm version 1.0.0-rc.19-fdg11 in Settings and the forest-study background with compact gold navigation.
4. Change App Language, reload and confirm the setting persists while vocabulary stays unchanged.
5. Check Library, Bulk Add, Cards, Quiz and Listen. Confirm previous account data remains present after a normal reload.

If FDG10 remains visible, check the deployed files and service-worker update first. A hard refresh is acceptable after pending work is saved; deleting cookies, IndexedDB or vocabulary is not an update procedure.

## Device Acceptance

On physical iPhone/iPad/Android/Windows, confirm installed PWA startup, touch targets, script fonts, available speech voices and offline reopening. Voice availability depends on the operating system. Missing voices are reported rather than replaced with an unrelated language.

The previous premium icon family is intentionally retained. OS home-screen icon caches may update separately from application assets.
