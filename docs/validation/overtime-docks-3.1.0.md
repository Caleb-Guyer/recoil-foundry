# Overtime Docks — 3.1.0

## Scope and compatibility

Six authored layouts cover the first two rooms, both third-room routes, and both Docks bosses. Each reserves its machinery's full movement/fall region together with enemy entrances, props and floor access. The authored squad is reserved for the final wave and uses existing coordination, collision, attack warnings and death/portal breakup. Existing Overtime scaling, entrance warnings, occupancy checks and finite reinforcements apply.

`Checkpoint.overtime.remix: 1` opts new Overtime entries into the layouts. An absent field retains legacy generation, including saved route choices. Unsupported values fail checkpoint validation. Normal campaign, Daily seeds/rules, ordinary Practice arenas and later Overtime regions are unchanged. `PRACTICE_RULESET` stays at 1 because no playable Practice simulation or arena changed. Rollbacks must retain the new Overtime generation and field handling to avoid changing an in-progress remix's room.

## Checks

- 77 focused tests passed across Overtime Docks, existing Overtime, squads, Loader support collapse, Progress and Practice records.
- New coverage checks seeded reproducibility and isolation across 24 seeds/all twenty stages, both orientations of all six rooms, actual spawn/prop hulls, full machinery sweep clearance, one machinery family per room, finite warned waves, coordinated pair arrival, saved checkpoint round trips, invalid revisions, strict test URL parsing, actual low/high reward exits through the boss and into Furnace, and baseline floor traversal after cargo release.
- Traversal tests remove combat opponents and use high health to isolate geometry; movement uses the base gun, ordinary running/jumping, no shooting or teleportation. They establish route reachability, not combat difficulty.
- A Loader cargo shaft initially lacked sufficient space beside a support; the load and boss entrance were separated before the clearance tests passed.
- TypeScript and the production build passed. The existing large-chunk advisory remains.

## Combat probes

Twelve engine simulations used the existing dodge pilot, the supplied legal late-game gun and normal health/damage. Nine cleared, two reached the 90-second cap and one died. Successful runs lasted 10.75–28.20 seconds; the Crane produced a death in one orientation and a 12-HP clear in the other. Maximum simultaneous opponents was ten; no reinforcement remained queued at the cap.

The capped Transfer and Stamping cases exposed the pilot's limited cover navigation. A targeted follow-up used ordinary movement, jump and downward-fire inputs to reposition when progress stalled: Stamping cleared in 23.55 seconds; Transfer ended in a normal death at 50.18 seconds. Production combat was not altered to force a bot pass. These are simulation results, not human balance acceptance or a guarantee that every build can win.

## Browser checks

The production build is inspected on isolated `127.0.0.1:4200`, without modifying public profiles. All six room types, including mirrored Counterweight gantry and Loader layouts, render with clean firing lanes, physically grounded scenery, visible entrance markings and the unchanged compact HUD. Restart followed by pause returns the mirrored Loader test to seed `OT-DOCKS-9`, with its full preset gun. The report preview identifies 3.1.0 / Preset test / Overtime; no report is submitted. After testing, the fresh profile still has no saved run and zero discoveries, victories, blueprints or records. Warning/error logs are empty. These are agent-controlled browser checks, not independent human playtesting or physical-device acceptance.

## Publication evidence

- Runtime commit: `858389fd2109f27a87e5a3e8f90dfd5525f444c2`, immutable tag `v3.1.0`.
- [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36211354886): **1,929 passed, 0 failed, 0 skipped**, followed by successful production build and deployment. Test duration was 584,610 ms.
- [Release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36211996604): successful for the same runtime commit after the Pages gate.
- [Official artifact](https://github.com/Caleb-Guyer/recoil-foundry/releases/download/v3.1.0/recoil-foundry-v3.1.0-site.zip): **9,760,314 bytes**, SHA-256 `8b312168516c5a64a4d228cf28909da896a087a776512b5ef4f35eff1fe249e3`. The downloaded file matches GitHub's recorded size and digest.
- Archive inspection: 17 files, root `index.html`, all four relative entry references present, no source/tests/dependencies/private development directories, source maps or path traversal.
- itch.io upload **19404536** uses that byte-identical archive. Its retained transport filename is `recoil-foundry-v2.98.0-site.zip` for replacement continuity; its visible name is **Recoil Foundry 3.1.0 — Overtime: Loading Docks**, with browser playback checked.
- Public Pages About and report preview show 3.1.0. Existing progress remains Room 2 / one discovery / zero Practice victories, blueprints or records. The published Transfer lock test starts with the preset gun, renders the new lift layout and pauses normally.
- Public itch.io About shows 3.1.0 in the new upload iframe. Continue Daily remains available, with the original Room 1 / zero discoveries, Practice victories, blueprints or records. Both public game warning/error logs are empty.

No public progress was reset, no issue report was submitted, and no physical-device or independent human balance acceptance is implied. Completed publication checks leave no pending release checklist entries.
