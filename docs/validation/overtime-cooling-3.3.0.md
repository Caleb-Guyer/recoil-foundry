# Crosswind — 3.3.0

## Scope and compatibility

Six authored layouts replace Overtime stages 8–11 for new revision-3 entries. Both third-room routes and both Cooling bosses have separate plans; each mirrors with its seed. Earlier Docks/Furnace revision behavior is retained, later areas are unchanged, and existing unversioned/revision-1/revision-2 saves keep their original generation. Normal campaign, Daily, upgrades and ordinary Practice are unchanged; Practice ruleset remains 1.

Fans are opt-in level placements. Their recessed art, five cover-clipped direction lanes and spin-up cue show where a gust will act. Each gives 1.25 seconds of warning, ramps over 0.4 seconds, runs for 3.6 seconds and rests for 3.8 seconds. Player acceleration is limited to 0.23 horizontal / 0.7 upward velocity units per simulation step; wind-only speed limits are 8 / 7.5. Stronger preexisting recoil is preserved. Grounded player input and projectiles are unaffected. Only lighter airborne enemies and free crate/rubble props are eligible; bosses, heavy/anchored enemies, carried objects and armed volatile attacks are left alone. Gusts do not cancel attacks, deal direct damage or grant armor openings. Fans stop after combat; pause and hitstop freeze them.

Steam's existing convex-cover calculation was extracted into a shared airflow helper without changing its geometry. Art and forces share that helper; rotated terrain and loose crates shield targets behind them. A blocking crate remains eligible for airflow itself. Overlapping fans cannot multiply the acceleration budget. No new packages, controls or HUD elements were added.

## Automated checks

All **147 focused checks passed after the final geometry/animation refinements**, covering Overtime, pressure, Turbine, squads, sound, saved progress and Practice records. The twelve new Cooling checks include 24 seeds across twenty stages, detached generation, all six rooms/mirrors, supported entrances, unobstructed shafts, old/new save round trips, strict preset URLs, progress isolation, real clears/rewards from Furnace through both Cooling routes into Reclamation, full warning timing, cue dispatch, pause/hitstop, clear/death/retry, grounded control, recoil preservation, projectile isolation, cover shielding, eligible bodies and finite coordinated reinforcements.

All twelve layouts passed traversal in both directions with the base gun and ordinary jumps, with fans running and off (48 cases). A normal jump in the intake shaft coasts to approximately y=111 without shooting, then falls back toward the finite draft; steering leaves it. The initial test's arbitrary y=120 ceiling margin was corrected after inspecting that ordinary trajectory; no wind-strength change was needed. This establishes movement behavior and reachability, not a human feel verdict.

The sound regression checks reserved warning voices under saturated gunfire, soundtrack ducking for the complete spin-up, bounded source lifetime/cleanup and effects mute. TypeScript and the final production build passed; the existing large-chunk advisory remains.

The initial full local suite passed 1,953 tests before the final room geometry and rotor-animation refinements. Those refinements were covered by the focused rerun above; publication requires the final commit's full Pages CI run.

## Combat probes and limits

Twelve final-layout probes used the existing dodge pilot, legal preset guns, normal health and ordinary movement/shooting inputs, with a six-second stall-reposition attempt. Ten cleared and two reached the 90-second input cap; none died. Ordinary clears took 7.78–36.35 seconds at 56–100 HP. All four boss variants cleared in 12.68–23.45 seconds at 36–64 HP. Maximum simultaneous ordinary enemies was eleven; boss arenas had four including finite supports.

Unmirrored Towers and Bypass capped while the simple pilot repeatedly fired below cover, retaining 100 HP with five/two enemies left. A separate test-only navigation probe chose an unobstructed ascent corridor from visible level geometry, walked there and fired downward before resuming normal combat. It cleared Towers in 27.53 seconds and Bypass in 24.93 seconds, both at 100 HP. It changed no production AI, geometry, health, damage or simulation state. Both original caps remain recorded, rather than relabeled as first-pass successes. Initial-layout results are also retained separately.

These probes establish possible clears through normal inputs, not human difficulty, enjoyment, universal build viability or a player win rate. Independent human balance testing remains unavailable.

## Browser scope

The local production build is checked through the embedded browser using actual menus and input. This is separate from physical hardware acceptance and independent player feedback. Public-host checks and exact artifact/deployment evidence are recorded after publication.
