# Pressure Shift — 3.2.0

## Scope and compatibility

Six authored layouts cover Overtime stages 4–7: two main rooms, both third-room routes and both boss arenas. Revision 2 includes the unchanged revision-1 Docks rooms, then the new Furnace plans. Unversioned and revision-1 saves keep their generation. Later regions, normal campaign, Daily, upgrades and ordinary Practice remain unchanged; the Practice ruleset stays at 1.

Hot pressure is opt-in per placement. Existing launch vents keep their timing, harmlessness, rendering and post-clear behavior. Hot jets use the same convex-cover exposure and swept bullet/beam valve tracing. New behavior adds once-per-burst damage, manual-only boss armor openings, a shared boss cooldown and safe shutdown after clearance. Boss movement and attack state are not cancelled. Rollbacks must retain revision-2 checkpoint decoding and generation.

## Automated checks

111 focused tests passed across Furnace/Docks Overtime, pressure, Kiln, squads, saved progress and Practice records. New cases cover 24 seeds across twenty stages, detached deterministic geometry, both mirrors, full steam shafts, exposed valves, reserved entrances, unsupported save revisions, strict test URLs, isolated retries, actual reward transitions from Docks through both Furnace routes into Cooling, coordinated arrivals, ordinary bullets/beam tracing, blocked and hostile shots, full warnings and recharge, cover shielding, once-per-burst damage even for unlaunchable enemies, both bosses' armor openings and shared cooldown, pause, safe room clearance and lethal-step termination.

All twelve layouts also passed floor traversal in both directions with ordinary movement/jumps, no shooting and jets disabled to isolate geometry. This establishes reachability, not combat acceptance. The initial clearance scan found one shelf overlapping a jet and one enemy entrance beside a valve; both were separated before the tests passed. TypeScript and production build passed; the existing large-chunk advisory remains.

## Combat probes and limits

Twelve normal-health engine probes used the existing dodge pilot, a legal preset gun and ordinary movement/shooting inputs. After six seconds without a kill the pilot attempted to reposition through normal inputs. Seven cleared; five died; none hit the 90-second cap. All ordinary variants except unmirrored Split boilers cleared. Clear times were 9.70–19.17 seconds, with 46–100 HP remaining; maximum simultaneous opponents was eleven.

Both Press and both Kiln probes died in 12.22–29.85 seconds. A same-seed/gun/pilot comparison with legacy revision-1 arenas cleared one Press and died in the other three boss fights. The pilot does not forecast hot steam or deliberately exploit valves. Its failures are retained, and production enemies were not weakened to manufacture a pass. These probes do not establish human balance, universal build viability or equal difficulty across orientations. The room/unit tests separately establish traversal, finite waves, full attack/steam warnings and reachable armor openings.

A follow-up test-only pilot added visible steam lanes to its approximate movement scorer and aimed ordinary shots at ready valves when a boss occupied the jet. It made no simulation, health or damage changes. Mirrored Press cleared in 23.60 seconds at 14 HP with one valve-triggered opening. Both Kilns cleared in 26.95/31.07 seconds at 72/36 HP; mirrored Kiln received two valve-triggered openings. Unmirrored Press still died. Mirrored Split boilers cleared, while its other orientation hit the 90-second input cap with one surviving gunner and 100 HP, exposing the pilot's cover-navigation limit. These mixed outcomes are retained rather than counted as six passes. No production change followed the probes.

## Browser checks

The production build was inspected on isolated localhost, with all six room types and mirrored Service tunnel/Kiln. Valve assemblies sit on the floor, warning lanes remain visible over the Furnace scenery, and the compact HUD is unchanged. The mirrored Kiln preset restarts and pauses through real keyboard input. These are agent-controlled embedded-browser checks, not independent human playtests or physical hardware acceptance.

The report preview shows 3.2.0 / Preset test / Overtime / `OT-FURNACE-3` / Furnace room 8 after restart. No report was submitted. Local progress remains no saved run and zero discoveries, Practice victories, blueprints or records. Warning/error logs are empty.

Reduced effects was enabled for a mirrored Gallery run, followed by death and replay viewing, then restored to its original off setting. This checks the setting/run/replay flow; it is not a separate visual acceptance of every reduced-effects warning frame.

## Publication evidence

Runtime commit: `91cd643f80092b433c7c66e508f332b3516db46c`. Immutable tag: `v3.2.0`.

- [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36213483349) passed **1,940 tests, zero failures and zero skipped** in 534,412 ms, then built and deployed successfully. Tests finished at 03:10:03 UTC on 26 September 2026 (25 September locally).
- The [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36214032347) succeeded for the same runtime commit. The [official ZIP](https://github.com/Caleb-Guyer/recoil-foundry/releases/download/v3.2.0/recoil-foundry-v3.2.0-site.zip) was published at 03:11:49 UTC: **9,762,104 bytes**, SHA-256 `d661b6ea275de5d94afd6ca801690ac7b2ed6f3ab0a798444780d18b4469a723`.
- The downloaded archive's size and SHA-256 match GitHub's artifact metadata. It contains 17 files with root `index.html`; all four relative entry references resolve. It excludes source, tests, dependencies, private files, source maps and unsafe archive paths.
- itch.io upload **19404836** uses that byte-identical ZIP, displayed as **Recoil Foundry 3.2.0 — Pressure Shift**. The transport filename remains `recoil-foundry-v2.98.0-site.zip` for replacement continuity. Browser playback was enabled and the editor saved; the public iframe serves the new upload. Store screenshots/copy were retained and no new announcement was posted.

On public GitHub Pages, About and the report preview show 3.2.0. The existing Room 2 save, one discovery and zero Practice victories/blueprints/records remain intact. The Gallery test starts at `TEST · OT 06`, renders its authored geometry and valves, and pauses through normal input. Warning/error logs are empty.

On public itch.io, About shows 3.2.0 in iframe upload 19404836. Continue Daily remains available and the existing Room 1 save and zero discoveries/Practice victories/blueprints/records remain intact. Warning/error logs are empty. Both hosts were checked through the embedded browser; these checks do not replace the retained physical-hardware and independent-player limitations.
