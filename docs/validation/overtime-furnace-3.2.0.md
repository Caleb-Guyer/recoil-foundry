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

## Browser checks

The production build was inspected on isolated localhost, with all six room types and mirrored Service tunnel/Kiln. Valve assemblies sit on the floor, warning lanes remain visible over the Furnace scenery, and the compact HUD is unchanged. The mirrored Kiln preset restarts and pauses through real keyboard input. These are agent-controlled embedded-browser checks, not independent human playtests or physical hardware acceptance.
