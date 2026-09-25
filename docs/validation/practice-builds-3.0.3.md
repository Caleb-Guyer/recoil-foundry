# Practice builds — 3.0.3

## Implemented

The earned boss list opens a Preset / Workshop build choice. The shared Workshop editor filters discoveries, enforces legal acquisition order and caps selections at that boss's stage index (3/7/11/15/19). Presets retain their existing loadouts. Custom selections live on the practice session, separately from persisted victory records. Retry explicitly carries the session build, including an empty array. Editing from Pause or the result screen starts a fresh attempt only when Start fight is selected.

No campaign or Daily combat rules, save formats or unlock requirements changed. Explicit boss test URLs still allow only their preset exception without granting earned custom-build access.

During browser setup, a valid backup containing an Annex logbook discovery was rejected. The import allowlist omitted `annex`; it now accepts only the existing `annex: true` field. A restore/reload/undo regression covers this, including malformed flag rejection.

## Automated evidence

`tests/practice.test.ts`, `tests/workshop.test.ts`, `tests/dialog-dismissal.test.ts`, `tests/commendations.test.ts` and `tests/progress.test.ts`: **57 passed**. Added coverage verifies exact victory matching, discovery/path/prerequisite filtering, both arena orientations for every practice boss, upgrade caps, detached build arrays, empty and beam/portal retries, no progress writes/awards, preset reset, and resuming a saved normal run.

TypeScript and the production Vite build passed. The existing large-chunk advisory remains; no new build warning was introduced. The final runtime commit `2fcba8531d8feae036f94e2d253342b18e327993` passed **1,903 tests, zero failures/skips**, the production build and [Pages deployment](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36178571167). The suite took 586.2 seconds. Its predecessor's run was superseded and cancelled when the final spacing correction was pushed.

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
- Continue restored the original campaign seed, Room 2 and Heavy hitter gun. The in-game report identified version 3.0.3 and Campaign mode; no report was submitted.
- A direct Turbine test still offered Retry but no custom editor. Choose fight listed only the two earned bosses.
- Browser error/warning logs were empty. The loadout choice and editor were visually inspected at the default 1280×720 viewport.
- The final spacing correction keeps the editor's help line inside its scroll region. Search no longer leaves the list at an old scroll offset. The existing preset path was also checked: Loader still starts with Heavy hitter / Hair trigger / Kickback.

These are automated and agent-controlled browser checks, not independent player feedback or new physical-controller/hardware acceptance.

## Release artifact

Tag `v3.0.3` points to runtime commit `2fcba8531d8feae036f94e2d253342b18e327993`. The [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36179836841) verified the matching Pages pass before packaging. The [official archive](https://github.com/Caleb-Guyer/recoil-foundry/releases/download/v3.0.3/recoil-foundry-v3.0.3-site.zip) is 9,752,301 bytes, with 17 files, a root `index.html`, all four entry asset references present, and no source, tests, dependencies, source maps or local fixtures.

SHA-256: `2079a47a8b4bb0826b94d5c77e50a3106e6282a8390799aaa9ae102bc5273c3f`. Size and digest matched GitHub's published asset metadata. The itch upload copy uses the existing replacement filename `recoil-foundry-v2.98.0-site.zip`; its contents and digest are the verified 3.0.3 archive.

## Public verification — 25 September 2026

- GitHub Pages' About & credits shows **3.0.3**. Its existing Room 2 save, one discovery and zero practice victories remained intact.
- itch.io replaced the prior archive with upload **19399784**, display name **Recoil Foundry 3.0.3 — Dead Signal**, marked as played in the browser. Its public iframe is `https://html-classic.itch.zone/html/19399784/index.html?v=1790364687`; About & credits shows **3.0.3**.
- itch.io retained Continue daily, its Room 1 save, zero discoveries and zero practice victories. Neither public profile was overwritten with QA data. Practice correctly remains hidden on profiles without a victory.
- Both public games started successfully and had empty captured warning/error logs. Custom loadout gameplay was verified on the isolated local production build as documented above, not by altering the public profiles.
- The upload picker initially timed out before a file was selected. Refreshing the unchanged editor and using its visible Upload files control succeeded. The final upload and public version were verified.

Publication is complete on both hosts. No release checks remain pending; historical hardware and independent-player limitations retain their existing scope.
