# Maintenance Shafts 3.10.0 validation

## Scope

Two optional traversal rooms replace one existing detour slot in 45% of new non-Daily campaigns. A version-6 optional `maintenance: { stage, kind }` schedule preserves the selection across Continue and progress backups. Missing schedules remain missing on older saves. Daily room selection, upgrade-pool compatibility, reward totals and Overtime rules are unchanged.

## Focused checks

The focused suite passes **111 tests**, including 17 new shaft checks:

`node --experimental-strip-types --test tests/maintenance.test.ts tests/detours.test.ts tests/hazards.test.ts tests/freight.test.ts tests/portals.test.ts tests/progress.test.ts tests/rules.test.ts tests/release.test.ts`

- Independent, deterministic scheduling with at most one shaft; old saves, Daily, Practice and Workshop exclusions.
- Strict preview URLs and malformed checkpoint rejection; preview writes stay behind the existing test boundary.
- Empty shafts cannot clear early or offer rewards at the bottom. No enemies, random crates, breakable structural landings or pending waves appear.
- Alternating press banks retain the full 1.1-second warning. Outer landing areas remain clear of the sweep. Pause and hitstop freeze motion and scheduling.
- Six ordinary-input climbs complete: both layouts with the starting, recoil and Fold guns, with live machinery and no teleportation, healing, hazard removal or forced clear. The pilot walks, jumps, fires downward and coasts onto each landing. These establish reachability, not a human difficulty rating.
- Continue reconstructs unfinished machinery at the entrance without repeating the regular room upgrade. Pending summit cards restore exactly; the extra upgrade pays once without healing and rejoins the boss at the original next stage.
- Floor/wall portals work above the ordinary room ceiling; moving lifts cannot host portals. Choosing the lower normal exit bypasses the shaft.
- Existing combat-detour fixtures explicitly select combat rooms; their wave, machinery, traversal, health, save and reward checks remain intact.

Production TypeScript/Vite build passes. The pre-existing large-bundle warning remains. No fresh physical-device or independent player claims are made.

## Browser inspection

Local in-app browser at 1280 × 720: both layout previews start with only the existing health bar, pause button and Maintenance label. Press supports, warning lanes, marked landing edges and lift cables render correctly. The shaft stays horizontally centered during a right-click portal trip from the floor to an upper landing; the camera follows the change in height. Pause/resume and About's 3.10.0 version were checked. No console warnings or errors appeared.

The gameplay commit `cfb4c81cbb5a2f5f2d9441365ed4b3159a6e54f9` passed all **2,062 tests** with zero failures/skips in [the first Pages run](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36296996356). Test duration was 1,128,442.441251 ms. The follow-up camera commit passed the same complete gate before tagging, as recorded below.

## Publication

- Runtime commit `47e3f9c30ef4a87ae7689ad04119cb249dc2d3f1`, immutable tag `v3.10.0`.
- [Final Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36323637942): **2,062 tests passed**, no failures/skips, build and deployment successful. Test duration: 1,124,582.467229 ms; all 4,096 maximal gun combinations included.
- [Release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36324855436) succeeded on that same commit. Stable release published 27 September 2026 at 14:09:05 UTC.
- Official `recoil-foundry-v3.10.0-site.zip`: **9,781,560 bytes**, 17 files, root `index.html` and all four relative entry references verified. No source, tests, dependencies, credentials or source maps packaged.
- SHA-256 **`ccdd01a57443013a85b93afaf5ac567dd9c90150e58639d34db308bf36bbe1e6`**, matched against GitHub's asset digest. Exact verified bytes uploaded to itch.io.
- itch.io upload **19428500**, display **Recoil Foundry 3.10.0 — Maintenance Shafts**, replaces upload 19422261. New identity verified before enabling browser play and saving. Public iframe uses `html-classic.itch.zone/html/19428500/index.html`.
- Both public About screens show **3.10.0**. The public Piston shaft starts with its centered camera and full HUD; Pages' issue-report preview identifies 3.10.0. No issue submitted. Public preview and itch.io console warning/error logs are empty.
- Existing progress preserved: Pages Room 2 / one discovered upgrade; itch.io Daily Room 1 / zero discovered upgrades. Both retain zero Practice victories, blueprints and Practice records. Test runs did not replace either save.
- No devlog or messages posted. Physical-device and independent player limitations remain in [browser support](../browser-support.md).

Publication checks are complete. A rollback must retain the optional maintenance schedule decoder and shaft reconstruction for saves that entered one; do not silently turn a saved shaft into a combat detour by deploying an unchanged older build.
