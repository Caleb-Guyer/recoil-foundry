# Overtime balance 3.7.0 validation

## What changed

Current Overtime (`remix: 5`) uses area-specific reinforcement deadlines of 4.8 / 4.2 / 4.8 / 4.4 / 3.8 seconds and paired entrance spacing of 0.85 / 0.8 / 1 / 0.9 / 1.1 seconds. Clearing the opening still advances the reserve immediately. One non-elite, non-squad pressure unit can trade places with an opening unit; all units retain their authored anchors and properties. Elite reserves and authored squad partnerships stay intact.

Boss reserves become eligible at 7 / 6.5 / 7.5 / 6.5 / 6 seconds or below 78% health. Their first warnings wait for idle/recovery, avoiding the start of support during a committed boss move. Queued pairs then receive a complete 0.75-second warning and at least 1.05 seconds of arrival grace. Already-shown tells never shorten or cancel. This spaces support pressure; it does not promise that independent enemy/hazard attacks can never overlap. Occupancy, relocation, pause and reset behavior remain authoritative. Freight and older Overtime layout revisions retain their original scheduling.

With at least nineteen upgrades, a three-card Overtime reward includes an eligible child/fusion if one remains available and the roll otherwise contains none. Its normal weighted selection still applies within that set. This preserves earned salvage, compatibility, path/branch locks, exclusions and exhaustion. First-lap, Daily, short synthetic builds and full-pool queries keep their existing selection rules. No enemy health, damage, upgrade effects, HUD or save format was changed.

## Reproducible combat diagnostics

`npm run balance:overtime -- rooms|campaign|areas|camp|positions|rewards [output.json]` runs the actual simulation with five legal nineteen-upgrade starting guns: Beam, Precision, Volley, Explosive and Mobility. Isolated later-room fixtures have nineteen plus the current stage's upgrades. These intentionally strong fixtures are diagnostic loadouts, not builds claimed to have been earned from a particular first lap. Campaign/area attempts choose real offered rewards and carry health between rooms. Ordinary inputs drive combat, physics and traversal; no healing, enemy deletion or forced completion is used.

The fixed `OT-BALANCE-0` room matrix samples each area's first room and boss (50 cases). Before the change it produced 36 clears, 12 deaths and 2 ninety-second caps; afterward, 39 clears, 11 deaths and no caps. The sample is small and deterministic; these are bot outcomes, not estimates of human win rate or proof every build is equally strong. The mixed results supported spacing arrivals rather than increasing all enemies' health.

Stationary trigger-holding at the entrance died in all 25 baseline cases and all 25 revised cases. A further 75 revised cases began at free corner, cover or upper-platform anchors and also died. The position suite sets only the initial diagnostic position, then allows normal physics and recoil; it does not pin the player or simulate expert hovering/portal use. It samples one boss variant per area and cannot establish that every camping exploit is impossible.

Ten continuous second-lap attempts (five builds, two seeds) were run before and after. None completed the whole lap: baseline had nine deaths and one cap; revised had seven deaths and three caps. The long-run pilot can stall around elevated cover, especially in Furnace. Twenty-five revised four-room area attempts provided additional carried-health coverage: fifteen completed their segment, seven died, and three hit the five-minute cap. The three completed Rooftops segments also traversed the real departure and reached victory. These limits are retained in the raw evidence rather than reclassified as passes. Independent human full-lap balance acceptance remains unverified.

The reward audit sampled 500 seeds for each of five builds at three stages (7,500 rolls). Every revised roll included an eligible development of the current build. Baseline rates ranged from 49.4% to 100%. Separate regressions cover reroll exclusions, salvage retention, full-pool exhaustiveness, finite exhaustion and valid checkpoint counts.

Raw before/after reports and their SHA-256 manifest are in [overtime-balance-3.7.0](overtime-balance-3.7.0/). Baseline reports were captured with the 3.6.0 runtime plus the diagnostic runner; revised reports use the final encounter/reward behavior. Cosmetic randomness and Matter identifiers reset per case. Older campaign reports omit `startRoom`; those attempts all began at room 1.

## Automated and browser checks

Eight new regression checks cover all 100 legal build/stage combinations, isolated restarts, strict URLs, useful and compatible rewards, preserved formations/anchors, full warning and spawn grace, committed boss attacks, queued support after boss death, and legacy scheduling. Existing Rooftops squad validation now waits through the staggered arrival schedule. Existing freight and first-lap campaign tests caught an early scheduling regression; restricting the new scheduler to current Overtime corrected it. A fusion-frequency regression was corrected by scoping the reward guarantee to established guns.

The 47 focused encounter checks, 27 fusion/reward checks, 31 campaign regressions and TypeScript/production build pass. The final local full suite passed all 1,995 tests with zero failures or skips in 286,024.4326 ms. Public deployment results are recorded below after publication. Vite retains its existing large-chunk advisory.

Local production-browser checks verified the Beam component list, the room-20 Precision preview, its `TEST · OT · 20 / 20` HUD, firing, pause and restart. About reports 3.7.0. Browser warning/error logs were empty. Automated fixtures verify that test runs cannot persist checkpoints or unlock progress; public-profile checks accompany publication. Physical controllers and independent human playtesting were not performed for this update.

## Publication

Pending the final full suite, Pages deployment and verified official archive upload to the existing itch.io game.
