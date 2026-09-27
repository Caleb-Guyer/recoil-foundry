# Shifting Shafts 3.11.0 validation

## Scope

New maintenance schedules opt into `revision: 2`. Each shaft shuffles four compatible 320-unit authored sections, containing all three families and one repeat. There are 36 section orders for each of the two shaft kinds. An independent seed stream avoids combat/reward RNG changes. Old schedules without a revision reconstruct the original 3.10.0 room. Daily, Practice, Workshop, Overtime, reward counts and shaft frequency retain their existing rules.

## Automated checks

`tests/maintenance.test.ts` covers all 36 orders for both shaft kinds with starting, enhanced-recoil and Fold builds: **216 ordinary-input climbs**. The pilot only moves, jumps and fires downward; live machinery remains active, with no teleportation, healing or forced completion. The Fold build traversals do not use portals. These checks establish reachability, not human difficulty ratings.

Additional checks cover strict preview parsing and save isolation, old/new save reconstruction, exact pending rewards and one-time payment, press warning duration and independent scheduling, safe landing zones, pause/hitstop, both split-lift branches, bypassing crumble transfers with recoil, crumble recovery with occupied-space protection, and existing detour/portal lifecycle behavior.

Production TypeScript/Vite build passes; the existing large-chunk warning remains. The focused regression suite passes 125 tests with zero failures/skips. Local in-app browser checks confirm the new piston pockets and crumbling lift transfers, minimal HUD, deterministic retry, and a floor-to-upper-landing portal shortcut with the centered camera. Publication receipts will be added after the full CI gate and public checks. Physical-device and independent player limitations remain in [browser support](../browser-support.md).
