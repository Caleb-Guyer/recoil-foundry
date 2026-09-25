# Dead Signal: playable Annex route

Implemented 25 September 2026 on `feature/dead-signal`. This preview connects the Annex to normal campaigns. The public Pages and itch.io releases remain 2.98.1.

## Play

With the local development server running on port 4186:

- [The physical fork after Furnace](http://127.0.0.1:4186/?test=annex-route)
- [Broadcast Floor](http://127.0.0.1:4186/?test=annex-route&room=broadcast)
- [Cable Well](http://127.0.0.1:4186/?test=annex-route&room=well)
- [Receiver Gallery](http://127.0.0.1:4186/?test=annex-route&room=gallery)
- [Mirrored route](http://127.0.0.1:4186/?test=annex-route&room=broadcast&mirror=1)
- [New alternate arrangements](dead-signal-layouts.md)

The fork preset starts with the Furnace fight already cleared: climb the two steps into **ANNEX**, or walk into **COOLING**. Normal runs require defeating the actual Furnace boss. Daily shows only its seeded destination. These presets use legal modest builds, preserve campaign saves and discoveries, and reset with R. `mirror` changes the Annex rooms, not the preceding Furnace arena.

Direct room presets continue through the remaining campaign; they are not one-room victory tests. The older `?test=annex` links remain isolated single-room prototypes.

## Included

- **Broadcast Floor:** eight machines, intersecting firing lanes, elevated junction and interruptible remote port.
- **Cable Well:** introduces one Caller without a Switchman among nine machines, a stepped climb through suspended platforms, high firing positions and recoil shortcuts. Every platform route also works with ordinary jumps and no upgrades.
- **Receiver Gallery:** pairs Caller with Switchman among ten machines, alternating solid cover and raised firing positions, with room to flank or use blue allies.
- Each room role now has [two authored arrangements](dead-signal-layouts.md), with deterministic mirrored versions. Fixtures, spawn hulls, cover and navigation points mirror together. New campaigns independently select one arrangement per role from the seed.
- The first Annex room's reward includes Spoof when unowned. It remains one of three optional normal-run cards; Daily keeps one forced card. Owning Spoof never creates a duplicate, and normal rerolls work as before.
- Continue restores the selected region, exact room orientation, owned upgrades and pending offers. Choosing a route changes no mandatory room or reward counts.
- The region is identified correctly in the HUD tooltip, death recap and an earned dispatch Logbook entry. Visiting the Annex does not claim a Cooling discovery.
- The upper exit has its own short sign and antenna symbol. The lower regional exit requires landing at the door, so passing above it cannot accidentally choose Cooling. No additional combat instructions or HUD meters.

## Compatibility and scope

Stages 8–10 (rooms 9–11) select from six authored combat arrangements. Revision 4 and Daily 83 introduce Crossed Lines, Broken Ladder and Relay Stacks; earlier revisions retain the original arrangements. **Stage 11 contains [The Switchboard](dead-signal-switchboard.md)** from Annex revision 3 and Daily 82 onward, then proceeds to Reclamation. Earlier saved revisions retain the existing Cooling boss. [Caller is also implemented](dead-signal-caller.md). All six combat arrangements and the boss arena have mirrored versions.

The region choice is separate from the existing Cooling difficulty band. These rooms currently use its score; the regional arrangement and boss layer remain open. Cooling's optional alternate layouts, story rooms, floodgate and area events do not replace the authored Annex rooms, and this preview does not offer Cooling's optional challenge detour. Existing reward, enemy collision, allied targeting and transmission lifecycle rules apply. Overtime retains its existing layout sequence.

Normal checkpoints missing the new `region` field retain their original behavior. Daily **80** introduces seeded regional selection; supported Daily **78** and **79** retain their original routes, forced rewards and separate records. Daily **81** adds Caller; Daily 80 and existing normal saves retain their previous roster through the saved Annex revision. Frozen Daily 80 full-layout/reward fixtures come from `0419cec`. Frozen Daily 79 fixtures come from commit `5572627`; Daily 78 fixtures remain from `c3e4a11`.

## Verification

Route-integration validation before Caller: **1,702/1,702 tests pass**, including **42 route checks**. `npm run build` and `git diff --check` pass. Vite retains the existing large-chunk advisory. The breach fixture now skips unrelated event fights during its save test; the scripted weapon-progression battery retains its pre-Annex course, while the new continuous route tests exercise the regional fork through ordinary input.

The route tests cover supported spawn hulls, mounted fixtures, both mirrors, ordinary-jump traversal in both directions with the base gun, actual physical exits, door-label rendering, three-room progression, pending-reward reloads, Spoof ownership/rerolls, invalid saves, Daily choices, old Daily snapshots and earned discovery.

Eighteen ordinary-input combat tests cover gun, beam and shell builds across all three rooms and both mirrors, without health, damage, AI or physics overrides. The Broadcast pilot uses its crossing-lane movement policy; the later rooms use the campaign pilot's platform navigation. Two continuous runs climb the real fork, earn upgrades, fight all three rooms and reach the shared boss entrance with their remaining health. These are repeatable simulations, not human balance sign-off.

Browser inspection covers the fork's two signs, the live Annex layout, minimal HUD and pause controls. [Switchboard](dead-signal-switchboard.md) and [layout variety](dead-signal-layouts.md) have separate verification notes. Full-update balance, regional music and release packaging remain on the [weekend plan](dead-signal-weekend.md).
