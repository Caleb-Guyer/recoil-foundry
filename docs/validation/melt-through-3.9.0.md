# Melt-through 3.9.0 validation

## Combat contract

Melt-through permits one passage through static authored interior terrain per primary projectile/ray. Material thickness is the distance through the actual convex hull along the incoming direction: 48 pixels normally, 96 with Clean Cut. Damage retained is 65% or 85%, including explosive payloads. The penetration never consumes enemy-pierce or ricochet allowances. Boundary terrain, loose props, machinery and overlapping cover remain solid. Both entry and exit clearance use swept hulls; upgraded projectiles use convex collision geometry for rotated terrain.

Projectile transit consumes flight time and lifespan, freezes steering until exit, and retains the spent passage on banks, portals and Recall. Trails restart outside the wall. Beams consume range through the material and retain the spent budget in portal/Resonator continuations. Tracing is pure; only actual emitted damage creates effects. Blowout creates three fragments with 12% of incoming direct damage each, speed 16 and lifetime 0.18 seconds. They have no wall passage, split, shell or recursive payload. Beams integrate actual lit damage and emit at most one cone per ray per pulse, including partial taps. Existing global shot limits remain in force; glow marks are capped at 32 and last 0.28 seconds, with reduced-effects rendering.

## Rewards and persistence

The Welder bonus guarantees the base salvage if not already owned. It remains optional and cannot reroll. The ordinary room reward follows without retaining the salvage offer. Clean Cut and Blowout require Melt-through and exclude one another in either acquisition order. New cards, icons and original maintenance records share the existing discovery, Workshop and saved-build systems. Legacy pending Welder choices remain unchanged on Continue; no new encounter or item is inserted into an existing run. Daily choices retain their existing pool. Previous maximal-combination URLs strip the newly introduced salvage and fork when resolving their original builds.

## Verification

- Focused combat and integration tests cover actual travel, damage, expiry, convex geometry, second walls, physical portals, Recall, ricochet, shells, steel balls, continuous/burst/charged/prism beams, range, secondary caps, frame-rate independence at 30/60/120 Hz, reward resume/decline, and isolated previews.
- Compatibility audit: 108 upgrades, 5,778 dependency-complete pairs checked in both acquisition orders; 4,865 allowed and 913 blocked. Base gun stats are order-independent. This is eligibility evidence, not an exhaustive combat-balance claim.
- Updated catalog enumerates 4,096 unique maximal builds and retains old links. Full-suite CI exercises all of those builds in the real Workshop with ordinary input and finite-effect assertions.
- [Ordinary-input audit](melt-through-3.9.0-audit.json): six presets in an authored room, its mirror and the final boss arena, with a 90-second limit. Results: 18 runs, 17 clears, one player death, zero timeouts, and finite physics throughout. Projectile passages total 2,157; observed peaks are 180 shots and 31 glow marks, within their caps. The simulation preserves damage, enemies and failed attempts; it is not a player win-rate estimate. Reproduce with `node --experimental-strip-types scripts/melt-through-audit.ts`.
- Production build passes with the existing Vite large-chunk advisory. Browser inspection covers entry, the equipped build and normal gameplay rendering. Human balance acceptance and broader physical-device coverage remain the existing limitations.

## Publication receipts

- Runtime commit: `bc4dc45a16339e120aea7643ea03eb96dca3706d`; immutable tag `v3.9.0`.
- [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36291517450): **2,036 tests passed**, zero failures/skips, successful production build and deployment. Test duration: 1,105,765.864 ms, including all 4,096 completed-build Workshop simulations.
- [Release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36292474924): success for that exact runtime commit. The [official archive](https://github.com/Caleb-Guyer/recoil-foundry/releases/download/v3.9.0/recoil-foundry-v3.9.0-site.zip) was published at 2026-09-27 03:48:43 UTC.
- Archive: **9,778,230 bytes**, **17 files**, four valid relative entry references and a root index.html. No source, tests, dependencies, private files or source maps. SHA-256 **CB72B638E1349618524350D8AC10BC0267455441BD29BB95429B1C36CFCF272A**, matched against the GitHub asset digest and the exact itch.io upload copy.
- Existing itch.io project: replacement upload **19421686**, display name **Recoil Foundry 3.9.0 — Melt-through**, browser playback checked and Save confirmed. The public game loads `https://html-classic.itch.zone/html/19421686/index.html?v=1790481024`. The public description now lists 108 upgrades.
- Both public About panels report **3.9.0**. The live Blowout preview starts a TEST room with Melt-through and Blowout in its equipped build. Pages retains Room 2, one discovered upgrade and zero Practice victories/blueprints/records; itch.io retains Daily Room 1 and zero discoveries/victories/blueprints/records. No player storage was reset.
- Warning/error logs were empty for the live Pages preview and refreshed itch.io game. Public release screenshot: `outputs/melt-through-3.9.0.png` in the task workspace.
- A supplementary [local headless cost smoke check](melt-through-3.9.0-cost.json) exercised four completed Workshop builds for 360 fixed steps each, with and without the new salvage/fork. With the upgrade equipped, mean simulation tick costs were 0.271–1.500 ms; maxima were 1.079–6.981 ms, with at most 180 shots. This is a short simulation-only sample on the development laptop, excludes rendering, and does not establish browser frame rates or minimum hardware requirements.

Publication is complete. The temporary preview server and editor were closed after verification; no devlog or player messages were sent.
