# Progress and recovery — 2.94.0

19 September 2026. Closeout for browser release checklist item 3. No combat, layout, reward-pool or campaign-length change; Daily remains ruleset 78.

## Player flow

**Settings → Progress**, or **Pause → Progress**, explains local browser storage and checkpoint behavior. Export downloads a versioned JSON backup. Import is available on the title, checks the file before changing data, previews the incoming profile and requires **Restore backup**. Successful import reloads the title with the restored profile. **Undo restore** returns to the prior profile; it is retained across reloads and later normal saves until another import replaces that recovery point.

The backup contains the current normal/Daily/Overtime checkpoint (including gun and pending rewards), discovered upgrades, Logbook, commendations, equipped cosmetics, Practice victories, recent run records, current and historical Daily times, and the saved Workshop build. Audio/controller preferences stay local. Checkpoints retain existing room-restart behavior; exports are not mid-frame physics snapshots.

Only saving failures or conflicts add an on-screen warning. The warning opens Progress and remains reachable inside dialogs. Failed writes retain the current tab's data for export. A quota failure offers Retry saving; an unreadable storage origin requires access to be restored and the page reloaded. Closing a tab while a write is pending or local progress is unsaved requests the browser's normal unsaved-changes warning.

## Persistence guarantees

- Progress is stored under one versioned `rf-progress-v1` key. A restore uses one atomic localStorage replacement, so a quota/storage failure cannot leave half an imported profile. Imports do not modify in-memory progress until that replacement succeeds.
- Strict import validation checks schema/version, bounded file size, legal checkpoints/builds, known records and unlocks, Daily dates/times, and every required category. Malformed, incomplete, unsupported or invalid files leave current data untouched. Imported strings used in the preview are rendered as text.
- Web Locks serialize writes across tabs where supported. Every commit also compares the stored revision against the version this tab read. Conflicts block stale commits, retain this tab's exportable data and offer a reload. Storage events/focus checks surface remote changes; active campaign play pauses for review. A pending restore cannot be interrupted by another restore or a stale local write.
- Older v3/v4/v5/v6 checkpoints and separate legacy records migrate on read without deleting the original keys. The new profile becomes authoritative after a successful save. A null checkpoint is explicit, so dying does not resurrect an older checkpoint.
- Corrupt/newer stored profiles are protected from automatic writes. A deliberate valid-backup restore can recover them while retaining the original raw record for Undo restore. Failed or interrupted legacy reads never authorize overwriting unread data.
- Practice, test runs, Workshop and warm-up retain simulation guards around checkpoints, discoveries, victories, commendations, Logbook and run recaps. A second guard protects the main application's boss-victory handler. Workshop's chosen build remains a saved preference; practicing a build does not grant its upgrades. Opening preview/test links no longer performs incidental migration writes.

## Verification

The focused persistence suite covers full-category round trips, invalid imports, atomic failure, persistent undo, unreadable-profile recovery, quota and security failures, interrupted legacy reads, concurrent writers, overlapping restores, checkpoint migration, reward-selection refresh, death, retry seed behavior and isolated modes. Existing encounter/reward/Practice/Workshop suites exercise the shared simulation isolation and their specialized checkpoints.

Browser checks used a separate local origin in the Chromium-based in-app browser, with disposable progress:

| Check           | Observed result                                                                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid file    | Unsupported backup rejected before showing a restore action; profile unchanged.                                                                                                                                                        |
| Valid restore   | Preview showed room 2 and one discovered upgrade; restoring reloaded that profile and enabled Continue.                                                                                                                                |
| Continue        | Restored campaign opened normally; Pause → Progress retained its room/upgrade summary.                                                                                                                                                 |
| Active campaign | Export remained available; Import and Undo were disabled until returning to the title.                                                                                                                                                 |
| Export/import   | Export produced an actual JSON file in Downloads. That same file was selected through Import and restored successfully. The browser automation's download event timed out, so the file and successful re-import were used as evidence. |
| Undo            | A confirmed undo returned to the original empty profile after reload.                                                                                                                                                                  |
| Two tabs        | Starting a new run in a second tab caused the older tab to show a conflict and disable import; Reload saved progress loaded the newer run. Closing the other tab retained that checkpoint.                                             |
| Layout          | Restore preview/actions fit at 960×540. At 390×740, the dialog scrolled vertically with no horizontal overflow and reachable confirmation/cancel actions.                                                                              |
| Browser errors  | No errors reported during the tested flows.                                                                                                                                                                                            |

All **1,528 tests passed**, including 15 focused recovery tests, with no failures or skipped tests. The final production build and TypeScript checks passed. These checks do not replace the separate browser/hardware coverage or human playtests still listed in the release checklist.

[Open Progress](https://caleb-guyer.github.io/recoil-foundry/?progress=1&v=2.94.0).
