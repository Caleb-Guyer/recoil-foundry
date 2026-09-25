# Beam balance investigation — 3.0.2

25 September 2026. Follow-up to the modest Burst-beam losses in the [3.0.1 audit](dead-signal-3.0.1.md). **Completed as an audit/tooling correction. No weapon stats, boss rules, saves, Daily identity, upgrade descriptions or live game files changed.** The stable game remains 3.0.2.

## Finding

The old eight losses reproduce exactly on 3.0.2, but the pilot is an unreliable basis for a beam damage buff. It predicts ordinary bullet recoil for continuous, pulsed and charged beams. The junction policy then changes aim after choosing a dodge, so its predicted recoil points in a different direction from the actual input. It also predicts full-height jumps while sending `jumpHeld: false`; the real game correctly cuts those jumps short.

Charge Lens needs deliberate release after charging; the old pilot cannot reliably perform that cycle. Prism needs either ray aligned with a single target; aiming between its rays is a spread attack. These are existing weapon mechanics, not defects to bypass or remove.

The corrected audit passes its intended aim into movement prediction, forecasts the actual beam cadence, releases charged lances, aligns Prism's first ray, and holds the jump it is predicting. It still uses approximate terrain trajectories and a skilled scripted policy. It never grants health, removes enemies, teleports, bypasses collisions or changes damage during a fight.

**Decision: no gameplay buff or boss nerf is justified by this investigation.** All tested beam branches can defeat the boss with normal inputs. This does not establish human difficulty, equal performance or universal viability of every possible build.

## Preserved results

- [Original reproduction](beam-balance-3.0.2/original.csv): 24 fights using the existing post-launch script. Modest Burst beams lose all eight, matching the archived output. Bullet and shell outcomes also match. The original script and default pilot behavior remain available for comparison.
- [Control probes](beam-balance-3.0.2/controls-tap.csv): 56 fights, seven weapon families × two mirrors × two aiming policies × original/committed trigger policies. Both retain the original short-jump input and bullet recoil prediction. Holding Burst improves it from 0/4 to 2/4; deliberate charge/release improves Lens from four timeouts to 2/4 wins. Other results vary. A blanket instruction to hold fire is not a universal solution.
- [Beam-aware, short-jump matrix](beam-balance-3.0.2/matrix-tap.csv): 112 fights retaining the mismatched jump input. Modest Burst wins 8/8, but full Burst wins only 2/8. These failures prompted inspection of the jump mismatch; they are retained, not discarded as outliers.
- [Final, matching-input matrix](beam-balance-3.0.2/matrix-held.csv): the same 112 build/tactic combinations, with held jumps matching the trajectory forecast. All finish in victory, with no deaths or timeouts. Eight outcomes per family/tier: two Subversion forks × two mirrors × body/junction targeting.
- [Full Burst hold check](beam-balance-3.0.2/burst-hold-held.csv): 16 additional fights using full Burst or Pulse Chamber builds, both Subversion forks, both mirrors and both aiming policies. Correctly forecast recoil plus held jumps/trigger also finishes 16/16. This rules out a requirement to exploit mid-volley cancellations in these cases.

An exploratory second seed produced identical outcome, duration, health and remaining boss health in all 112 corresponding fights because this preset fixes the relevant encounter state. It is not counted as independent evidence. No participants or human win rates are represented by these rows.

| Weapon                        | Modest wins | 11-upgrade wins | Modest mean fight time | 11-upgrade mean fight time |
| ----------------------------- | ----------- | --------------- | ---------------------- | -------------------------- |
| Direct rounds                 | 8/8         | 8/8             | 38.5s                  | 43.7s                      |
| Shell + Aftershock            | 8/8         | 8/8             | 37.2s                  | 25.8s                      |
| Continuous + Thermal Runaway  | 8/8         | 8/8             | 36.0s                  | 38.4s                      |
| Burst beam                    | 8/8         | 8/8             | 50.6s                  | 39.0s                      |
| Pulse Chamber                 | 8/8         | 8/8             | 50.9s                  | 42.3s                      |
| Charge Lens + Thermal Runaway | 8/8         | 8/8             | 38.4s                  | 30.1s                      |
| Prism Array + Thermal Runaway | 8/8         | 8/8             | 42.6s                  | 42.3s                      |

Modest builds have nine upgrades, or ten for Pulse Chamber/Lens/Prism because of their extra prerequisites/support. Every build includes `magnum`, `rapid`, `light`, `leech` and one three-card Subversion fork. Full builds add `kick` and then `airshot` as space permits, stopping at eleven upgrades. Thus the comparison tests legal usable builds, not identical investment or a controlled estimate of each upgrade's individual value. Exact IDs and all health/damage/time outcomes are in the CSVs. All builds are validated against the real upgrade rules.

The final pilot reads visible attack plans and uses precise target coordinates with decisions every six simulation frames. Many fights are hitless. That demonstrates a technical route to victory; it is not proof that human players will find the boss fair, easy or difficult. Longer times or a slower full build alone are insufficient grounds for changing stats, because recoil changes the pilot's movement and available firing lanes.

## Upgrade payoff and interaction checks

The existing mechanical tests verify continuous output and rate upgrades; Burst's three concentrated pulses and recovery; Pulse Chamber's stronger final pulse and extra penetration; charge duration, release and recovery; Prism's separate 60%-power rays and combined output when both connect; Thermal Runaway's tracking bonus; and 30/60/120 Hz damage integration. Cover, shields, armor, exposed boss recovery, junction interruptions, shared proc/deflection limits, and Subversion/Daily compatibility remain covered. No dropped beam damage or inert branch effect was reproduced.

The new test-only recoil forecaster is opt-in, so prior default-policy experiments remain reproducible. Six new checks compare its impulses with actual `TorchSystem.beforeStep` output over holds, releases, recovery, grounded/airborne changes and landing charges, including restarting the forecast mid-cycle. A seventh check verifies the real distinction between a held and released jump. The forecaster covers the audited basic beam branches; advanced mobility/fusion effects and complete Matter trajectories are outside its scope.

**183 focused tests passed, zero failed/skipped.** No production files changed, so no new build, release tag or deployment is needed. The previous full 1,891-test publication remains the evidence for the unchanged live game.

## Reproduce

From the repository root:

```text
node --experimental-strip-types scripts/dead-signal-postlaunch.ts boss
node --experimental-strip-types scripts/beam-balance-audit.ts controls tap
node --experimental-strip-types scripts/beam-balance-audit.ts matrix tap
node --experimental-strip-types scripts/beam-balance-audit.ts matrix held
node --experimental-strip-types scripts/beam-balance-audit.ts burst-hold held
node --experimental-strip-types --test tests/beam-pilot.test.ts tests/beam-branches.test.ts tests/torch.test.ts tests/switchboard.test.ts tests/switchboard-balance.test.ts tests/subversion.test.ts tests/subversion-daily.test.ts
```

New audit outputs are `.release-assets/beam-balance-<suite>-<jumpMode>.json`. Time/contact measurements exclude hitstop; `cancelled` counts queued beam pulses abandoned on a processed trigger release. Control rows with `outcome: playing` are 150-second frame-budget timeouts, not wins. These isolated fights use the Switchboard preset's revision 5; normal revision 6 changes route entry/rewards, not its combat scheduler. This is not a complete campaign or a new human playtest.

Existing save-safe public tests: [Switchboard with a developed continuous beam](https://caleb-guyer.github.io/recoil-foundry/?test=switchboard&build=beam), [Pulse Chamber](https://caleb-guyer.github.io/recoil-foundry/?test=branches&build=pulse), [Charge Lens](https://caleb-guyer.github.io/recoil-foundry/?test=branches&build=charge), [Prism Array](https://caleb-guyer.github.io/recoil-foundry/?test=branches&build=prism). The three branch links use their established ordinary-room presets; they do not reproduce the exact boss audit loadouts.
