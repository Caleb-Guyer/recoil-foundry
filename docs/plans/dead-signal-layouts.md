# Dead Signal: Annex room variety

Implemented 25 September 2026 on `feature/dead-signal`, now included in [stable 3.0](../validation/dead-signal-3.0.md). The Annex has six authored combat arrangements plus the Switchboard arena. It occupies four rooms of the twenty-room campaign.

## Play

With the local server running (`npm run dev -- --port 4186 --strictPort`):

- [Crossed Lines](http://127.0.0.1:4186/?test=annex-route&room=broadcast&layout=alternate)
- [Broken Ladder](http://127.0.0.1:4186/?test=annex-route&room=well&layout=alternate)
- [Relay Stacks](http://127.0.0.1:4186/?test=annex-route&room=gallery&layout=alternate)
- [All alternate rooms from the physical fork](http://127.0.0.1:4186/?test=annex-route&layout=alternate)
- [Mirrored Broken Ladder](http://127.0.0.1:4186/?test=annex-route&room=well&layout=alternate&mirror=1)

R retries the selected preset. These tests pre-equip legal builds and continue through subsequent rooms without saving campaign progress, discoveries or Daily scores. `layout=alternate` forces the three new arrangements; `layout=original`, and old preview links without that argument, retain the original three. Normal campaigns mix them using the run seed.

## Arrangements

| Room role | Original | New arrangement |
| --- | --- | --- |
| Broadcast | Broadcast Floor | **Crossed Lines:** broad offset balconies frame an exposed middle, with an elevated junction and overhead port. The floor lane and balcony route offer different firing angles. Eight enemies, including one Switchman. |
| Well | Cable Well | **Broken Ladder:** two interrupted climbs, a gap between them, a floor passage and two optional high perches. Recoil gives shortcuts; ordinary jumps can reach every perch. Nine enemies, introducing one Caller without a Switchman. |
| Gallery | Receiver Gallery | **Relay Stacks:** staggered grounded blocks and suspended shelves split the approach. The Caller occupies a high perch over 500 units away from the Switchman’s floor patrol. Ten enemies, with both machines active. |

Each arrangement has both orientations. Geometry, spawns, navigation, props and fixtures mirror together. Junctions are mounted on platforms with clear firing approaches; props do not overlap spawn hulls. No new HUD element or instruction panel is added.

New campaigns use Annex revision 4. Each of the three combat slots independently selects its original or alternate arrangement at equal probability using a dedicated seed stream, separate from mirroring and rewards. That provides eight arrangement combinations before orientation. Continue restores the exact arrangement and pending offers. Revisions 1–3 keep their original rooms; Switchboard and the return to Reclamation retain their established progression.

Daily 83 introduces the new layout pool and preserves a single forced reward after each room. Supported Daily 78–82 keep their previous challenge identities and layouts. The frozen Daily 82 fixtures were captured from `a254767` before implementation, recording all twenty full-layout hashes and nineteen rewards for both regions. Overtime keeps its existing sequence.

## Verification

The focused route, variety, Caller, Switchboard and elite-placement suites pass **181/181**. Tests cover all eight seeded combinations, deterministic mirrors, returned-data isolation, supported enemy hulls, clear fixtures/props, enemy-role counts, strict preview URLs, Continue, pending rewards, saved revisions and old Daily snapshots. All six arrangements pass ordinary-jump traversal in both directions; the new optional high perches are tested separately with no upgrades or firing.

The room battery covers bullets, beams and shells across all six arrangements and both orientations: 36 combat completions with ordinary player input. Six continuous simulations take those weapon families through all three new rooms, defeat Switchboard, earn upgrades and enter Reclamation through the real exit. They finish in approximately 71–146 seconds with 59–100 health remaining. No health, damage, enemy-AI or physics overrides are used. The shared campaign pilot now responds to Switchboard's visible warnings, as its existing boss pilot already did. These are repeatable simulations, not a human difficulty verdict.

The production build passes with Vite's existing large-chunk advisory. In-app browser inspection covers the three new rooms, the mirrored Broken Ladder entrance, fixture/character separation and the sparse HUD; no warnings or errors were logged. The complete regression suite passes **1,844/1,844** with no failures or skipped tests (331 seconds). TypeScript and the diff whitespace check also pass.

[Regional audio](dead-signal-audio.md) is implemented. The [whole-update balance audit and 3.0.0-rc.1 preparation](dead-signal-balance.md) are complete. Public-host acceptance remains in the [weekend plan](dead-signal-weekend.md).
