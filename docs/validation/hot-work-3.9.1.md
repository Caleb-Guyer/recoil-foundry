# Hot Work 3.9.1 validation

## Scope

Adds one commendation, two cosmetic rewards and an original maintenance record. No balance, world generation, save-format or permanent progression gates change. In-progress barricade evidence is transient because Continue restarts an unfinished encounter; the actual award persists immediately through the existing commendation store.

## Targeted checks

The focused command passes **101 tests**, including nine new Hot Work checks and the existing commendation, Welder, props, progress, logbook and Melt-through suites:

`node --experimental-strip-types --test tests/hot-work.test.ts tests/commendations.test.ts tests/welder.test.ts tests/props.test.ts tests/progress.test.ts tests/logbook.test.ts tests/melt-through.test.ts`

- Both spawned walls must be destroyed in the same deployment, followed by the credited Welder victory. Duplicate hits cannot count twice. A later deployment retains a previously completed pair for the same enemy.
- Partial pairs from separate deployments, cancelled warnings, expired walls, cleanup, train removal, hostile/allied fire and enemy impacts cannot qualify.
- Death, room reload, Continue, uncredited kills, Practice, tests and Workshop cannot carry partial progress into an award.
- Real projectile sweeps, beam damage, steel-ball impacts and player shell blasts can break qualifying walls. Player-triggered canister blasts count; enemy-triggered blasts do not. Player ability damage carries separate attribution without granting the Auditor case's direct-fire trigger.
- Both appearance selections require Hot Work, independently equip, survive progress backup/restore and reload, and expose their report only when earned or in the isolated preview.

Expanded regressions (including Demolition, Arc Coil, Grindshot, salvage evolutions and release packaging) pass **184 tests**, with no failures or skips. The production TypeScript/Vite build passes; the existing large-chunk warning remains.

Local in-app browser inspection at 1280 × 720 confirms the Hot Work objective, dual reward label and full maintenance report fit the logbook. Both new selections appear in Workshop → Appearance, independently select, and display the raised visor, jacket stitching and recessed gun vents without clipping. The preview explicitly identifies its selections as temporary.

Public deployment checks are recorded below when complete. Existing physical-device/browser support limits remain in [browser support](../browser-support.md); automated tests are not new physical-device evidence.
