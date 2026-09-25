# Dead Signal: first playable room

Implemented 24 September 2026 on `feature/dead-signal`. This completes the first playable foundation from the weekend plan. It is a one-room development preview, not the full 3.0 update. The public Pages and itch.io releases remain 2.98.1.

## Play

Run `npm run dev -- --port 4186 --strictPort` in the game repository, then open:

- [Standard gun](http://127.0.0.1:4186/?test=annex)
- [Beam](http://127.0.0.1:4186/?test=annex&build=beam)
- [Explosive rounds](http://127.0.0.1:4186/?test=annex&build=shell)
- [Mirrored room](http://127.0.0.1:4186/?test=annex&mirror=1)
- [Standard gun without Spoof, for comparison](http://127.0.0.1:4186/?test=annex&spoof=0)

Select **Enter the Annex**. Normal controls apply; R retries the same test. Defeat the red machines and use the right exit to finish. The pause menu lists Spoof under Your gun. These local links require the preview server on this computer.

The test mode does not overwrite a saved campaign, grant Logbook discoveries or alter Daily records. The [Subversion family](dead-signal-subversion.md) is now implemented as five real upgrades in this development branch, including normal rewards, saves, Workshop and lore. These one-room tests still pre-equip their selected build and award no progression.

## Included

- A dark violet broadcast floor with staggered platforms, movable cover and an elevated junction. Six ordinary enemies include the new Switchman. Both mirrors retain space around the entrance and supported enemy placements.
- A fixed amber cable connects the junction to a remote gun port. Each 1.8-second charge visibly advances along it. The aim locks for the last 0.65 seconds, then fires three ordinary projectiles with normal cover collision.
- Shooting the charging junction cancels that volley and deals 42 feedback damage to its sender. Its 2.4-second recovery prevents repeated hits from farming the same charge. Bullets, beams and primary shell explosions can interrupt it; cover blocks all three.
- The Switchman patrols a supported bay and takes direct shots as well as operating the port. Defeating a sender cancels its unfinished charge. Already-fired rounds retain their original allegiance.
- Spoof reboots a defeated ordinary runner, shooter, flyer, hopper or Switchman as a blue ally for four active seconds after its brief startup. One ally at a time, eight seconds between conversions, at most four conversions per room. Blue bodies retain the original enemy silhouette, with a small shield and remaining-life underline. Specialized machinery resists conversion and receives feedback instead.
- A reboot uses a fresh body and AI state. It cannot hurt the player, be shot by the player, produce another reward on shutdown, or hold the exit closed. Its attacks target red enemies. A blue Switchman can operate the port against them.
- Primary bullets, continuous beam damage and primary shell blast kills qualify. Fragments, reflected shots, echoes, allied attacks, feedback, elites, summons and objective enemies do not create more allies. The ordinary kill reward is resolved once before replacement.
- Base Spoof accumulates 12% of actual primary damage into a feedback pulse against resistant machinery, capped at 24 before normal damage modifiers, on a 0.6-second window. It cannot recursively generate feedback or convert a boss. The complete family adds two branches and final-boss presets; see the Subversion notes.
- Pause and hitstop freeze simulation timers. Death, menu, retry and room completion clear transient allies, pending reboots and transmissions. Results use a prototype-specific finish screen.

## Original foundation verification

`npm test`: **1,601 passed, zero failed**. This includes 27 new prototype tests and the existing Turf War, weapon, progression, save and physics suites. Focused tests cover both mirrors, cover obstruction, timing/aim lock, real gun/beam/shell kills, reward provenance, conversion limits, friendly fire, boss feedback, pause, cleanup and repeated restart body counts.

Six ordinary-input room simulations completed with unmodified health, AI and physics. Each exercised at least one Spoof reboot and at least one port volley:

| Build | Mirror | Clear time | Health remaining |
| --- | --- | ---: | ---: |
| Gun | Normal | 17.50 s | 85 |
| Gun | Mirrored | 12.48 s | 85 |
| Beam | Normal | 22.62 s | 31 |
| Beam | Mirrored | 21.58 s | 13 |
| Shell | Normal | 13.55 s | 100 |
| Shell | Mirrored | 25.17 s | 85 |

These are repeatable simulator results, not a claim that the final area is balanced for human players. The in-app browser was used to inspect the room art, live amber charge and firing lanes, sparse HUD, pause/resume, death screen and retry. Standalone-browser human playtesting remains part of the full update gate. The production build and whitespace checks pass; Vite retains the existing large-chunk advisory.

## Next step

The [Subversion reward family](dead-signal-subversion.md), [regional route and saves](dead-signal-route.md), [Caller](dead-signal-caller.md), [Switchboard boss](dead-signal-switchboard.md) and [six combat arrangements](dead-signal-layouts.md) are now implemented in the development branch, including regional discovery and lore. Daily 83 carries the current layout pool while preserving earlier rulesets. [Regional audio](dead-signal-audio.md) is implemented. Final balance and release acceptance remain on the [weekend plan](dead-signal-weekend.md).
