# Sorting Pit 3.13.0 validation

The encounter uses an independent seeded stream and an optional checkpoint field. It can replace normal Reclamation room 15; earlier saves do not acquire a plan on Continue. Daily, Overtime and test isolation guards retain existing behavior. The planner excludes area events and scheduled Auditor visits and avoids the two Reclamation introductions.

New checks cover all six arena orientations, supported enemy spawns, finite prop counts, real lifting/drop collisions, warning timing and spam, player-only coil activation and cover obstruction, Ray/shell/Mass Driver operation, portal-routed shots and beams, pause, room clear, rewards, cleanup, malformed links and save isolation. Each layout is traversable with ordinary movement and jumping after every loose crate is removed.

The final room-15 ordinary-input combat probe cleared **18/18** attempts across three layouts, two mirrors and standard/Ray/portal builds, with health and machinery active. These are automated reachability/combat checks, not human difficulty acceptance. An earlier room-13 prototype probe lost one mirrored Ray attempt; the actual encounter now previews at room 15, matching its campaign placement and preserving the Harpooner introduction.

Local validation passed **284 focused tests** and the production TypeScript/Vite build. A final malformed-checkpoint guard was checked again with the 32 Sorting Pit/progress tests and TypeScript. The pre-existing large-chunk build warning remains.

Browser checks covered all three layouts, normal and Reduced effects rendering, pause, death/retry, test startup and save isolation. The local Reduced effects preference was restored after the check. The existing room-one/65-discovery local profile remained intact. These are UI checks, not new physical-device or human listening acceptance.

## Release verification

- Runtime revision: `238465e50cad46f51384e2a1d2fb17a24345bc10`.
- [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36369989022) passed **2,097 tests**, with zero failures, cancellations or skips, in 1,130,822.446093 ms. Build and deployment passed.
- Tag `v3.13.0` passed the [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36371362750) at that same revision. The stable release was published at 02:50:54 UTC on 28 September 2026.
- Official archive: `recoil-foundry-v3.13.0-site.zip`, **9,790,484 bytes**, 17 files with all four relative entry assets verified. No source, tests, node_modules, work files or source maps.
- SHA-256: `7f027f00c1be4f57ed157e4c9e3c32c6b1b175192e9213724f90dbe3dda739cd`, verified against GitHub's asset digest and the byte-identical itch.io upload copy.
- GitHub Pages shows 3.13.0, starts the Sorting Pit preview in room 15, and retains the room-two campaign, one discovered upgrade and zero Practice victories, blueprints or records. No runtime browser errors were reported.
- itch.io upload `19442261` is named **Recoil Foundry 3.13.0 — The Sorting Pit**, enabled for browser playback. Its public player loads `/html/19442261/index.html?v=1790563965`, shows 3.13.0 in About & credits, and retains the Daily room-one save and zero-discovery/Practice/blueprint/record totals. No browser errors were reported. No devlog, pricing or disclosure changes were made.

Existing hardware, listening and independent-player limitations remain in [browser support](../browser-support.md). A rollback must retain the optional `sortingPit` checkpoint field and its decoding so already-planned rooms remain stable.
