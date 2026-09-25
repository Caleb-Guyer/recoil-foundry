# Dead Signal: Caller

Implemented 25 September 2026 on `feature/dead-signal`. This is the Annex's second enemy, introduced in Cable Well and paired with the Switchman in Receiver Gallery. The stable public release is still 2.98.1.

## Play

With the local development server running on port 4186:

- [Cable Well — Caller introduction](http://127.0.0.1:4186/?test=annex-route&room=well)
- [Receiver Gallery — Caller and Switchman](http://127.0.0.1:4186/?test=annex-route&room=gallery)
- [Mirrored Cable Well](http://127.0.0.1:4186/?test=annex-route&room=well&mirror=1)
- [Mirrored Receiver Gallery](http://127.0.0.1:4186/?test=annex-route&room=gallery&mirror=1)

Choose **Enter the Annex**. R restarts the preset. These links use legal campaign builds with Spoof, continue through the remaining rooms, and do not write campaign progress or discoveries. To encounter it naturally, start a new normal run and choose the upper Annex exit after Furnace.

## Behavior

The Caller records one target at three positions, 0.35 seconds apart. Rings appear at those positions as its three recording lamps fill. The completed recording locks for 0.75 seconds; the rings become solid with side brackets. It then shoots the positions in order, with 0.22 seconds between rounds, followed by 2.4 seconds of recovery. The next firing lane is a thin, cover-clipped line. Reduced effects retains the same warning shapes and timing. There is no new combat text or meter.

Each shot is an ordinary 14-damage round at speed 9.4. The recording does not follow the target after lock. Changing height or direction avoids the old positions; terrain and crates block the shots. Acquisition needs a visible target within 1,200 units. Once recording starts, that target keeps its identity rather than switching to a different actor midway through.

The speaker has a 34×36 dynamic hull and 100 base health, with the existing stage health scaling. It braces while recording but can still be moved by physics and weapon impacts. Killing it cancels unfinished shots. Already-fired bullets remain physical. Moving the speaker over 40 units after lock cancels the rest, avoiding an unexpected firing angle after displacement or portal travel. Shots themselves use the ordinary portal and collision pipeline.

Spoof reboots a fresh blue Caller. It records eligible red enemies, respects Priority Target, cannot shoot the player or other allies, and completes one sequence within even Cross Talk's shorter lifetime. It does not inherit the dead machine's recording. Couriers, relays and unfinished arrivals remain excluded. Normal ally limits, damage scaling, expiry and cleanup apply.

The horn and pedestal distinguish it from the Switchman's radio box. The Gallery speaker is offset from the junction so its body and lamps remain legible. Cable Well no longer draws an unused transmission fixture. An earned maintenance Logbook entry describes its former attendance-call function.

## Compatibility

New normal runs and Daily **81** use the Caller encounters. Daily **80** retains its exact old room rosters, layouts and forced rewards; 78/79 remain supported. Full-layout hashes and reward fixtures for both Daily 80 regions were frozen from `0419cec` before implementation.

Checkpoints now retain `annexVersion`. Existing normal saves without that field use the previous roster, even if they have not yet entered the Annex. New saves retain revision 2 through Continue and pending rewards. Daily revision mismatches and invalid values are rejected. No new gun upgrade or upgrade-pool change is included here.

## Verification

The full suite completed with **1,733 passing checks and one failing test assumption**: its Daily progression fixture always expected all four detours. Daily 81's Annex route correctly has three. The fixture now checks the exact detour set for each region and runs both Daily 80 and 81. After that correction and the Gallery fixture-spacing adjustment, the affected suites passed as recorded below; the full five-minute suite was not repeated. The production build and whitespace checks pass, with Vite's existing large-chunk advisory.

The focused Caller, route and detour checks pass **90/90**. They cover immutable recordings and firing order, warning time, evasion, cover and muzzle obstruction, crates, portals, killed owners, removed targets, faction changes, displacement, freeze/pause/hitstop, cleanup, real Spoof kills and allied damage, expiry, bounded warning state, both room mirrors, save revisions and preserved Daily layouts/rewards.

Eighteen ordinary-input combat simulations exercise bullets, beams and shells across all three Annex rooms and both mirrors. Two continuous simulations enter through the physical fork, complete the three rooms and reach the existing boss entrance. Health, damage, AI and physics remain unchanged in these simulations. Both mirrors remain traversable with ordinary jumps.

In-app browser inspection covers the two layouts, horn silhouette, fixture separation, minimal HUD, pause/resume, and an empty error log. Human balance evaluation and the finished update's dedicated boss remain outside this step.

The [Switchboard boss](dead-signal-switchboard.md) and [three additional arrangements](dead-signal-layouts.md) are now implemented. [Regional audio](dead-signal-audio.md) is implemented. The [whole-update balance audit and 3.0.0-rc.1 preparation](dead-signal-balance.md) are complete. Public-host acceptance remains in the [weekend plan](dead-signal-weekend.md).
