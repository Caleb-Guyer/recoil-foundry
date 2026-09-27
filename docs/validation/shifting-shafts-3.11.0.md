# Shifting Shafts 3.11.0 validation

## Scope

New maintenance schedules opt into `revision: 2`. Each shaft shuffles four compatible 320-unit authored sections, containing all three families and one repeat. There are 36 section orders for each of the two shaft kinds. An independent seed stream avoids combat/reward RNG changes. Old schedules without a revision reconstruct the original 3.10.0 room. Daily, Practice, Workshop, Overtime, reward counts and shaft frequency retain their existing rules.

## Automated checks

`tests/maintenance.test.ts` covers all 36 orders for both shaft kinds with starting, enhanced-recoil and Fold builds: **216 ordinary-input climbs**. The pilot only moves, jumps and fires downward; live machinery remains active, with no teleportation, healing or forced completion. The Fold build traversals do not use portals. These checks establish reachability, not human difficulty ratings.

Additional checks cover strict preview parsing and save isolation, old/new save reconstruction, exact pending rewards and one-time payment, press warning duration and independent scheduling, safe landing zones, pause/hitstop, both split-lift branches, bypassing crumble transfers with recoil, crumble recovery with occupied-space protection, and existing detour/portal lifecycle behavior.

Production TypeScript/Vite build passes; the existing large-chunk warning remains. The focused regression suite passes 125 tests with zero failures/skips. Local in-app browser checks confirm the new piston pockets and crumbling lift transfers, minimal HUD, deterministic retry, and a floor-to-upper-landing portal shortcut with the centered camera. Physical-device and independent player limitations remain in [browser support](../browser-support.md).

## Publication

- Runtime commit `4353fe008d5075df6c57d060a877c1aaa18b6879`, immutable tag `v3.11.0`.
- [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36328508996): **2,073 tests passed**, zero failures/skips; build and deployment succeeded. Test duration: 1,126,284.134336 ms, including all 4,096 maximal gun combinations.
- [Release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36329728413) succeeded on that same commit. Stable release published 27 September 2026 at 15:29:40 UTC.
- Official `recoil-foundry-v3.11.0-site.zip`: **9,782,243 bytes**, 17 files, root index and four relative entry references verified; no source, tests, dependencies or source maps packaged.
- SHA-256 **`e188e1f20dee519eab67721994a3fbb25ad095b49d01aae743e5eb77fbb1ab25`**, matched against GitHub's digest. Exact verified bytes uploaded to itch.io.
- itch.io upload **19430037**, display **Recoil Foundry 3.11.0 — Shifting Shafts**, replaces upload 19428500. New identity verified before enabling browser play and saving. Public iframe uses `html-classic.itch.zone/html/19430037/index.html`.
- Both public About screens show **3.11.0**. The public paired-piston preview starts with full health and the minimal Maintenance HUD. Local checks also inspected the crumbling and split lift sections, pause and retry. No console warnings/errors on the public shaft or itch.io game.
- Existing progress preserved: Pages Room 2 / one discovered upgrade; itch.io Daily Room 1 / zero discovered upgrades. Both retain zero Practice victories, blueprints and Practice records.
- No devlog or messages posted. No fresh physical-device or independent player acceptance is claimed.

Publication checks are complete. Rollbacks must retain both maintenance layout revisions, schedule decoding and pending summit reward reconstruction.
