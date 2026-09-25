# Dead Signal 3.0.1 technical audit

25 September 2026. This is a reproducible technical audit, not independent first-time-player feedback. It supplements the [3.0 audit](../plans/dead-signal-balance.md); it does not establish human difficulty or low-end performance.

## Changes supported by the audit

- **Door threshold:** in revision 5, an idle grounded player at x=1871 entered Cooling despite its visible doorway starting at x=1894. Fresh normal runs now require x>1906, inside that opening. Probes at x=1850, 1871, 1890 and 1900 stay at the fork; x=1910 and 1930 enter Cooling. Older saved revisions and the single Daily destination retain their previous trigger. Existing ordinary-input traversal checks still cover both physical exits.
- **Discovery:** after the fight, static amber strips mark the two Annex steps and a small arrow marks the climb. No extra combat text, flashing hint or HUD element. Browser inspection at 1280×720 confirmed both destination signs, clear step lights and no warning/error logs.
- **Route identity:** fresh normal runs offer one optional legal Subversion card at the Annex entrance and after its first room. Players can decline it or reroll. Existing Subversion cards are retained, opposing branches stay locked, exhausted branches add nothing, and boss salvage is preserved. There are still three offers and one selected upgrade per normal room reward.

These changes use normal Annex revision **6**. Continue retains saved revisions and pending offers. Daily 84 explicitly retains revision 5; no Daily seed, forced card, encounter, physics rule or record identity changes. Enemy health/attacks, weapon output and ally caps are unchanged.

## Combat probes

Run `node --experimental-strip-types scripts/dead-signal-postlaunch.ts boss`, then `boss-full`. Both use real Game/Matter simulation, legal builds, actual damage and ordinary movement/fire input. Each set has 24 fights: three weapon families × two Subversion branches × two mirrors × two aiming policies. No combat health, enemy, damage or physics overrides. Presets start fresh boss fights; these are not full campaigns.

| Build              | Modest: body aim | Modest: junction aim | 11 upgrades: body aim | 11 upgrades: junction aim |
| ------------------ | ---------------- | -------------------- | --------------------- | ------------------------- |
| Direct rounds      | 4/4              | 4/4                  | 4/4                   | 2/4                       |
| Burst beam         | 0/4              | 0/4                  | 2/4                   | 4/4                       |
| Shell + Aftershock | 1/4              | 4/4                  | 2/4                   | 4/4                       |

Cells count fights won. All 48 finished in victory or death, not timeout. [All modest results](dead-signal-3.0.1/boss-modest.csv) and [all full-build results](dead-signal-3.0.1/boss-full.csv) retain failures and legal loadouts.

The junction policy aims at visible charging junctions and gives shells a short target lead. It reuses the existing dodge policy, whose movement prediction does not fully account for redirected recoil. It is not universally better: the full direct build loses two fights with that policy. Modest beams still lose all eight. Developed beam and shell builds can win without combat nerfs; these small samples do not prove every build is equally balanced.

## Paired route continuations

Run the same script with `routes`. Six seed/build pairs compare revisions 5 and 6, starting after the already-cleared Furnace with seven legal upgrades, choosing actual offered rewards, and carrying real health through the Annex into Reclamation. No enemy or health overrides occur during combat. The pilot favors Spoof and its legal support upgrades; it need not represent a player's preferences.

| Family / seed suffix | Revision 5 outcome / HP | Revision 6 outcome / HP |
| -------------------- | ----------------------- | ----------------------- |
| gun-0                | Reclamation / 36        | Reclamation / 100       |
| gun-1                | Reclamation / 62        | Reclamation / 62        |
| beam-0               | Reclamation / 77        | Reclamation / 100       |
| beam-1               | Reclamation / 42        | Reclamation / 36        |
| shell-0              | Reclamation / 62        | Reclamation / 88        |
| shell-1              | Reclamation / 88        | Died at Annex boss / 0  |

[All 12 results](dead-signal-3.0.1/routes.csv) retain the seed, entrance choices, final build, duration, damage and peak allies. Revision 5 completed 6/6; revision 6 completed 5/6. Taking the newly available utility card changes later choices and sacrifices a damage option in the failing shell run. This is not evidence of a higher win rate. The feature guarantees an opportunity to build around the route, not a free extra upgrade or mandatory power increase.

## Regression and publication

Four new regression tests cover threshold positions and preserved legacy behavior; 24 seeded entrances; legal branch ownership, exhaustion and rerolls; declined cards; saved pending choices; preserved boss salvage; and unchanged Cooling/Daily rewards.

The first full run passed 1,887/1,889 tests. Its two stale expectations were corrected: revision 6 is now valid, and the campaign pilot collected one courier reward. The latter now separately counts courier and regular rewards, verifies collection, and still requires exactly 19 regular rewards. All **141 focused checks** then passed. Production TypeScript/Vite build passed; the existing large-chunk advisory remains. The publishing workflow must pass the complete suite on the exact release commit before the tag is created.

Publication evidence will be recorded after both public hosts are verified. Existing [browser/hardware limitations](../browser-support.md) remain. No independent player feedback, listening assessment or new physical-device certification was collected.
