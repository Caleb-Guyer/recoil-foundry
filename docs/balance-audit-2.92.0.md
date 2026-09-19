# Browser balance pass — 2.92.0

19 September 2026. Engineering balance pass against the complete twenty-room campaign. This is automated evidence, not a human playtest or a claim that every build has equal difficulty. Human acceptance remains open in the [release checklist](browser-release-checklist.md).

## Changes

- **Opening reward safety:** until a shared firepower upgrade is owned, the first three normal reward screens contain at least one such option. The other choices remain available. Shared options are Heavy hitter, Hair trigger, Kickback, Airshot, Scattershot, Backblast and Burst fire. A one-card Daily receives this safeguard only on the last reward before its first boss, if necessary. Choices remain deterministic, compatible and subject to reroll exclusions. Later rewards and Overtime retain their existing selection rules.
- **Shaped Charge:** its narrower coverage now buys 30% more blast damage, in addition to its longer cone. Aftershock inherits the stronger payload once. This is a blast bonus, not a 30% bonus to the entire projectile.
- **Cluster Shell:** 125% total blast payload: 65% at the initial impact and 20% in each of three bomblets. Previously the initial impact kept only 40%. A full child-effect budget folds unused child damage back into the parent. Launch strength stays at its original total; echoes and children cannot compound the bonus.
- **Daily ruleset 78** separates changed rewards and damage from earlier challenges.

Boss health, attack tells, armor, room healing, wave deadlines and campaign length were retained. These measurements did not justify weakening the entire campaign. No extra combat UI was added.

## Method

`npm run balance -- <suite>` runs a deterministic input pilot using real health, Matter collisions, enemy AI, damage and weapon behavior. Each case resets physics IDs and cosmetic randomness. Results include deaths and timeouts, not only victories. The script writes JSON under the ignored `balance-results/` directory and accepts an optional output filename and a `BALANCE_FILTER` regular expression.

The campaign pilot was extracted from the existing full-run regression tests so movement logic is shared. The audit does **not** inject reward offers or disable encounters. It selects only offered cards, operates Lockdown terminals through movement and jump input, and carries health between rooms. Existing scripted build tests remain separate.

Pilot corrections made before interpreting balance: Charge Lens waits for its actual full-charge indicator instead of a fixed delay; Rail spike releases the trigger to charge; Stasis releases stored rounds; the full-run pilot reacts to the Kiln's visible warnings. Charge Lens then cleared its final-boss preset in 41.5 seconds with 56 health, so its damage was not increased.

There are important limits:

- The eight boss profiles are legal builds with stage-appropriate numbers of picks, assembled from the eligible pool. They are controlled weapon comparisons, not claims that those exact cards are guaranteed in a run.
- Area-entry cases start with 100 health and a legal preset, then carry health and take real offers through the remaining campaign. Their checkpoint presets omit optional saved event plans. Fresh full campaigns retain those plans and current encounter generation.
- The pilot has imperfect navigation and aim, does not place Fold portals, and does not optimize rerolls or every situational upgrade. Its `precision` policy is a preference list; actual offers may send it down another path. `ordinary` takes the first card. These are decision policies, not skill ratings.
- Boss/branch comparisons stop after 90 seconds of input; maximum-build boss stress cases stop after 60. Campaign cases stop after 180 simulation seconds without leaving a room, or 1,200 seconds overall. Reported simulation time excludes hitstop, so it can be slightly below an input-time cap.
- Maximal builds contain far more than the normal campaign's nineteen upgrades. They test interaction limits, not normal-run difficulty.

## Measured results

All outcomes are retained in [232 case records](balance-2.92.0-cases.csv) and [368 room/escape visit records](balance-2.92.0-rooms.csv). Damage includes lethal crushing/falls; healing is effective health restored after caps, including room rewards. Room duration includes exit traversal. Zero remaining enemies alone is not considered a cleared event.

| Suite                                                              | Cases | Clears / wins | Deaths | Time limits |
| ------------------------------------------------------------------ | ----: | ------------: | -----: | ----------: |
| Eight profiles, five boss stages, three seeds                      |   120 |            95 |     20 |           5 |
| All 27 branch presets, ordinary room and final boss                |    54 |            51 |      0 |           3 |
| Max-build sample covering every local fork and weapon/path pairing |    22 |            20 |      1 |           1 |
| Three policies across four later-area entrances and two seeds      |    24 |            15 |      8 |           1 |
| Nine fresh campaigns and three Daily dates                         |    12 |             2 |      8 |           2 |

The boss matrix includes Loader, Crane, Press, Kiln, Condenser, Turbine, Sorter, the Reclaimer variant and Interceptor. Every profile cleared multiple boss stages. The new natural-reward regression runs finish a normal campaign in 647.3 simulation seconds with 72 health and the 20 September Daily in 725.5 seconds with 70 health. These are bot timings, not a proposed human run-duration target. One successful route includes Turf War; the other includes Blackout. Lockdown is also exercised in the measured campaigns, including physical terminal access.

For completed ordinary rooms, median time including traversal was 15.5 seconds in the Docks, 23.5 in Furnace, 18.6 in Cooling, 17.9 in Reclamation and 22.5 on the Rooftops. Peak simultaneous hostiles were 5, 14, 10, 10 and 12 respectively; Furnace's 14 is the authored Turf War roster. These samples did not establish a universal area-wide spike or justify removing enemies. Room repetition and perceived pacing need player feedback.

The live boss stress sample stayed within 180 projectiles and 220 particles. Separate regression tests fire **all 1,024 maximal combinations** and check finite physics, bounded secondary effects, legal prerequisites and cleanup. This is simulation stability coverage, not a low-end-hardware frame-rate measurement.

## Regression coverage

The full suite and production build were run for this pass. New regressions cover the opening safety rule in actual reward flow, Daily's single card, deterministic rerolls, legal paths, direct armored-boss blast damage, bounded Cluster payload at saturation, and complete normal/Daily victories using actual offers with current encounters enabled.

Existing checks cover:

- Boss overhead, corner and cover camps; Countershot/Breach spam and reflected damage limits.
- Portal placement budgets, shots and bodies crossing portals, and cover collision.
- Trains and moving machinery interacting with players, crates, steel balls and explosions.
- Fifteen scripted full combat runs, including an Overtime run, plus detour progression/traversal.
- Optional event combat and objectives, the secret chamber's three combat waves, and reachable controls.
- Auditor arrival spacing, full tells, pursuit persistence, retreat, encounter exclusions, extra rewards and ending/Overtime transitions.

## Closeout

The [follow-up report](balance-closeout-2.92.0.md) resolves the engineering follow-ups, records longer demolition fights and Recall positioning, and adds low-health optional-route measurements and a full secret-finale input regression. It also defines difficulty and duration targets. Item 1 has been removed from the active checklist. Human balance acceptance is consolidated under section 7, and hardware/readability checks remain under sections 5–7; neither is claimed as automated proof.

## Reproduce and play

```sh
npm test
npm run build
npm run balance -- bosses
npm run balance -- branches
npm run balance -- max
npm run balance -- campaign
npm run balance -- areas
```

[Play the updated campaign](https://caleb-guyer.github.io/recoil-foundry/?v=2.92.0), [test Shaped Charge](https://caleb-guyer.github.io/recoil-foundry/?test=branches&build=shaped&room=boss&v=2.92.0), or [test Cluster Shell](https://caleb-guyer.github.io/recoil-foundry/?test=branches&build=cluster&room=boss&v=2.92.0). The branch links use isolated presets and do not grant campaign progress. Press **R** to retry the preset.
