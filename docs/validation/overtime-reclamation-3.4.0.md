# Scrap Circuit — 3.4.0

## Scope and compatibility

Six authored layouts replace Overtime stages 12–15 for new revision-4 entries, covering both third-room routes and both existing bosses. Layouts mirror with the seed. Earlier Overtime remixes are retained; later Rooftops, the ordinary campaign, Daily and earned Practice retain their rules. Existing unversioned/revision-1/2/3 checkpoints keep their original generation. The Practice ruleset remains 1.

Transport is an opt-in extension of existing CargoSystem, preserving its real collision, bounded impact damage, breakability, weapon traces and portal restrictions. Two or three finite loads travel at 68 world units/second after staggered delays. A swept convex-hull query checks terrain, rotated props, other loads, the player and enemies before each translation. An obstruction stops the load and begins its full 1.15-second release warning; no body is forcibly displaced. Endpoint and shot releases use that same warning. After landing, loads remain physical breakable cover. Clearance disables remaining machinery, and pause/hitstop freeze simulation time.

Only the yellow 22×22 latch is shootable on a transport rig; the decorative suspension cable is not a target. Existing stationary cargo retains its original cable behavior. There are no new dependencies, controls or HUD elements. Warning sound has reserved voices and ducks music/effects for the full tell. Reduced effects keeps static dust and landing marks.

## Automated checks

All 230 final focused checks passed across Reclamation, Cargo, Torch, props/enemy collisions, every Overtime area and music. TypeScript and the final production build passed, with the existing large-chunk advisory. The full local suite passed 1,963 checks before the final warning-audio/visual refinements and two extra regression checks. The final commit passed all 1,965 tests in Pages CI: zero failures, zero skips; duration 314,917.553 ms.

Eleven new Reclamation checks cover 24 seeds × 20 stages, detached generation, all six layouts and both mirrors, initial hull/rail/entrance clearance, finite machinery, old/new saves, strict preset parsing, progress isolation, moving latches, real ordinary/hostile/Ray/Torch fire, cover occlusion, full warnings, fixed/rotated/dynamic blockers, pause/hitstop, clearance, physical falling/impact accounting, breakability and finite squads. Actual reward transitions carry revision 4 from Cooling through both Reclamation routes into Rooftops. Every layout passes base-jump traversal both ways after loads land or break (48 cases).

The existing Cargo checks additionally cover every boss's armor, direct player drops, canister chains, portals, wall collision, death/retry/Continue and resting-contact safety. The first new generation test counted preserved boss IDs rather than authored plans; it was corrected to count plan names because the same boss can retain different original arena IDs. A test-only Ray helper was corrected to use the existing `fire()` API. Neither required production behavior changes.

## Combat probes

Twelve normal-health, legal-preset probes used the existing dodge pilot and ordinary movement/aim/fire, with a six-second cover-stall reposition attempt. Eleven cleared, one capped at 90 seconds, none died. Clears took 9.30–39.82 seconds at 14–100 HP. Ordinary rooms reached at most eleven concurrent enemies; boss rooms had four including finite supports. Raw results: `.release-assets/overtime-reclamation-probe-reposition.json`.

Mirrored Service capped with one shooter remaining and 58 HP. A follow-up pilot choosing an unobstructed ascent corridor after six seconds died at 40.20 seconds with that shooter left. A separate earlier-navigation probe entered an open ascent lane after two seconds, fired downward to climb, and cleared in 19.27 seconds with 100 HP. Both earlier outcomes remain recorded in `.release-assets/overtime-reclamation-navigation.json` and the successful result in `.release-assets/overtime-reclamation-navigation-early.json`. No production geometry, health, damage or simulation state was changed for these follow-ups.

These probes show clears are possible through ordinary inputs. They do not establish human difficulty, enjoyment, all-build viability or a player win rate. Independent human balance testing remains unavailable.

## Browser and publication

All six room types were visually inspected through the local production build in the embedded browser, including mirrored Service and Reclaimer. Rails, latches, stacked scrap art and the compact HUD were legible. Actual jump/fire, pause, death and retry inputs were exercised. The final build showed supported rails and visible reduced-effects landing marks and static dust during an automatic release; Reduced effects was restored to Off afterward. The report preview confirmed 3.4.0 / Preset test / Overtime / OT-SCRAP-0 / room 13, without submitting a report. Browser warnings/errors were empty. Local Progress remained no saved run and zero discoveries/victories/blueprints/records. Public-host and artifact evidence follows.

## Publication evidence

Runtime commit: `ae84228ea6f2f554bf5d027272179156b8ca6c57`. Immutable tag: `v3.4.0`.

- [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36281400171) passed all 1,965 tests, then built and deployed successfully. Tests completed at 00:10:16 UTC on 27 September 2026 (26 September locally); deployment completed at 00:10:31 UTC.
- The [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36281734114) succeeded for the same commit. The [official ZIP](https://github.com/Caleb-Guyer/recoil-foundry/releases/download/v3.4.0/recoil-foundry-v3.4.0-site.zip) was published at 00:11:35 UTC: **9,766,087 bytes**, SHA-256 `53a3a495912caa1017a75a660bd2078506ec2c12abce1cbd15bcd38840f46bb8`.
- Download size and checksum match the GitHub asset metadata. All 17 files passed archive checks: root index.html, four resolved relative entry references, and no source/tests/dependencies/private files/maps or unsafe paths. The itch.io replacement copy has an identical checksum.

Public Pages About shows 3.4.0. The existing Room 2 save, one discovery and zero Practice victories/blueprints/records remain intact. The published Sorting preset starts at TEST · OT · 13, displays the rail loads and pauses normally. Main game and preset warning/error logs are empty. Proof image: `../scrap-circuit-3.4.0.png` outside the repository.

itch.io upload **19419406** contains the same verified ZIP, displayed as **Recoil Foundry 3.4.0 — Scrap Circuit**. Its transport filename remains `recoil-foundry-v2.98.0-site.zip` for replacement continuity. Browser playback was enabled and the editor confirmed Saved. The public iframe serves upload 19419406; About shows 3.4.0. Continue Daily remains available, with the same Room 1 save and zero discoveries/victories/blueprints/records. Warning/error logs are empty. Store copy/screenshots were retained; no announcement or issue report was submitted. Both hosts were checked through the embedded browser; retained human/hardware limitations still apply.
