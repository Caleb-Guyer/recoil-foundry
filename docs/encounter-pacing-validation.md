# Encounter pacing validation — 4.4.0

The simulations use the real fixed-step Game with ordinary movement, jump, aim, fire and objective inputs. Health, enemy AI, damage, physics and room geometry are not overridden. Campaign rewards come from actual offers. Job previews carry the existing stage-appropriate preset upgrades and do not write profile progress.

## Progression samples

| Starting gun | First zone, `starting-guns-2` | Health on entering zone two | Twenty-room Campaign, `starting-guns-1` | Final health |
| ------------ | ----------------------------: | --------------------------: | --------------------------------------: | -----------: |
| Pistol       |                    73 seconds |                         100 |                             485 seconds |           79 |
| Shotgun      |                   102 seconds |                          82 |                             514 seconds |           79 |
| Nailgun      |                    59 seconds |                          94 |                             451 seconds |           79 |

Full runs include real Factory events, four job choices, earned upgrades, five boss arenas and extraction. The first-zone probes include the first boss and four earned rewards. All eleven jobs completed and exited with every starting gun: 33 successful scenarios, 6.8–36.9 seconds, with 49–100 remaining health. Evacuations require both switches and boarding before forty seconds; every defense success requires the full eighteen-second hold after activation.

These are scripted pilot samples, not player win rates. Exploratory whole-run stress attempts during tuning on `starting-guns-2` lost in later zones with each gun. The prior schedule also lost with shotgun and nailgun on that seed. The committed progression checks cover all guns through the opening zone and the complete first seed; they do not assume every seed and reward selection produces a win. Human feedback and broader seed/build samples remain useful for further balance changes.

## Regression checks

- Forty seeded schedules verify alternating ordinary fights, boss positions and post-boss breathers. Six hundred rooms preserve authored enemy hull anchors and rosters, special introductions and coordinated wave membership.
- Actual attack admission checks cover overlapping crossfire, opposing pincers, heavy attacks, queue fairness, removed enemies, objective targets behind cover, and already-visible warnings.
- Door checks cover the full entry warning, live enemy caps, blocked occupancy, pause and hitstop. Boss recovery checks use every native gun's firing cycle without changing gun statistics.
- Floodgate retains its authored schedule. The Campaign pilot reads rising water, climbs actual stairs and shoots exposed relief valves through ordinary inputs. Current Freight and Power campaigns and all four Uprising finales have complete Campaign coverage. The older fixed-offer weapon battery retains its original event-free encounter course.
- Job checks cover accidental combat jumps, patrol-first activation, and deliberate exits after recoil. Save/history checks preserve encounter revisions and reject malformed or Daily revisions. Isolated previews never record Campaign progress.
- Browser checks inspect the clean first room, the generator's patrol status cue and the release presentation through the production renderer. The TypeScript/static production build is checked separately.

The complete regular regression suite passed all 2,385 tests, and the production build passed TypeScript and Vite checks. Reproduce focused coverage with `node --experimental-strip-types --test tests/encounter-pacing.test.ts tests/encounter-balance.test.ts tests/starting-guns-balance.test.ts`. Use `npm run test:ci` for the complete regular regression suite and `npm run build` for the production bundle. The existing eight maximal-build groups also run before Pages deployment.
