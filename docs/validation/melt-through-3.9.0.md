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

Full-suite and publication receipts will be recorded after the release gates finish.
