# Factory Uprising production pass

Verified on 3 October 2026 for version 4.0.0.

## Campaign verification

Fresh Campaigns opt into Factory Uprising. Four choices lead into eleven authored jobs across the existing twenty rooms, with eight routes initially available and three unlocked through Campaign contracts. Railworks introduces moving railcars; Foundry Core introduces powered platforms. The later jobs revisit Reclamation and Rooftops. Completed objectives affect later pursuit, environmental machinery, boss cover and the final defense.

- All **eleven jobs** completed using ordinary movement, jump, aim and fire inputs, with normal enemy behavior and player health.
- All **four final responses** completed full twenty-room campaigns and extraction using actual upgrade choices. The Command overload campaign deliberately skipped a crew objective, exercising the same abandon action available in Pause. Failed evacuation jobs did not block progression.
- Two additional full campaigns completed under **Freight surge and Power failure**, using the existing Factory regression seeds, actual upgrade choices and normal inputs. Faction conflict remained active in the four finale campaigns.
- **120 fresh campaign profiles** retained their Factory condition, moved its introductions to rooms 1 and 5, and reserved mission rooms from courier, Auditor and story plans. Existing Factory versions retain their original encounter timing.
- Every emitted checkpoint in the four finale campaigns passed the normal save validator. Route selection, mandatory choice before an upgrade, objective completion, skipping jobs and Continue were checked separately.

## Objective and compatibility checks

Recovery requires player damage to expose the case and proximity to collect it. Sabotage requires player damage to both relays, settles powered platforms with safe clearance and preserves the completed result on Continue. Defense requires activation, ignores friendly fire, warns its bounded reinforcements, freezes while paused and can fail without trapping the player. Evacuation can leave live enemies behind without awarding false kills. Resolved or abandoned jobs remove their objective props so they cannot block firing lanes.

Campaign contracts snapshot access at the start of a run. Their records, independent Logbook badges, backup migration, recap snapshots and saved route plans were checked. Older backups acquire empty Campaign records; older saves retain their original rooms. Daily, Practice, Workshop and isolated previews retain their existing progression rules. Overtime and the alternate Shutdown ending do not award an Uprising finale clearance.

The final automated regression run passed **2,256 / 2,256 tests** using all test files except `tests/max-combos.test.ts`. This includes the thirty new Uprising tests and the existing combat, campaign, Factory, save, progress, replay, archive, input, encounter and packaging checks. TypeScript checking and the production Vite build passed.

The exhaustive Workshop check was not repeated locally in this pass. It previously passed all 9,216 complete builds; this update does not alter gun calculations and Workshop does not opt into Uprising. The normal GitHub Pages workflow runs the complete `npm test` suite, including that exhaustive check, before deployment.

## Browser verification

The game was inspected through its actual browser controls on an isolated localhost profile. Keyboard route selection led to the ordinary upgrade choice and the selected mission. Railworks and Foundry Core showed their distinct scenery, machinery, objective props and instructions. Pause exposed the route map and current-job skip action; skipping removed that action and preserved Resume. The Logbook displayed all three Campaign contracts with their progress, requirements and route rewards.

A fresh normal Campaign displayed its Factory condition, saved its checkpoint, survived page reload and exposed the same Factory route map through Continue. No browser console errors or warnings were reported.

Route cards and maps were checked at **1280 × 900** and **320 × 900**. The narrow view had no horizontal document or dialog overflow; cards stayed readable in a single column and the map used two columns. The temporary viewport override was reset after verification.

The existing large JavaScript chunk warning remains. Windows desktop with keyboard and mouse remains the supported target; responsive browser checks do not establish physical controller or touch-device support.
