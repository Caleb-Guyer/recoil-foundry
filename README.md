# Recoil Foundry

**One gun. All recoil.**

[Play in your browser](https://caleb-guyer.github.io/recoil-foundry/)

A physics roguelike about staying in motion. Clear sixteen stages, take optional challenge detours for extra upgrades, and get out. No inventory, ammunition, energy, or ability selection.

## Play

| Input                  | Action                     |
| ---------------------- | -------------------------- |
| A / D or arrows        | Move                       |
| Space / W / up arrow   | Jump; hold for more height |
| Mouse                  | Aim                        |
| Left click / hold      | Fire                       |
| Right click / E (Fold) | Place the next portal      |
| Escape / P             | Pause                      |
| 1–3 during upgrades    | Choose a modification      |

Shoot downward in the air to climb. Shoot sideways to launch yourself the other way. Recoil is almost five times stronger in the air; steering preserves speed above the normal running limit. Clear every enemy, then walk through the door on the right. Each area ends with a boss.

You always carry **one gun**. Thirty-two possible modifications change its shots, recoil, handling, or healing. Choose one of three between main rooms; these rewards also restore 12 health. The direct route gives fifteen picks. Taking all four optional detours extends the run to twenty fights and nineteen picks; bonus rewards give no healing.

Bloodwork restores 2 health per kill. Hidden salvage still restores 18 health, so exploring a passage can save a damaged run. Scattershot fires five pellets at 32% base damage each; landing the spread up close rewards the risk without overwhelming every boss window.

Your gun's shape reflects its build: Heavy hitter adds a thick sliding barrel, Scattershot widens the muzzle, and Burst fire cycles a bolt and three recessed chambers. These parts combine on the same weapon. Banked rounds leave short mint trails along their actual bounce paths; piercing rounds leave thin pale-blue streaks. Combined rounds keep both cues. Screen-shake settings also reduce the weapon animation and muzzle flash. These visual changes preserve the gun’s stats.

## Daily run

Choose **Daily run** on the title screen for a shared sixteen-room challenge. A new challenge starts at midnight UTC. Players taking the same route get the same layouts, enemy and prop setup, and predetermined upgrade sequence. After each of the first fifteen rooms, a single card shows your next upgrade: click it or press 1 to take it and continue, with the usual 12-health recovery. Optional detours also give exactly one predetermined bonus card, without healing. Choosing a detour can change later upgrades because your build changes. There are no alternative upgrades in a Daily Run. Regular runs keep their three choices. The gun, movement, and combat HUD are unchanged.

Finish all sixteen rooms and reach the extraction lift to save your fastest successful time for that challenge in this browser. The timer counts active simulation time through the escape route, excluding pauses, upgrade screens, and the automatic lift departure. Continue keeps the elapsed time saved at the room or escape entrance; Again restarts the same challenge, even after midnight. Starting a new run replaces the existing checkpoint.

The room counter marks active challenges with **DAILY**, and Pause shows the challenge date. Starting a daily updates its URL and keeps **Play daily** selected when returning to the menu; choose **Random run** to leave the daily. Saves from an unsupported daily ruleset cannot continue as an ordinary run. Their saved data stays untouched until you start another run.

The result screen's **Copy challenge link** button lets a friend play that exact day, including past challenges. If automatic copying is unavailable, the link appears for manual copying. Records stay on this device; no account or leaderboard is needed. Up to 365 challenge records are kept. Blocking browser storage prevents saving but does not prevent play.

Daily links include a ruleset version (`?daily=2026-09-08&dv=27`). Version 27 adds conveyor belts; its best times are separate from earlier rulesets. Belt placement and direction, squad selection, boss selection, passage placement, cargo, and pickups repeat for everyone playing the same challenge. The final escape route is the same for every player. Bump `DAILY_RULESET` in `src/daily.ts` when changing layouts, upgrade pools, or gameplay balance. Unsupported or invalid daily links show a short notice and leave ordinary play available; they never silently launch a different daily challenge.

## Expanded-run test

[Try the new rooms](https://caleb-guyer.github.io/recoil-foundry/?test=expanded). Click **Test new rooms** to begin in room 3 with full health and two upgrades, then play onward normally. Add `&area=furnace`, `&area=cooling`, or `&area=rooftops` to begin at that area's new third room with an appropriate preset build. **R** or **Restart test** in Pause returns to the test entrance. These links preserve ordinary saves, Daily records, and earned Practice victories.

Ordinary saves from the twelve-room version migrate to the same area and encounter with their health, gun, optional rewards, and elapsed time intact. They skip any newly inserted rooms behind that checkpoint. The migration records those missed upgrade picks so later detours and escape checkpoints remain valid. New runs use all sixteen rooms. Daily rulesets start fresh when their route or gameplay changes.

## Build paths

Specialization happens through ordinary upgrade choices. **Crossfire** commits the run to **Bullet hell** and unlocks **Death bloom** and **Convergence**. **Deadeye** commits the run to **Precision** and unlocks **Executioner** and **Deadlock**. **Shellshock** commits the run to **Demolition** and unlocks **Blast surfing**, **Aftershock**, and **Chain reaction**. Choosing an entry locks the other paths for that run. Cards show only the path name; follow-ups can appear in later rewards. Shared upgrades remain available to every path. After committing, eligible upgrades on your path get 1.5 times the normal selection weight, sampled without duplicates. This slightly improves their chance without guaranteeing them, including in the deterministic Daily sequence.

| Path        | Upgrade     | Effect                                                                                                                                                         |
| ----------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bullet hell | Crossfire   | Three firing lanes, each carrying the gun's pellet pattern at 55% damage. Shot delays are 20% longer; recoil still happens once per discharge.                 |
| Bullet hell | Death bloom | Requires Crossfire. Unblocked bullet kills release six radial fragments, each dealing 35% of the killing round's damage. Fragments cannot trigger more blooms. |
| Precision   | Deadeye     | 30% more damage, 50% faster projectiles, and half the pellet spread. Shot delays are 20% longer.                                                               |
| Precision   | Executioner | Requires Deadeye. Main projectiles deal 60% more damage to enemies below 30% health. Health is checked separately at each impact, before armor.                |

Crossfire works with Scattershot, Burst fire, Backfire, and the existing projectile modifications. Deadeye keeps those shared options too, tightening Scattershot rather than removing it. Death bloom fragments respect walls and remain separate from Splinter; fragments receive neither Executioner's bonus nor recursive fragmentation. All paths keep the same shot and particle limits.

Normal rewards still show three available choices. Daily Runs still force one predetermined legal upgrade per room, including any path commitment. Continuing preserves the selected path; starting a fresh run clears it. The pause screen's existing gun summary shows the current path. Existing ordinary checkpoints keep their saved room number, gun, health, and time. A saved room 7–9 now resumes in Cooling Works. A previously completed nine-room escape resumes its escape route with its original eight upgrades.

## Demolition

A third path built around explosive impacts and movement. Taking **Shellshock** makes later Demolition upgrades eligible. **Shockfront** requires **Aftershock**; the other follow-ups require Shellshock.

| Upgrade        | Effect and tradeoff                                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shellshock     | Rounds deal 55% of their usual direct damage, then explode on their final impact for up to another 85% in a 96-unit radius. Shot delays are 35% longer.                      |
| Blast surfing  | Your shell, aftershock, and chain blasts push you away from their center. Shoot the floor to launch upward, or a nearby wall to gain sideways speed.                         |
| Aftershock     | Each shell or chain blast repeats once after 0.38 seconds, at 40% damage and launch strength. A quiet amber ring marks the pending blast. Echoes cannot repeat themselves.   |
| Chain reaction | Destroying a crate, movable cover, or cracked passage panel schedules one 48-damage blast after 0.12 seconds, within a 110-unit radius. Nearby props can continue the chain. |

Explosion damage falls with distance from the target's visible hull, to 35% at the edge. Terrain and intact props block blasts. Cover is checked before each explosion destroys anything, so a chain can open a firing lane without the first blast leaking through it. Shields and boss armor still reduce damage, and bosses resist knockback. Your own Demolition blasts never cost health; Blast surfing adds the launch. Fuel canisters remain dangerous and use their existing arming and explosion rules.

Shared upgrades combine with the same gun: Scattershot distributes the payload across pellets, Burst fire sends three explosive discharges, and Backfire fires explosive rounds in both directions. Punch through postpones detonation until the final hit and attenuates both damage portions. Bank shot and Banker preserve the payload through reflections; Banker increases both portions. Splinter fragments do not explode. Fold transports the intact shell, which detonates only when it later strikes something. Rounds that expire in flight disappear without an explosion.

Airshot and Landing shot strengthen both direct and blast damage. Blast surfing's launch budget is shared across a discharge's pellets and forward/rear volleys, keeping dense builds controllable. Player speeds stay bounded. Overlapping effects are grouped visually, and short flashes, restrained sparks, and low impact sounds preserve combat visibility. Reduced-motion settings soften the effects.

Delayed blasts freeze on pause, upgrade screens, and impact pauses. Room changes, retries, death, and boarding the extraction lift clear them. Ordinary checkpoints preserve the build and reconstruct transient effects at the entrance. Daily Runs offer a single predetermined legal card, using the same modest preference for the chosen path.

## Fold portals

**Fold** is a shared, unique upgrade available to every path. Right-click a permanent wall, floor, or ceiling to place the blue opening, then right-click another surface to place orange. You can place each opening only once per room: after orange is placed, the pair stays fixed until the next room. Invalid attempts do not spend a placement. A dashed surface preview shows the next opening until both are placed; the touch placement button then disappears. Further placement attempts give a brief rejection cue. **E** places at the mouse aim point; on touch devices, select the small portal button, then tap a surface.

Walk or fall into either linked opening to emerge from the other. Momentum rotates with the exit: falling into a floor can launch you sideways from a wall. Friendly and hostile projectiles, smaller mobile enemies, crates, and canisters can pass through. Shots keep their damage, ownership, piercing, and bounce charges; teleporting is not a bounce. Enemies can follow you, and their bullets can come back through your own portals. Heavy bosses and anchored machines do not fit the opening.

Each opening needs 80 units of exposed permanent surface. Moving hazards, props, and destructible walls cannot host one. A single unlinked opening remains solid, and a blocked or undersized exit prevents travel. Portals reset at each room entrance, on retry, and when continuing a checkpoint; the Fold upgrade stays equipped. Opening the pause screen clears pending placement input. Portal travel cuts trails and snaps the camera to the destination instead of drawing or panning across the intervening map.

Rewire removes the placement limit while retaining exactly two portals. Its preview and touch placement button remain available after the first pair. Slingshot rewards player travel; enemy and projectile speeds are unchanged.

## Follow-up upgrades

Follow-ups enter the ordinary reward pool only after their prerequisite has been taken. Shared follow-ups stay available to every build path; Convergence, Deadlock, and Shockfront inherit their respective paths and their existing selection weight. A card needs no extra lock text or new menu. Checkpoints and Daily rewards validate the same prerequisite order.

| Upgrade     | Requires   | Effect                                                                                                                                                                                                                                                                                                                   |
| ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rewire      | Fold       | Unlimited alternating blue/orange replacements. Exactly two active portals; invalid attempts do not switch color.                                                                                                                                                                                                        |
| Slingshot   | Fold       | Player portal travel boosts velocity by 25%, within the normal movement caps, and grants 50% more damage to the next discharge. Repeated travel cannot stack or refresh either boost until firing.                                                                                                                       |
| Redline     | Kickback   | Damage scales with speed before recoil is applied, from no bonus at rest to 50% at speed 18. All pellets, rear rounds, and shell payloads share that discharge's bonus.                                                                                                                                                  |
| Breach      | Backblast  | The rear cone destroys visible hostile bullets within its existing 130-unit range. Cover blocks it even when that blast breaks the cover. Bombs, warned hazards, and machinery remain dangerous.                                                                                                                         |
| Shatter     | Splinter   | A first solid impact creates six outward fragments at 30% round damage, speed 20, and 0.6-second lifetime. Ordinary enemy hits still produce three fragments at 20%. No recursive splitting.                                                                                                                             |
| Convergence | Crossfire  | Outer lanes fan out, then turn inward halfway to the aim point fixed when firing. They cross and continue beyond it. Each pellet keeps its spread; Backfire mirrors the pattern. Near-muzzle aim has a minimum focus distance of 32 units. Cover stops shots; banks and portal travel cancel the old convergence target. |
| Deadlock    | Deadeye    | Each accurate discharge adds 12% damage to later discharges, capped at 60%. At least one direct, unblocked enemy hit qualifies, regardless of pellet or piercing count. A discharge whose main rounds all miss resets the streak. Results resolve in firing order; fragments and rear blasts cannot build it.            |
| Shockfront  | Aftershock | Echo radius grows by 50%, keeping 40% damage and adding stronger outward knockback. Cover and boss knockback resistance still apply. Echoes cannot create more echoes.                                                                                                                                                   |
| Backfire    | Backblast  | Adds a matching backward volley and another 20% firing delay. The aimed shot still applies the only recoil impulse.                                                                                                                                                                                                      |

Slingshot's ready charge appears as a blue strip on the gun. Redline warms the gun's lower edge as speed increases; Deadlock lights up to five tiny receiver marks. No extra HUD text is added. Charges and streaks survive pauses but reset on a new room, retry, death, or checkpoint reconstruction.

## Gun builds

| Modification | Effect and tradeoff                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Burst fire   | Three committed shots in quick succession, then recovery. Each round deals 10% less damage and has 20% less recoil. Aim can change between rounds. |
| Kickback     | 20% more damage and 40% more recoil, with no firing delay penalty. The damage bonus stacks with other modifications.                               |
| Backblast    | 25% more damage, plus a short rear cone for 80% of total pellet damage. Shot delays are 20% longer. Backward rounds require Backfire.              |
| Banker       | One additional bounce and 35% more damage after each reflection, starting with 20% less damage. Works on its own; Bank shot adds two more bounces. |
| Landing shot | A hard landing doubles the next discharge's damage and adds 25% recoil. Base damage is 10% lower. The gun glows when ready.                        |

Burst fire plus Scattershot fires three five-pellet volleys. Landing shot boosts all pellets of the next discharge, then the rest of a burst returns to ordinary damage. The boost lasts until your next shot or room change, so you can jump again and combine it with Airshot. Repeated landings do not stack charges.

Banked rounds change color as they gain damage. Punch through retains its damage reduction after each enemy, and Splinter only creates fragments on the first impact. Backblast fires its cone once per discharge, regardless of pellet count. Backfire unlocks a rear volley that mirrors the forward pellets, including airborne damage, Landing shot, bouncing, piercing, and Splinter; Burst fire sends all three discharges both ways. Both muzzles respect solid cover. The aimed shot applies recoil once, so the backward volley does not cancel your movement. At the base firing rate, Backblast increases the shot delay from 0.22 to 0.264 seconds. Backfire adds another 20%, bringing it to 0.3168 seconds. Pause cancels an unfinished burst while preserving its recovery time.

Existing modifications remain: Heavy hitter, Scattershot, Hair trigger, Bank shot, Punch through, Splinter, Airshot, Kickback, Bloodwork, and Light frame. No extra weapon slots or controls are needed.

## Levels

Escape through four areas, each with its own scenery, lighting, and layout pool:

- **Loading docks, rooms 1–4:** cold overhead lights, cargo shutters, low cover, and wide firing lanes. Two layouts drawn from loading bays, overpasses, staggered cargo, and terraces, then the Cargo switchyard and either The Loader in its loading bay or The Crane among raised shelves and cargo stacks.
- **Furnace halls, rooms 5–8:** warm boiler light, tall machinery, and tighter routes. Two layouts drawn from pillars, underpasses, a central chimney, a fortress, and slalom passages, then the Stamping line and The Press in its machine hall or The Kiln among low stacks and raised shelves.
- **Cooling Works, rooms 9–12:** teal tanks, overhead pipes, and shallow coolant channels. Two layouts drawn from settling tanks, a pump gallery, and a return channel, then the Spillway and either the Condenser hall or the Turbine gallery. Low stacks support ordinary jumping routes; higher shelves reward recoil movement. Coolant preserves sliding momentum without dealing damage or reducing steering. Lifts and crushers reuse their familiar warnings.
- **Rooftops, rooms 13–16:** open sky, a distant skyline, and steel walkways. Two layouts drawn from split decks, gantries, and broken bridges, then Antenna crossing and one of two rooftop finales. All three regular rooms contain an elite and multiple snipers, alongside faster shooters and the new Skimmer.

Each run has twelve different regular layouts and four boss arenas. Seeded mirrored variants change the approach, and enemies use spawn anchors matched to the actual terrain. Background machinery is scenery; solid surfaces have brighter top edges. Area changes happen at room entrances without extra prompts or HUD elements.

Climb stacks, fight from ledges, take lower routes, and use solid cover to break firing lines. The ground beneath raised gaps is safe. Every main route can be crossed with ordinary jumps; airborne recoil lets you skip steps and reach higher firing positions. The controls and HUD stay the same throughout the run.

Touch controls provide left, right, and jump buttons. Hold the arena to aim and fire. Keyboard and mouse offer the most precise control.

## The Interceptor

Room 16 has an equal chance of ending with the original rooftop boss or **The Interceptor**, a rival gunner on the Relay roof. An independent seeded draw preserves the other rooms and reconstructs the same finale on retry or Continue. Its arena has low cover, separated high shelves, a mirrored variant, and a route traversable with ordinary jumps. Both finales lead into the existing escape sequence.

The Interceptor fires opposite its travel direction to recoil between firing positions. A 0.56-second warning marks its launch volley and travel direction; physical walls, crates, fuel, and portals affect its hull normally. It flanks sheltered players instead of firing through cover. Aimed volleys lock for the final 0.36 seconds. Below two-thirds health they gain a separately warned follow-up, and below one-third they gain two. Seven-round heavy blasts warn for 1.1 seconds and kick the gunner backward, exposing its armor for 1.4, 1.3, or 1.2 seconds. Ordinary volleys recover for 1.1, 1.0, or 0.9 seconds. Open armor takes 130% damage; closed armor takes 35%. The boss has 4,800 health.

The compact silhouette, amber aiming lines, split armor, muzzle flash, and distinct gun sounds communicate the fight without adding controls or HUD panels. Practice unlocks only after defeating it in an ordinary or Daily Run. Existing rooftop victories keep their original arena. An explicit [Interceptor test link](https://caleb-guyer.github.io/recoil-foundry/?test=interceptor) starts an isolated fight with 100 health and fifteen upgrades; it preserves saves and records and grants no Practice unlocks. Press **R** to retry.

## The Turbine

Cooling Works ends with either the Condenser or **The Turbine**, selected independently from other rooms. The Turbine gallery has low stacks, separated shelves, and two coolant channels, with a mirrored variant and an ordinary jumping route.

The rotor moves around cover to find an angle wide enough for its blades. Gusts have a 1.15-second warning; blade sweeps have a 1.05-second warning. Both track early, then lock their entire marked fan for the final 0.45 seconds. Gusts push much harder in the air, adding to existing recoil momentum within the movement limits. Exposed crates and fuel move too; solid cover blocks the airflow.

A committed gust lasts 1.8 seconds and sends two blade passes through the marked lanes, 0.95 seconds apart. Sweeps release a wider fan. Each blade deals 22 damage, collides with scenery and props across its full width, and can travel through Fold portals. Wind itself deals no damage. Later phases widen the fan from three lanes to five; the final phase reverses the release order. Phase changes cancel unreleased blades and active wind.

After an attack, the center opens for 1.35, 1.25, or 1.15 seconds as the fight progresses. The exposed rotor takes 135% damage; closed armor takes 32%. The boss has 3,480 health. No new controls, meters, or encounter previews are added. Practice lists the Turbine only after a normal-run defeat. Previously earned Condenser victories retain their original practice arena even if their seed now selects the Turbine.

## Optional challenges

After clearing room 3, 7, 11, or 15, take the ordinary ground exit to continue or climb the two suspended steps to the upper **CHALLENGE** door. Its amber warning frame and small +1 symbol identify the risk and reward without revealing the encounter. The steps extend after combat and keep the ground exit clear. Both doors work by walking through them; there is no route menu.

The upper door gives the main room's earned upgrade and usual 12-health recovery, then enters an extra fight in the current area. Each area has its own authored challenge layout with mirrored variants, obstacles, active machinery, and larger coordinated waves. Regular enemies have 15% more health than at the same stage. Reinforcements arrive with two opening enemies still alive, keeping their full warning and emergence grace period.

Survive and take one bonus upgrade, with **no reward healing**, before rejoining the main route at the area's boss. Bloodwork can still heal from kills. Each detour can be taken once; a full run therefore contains 16–20 fights and 15–19 upgrades. The main room counter and final escape remain unchanged.

Continue remembers whether you entered a challenge, its starting health and gun, and completed detours. It restarts the saved fight without repaying the entrance reward. Fold gets its normal fresh placement allowance on entering and leaving a challenge. Daily Runs use the same doors and force one legal card at every reward, including bonuses. Practice has no detours.

## Reinforcements

Regular rooms have two compact waves: a small opening group, then the tougher part of the room’s roster. The second group reserves elites and mixes flyers with mobile ground enemies when that roster supports it. Both waves share the room’s fixed roster. Reinforcements do not add extra enemies or healing opportunities.

Regular enemies gain 8.5% of their base health per room after the first, including elites. Shooters and flyers attack more often through each area, with faster, harder-hitting bolts in the furnace and on the rooftops. Their warning windows stay readable. Arriving reinforcements still get a full door warning and emergence grace period before attacking.

Service-door lights turn amber and a short mechanical cue warns of the next group for 0.75 seconds. Clearing the opening group starts the warning immediately; from the furnace onward, opening groups of two or more call reinforcements while their last enemy remains. Each door opens as its enemy emerges. The exit unlocks only after both groups are defeated. Main-room rewards give the usual single upgrade and 12-health recovery; challenge bonuses give only the upgrade.

Doors wait if you, another enemy, or a moved prop block the entry. When another suitable authored entrance is free, that door gets its own full warning before the delayed enemy arrives. Shots and explosions do not damage enemies still behind sealed doors. Boss rooms and the final escape keep their existing encounters.

Wave composition and initial attack delays repeat from the seed, including Daily Runs. Continue and retry rebuild both groups at the room entrance. Pauses and impact pauses freeze arrivals. Door lights and sound carry the information without a wave counter or additional controls.

## Moving rooms

Regular rooms introduce one moving feature at a time. Room 2 introduces freight lifts, room 5 introduces crushers, and room 13 introduces collapsing platforms. Later regular rooms mix familiar features. The opening room and boss arenas stay clear of them. Placement follows the seed, including Daily Runs, with space around enemy entrances and safe ground underneath.

- **Freight lifts** travel smoothly between two heights. Ride them to reach ledges, or jump and fire downward to launch ahead. Crates can ride too; the deck blocks shots and provides moving cover.
- **Factory crushers** mark their strike lane when you approach. A 1.1-second warning gives you time to move out before the slab drops. It rests briefly, then slowly rises. A hit deals 24 damage and knocks you clear; enemies and props can also be crushed. The top is safe to stand on.
- **Collapsing platforms** crack under your feet for 0.7 seconds before giving way. Jump or recoil away, or drop to the floor below. They rebuild after 3.5 seconds, waiting until their space is clear before becoming solid again.

Rails, warning lights, floor markings, and cracks explain each feature in the arena. Pause and impact pauses freeze their timing. Continuing or retrying resets their state at the room entrance, with the same placement and lift cycle.

## Hidden routes

Look above the main path in the second room of each area for a recessed maintenance vent. Its cracked floor hatch and side panel break after two ordinary rounds, opening a passage to a higher perch. Shoot the hatch from below, then fire downward in the air to climb through. You can also open the side panel from outside. Crowded rooms omit the vent so the ordinary route remains clear.

Some vents contain a small mint health pickup. Touch it to recover 18 health, capped at 100; it stays available while you are at full health. Panels and walls block collection, bullets, aiming lines, and blasts until opened. Breaking metal flies in the shot's direction as harmless debris, with flight hidden when screen shake is disabled.

Passages and pickups follow the run seed, including Daily Runs. Continuing restores the room entrance with its original panels, pickup, and saved health. Boss arenas and the final escape contain none.

## Physics props

Rooms contain up to three small props, placed away from enemy entrances and the exit. Selected third rooms also contain one hanging load. Tall breakable panels stay off the main traversal route. Some furnace rooms contain a pair of canisters for a chain reaction.

- **Loose crates** can be pushed, stood on, or launched with gunfire. A fast crate impact damages enemies; ordinary pushing is harmless. Repeated shots eventually break the crate. Hard enemy body impacts damage crates; committed charges and heavy slams smash them.
- **Fuel canisters** launch and light up when shot. A hard impact detonates them, damaging nearby enemies and triggering nearby canisters. Hard enemy body impacts and direct charges or hammer slams detonate even unlit canisters. Charges stop in recovery on contact, including tipped props. Solid cover blocks the blast. Stay clear: close explosions can also hurt you.
- **Breakable panels** stop bullets and aiming lines. Three ordinary rounds break one, opening a new firing lane. Cracks show damage without a health bar.

Every enemy hull is solid against props, and the resting Crane hammer can support them. Swept charges and slams stop at the first solid object, respecting rotated prop surfaces and anything protected behind a wall. Props block enemy fire and rear blasts as well as ordinary shots. Banked rounds reflect from their actual rotated surfaces; gun modifications still combine on the same weapon. Surviving props do not prevent a room from clearing. Continuing a run restores its props at the room entrance, like enemies.

## Hanging cargo

Shoot the suspension cable to drop a heavy load. Two ordinary hits sever it; stronger rounds can cut it sooner. An amber outline, floor mark, and metal release sound give 0.65 seconds of warning before it falls. Enemy shots can cut cables too. No extra controls or HUD text are needed.

Fast impacts crush enemies and detonate even unlit fuel canisters, allowing nearby fuel chains. A direct hit costs the player 24 health. Boss damage is capped at 90 before the boss's usual armor or recovery multiplier. Resting contact is harmless. The 400-health load stays upright after landing: push it, stand on it, or use it as cover. Sustained gunfire can break it. Its wide hull does not fit portals, although bullets fired through portals can cut its cable.

Cargo appears sparsely in selected third-room layouts, with clear falling lanes away from exits and moving machinery. Placement follows the run seed and repeats on Continue and in Daily Runs. Pausing freezes the warning. Boss arenas, detours, and the final escape contain no hanging cargo.

[Test hanging cargo](https://caleb-guyer.github.io/recoil-foundry/?test=cargo): click **Test hanging cargo** to enter a room with a suspended load, full health, and two upgrades. Shoot the cable; press **R** to restart the room. This isolated test preserves ordinary saves, Daily records, and earned Practice victories.

## Conveyor belts

Moving rollers and amber arrows mark belts set flush into selected floors and platforms. They start slowly in the furnace, with faster belts and occasional pairs in Cooling Works and the rooftops. Ordinary ground remains at both ends, and placement avoids coolant, fixed cover, and moving machinery. Boss arenas, detours, docks, and the final escape contain no belts.

Belts carry grounded players, enemies, crates, unlit fuel canisters, and fallen cargo. Supported stacks move together, so a crate can become moving cover. Gun emplacements on belts become physical bodies after their entrance warning; their attack warnings and aim locks remain intact. Fixed panels and suspended cargo stay anchored.

Walking against a belt overcomes its pull. Jumping carries your horizontal momentum into the air, where recoil works normally and the belt stops affecting you. Walls still stop every hull; belts cannot accelerate cargo into damaging impacts by themselves or ignite unlit fuel. Portals work with carried players, enemies, and small props. Pauses and hitstop freeze transport, and Continue restores the same room entrance.

Try the [furnace belts](https://caleb-guyer.github.io/recoil-foundry/?test=conveyors) or [faster rooftop belts](https://caleb-guyer.github.io/recoil-foundry/?test=conveyors&area=rooftops). Click **Test conveyor belts**; **R** restarts the room. Both tests provide full health and a preset gun while preserving ordinary saves, Daily records, and earned Practice victories.

## Enemies

New behaviors appear gradually as the run advances:

- **Chargers** brace, then rush in a fixed direction. Bait one into cover: the crash leaves it stunned, harmless to touch, and vulnerable to extra damage.
- **Snipers** track with a thin aiming line. The line becomes solid when their aim locks; move before the fast shot follows. Solid cover stops both the aiming line and the shot.
- **Hoppers** crouch before jumping toward a landing spot. They climb ledges to follow you and pause after landing.

- **Skimmers** first appear in Cooling Works. These compact flying rotors navigate around cover, warn for 0.82 seconds, and fire three narrow jets. Aim locks for the final 0.34 seconds. Rooftop Skimmers recover faster and fire stronger bolts.

## Enemy squads

Selected rooms pair two existing enemies in the second reinforcement wave. Squads add no enemies, health, or damage bonuses. Both members use the usual warned entrances. Small matching chassis marks identify an active pair without labels or connecting lines.

- **Shield pushes**, available from room 5: a shield carrier advances while a mobile gunner follows behind. The gunner climbs low obstacles and steps off ledges to keep up. Its raised mount fires single rounds after a 0.85-second warning, locking direction for the final 0.35 seconds. It waits for a clear firing lane and cannot shoot through its carrier. The carrier retains its ordinary directional shield and slow turn.
- **Flanking pairs**, available from room 7: a gunner or sniper pressures you while a flyer physically routes around cover to your other side. The flyer keeps its usual three-shot volley and attack interval, holding position during its final aiming lock.
- **Sniper–hopper ambushes**, available from room 9: a hopper starts its full jump warning after the sniper locks aim. The sniper fires before the leap, then waits for the hopper to land before starting another warning. Landing targets and aiming lines keep their existing visual cues.

At most one pair forms in a room, and only when its roster contains suitable partners. Killing or teleporting either member breaks the formation. Members separated by a large distance also disengage; survivors use their ordinary behavior. Fuel blasts and falling cargo can break a pair. Squad rounds stop on other enemies without damaging them, so positioning an enemy between you and its partner blocks fire. Terrain, crates, portals, and moving machinery retain their normal physical rules. Boss rooms, detours, and the escape contain no squads.

Test each formation: [Shield push](https://caleb-guyer.github.io/recoil-foundry/?test=squads), [Flanking pair](https://caleb-guyer.github.io/recoil-foundry/?test=squads&formation=flank), or [Sniper–hopper](https://caleb-guyer.github.io/recoil-foundry/?test=squads&formation=ambush). Click **Test enemy squads** and clear the opening group to meet the pair in the second wave. **R** restarts the test entrance. These links preserve ordinary saves, Daily records, and earned Practice victories.

## Rare elites

Each run contains seven elites: two across the furnace rooms, two in Cooling Works, and one in each regular rooftop room. The first elite in each middle area appears in one of its first two combat rooms; its third room adds another. Later areas select a different elite type from the first furnace encounter when possible. An elite replaces one ordinary enemy at a safe existing spawn point. Early rooms and boss arenas contain none. The seed determines these encounters, including in Daily Runs and restored checkpoints.

- **Shielded runners** carry a visible front plate that absorbs 90% of direct shot damage. Blocked shots stop, including piercing rounds and fragments. Recoil overhead or behind them for full damage: they commit to a 0.65-second turn before moving the shield. Crates and explosions can crush through their guard.
- **Twin-shot snipers** have paired barrels and fire twice. The second shot has its own 0.65-second warning; its aim locks for the last 0.4 seconds. Keep moving or get behind cover, then attack during the longer recovery.
- **Volatile flyers** have a spiked body and slowly chase you. Close contact starts a 0.9-second fuse and locks them in place. Leave the marked blast area or destroy them to defuse it. Cover blocks the blast, which can also damage nearby enemies and ignite fuel canisters. They do not shoot or deal contact damage.

Silhouettes, shields, aiming lines, and fuse rings carry the information in the arena. There are no additional controls or elite menus.

## Area bosses

- **Room 4 — The Loader:** a tracked ram that braces for 0.9 seconds before charging in a fixed direction. Jump over its charge or bait it into the low bumpers. A crash leaves it harmless to touch for 1.25 seconds and taking 25% extra damage. Its armor reduces incoming damage by 60% while active. It hops obstacles and uses an aimed turret volley against players hovering overhead or camping a corner.
- **Room 4 — The Crane:** an overhead motor carries a suspended hammer. Its sweeps warn for 0.95 seconds and slams for 1.1 seconds; both lock their marked path for the final 0.45 seconds. Jump or recoil over a sweep and step out of a locked slam. The hammer stops on solid cover and smashes loose crates. A missed strike opens the motor shutters for 1.25 seconds, taking 40% extra damage. Closed shutters reduce incoming damage by 65%. Aim at the motor: the hammer blocks shots. A moving turret finds a clear firing lane when the hammer cannot reach you, including overhead hovering and protected corners.
- **Room 8 — The Press:** an overhead machine that marks a landing column before dropping. The final 0.65 seconds of the warning are locked, giving you time to dodge or recoil upward beside it. Platforms stop the slam; its 0.8-second recovery takes 25% extra damage before it rises again. Active armor reduces incoming damage by 60%. Its turret pressures players above it, behind a protected slam column, or camping a corner; it moves into position before attacking.
- **Room 8 — The Kiln:** a mobile boiler that lobs three molten shells over low cover, or four below half health. Curved warnings show their actual paths and landing surfaces for 1.1 seconds, locking for the final 0.5 seconds. Impacts leave short hot strips that glow for 0.4 seconds before burning for 1.8 seconds. Move out of the marked landing, then jump or recoil across the heat. Its cooling vents open for 1.5 seconds after each mortar volley, taking 35% extra damage; closed armor reduces incoming damage by 60%. It physically advances and hops stacks to find a turret firing lane against overhead or sheltered players. Cover blocks shells and turret shots.
- **Room 12 — The Condenser:** a floating cooling machine with twin aimed jet volleys and rotating radial purges. The follow-up has its own 0.72-second warning, with aim locked for the last 0.34 seconds. Purges show four wider gaps and keep their orientation once warned. Later phases follow with a second ring after a fresh 0.95-second warning, filling the previous gaps. Its rotor opens for 1.15 seconds after the sequence, taking 30% extra damage; closed armor reduces damage by 75%. It physically routes around cover to find a firing lane. Phase changes widen the jets and pause attacks briefly.
- **Room 16 — Rooftop boss:** physically flies around cover to find a clear firing lane. Its attacks change at two-thirds and one-third health: aimed volleys and wider fans, then radial patterns. Below two-thirds health, aimed attacks fire a second fully warned volley before recovery. Each pattern locks its aim for the final 0.3 seconds. Closed armor reduces damage by 70% during both warnings, then opens for 0.95, 0.85, or 0.75 seconds as the fight progresses. Phase changes reduce incoming damage by 65% for 0.75 seconds. Lights on its body show the phase.

Turret volleys warn for 0.85 seconds and lock their aim for the final 0.38 seconds. Dashed amber lines track you, then turn solid: move across the firing direction once they lock. Below half health, a new volley contains five bolts instead of three; the complete spread is shown before firing. Cover still blocks every projectile. Bosses resist bullet knockback. The longer route gives the Loader and Crane 920 health, the Press and Kiln 1,625, the Condenser 3,770, the Turbine 3,480, the rooftop boss 5,120, and the Interceptor 4,800. Boss health grows to match the extra upgrades; their existing warning and dodge windows stay intact.

Each boss has its own arena and silhouette. Separate seeded draws select the loading-docks, furnace, Cooling Works, and rooftop bosses, including in Daily Runs, and replaying or continuing that seed keeps the same selections. The docks, furnace, and Cooling Works bosses lead to the usual gun upgrade and 12-health recovery. Either final rooftop exit leads to the escape route. No extra controls or HUD panels are needed.

## Boss practice

Practice appears on the title screen after you defeat a boss in a normal or Daily Run. Its menu lists only bosses you have beaten, without locked entries, silhouettes, or a total count. Victories stay in this browser. Previous encounter-only unlocks do not carry over, because they did not record whether you won; defeat those bosses again to unlock them.

Choose a defeated boss to replay its arena with 100 health and a preset gun containing three, seven, eleven, or fifteen upgrades for that stage. Defeating the boss ends the practice fight. Retry from the result screen, or press **R** during a fight to restart immediately. Pause also offers Retry and Choose fight. The usual Your gun list shows the preset upgrades.

Practice preserves your normal checkpoint, Daily selection, and best times. Returning to the menu and choosing Continue restores your saved room with its original health and gun. Practice cannot unlock other encounters or advance into another room. Ordinary and Daily gameplay rules remain unchanged.

[Test the Turbine directly](https://caleb-guyer.github.io/recoil-foundry/?test=turbine): select **Test the Turbine** to start its isolated fight with 100 health and eight upgrades. Press **R** to retry. This explicit playtest link works before earning the boss, preserves your saved run and Daily records, and grants no Practice unlocks. The regular Practice menu still lists only bosses you have beaten during a run.

## Final escape

After defeating the last boss, leave through its exit to begin a continuous rooftop escape. Three clusters of failing machinery form a short traversal finale, with ordinary jumps along the lower route and faster recoil shortcuts above. Lights fade, debris falls in the background, and collapsing platforms crack before dropping away permanently. The ground stays safe, and there is no fatal countdown.

Follow the green direction marks to the extraction lift and land on its deck. Its gates close and it carries you away before the results appear. Your gun, health, upgrades, and elapsed time carry over from the boss fight. The room counter simply changes to **ESCAPE**; no extra weapon, upgrade, or panel is added. The rooftop score builds during the run and settles as the lift departs.

The escape entrance is saved automatically. Continue rebuilds the same route from that entrance, with the same gun and accumulated time; Again starts the complete run over. Pause and focus loss freeze both traversal and departure. Boarding stops the run timer, and the 2.6-second departure animation cannot cause damage or fire queued shots.

## Feel

- Buffered jumps, coyote time, variable jump height, and quick ground acceleration.
- Strong airborne recoil, preserved momentum, and bounded speeds.
- Directional camera kick and short screen shake, muzzle flashes, casings, impact sparks, kill pauses, and landing squash.
- Layered procedural gunfire and impact audio.
- A single health bar and room counter during play. Gun details and settings stay in the pause screen.

Screen shake can be disabled in Settings or Pause and initially respects the device's reduced-motion preference. Audio starts after a player interaction. The game pauses when the tab loses focus.

## Soundtrack

Each area has an original, quiet four-bar score synthesized in the browser: low mechanical beats in the docks, heavier percussion and bass in the furnace, and sparse airy melodies on the rooftops. Nearby enemies, active attacks, and sustained firing gradually add layers. Boss fights add rhythmic accents; cleared rooms and upgrade screens settle into soft harmony.

The music dips beneath attack warnings and damage sounds. It fades out on pause, results, the title screen, or loss of browser focus. Returning to play starts a fresh phrase; new runs and room entrances reset the arrangement. No audio files are downloaded, and the score never uses the gameplay random generator or changes Daily Run rules.

**Music** in Settings or Pause switches only the soundtrack. **Sound** is the master switch for both effects and music. Both preferences are saved in this browser, and an existing muted setting stays muted. Audio begins only after a player interaction; unsupported or blocked audio does not prevent playing.

Checkpoints save at room entrances. Continue reconstructs that room and area with its modified gun and saved health. Death clears the checkpoint. Existing version 3 saves remain compatible; their room number now selects from the new area pools. Saves stay in this browser. A `?seed=YOURSEED` URL repeats room layouts and upgrade selection within this version.

## Develop

Node.js 24 and npm:

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

| File                      | Responsibility                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `src/evolutions.ts`       | Per-discharge accuracy streaks, speed damage, and portal travel charges                |
| `src/game.ts`             | Matter.js simulation, movement, recoil, combat, and room progression                   |
| `src/enemies.ts`          | Enemy dimensions, health, attack timing, and boss patterns                             |
| `src/kiln-ai.ts`          | Mortar planning, swept shell collisions, surface heat, and boiler movement             |
| `src/kiln-art.ts`         | Boiler silhouette, cooling vents, arc warnings, and molten shell effects               |
| `src/expanded-layouts.ts` | Four additional third-room layouts, obstacles, spawn anchors, and traversal routes     |
| `src/levels.ts`           | Authored obstacle layouts, spawn anchors, traversal routes, and seeded level selection |
| `src/areas.ts`            | Area palettes, parallax scenery, and surface details                                   |
| `src/props.ts`            | Sparse prop placement, rotated hit detection, impact damage, and explosions            |
| `src/cargo.ts`            | Shootable suspension cables, delayed drops, and heavy impact interactions              |
| `src/cargo-layout.ts`     | Seeded cargo placement with clear cables and falling lanes                             |
| `src/cargo-art.ts`        | Suspension cables and restrained drop warnings                                         |
| `src/conveyors.ts`        | Ground transport, momentum, supported stacks, and physical enemy carriage              |
| `src/conveyor-layout.ts`  | Sparse seeded belt inserts with clear approaches and mirrored directions               |
| `src/conveyor-art.ts`     | Moving rollers, tread marks, and direction arrows                                      |
| `src/squads.ts`           | Seeded pairs, escort movement, flank goals, staggered attacks, and formation breakup   |
| `src/squad-art.ts`        | Escort aiming warnings using the actual projectile origin and blocked firing lane      |
| `src/demolition.ts`       | Explosive shell payloads, cover-aware blasts, launch impulses, and delayed chains      |
| `src/demolition-art.ts`   | Restrained blast outlines, delayed warnings, and reduced-motion effects                |
| `src/rules.ts`            | Gun modifications, seeded choices, swept collisions, and checkpoint validation         |
| `src/daily.ts`            | UTC challenge identity, versioned links, and validated local best times                |
| `src/practice.ts`         | Validated boss victory storage and stage-appropriate practice builds                   |
| `src/render.ts`           | Canvas world, camera feedback, character animation, and effects                        |
| `src/main.ts`             | Minimal UI, keyboard/pointer/touch input, pause, saves, and frame loop                 |
| `src/audio.ts`            | Shared Web Audio output, effects, and audio preferences                                |
| `src/music.ts`            | Bounded music scheduling, synthesis, fades, and warning ducking                        |
| `src/music-score.ts`      | Original area phrases and read-only combat intensity                                   |
| `src/style.css`           | Game menus and compact HUD                                                             |

Simulation runs at 60 Hz with a maximum of five catch-up steps per rendered frame. Projectiles use swept bounding-box intersections; piercing and bouncing consume the remaining travel within the current tick. Fragments never split again. Per-frame effects, projectile counts, and audio voices are bounded.

The test suite covers actual movement, recoil flight, extreme builds, projectiles, saves, sixteen-stage combat runs, layout variety, spawn clearances, and traversal in both directions. Enemy checks cover charge telegraphs and wall stuns, sniper aim locks and close cover, hopper landings and low ceilings, boss transitions and attack cycles, and frozen warnings during pause or hitstop. Upgrade checks cover burst timing and cancellation, rear-cone cover, compounded bounces, piercing and fragments, real hard landings, recoil braking, charge consumption, and checkpoint reconstruction.

Cargo checks cover deterministic placement, clear cables and falling lanes, fast bullets, full warning timing, real enemy and player collisions, fuel chains, every boss's resistance, landed cover, portal interactions, pause and death cleanup, saved entrances, isolated test links, and ordinary traversal with hanging and landed loads in all four areas and both mirrors.

Conveyor checks cover mirrored placement, clear approaches and machinery spacing, both travel directions, running against the fastest belt, airborne momentum and recoil, stacked cover, harmless fuel transport, anchored and airborne exclusions, enemy entrances and aim locks, walls, ledges, restored friction, bounded cargo speed, actual portal travel, pause and hitstop, Continue, Daily, and isolated test links. Full combat playthroughs use ordinary movement, normal health, and legal upgrades, with direct-fire builds jumping off belts during combat.

Squad checks cover unchanged rosters, gradual introductions, paired reinforcement entrances, physical escort and flank movement around obstacles, full warnings and aim locks, allied projectile occlusion, staggered sniper/hopper cycles, cargo and fuel counterplay, portal breakup, delayed doorways, pause and hitstop, deterministic normal and Daily entrances, and isolated test links.

Prop checks cover sparse placement, baseline route clearance, real crate impacts, safe slow contact, standing and jumping from crates, fuel launch and impact arming, rotated projectile hits, breakable firing lanes, blast occlusion and chains, immediate freezing on death, and fresh prop reconstruction from checkpoints.

Hidden-route checks cover panel collision and destruction, fast and close-muzzle shots, blast cover, physical passage after breaking, health collection and occlusion, harmless bounded debris, daily reproduction, and room-entrance restoration. Placement checks cover mirrored geometry, enemy and hazard clearances, baseline traversal, and actual recoil ascent through the hatch.

Shot-trail checks cover real collision corners, bounded path history, persistent styling after bounces or piercing, fragment exclusions, pause/reset cleanup, and unchanged projectile physics and combat randomness.

Reinforcement checks cover deterministic composition, full arrival warnings, blocked entries, room completion, one reward per room, pause and death, and fresh checkpoint reconstruction.

Area boss checks cover locked attack warnings, airborne camping versus reactive dodging, corner pressure, shotgun knockback resistance, transition armor, and physical flanking across both rooftop arenas and their mirrors. They also cover wide-body crashes, platform-edge landings, returning from beneath shelves, safe recovery windows, recoil escapes, pause and death cleanup, and exactly one upgrade after each intermediate boss.

Loader fuel checks cover direct contact in both directions, upright and rotated canisters, a complete warned charge, closing the braking gap before detonation, nearer walls shielding fuel, overhead misses, pause, and exactly one explosion.

Kiln checks cover seeded arena selection, unchanged non-furnace rooms, locked mortar plans, live collisions with cover and props, hot-strip warnings and expiry, vent armor, displaced-muzzle cancellation, and reactive combat in both mirrors. Shells and hot strips reset when restarting or leaving the room.

Practice checks cover victory-only unlocks, excluded practice wins and losses, malformed storage, every boss arena in both mirrors, fresh retry state, and resuming an untouched normal or Daily checkpoint.

Elite checks cover sparse deterministic placement, checkpoint reconstruction, directional shielding and flanking, piercing and rear blasts, the sniper's second aim lock, fuse timing and defusing, blast cover and chains, and immediate cancellation on death.

Moving-room checks cover seeded safe placement and traversal, lift riding and recoil escapes, moving cover, crusher warnings and swept damage, collapsing-platform timing and safe rebuilding, and pause, death, and checkpoint resets.

Escape checks cover final-boss entry, ordinary traversal and faster recoil routes, full-width physics and projectiles, permanent platform collapse, safe boarding and departure, checkpoint reconstruction, Daily Run timing, and exactly one victory after extraction.

Music checks cover area phrases and combat intensity, independence from gameplay state and RNG, scheduling after frame stalls, voice cleanup, pause and focus loss, warning ducking, independent music and master switches, and unavailable browser audio.

Daily checks cover UTC rollover and real calendar dates, versioned links, reproducible room and upgrade sequences, continued elapsed time, and corrupt or slower personal records. Browser checks also exercise title and result actions, retries, blocked storage, and both clipboard outcomes.

Enemy collision checks exercise all eleven enemy types with fast crates and gentle contact, hard impacts into stationary props, both ram directions, low tipped crates, Press and Crane slams, blocked impacts, the solid resting hammer, and props entering the motor rail. Complete combat runs retain normal health, earned upgrades, and real input, using solid-object navigation and two fighting distances.

Upgrade balance checks cover Kickback damage and unchanged firing cadence, full-range backward hits, mirrored scatter and burst volleys, one landing charge across both directions, rear bounce/pierce/splinter interactions, blocked rear muzzles, and fuel impacts. Boss camping checks still fail for the passive player; the complete combat runs reach extraction with normal health and earned upgrades.

Path tests cover entry and follow-up eligibility, concise path labels, incompatible-save rejection, replayed and continued rewards, 120 complete random/daily upgrade sequences, mirrored Crossfire bursts, Deadeye collision safety, Executioner thresholds and piercing, nonrecursive Death bloom kills, and sustained projectile limits. Full combat runs exercise Precision, Bullet hell, and Demolition builds with normal health and earned upgrades.

Portal checks cover grounded walking under normal gravity in both directions, raised supports, linking while already pressing against a wall, walking enemies, surface fitting, one fixed pair per room, all velocity orientations, swept high-speed travel, blocked exits, enemy rushes, close hostile muzzles, preserved projectile modifiers, props, pause/reset handling, and prevention of idle floor-to-floor loops. Path odds are checked over 40,000 deterministic draws. Three full combat runs retain fixed, legal earned-build offers to isolate combat from pool changes; a fourth reaches extraction with Demolition using the current weighted reward pool. Browser checks cover real right clicks, player travel, invalid placement, the desktop and phone-width upgrade card, and console errors.

Demolition checks cover direct and area damage, falloff, shield and boss armor, terrain and rotated-prop occlusion, real floor-shot launches, per-volley launch limits, bank and pierce payloads, air and landing bonuses, delayed and finite chains, escape boarding, checkpoint legality, deterministic path odds, portal travel, and sustained dense builds.

## Publish

GitHub Pages uses the included GitHub Actions workflow. Pushes to `main` run tests and a production build before deploying the static `dist/` directory. Relative assets also support other static hosts. No server or external game service is needed.

Physics: [Matter.js](https://brm.io/matter-js/) (MIT). Build: [Vite](https://vite.dev/) and [TypeScript](https://www.typescriptlang.org/). Artwork and sound are generated by the game's rendering and audio code. Game source is MIT licensed; dependencies retain their own licenses.

Cooling Works regression checks cover coolant momentum, locked jet volleys, separately warned follow-ups, rotating purge gaps, armor, physical cover navigation, pause and death cleanup, save migration, and final-area rosters. Full-run pilots use ordinary movement and firing inputs, with short trajectory prediction for the new ranged fights; they retain normal health and earn all fifteen upgrades before extraction. A rooftop placement regression keeps collapsing platforms away from the launch space beside steps.

Follow-up checks cover prerequisite rewards and saves, repeated portal replacement, capped travel and movement bonuses, defensive rear cones, wall fragment fans, converging lanes through cover and portals, firing-order accuracy streaks, enlarged echoes, and combined projectile/effect limits.

Detour tests cover both exit routes with ordinary movement, four mirrored challenge layouts, warned reinforcement entrances, direct and extended run progression, bonus healing rules, deterministic Daily routes, and continued challenge/escape checkpoints.

Turbine tests cover full warning and lock timing, both marked blade passes, airborne versus grounded wind, recoil preservation, solid cover and prop interactions, blade portals, pause and phase cancellation, saved entrances, earned Practice unlocks, and both mirrored fights. Reactive pilots win with normal health and eleven upgrades; passive overhead, corner, and cover camps lose.

Interceptor tests cover deterministic boss selection, full aiming locks and follow-up tells, physical recoil travel, cover and prop collisions, portal projectiles and hulls, cancellation after teleport or phase change, earned Practice unlocks, legacy rooftop victories, and the final escape. Reactive pilots win both mirrors with normal health and fifteen upgrades; tested overhead, corner, and cover camps lose. Its direct test link preserves normal saves and grants no victories.
