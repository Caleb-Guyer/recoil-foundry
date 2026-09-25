# Dead Signal balance and release-candidate audit

25 September 2026. Prepared on `feature/dead-signal` for **3.0.0-rc.1**. Public Pages and itch.io remain **2.98.1**.

## Changes justified by the audit

The original stationary matrix found 39 damage-free cases among 144 probes. Hovering just beneath shelves could make the escape validator cancel aimed volleys; in the central pockets, all fixed emitters also fired into cover. Ground volleys passed below the hovering player.

Annex revision 5 fixes both causes. Escape validation includes falling after releasing recoil and checks the player's hull against the shot lanes. When every usable fixed emitter is obstructed but the controller has a clear shot, the controller braces and takes over that existing pattern. An amber source ring, cable, junction and locked dashed lanes identify the response. The original fixed mount remains visible. This does not add a third simultaneous pattern, shorten the 1.4-second warning, increase boss health/damage, or permit rounds through cover.

The junction retains its shared 7.5-second lockout and cancels one pattern. The ordinary-physics regression releases recoil after lock and falls safely out of the controller volley in both mirrors. Saved Annex revisions 1–4 and Daily 78–83 keep their previous behavior; fresh runs, Practice, test links and Daily 84 use revision 5.

Two test-pilot navigation fixes are separate from game tuning: stop firing when recoil holds the pilot above a covered Annex target, and back out after missing a landing on the regional entrance steps. The latter is restricted to the regional fork so it does not change freight-route navigation.

## Reproduce and inspect

Run these from the repository root:

```sh
npm run balance:dead-signal -- routes
npm run balance:dead-signal -- cheese
npm run balance:dead-signal -- boss-builds
npm run balance:dead-signal -- campaigns
npm run balance:dead-signal -- campaigns-extra
npm run balance:dead-signal -- overtime
npm run balance:dead-signal -- restarts
npm test
npm run build
```

The audit writes full JSON to `.release-assets/dead-signal-<suite>.json`. Committed [case results](../validation/dead-signal-rc/cases.csv) and [per-room results](../validation/dead-signal-rc/rooms.csv) include builds, seeds, mirrors, health, damage, healing, duration, entity peaks and failures. Stage numbers in the data are zero-based. Healing measurements cover ticks inside the room; reward healing between rooms is visible in the next room's starting health.

Local preview while Vite is running on this laptop:

- [Choose the actual regional fork](http://127.0.0.1:4186/?test=annex-route&room=fork).
- [Switchboard, direct gun](http://127.0.0.1:4186/?test=switchboard&build=gun).
- [Switchboard, beam](http://127.0.0.1:4186/?test=switchboard&build=beam).
- [Switchboard, Countershot](http://127.0.0.1:4186/?test=switchboard&build=counter).
- [Switchboard, portals, mirrored](http://127.0.0.1:4186/?test=switchboard&build=portal&mirror=1).

Presets are isolated from normal progress. They are direct test links and reveal the encounter.

## Paired regional continuations

Twelve seeds each start room 9 with a legal eight-upgrade checkpoint and 100 HP, then play the next four rooms, choose real rewards and use real exits. Each seed/build is also run through Cooling. Three gun forms (Pierce, beam, shell), both Subversion branches and both room mirrors are represented. These are checkpoint continuations, not twelve fresh campaign completions.

| Route | Clear / attempts | Median successful time | Median damage, all attempts | Peak allies / shots |
| --- | --- | --- | --- | --- |
| Annex | 9 / 12 | 100.7 s | 98 | 2 / 27 |
| Cooling | 10 / 12 | 96.0 s | 38 | 2 / 22 |

All 24 attempts end in a route completion or a combat death; none times out. Annex remains more costly in health in this sample. Its traversal and duration are comparable, but these pilots cannot determine whether humans find the additional pressure worthwhile. No broad damage or healing changes were made to force identical results.

## Boss and abuse probes

- **144 stationary probes:** four presets × two mirrors × eighteen locations (corners, ceiling, above/below each major shelf and its floor lane). These deliberately grant perfect aim and impossible free hovering. After the fix, 126 die and 18 kill the boss after taking at least 52 damage. None is damage-free, compared with 39 before the fix. Surviving by racing the boss's damage is different from indefinite immunity; this is not a player win-rate estimate.
- **40 moving build probes:** five families (direct gun, Burst beam, shell, Countershot/Breach, portals), both Subversion branches, both mirrors, and modest/maximal variants. Modest variants win 13/20; maximal variants win 20/20. All end in a win or death. The seven modest losses are four Burst-beam and three shell cases. Separate standard boss presets complete with all five gun presets in both mirrors. The fully completed upgrade stacks are deliberately beyond the room-12 upgrade budget and are stress fixtures, not campaign balance evidence.
- **Actual junction spam:** perfect stationary firing hits charging junctions but still takes damage and permits boss volleys. Shared lockout cannot be bypassed by the next pattern.
- **Portals:** normal player and projectile transit, blocked exits, finite repeated travel and damage budgets remain covered. Switchboard exceeds the existing portal hull budget and cannot be ferried through either floor or wall portals. Its shots can travel through them.
- **Allies:** a normal Switchboard room has no carryover allies or convertible adds. Spoof supplies bounded feedback. Even a stress fixture that injects two temporary bodyguards loses them; no permanent shield or recursive reboot appears. Ordinary route probes never exceed two allies.

New regressions cover all five shelf pockets in both mirrors, warning duration and locked aim, bracing, interrupted mobile attacks, phase-two limits, ordinary falling escapes, old-save revision retention and new Practice/Daily identity. Existing tests cover physical projectile collision, pause/hitstop, cleanup, imports, pending rewards, focus/fullscreen state, reward input, legacy Daily snapshots and the 2.98.1 collision/Blackout regressions.

## Fresh campaigns and continuation

Fresh-run results and failures are retained in the CSV evidence. The normal pilot chooses from actual offered cards, preferring sustain/direct output, and accepts the first legal Reforge offer if it enters the bench. Daily runs take their single forced reward. No run receives extra health, upgrades, damage or disabled enemies.

Fifty fresh attempts (36 normal, 14 Daily) produce **13 full extractions**, 28 combat deaths and nine pilot timeouts. Eleven normal runs and two Daily runs finish. The successful normal runs include eight Annex and three Cooling campaigns. All fifty attempts are retained; the table lists successful runs for reproduction, not an estimated human success rate.

| Seed | Region | Final HP | Seconds to extraction |
| --- | --- | --- | --- |
| `path-run-67` | Cooling | 100 | 512 |
| `DEAD-SIGNAL-FULL-0` | Annex | 100 | 577 |
| `DEAD-SIGNAL-FULL-1` | Annex | 100 | 559 |
| `DEAD-SIGNAL-FULL-5` | Cooling | 25 | 760 |
| `DEAD-SIGNAL-FULL-10` | Annex | 97 | 402 |
| `DEAD-SIGNAL-FULL-13` | Annex | 64 | 468 |
| `DEAD-SIGNAL-FULL-15` | Cooling | 81 | 549 |
| `DEAD-SIGNAL-FULL-18` | Annex | 78 | 504 |
| `DEAD-SIGNAL-FULL-23` | Annex | 80 | 496 |
| `DEAD-SIGNAL-FULL-25` | Annex | 100 | 613 |
| `DEAD-SIGNAL-FULL-34` | Annex | 50 | 577 |
| `RF-D84-2026-09-16` | Annex | 66 | 474 |
| `RF-D84-2026-09-23` | Annex | 76 | 513 |

The nine unfinished pilot cases are `DEAD-SIGNAL-FULL-2/12/16/19/21/26/33` and Daily 84 on 19/20 September. They stop in existing areas while approaching objectives or exits. No Annex combat room times out. These cases remain limits of this audit; their traversal is not marked passed.

The successful Annex seed `DEAD-SIGNAL-FULL-0` is replayed separately for Overtime. It defeats the final boss, traverses extraction, climbs the actual upper steps, rides the New Game+ elevator and clears the first Overtime room at 100 HP with its nineteen earned upgrades. This validates a continuation, not a complete second lap. A longer attempt cleared that room but hit the pilot's exit-navigation limit; it is not represented as an Overtime completion.

The audit does not treat a pilot timeout as a game progression defect without a reproducible player-input failure. Unresolved navigation cases remain visible in the results instead of being counted as wins.

## Browser and package verification

The actual game renderer was inspected in the in-app browser at the covered-position warning, including Reduced effects and a muted harness. Source rings, junction shapes and dashed locked lanes remain visible without audio. Automated input playback is not a human playtest.

The full regression suite passes **1,885/1,885**, including 30 new Switchboard regressions. The production build passes with the existing Vite large-chunk advisory. The subsequent About copy correction removes the outdated five-theme count; it does not change gameplay.

The same available in-app browser measured 1,200 simulation/render samples after 120 warmup steps, using a 1280×720 canvas at device-pixel ratio 1.5. The matched case uses the existing phase-three boss arsenal on both versions. A separate maximal Subversion/Switchboard fixture reaches the actual 180-shot and 220-particle caps.

| Recording | Work p50 / p95 / p99 | Maximum work | Frame interval p95 / maximum | Peak shots / particles |
| --- | --- | --- | --- | --- |
| 2.98.1, existing boss | 0.4 / 0.6 / 0.9 ms | 2.3 ms | 16.8 / 21.0 ms | 43 / 174 |
| 3.0.0-rc.1, same boss | 0.5 / 0.7 / 1.0 ms | 2.9 ms | 16.8 / 21.1 ms | 43 / 174 |
| 3.0.0-rc.1, maximal Annex build | 1.2 / 2.3 / 2.8 ms | 3.4 ms | 20.6 / 24.7 ms | 180 / 220 |

Reproduce with the development-only [browser harness](../../scripts/dead-signal-browser.html), served by Vite. `?case=annex` selects the maximal fixture; `?case=pocket&hold=1` pauses at the covered-position warning. The baseline uses the same harness against the isolated 2.98.1 checkout, with the default existing-boss case. Work time measures synchronous simulation and draw submission, not GPU completion. This bounded check does not establish long-session behavior or low-end hardware support.

Twenty repeated twenty-second maximal-build runs on the same `Game` instance reset to exactly 13 bodies, no constraints/contact pairs/shots/particles, one enemy and two props. Every sampled world remains finite; peaks stay at 180 shots and 220 particles. [Restart measurements](../validation/dead-signal-rc/restarts.json) record all twenty cycles.

The extracted candidate ZIP starts successfully and shows **3.0.0-rc.1** in About. Its [release notes](../releases/3.0.0-rc.1.md), checksum and promotion/rollback procedure are recorded in [release operations](../release-operations.md). Physical low-end testing and independent human difficulty judgments remain unavailable. Public-host acceptance is a separate promotion step; this branch does not publish to either public host.
