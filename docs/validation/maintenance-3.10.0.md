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

Production TypeScript/Vite build passes. The pre-existing large-bundle warning remains. Local browser checks and final publication evidence are recorded below when complete; no fresh physical-device or independent player claims are made.

## Publication

Pending the complete Pages test/build/deploy workflow, tagged archive verification and public-host smoke checks.
