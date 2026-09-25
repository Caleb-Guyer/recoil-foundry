# Dead Signal: The Switchboard

Implemented 25 September 2026 on `feature/dead-signal`. Transmission Annex now ends in its own boss arena in room 12, then returns to Reclamation with the ordinary reward count. Public Pages and itch.io remain on stable 2.98.1.

## Play

Start the local server with `npm run dev -- --port 4186 --strictPort`.

- [Gun and Standing Orders](http://127.0.0.1:4186/?test=switchboard&build=gun)
- [Beam](http://127.0.0.1:4186/?test=switchboard&build=beam)
- [Shell, mirrored arena](http://127.0.0.1:4186/?test=switchboard&build=shell&mirror=1)
- [Countershot](http://127.0.0.1:4186/?test=switchboard&build=counter)
- [Fold and Rewire](http://127.0.0.1:4186/?test=switchboard&build=portal)
- [Cross Talk and Dead Switch](http://127.0.0.1:4186/?test=switchboard&build=subversion)
- [Complete route from the Furnace fork](http://127.0.0.1:4186/?test=annex-route)

Boss presets are isolated single fights with legal eleven-upgrade builds and full health. R retries. They cannot overwrite campaign progress, unlock Practice, grant lore discoveries or record Daily scores. Route tests continue through the campaign.

## Fight

Three fixed remote emitters serve a moving control assembly. Early cycles teach a five-shot sweep, a ground-directed volley, and playback of three recorded positions. Sampling lasts 0.6 seconds, then the aim locks for 0.8 seconds before firing. Playback marks stop following the player after recording. All rounds obey normal terrain, prop, portal and Countershot rules.

Below half health, after teaching all three patterns, the assembly transitions into combinations of two familiar attacks from separate emitters. The second warning is offset by 0.38 seconds. A conservative player-hull sweep checks a nearby escape corridor against the locked firing lanes; an unsafe new pattern is cancelled. There are never more than two scheduled patterns. This is a geometric safety check, not proof that any arbitrary player position and input is survivable.

Shooting an exposed charging junction cancels that emitter, inflicts feedback damage and opens the assembly for 1.4 seconds. The 7.5-second shared cooldown prevents repeatedly disabling both emitters. Bullets, continuous beams and primary shell splash all work; solid cover blocks access. A junction cannot interrupt rounds already firing or recursively feed Spoof. Closed contacts remain visibly distinct during lockout.

The assembly always takes damage: 60% normally, 125% during recovery and 155% during the interruption opening. Its base health is 4,200 before the existing difficulty-band scaling. Physical rounds deal 26 damage before the player's ordinary defenses. Spoof supplies capped feedback rather than converting the boss. Low side emitters cover the space beneath shelves; overhead fire pressures hovering. Hull recovery backs away from chamfer contacts using ordinary velocity and collision, without teleporting through terrain.

No extra combat text, meter or key is added. Amber cables and exposed cross-shaped contacts identify charging junctions; locked shot lanes and recorded-position rings show the attack. Boss contacts open during recovery. Reduced effects preserves these warning shapes. The new dispatch Logbook record is earned through discovery, and Practice requires a real campaign victory.

## Compatibility

New campaigns use Annex revision 3. Explicit revisions 1/2 and older checkpoints missing the revision keep their previous room-12 Cooling boss. Current Daily 82 fixes its region and still awards exactly one upgrade after every room. Daily 78–81 retain their existing challenge identities, rooms and forced rewards. Daily 81's full-layout hashes and reward fixtures were captured from `f2ae3b5` before this implementation. Pending rewards, Continue, victory records, regional recap and Logbook migration include the new boss. Overtime retains its original sequence.

## Verification

The 50 focused Switchboard checks pass. They exercise warning timing, immutable recordings, the phase transition, separate emitters, escape geometry, shared interruption cooldown, weapon-specific junction collision, projectile cover and portal travel, Spoof resistance, cleanup, pause/hitstop, retry, saved revisions, pending rewards, Practice and Daily compatibility.

Twelve combat simulations win with ordinary input across six builds and both mirrors, with 76–100 health remaining and roughly 28–45 seconds elapsed. The portal builds place a real linked pair. Health, damage, AI and physics are unchanged; the pilot reads visible locked warnings. Sixteen deliberately favorable stationary-fire probes give gun/Countershot builds perfect aim and free hover at corners, under cover and above the boss; all lose. Additional collision tests reproduce and prevent the shelf-contact stall and ceiling-warning cancellation found during development. These finite checks do not establish exhaustive immunity to cheese or human difficulty balance.

The production build passes with Vite's existing large-chunk advisory. In-app browser inspection covers startup, live arena and attack warnings, death/retry, pause/resume and an empty warning/error log.

The full suite completed 1,788 checks: 1,787 passed and one elite-save fixture incorrectly assumed the current Daily always selected Cooling. Daily 82's date now selects Annex. The fixture was corrected to check the actual seeded region and expanded across Daily 80/81/82 on three dates, while preserving exact layout and spawn-body comparisons. All four elite-placement tests then passed. No runtime changes were needed for that correction, and the five-minute full suite was not repeated afterward. `git diff --check` passes.

The [three additional arrangements are now implemented](dead-signal-layouts.md). Regional music, whole-update balance and release acceptance remain on the [weekend plan](dead-signal-weekend.md).
