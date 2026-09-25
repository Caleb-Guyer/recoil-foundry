# Dead Signal: Subversion

Implemented on `feature/dead-signal`, 24 September 2026. Development preview based on 2.98.1; stable Pages and itch.io builds are unchanged. This completes the five-upgrade family, not the alternate region or its boss.

## Play

With `npm run dev -- --port 4186 --strictPort` running locally:

| Build | Annex room | Mirrored beam room | Existing final boss |
| --- | --- | --- | --- |
| Standing Orders → Priority Target | [Play](http://127.0.0.1:4186/?test=annex&path=priority) | [Play](http://127.0.0.1:4186/?test=annex&path=priority&build=beam&mirror=1) | [Play](http://127.0.0.1:4186/?test=branches&build=priority&room=boss) |
| Cross Talk → Dead Switch | [Play](http://127.0.0.1:4186/?test=annex&path=switch) | [Play](http://127.0.0.1:4186/?test=annex&path=switch&build=beam&mirror=1) | [Play](http://127.0.0.1:4186/?test=branches&build=dead-switch&room=boss) |

Select the test button on the title screen. R repeats the same preset. Annex tests end at the right door; boss links use the existing Interceptor. Tests do not overwrite Continue, discoveries, records or Practice unlocks. Add `build=shell` to an Annex link for explosive rounds. Base comparisons: `?test=annex`, `?test=annex&path=orders`, `?test=annex&path=cross` and `?test=annex&spoof=0`.

## Upgrades

Cards display only **Subversion** as their family. It can accompany Precision, Bullet Hell, Demolition, Cryogenic or Stasis. Choosing Standing Orders excludes Cross Talk and its descendant, and vice versa. Owning Spoof weights remaining eligible family cards 1.5×, using normal reward sampling.

| Upgrade | Behavior |
| --- | --- |
| Spoof | Primary gun kills can reboot ordinary runners, shooters, flyers, hoppers and Switchmen. One ally, 4 active seconds, 65% normal health, normal damage, 8-second recharge, 4 conversions per room. |
| Standing Orders | Requires Spoof. Ally lasts 7.5 seconds with 115% normal health. Same one-ally limit and recharge. |
| Priority Target | Requires Standing Orders. Primary hits mark one living enemy for 3 seconds. Rebooted allies prefer it when exposed and hit it 40% harder. A newer hit changes the target. |
| Cross Talk | Requires Spoof. Up to two allies, each with 45% normal health, 70% normal damage and 3.5 active seconds. 2.5-second recharge, 6 conversions per room. |
| Dead Switch | Requires Cross Talk. Natural expiry releases a 42-damage overload within 145 units, with cover checks and distance falloff. Only red enemies can be damaged. Destruction, death/menu cleanup and combat clear do not trigger it. |

Allies have a 0.25-second startup before their active lifetime. They use fresh IDs/bodies/AI, normal physics and their original attacks. They cannot hurt the player or other allies, absorb player shots, inherit the player's gun stack, earn duplicate shutdown rewards or keep an exit shut. Their aim, contact and shots leave Blackout relays and couriers to the player. Blue shield/lifetime marks and target corner brackets are world indicators; no combat panel, extra key or meter is added. Overload outlines are computed once when triggered; reduced effects use a fading static outline.

Specialized industrial machines, elites and bosses resist conversion. They receive feedback from actual eligible damage rather than becoming allies with unsafe player-targeting AI. Summons, split children, couriers and relay objectives cannot feed this system.

| Owned family | Resistant-machine feedback, before ordinary armor/vulnerability |
| --- | --- |
| Spoof | 12% of actual primary damage, capped at 24 per 0.6-second accumulation window. |
| Standing Orders | 18%, capped at 36. |
| Priority Target | A marked target adds 25% to its accumulated feedback and cap (45 maximum). |
| Cross Talk | 16%, capped at 32, divided equally into two pulses, 0.25 seconds apart. |
| Dead Switch | Second pulse also releases a covered overload for 75% of that pulse's payload. It includes the struck boss, making the upgrade useful without additional enemies. |

Feedback cannot recursively feed itself. At most 16 targets accumulate feedback, 32 pulses wait and 12 short visual effects remain. Overloads never damage or ignite props. Ally expiry damage grants no player kill credit; primary feedback retains ordinary damage credit but cannot trigger gun procs or reboots.

Primary bullets, continuous/charged/prismatic beams, rails, balls, returned/guided/stored rounds and portal-transmitted rounds qualify. Fuse retains primary provenance through delayed detonation, including Linked Fuse and capacity fallback. Primary Cluster Shell children retain provenance. Fragments, reflections, echoes, allied attacks, feedback and secondary upgrade effects cannot reboot or generate feedback. The base/direct component of those builds remains eligible.

## Progression and compatibility

All five nodes are normal reward cards with prerequisites, icons and original dispatch/maintenance lore. Normal runs, pending reward saves, discoveries, Workshop imports and Overtime accept legal chains. Existing exhausted Overtime builds retain their earned repairs while new upgrades become available. Invalid cross-branch builds are rejected.

Daily 79 uses the new pool and still offers one forced upgrade. Supported Daily 78 keeps its old pool and identity, including pending rewards and records. Frozen snapshots from commit `c3e4a11` verify all twenty room IDs and nineteen forced rewards for 24 and 26 September. Scores never merge between rulesets, and retention sorts by calendar date across versions.

The [compatibility CSV](../upgrade-compatibility.csv) checks all 5,460 pairs, including all 510 involving a new node, with prerequisite closure and both acquisition orders. The [max-build catalog](../max-upgrade-combos.md) and [focused builds](../new-upgrade-builds.md) include both forks. Existing max-combo links retain their original upgrades without silently adding Subversion. Catalog links target the local development server until release.

## Verification scope

The full `npm test` run passed **1,658/1,658**. The final objective-targeting guard and two additional cases then passed **119/119 focused tests**, covering Subversion, both Daily versions, Annex and area events, plus **9/9 release-balance checks**. The production build and whitespace checks pass. Vite retains its existing large-chunk advisory.

Dedicated checks cover reward/save/Workshop round trips, branch exclusions and weighting, feedback caps, mark expiry/cover, actual allied shot damage, Turf War independence, hopper targets, delayed explosive provenance, primary/secondary damage separation, portal traversal, ally expiry/cleanup and bounded queues.

Twelve ordinary-input Annex runs (both forks × gun/beam/shell × both mirrors) clear with unmodified health, AI and physics. Two ordinary-input Interceptor runs check real combat contribution. These are repeatable simulations; final balance still needs observation during the full alternate route.

The normal campaign `path-run-67` completes with the expanded pool and a sustain/direct-output selection policy; the preserved `RF-D78-2026-09-20` also completes. The campaign test pilot now approaches Lockdown terminals and uses the normal interact key. `RF-D79-2026-09-24` genuinely acquires Spoof, Cross Talk and Dead Switch through its nine forced rewards and clears its first Lockdown. A continued probe dies in room 10; `RF-D79-2026-09-20` dies in room 6. These new Daily probes are not full-run balance sign-off. They leave the full-update Daily completion gate open, with no health, damage or reward overrides to conceal failures.

In-app browser checks cover both branch links, their equipped-build labels, the live room, pause/Your gun, death/retry and an empty error log. The preview retains the minimal HUD. These checks do not replace standalone-browser or human balance testing for the finished 3.0 release.

The [three-room route integration](dead-signal-route.md), first-Annex Spoof offer, regional discovery and Daily 80 are now implemented. Caller, Switchboard, further layouts and regional sound remain open in the [weekend plan](dead-signal-weekend.md).
