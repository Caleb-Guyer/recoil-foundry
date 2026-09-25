# Recoil Foundry: Dead Signal

Proposed themed update, planned against 2.98.1, with target version **3.0.0**. The [first playable room](dead-signal-prototype.md), [five-upgrade Subversion family](dead-signal-subversion.md) and [three-room alternate route](dead-signal-route.md) are implemented on `feature/dead-signal` as of 25 September. The second machine, dedicated boss and remaining arrangements below are still planned. Target: ready Sunday, 27 September 2026, with public release before 7:00 a.m. Central on Monday, 28 September. The timetable below is a work plan, not a scheduled background job.

**Foundation completed:** one Transmission Annex room in both mirrors; one Switchman and interruptible gun port; pre-equipped Spoof with temporary blue allies; bullet, beam and shell presets. The production build and 1,601 automated tests pass, including 27 prototype checks and six ordinary-input combat completions. Browser presentation, pause and retry were checked in the in-app browser. See the prototype notes for exact scope, test links and remaining integration work. This is a development preview; the public release remains 2.98.1.

**Subversion implemented:** all five real upgrades, exclusive support branches, compatible gun families, normal rewards, saves, Workshop, original lore and focused room/boss presets. Both branches provide bounded feedback against resistant machines. Daily 79 introduced the new pool; Daily 78 keeps its original rewards, links, saves and records. The completed eligibility audit covers all 510 new pairs and the build catalog now contains 2,048 maximal combinations. Verification for that step is recorded in the [Subversion notes](dead-signal-subversion.md).

**Route integration implemented:** physical Cooling/Annex exits after Furnace; Broadcast Floor, Cable Well and Receiver Gallery in both mirrors; first-room Spoof offer; Continue and pending-reward persistence; regional recap and Logbook discovery. Daily 80 fixes the region by seed while 78/79 retain their old rooms. The preview rejoins the existing Cooling boss in room 12. Replacing that shared fight with Switchboard remains the next boss milestone. See [route notes and test links](dead-signal-route.md).

**The hook:** a communications wing sealed years ago has started issuing orders again. You can enter it, trace the transmission, and steal enough authority to make the factory attack itself.

“The shift ended. The orders didn't.”

The player should recognize this as one substantial update: a different place, a different enemy formation, a new way to build the gun, and a fight worth discovering. Preserve the single gun, immediate recoil, sparse interface, and twenty-room campaign. Changes to routes and builds create reasons to replay the full run.

**Monday's intended package:** an alternate four-room area, six combat layouts plus one boss arena, two enemy types, one boss, five connected upgrades, a machinery interaction, a new area music arrangement with a boss layer, and corresponding discovery/lore entries. Four polished combat layouts are the minimum; layouts five and six are the first scope cut.

**The Transmission Annex.** After the Furnace boss, a clearly marked physical exit offers the Annex alongside the usual Cooling Works route. It occupies rooms 9–12 and reconnects to Reclamation. It replaces those four rooms in the chosen run; reward count, difficulty tier and final encounter remain consistent. No unlock grind or launch-week availability timer. The choice stays available on future runs. A Daily's route is fixed by its ruleset and seed, with no competitive advantage from a different branch.

Use three room roles: a broadcast floor with intersecting firing lanes, a cable well that rewards recoil climbing, and a receiver gallery with staggered cover. Each has two authored arrangements, validated in both mirrors. Entering the Annex locks the regional choice for that area. Existing saved campaigns keep their already-generated route.

The visual language is old communications equipment: dark violet steel, amber cable lamps, silent announcement speakers and clean antenna silhouettes. Keep normal player, enemy and ally color conventions. Hostile warnings must differ by shape and timing as well as color. Background interference never conceals projectiles, flashes the entire screen, or adds fake interface errors.

**One environmental rule: interrupt the transmission.** A hostile machine sends a visible charge along a fixed cable to a remote gun port. Before it arrives, shooting the exposed junction cancels that one discharge and sends a feedback hit to its sender. The junction only responds while charging; it cannot become an endlessly farmable stun or damage source. After a discharge, it visibly cools down. Direct enemy attacks continue to threaten a player camping at the junction.

The first room demonstrates one cable and one port with a generous warning. Later layouts combine separate heights and firing angles. Ports produce ordinary physical projectiles with normal cover collision. Mounts are fixed level fixtures, independent of conveyor forces and breakable props. No switches can permanently lock an exit, trap an essential target outside the room, or demand an upgrade the player may not own.

**Two machines with distinct jobs.**

| Machine | Encounter behavior | Player response |
| --- | --- | --- |
| Caller | Samples a short section of the player's recent route, shows at most three marked positions, then sends a clearly telegraphed attack through those positions. The sampling ends before the attack commits. | Leave the recorded route, change height, or interrupt the Caller. Warning marks expire quickly. |
| Switchman | Moves between supported firing positions and charges one connected remote port at a time. It also has a modest direct shot so breaking the cable isn't permanent immunity. | Shoot the charging junction, exploit the recovery, or flank the sender. |

Both use normal collision and damage rules, spawn with space around the entrance, and have readable blue allied versions for the new upgrades. Killing their sender cancels unreleased warnings; already-fired rounds remain ordinary rounds. No attack lands before its visible warning or continues after the room has ended.

Ownership changes clear recorded player targets and pending hostile transmissions. An allied Caller records a red enemy's route; an allied Switchman uses friendly ports. Their attacks cannot damage the player or other allies. Extract shared faction behavior from Turf War instead of maintaining two subtly different versions of targeting and room-clear logic.

**Five upgrades: Subversion.** Reuse the existing Turf War faction behavior as the foundation. Rebooted machines keep their original attacks; they never duplicate the player's entire upgrade stack. They leave when combat ends and cannot hold an exit closed. Reward cards show only the short path name, as with existing paths.

| Upgrade | Prerequisite | New behavior | Boss contribution |
| --- | --- | --- | --- |
| Spoof | None | Your gun can briefly reboot a defeated ordinary machine as a blue ally. Prototype limit: one ally for four seconds, with eight seconds between reboots. | Eligible damage to bosses builds a bounded feedback burst. Bosses themselves cannot be converted. |
| Standing Orders | Spoof | The ally remains active longer and survives more incoming damage. Alternative to Cross Talk. | Strengthens the feedback burst. |
| Priority Target | Standing Orders | Your direct hits mark a priority target; your ally concentrates its fire and gains a bounded damage bonus against that target. | Feedback also benefits against the marked boss. |
| Cross Talk | Spoof | Two weaker, shorter-lived allies can be active. Alternative to Standing Orders. | Feedback becomes two smaller pulses; splitting preserves the base payload rather than doubling it. |
| Dead Switch | Cross Talk | An expiring ally produces a small hostile-only overload before shutting down. | The second feedback pulse gains a limited explosion around the struck boss, subject to cover. |

The five nodes are implemented; exact current values and playtest links are in the Subversion notes. Further balance work belongs with the full route and boss. Subversion is a support family compatible with existing gun forms; its two internal branches exclude each other. It does not remove existing weapon-path restrictions.

Make the update discoverable: the first Annex reward includes Spoof among the three choices when it is unowned and legal. Picking it is optional. Afterward, use the existing chosen-family weighting and normal eligibility rules. Spoof can also appear in ordinary campaigns outside the Annex. A Daily entering the Annex has its corresponding single fixed reward planned in advance; it never opens a three-card choice.

Count one reboot opportunity per eligible original enemy, including kills by a primary shell's explosion or continuous beam. A killed machine grants its ordinary reward exactly once before becoming a temporary ally; its later shutdown grants no second kill, health, score, loot, or conversion. Reboots cannot come from summoned enemies, allies, fragments or feedback effects. Secondary damage cannot recursively create more feedback or allies. Share one discharge/target credit across pellets and beam samples; use actual damage, not overkill, for feedback. Set explicit per-room and simultaneous-entity limits.

Every new node must visibly help against a boss without adds as well as in ordinary rooms. Test the family with the base gun, Bullet Hell, Precision, Demolition, every beam fork, Rail, Mass Driver, Recall, Vector, Stasis and portals. Every upgrade description must match its final behavior. Do not accept a compatibility rule that silently leaves an owned upgrade doing nothing.

**The boss: The Switchboard.** A mobile control assembly feeds three separated remote emitters. Its readable sequence is **record → transmit → recover**. Early attacks teach each emitter; the later phase combines previously learned patterns instead of introducing an unannounced lethal attack. The control assembly remains damageable, with meaningful openings rather than long invulnerability waits.

The three attack roles are an overhead sweep that requires lateral movement, a ground-directed volley that rewards recoil lift, and a delayed playback of the player's recorded route. Only two dangerous patterns may overlap, and the scheduler must leave a reachable escape route. A junction interruption creates an opening but has a shared cooldown; camping beside one cannot suppress the whole fight. All ordinary shots still hit the boss's own physical obstacles, so the AI must verify its firing lane.

The exact phase-two reveal stays out of public screenshots, the teaser and the title menu. Practice unlocks only after an actual victory. A new Logbook record explains the machine after discovery, without rewriting the existing ending or revealing future encounters.

**Sound and discovery.** Develop an original arrangement within the existing procedural score: a sparse detuned synth pulse on entry, bass and percussion when the ports power up, and a stronger lead layer for the boss. Mix against gunshots and warnings; the music must not conceal critical tells. No licensed-song dependency or new composer delivery is on the weekend's critical path.

Add five upgrade entries, two machine entries, a regional note and the boss record using the established maintenance/dispatch/safety voices. One optional note can suggest why an abandoned department still has authority. The physical route, cable pulses and lamp states teach the mechanics; lore stays optional. No objective paragraph, new energy meter or extra combat key is required.

**Weekend milestones.** All times are Central; this is an estimated schedule with explicit go/no-go gates.

| When | Deliverable and gate |
| --- | --- |
| Friday 25 September, evening | Freeze this scope. Build one playable Annex room with a junction, one hostile port and one rebooted ally. Verify cover, a beam kill, a shell kill, pause and save/reload. If this foundation isn't convincing, simplify it before producing more content. |
| Saturday 26 September, morning | Complete route/save integration, both enemy behaviors and the five upgrade nodes. Play through the full new branch, including a rough boss, with a normal campaign build. |
| Saturday, afternoon/evening | Finish the four essential layouts, boss tells/escape routes, presentation and first balance pass. Add the final two layouts only once the essential branch works. By the end of Saturday, the full intended update must be playable from a fresh run through extraction. |
| Sunday 27 September, morning | Content freeze at noon. Finish lore, sound mix and readable effects; resolve balance findings. Capture a short spoiler-light gameplay teaser from actual play. |
| Sunday, noon–8 p.m. | Regression tests, compatibility checks, old-save/Daily checks, anti-cheese runs, browser smoke tests, ZIP validation and release notes. Produce a verified release candidate and rollback instructions. No new mechanics after the freeze. |
| Monday 28 September, 6–7 a.m. | Release window: publish the already-tested commit, wait for Pages CI, check the public game, tag/package it, replace the itch.io build, and verify its version and existing saved progress. |

**Technical boundaries.** Work on a feature branch while the stable game remains available. Separate the alternate region's identity from its campaign difficulty tier: adding an Annex must not shift the five existing stage bands, boss positions, rewards or Overtime transitions. Centralize region selection so rendering, audio, the HUD, Practice and Logbook agree. Do not scatter another numerical area index through the game.

Use dedicated layout, combat, art and upgrade modules with the existing lifecycle hooks. Clear transient actors, cable charges and warnings on death, restart, room transition and menu entry; freeze them during pause/hitstop. Save deterministic route and content-version decisions. Missing new fields in an old checkpoint select the old campaign behavior. Preserve pending upgrade offers across migration.

New Daily runs need a new ruleset for the changed pool and routes. Keep old Daily checkpoints and records associated with their original ruleset. Never silently reinterpret an old challenge or migrate its score into the new board. The Daily continues to present its single fixed reward option. Validate Workshop, imported builds, Practice discovery and Overtime explicitly.

**Release acceptance.** These are open implementation gates, not claims of completed testing.

- All existing automated checks and the production build pass, plus meaningful regressions for every new system. The baseline has 1,571 tests; passing that baseline alone is insufficient.
- Exercise the strongest complete Subversion combinations against the finished alternate area and boss. The 510-pair eligibility audit, representative weapon-runtime checks and generated build catalogs are complete; repeat affected checks when remaining content changes these rules.
- Finish at least twelve seeded campaign routes spanning both mirrors and the main gun families, plus a Daily run and an Overtime continuation. Record seeds, builds, damage taken and failures. A simulator passing is not a substitute for watching the encounters.
- Test stationary corner play, hovering above the boss, hiding behind each major obstacle, portal loops, Countershot/Breach spam, ally body-blocking, and repeated junction interruption. No indefinite safe position or complete attack suppression may remain. Verify that evasive play has a real escape from each attack combination.
- Exercise death/retry, repeated Escape at rewards, rerolling, pending rewards across reload, lost browser focus, fullscreen, existing imports, old checkpoints and all supported Daily rulesets. Retain the 2.98.1 blackout and boss-collision regressions.
- Compare a bounded worst-case combat recording against 2.98.1 on the same available browser/device. Cap allies, traces, emitters, projectiles and secondary effects; no growth across repeated restarts. Inspect Reduced effects and muted play for readable warnings. Record unavailable physical-browser or hardware checks honestly.
- Check About/version, normal startup, reward selection, Report an issue and preserved progress on both public hosts. Verify the release artifact checksum and the actual itch.io iframe version.

**Scope protection.** If Sunday needs more time, cut layouts five/six first, then the extra optional lore discovery and a longer teaser. Keep the playable branch, readable boss, complete five-node upgrade family and migration checks together. If any core feature still has a reproducible progression block, save loss, attack with no escape, or unbounded combat loop, the big update misses the target rather than shipping that defect. Preserve the tested stable release as the rollback point.

**Launch presentation.** Use one restrained “Dead Signal” update label and a short announcement: new route, machines that can change sides, new upgrades, and something transmitting from inside the Annex. An optional 15–25 second teaser begins with an empty speaker coming alive, shows a recoil climb past a charged port and a red machine rebooting blue, then ends on the update name and play link. Show no final boss reveal. New content stays available permanently; repeat play comes from alternate rooms, competing upgrade branches and different encounter combinations.
