# Practice builds — 3.0.3

## Implemented

The earned boss list opens a Preset / Workshop build choice. The shared Workshop editor filters discoveries, enforces legal acquisition order and caps selections at that boss's stage index (3/7/11/15/19). Presets retain their existing loadouts. Custom selections live on the practice session, separately from persisted victory records. Retry explicitly carries the session build, including an empty array. Editing from Pause or the result screen starts a fresh attempt only when Start fight is selected.

No campaign or Daily combat rules, save formats or unlock requirements changed. Explicit boss test URLs still allow only their preset exception without granting earned custom-build access.

During browser setup, a valid backup containing an Annex logbook discovery was rejected. The import allowlist omitted `annex`; it now accepts only the existing `annex: true` field. A restore/reload/undo regression covers this, including malformed flag rejection.

## Automated evidence

`tests/practice.test.ts`, `tests/workshop.test.ts`, `tests/dialog-dismissal.test.ts`, `tests/commendations.test.ts` and `tests/progress.test.ts`: **57 passed**. Added coverage verifies exact victory matching, discovery/path/prerequisite filtering, both arena orientations for every practice boss, upgrade caps, detached build arrays, empty and beam/portal retries, no progress writes/awards, preset reset, and resuming a saved normal run.

TypeScript and the production Vite build passed. The existing large-chunk advisory remains; no new build warning was introduced. Full-suite CI/publication evidence will be appended after the exact release commit passes.

## Browser evidence

The production build was served at a fresh local origin (`127.0.0.1:4197`). An isolated test backup was imported through Settings → Progress, without injecting browser storage or touching public profiles. It contained two victories, 15 discovered upgrades, a four-upgrade Workshop gun, and a Room 2 campaign checkpoint.

- A fresh profile hid Practice. After restore, only Loader and Switchboard appeared.
- Loader exposed the three-upgrade cap. Initial Workshop selection was capped without changing the saved four-upgrade Workshop gun.
- Removing Fold also removed Rewire. Beam descriptions changed appropriately and incompatible Mass Driver stayed disabled.
- Search, Back and Escape worked. Escape restored focus to Workshop build and retained the setup draft.
- The selected Light frame / Cutting Torch / Burst fire gun appeared in Pause and survived Retry.
- Clearing the editor and cancelling left the active gun unchanged. Starting an empty build and retrying kept zero upgrades.
- Natural Loader death showed Retry, Edit build, Choose fight, replay and Feedback. Editor Back returned to that result.
- Switchboard used the eleven-upgrade cap and entered the correct practice arena.
- Returning to Workshop showed the original Fold / Rewire / Light frame / Bloodwork gun. Progress still reported Room 2, 15 discoveries and two victories.
- Browser error/warning logs were empty. The loadout choice and editor were visually inspected at the default 1280×720 viewport.

These are automated and agent-controlled browser checks, not independent player feedback or new physical-controller/hardware acceptance.
