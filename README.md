# Recoil Foundry

**One gun. All recoil.**

[Play in your browser](https://caleb-guyer.github.io/recoil-foundry/)

A physics roguelike about staying in motion. Clear nine stages, change your gun between fights, and get out. No inventory, ammunition, energy, cargo, or ability selection.

## Play

| Input                | Action                     |
| -------------------- | -------------------------- |
| A / D or arrows      | Move                       |
| Space / W / up arrow | Jump; hold for more height |
| Mouse                | Aim                        |
| Left click / hold    | Fire                       |
| Escape / P           | Pause                      |
| 1–3 during upgrades  | Choose a modification      |

Shoot downward in the air to climb. Shoot sideways to launch yourself the other way. Recoil is almost five times stronger in the air; steering preserves speed above the normal running limit. Clear every enemy, then walk through the door on the right. Each area ends with a boss.

You always carry **one gun**. Fourteen possible modifications change its shots, recoil, handling, or healing. Choose one of three after each room; each choice also restores 20 health. Eight picks per run leave room for different builds.

Your gun's shape reflects its build: Heavy hitter adds a thick sliding barrel, Scattershot widens the muzzle, and Burst fire cycles a bolt and three recessed chambers. These parts combine on the same weapon. Banked rounds leave short mint trails along their actual bounce paths; piercing rounds leave thin pale-blue streaks. Combined rounds keep both cues. Screen-shake settings also reduce the weapon animation and muzzle flash. These visual changes preserve existing gun stats and Daily Run records.

## Daily run

Choose **Daily run** on the title screen for a shared nine-room challenge. A new challenge starts at midnight UTC. Everyone gets the same layouts, enemy and prop setup, and predetermined upgrade sequence. After each of the first eight rooms, a single card shows your next upgrade: click it or press 1 to take it and continue, with the usual 20-health recovery. There are no alternative upgrades in a Daily Run. Regular runs keep their three choices. The gun, movement, and combat HUD are unchanged.

Finish all nine rooms and reach the extraction lift to save your fastest successful time for that challenge in this browser. The timer counts active simulation time through the escape route, excluding pauses, upgrade screens, and the automatic lift departure. Continue keeps the elapsed time saved at the room or escape entrance; Again restarts the same challenge, even after midnight. Starting a new run replaces the existing checkpoint.

The room counter marks active challenges with **DAILY**, and Pause shows the challenge date. Starting a daily updates its URL and keeps **Play daily** selected when returning to the menu; choose **Random run** to leave the daily. Saves from an unsupported daily ruleset cannot continue as an ordinary run. Their saved data stays untouched until you start another run.

The result screen's **Copy challenge link** button lets a friend play that exact day, including past challenges. If automatic copying is unavailable, the link appears for manual copying. Records stay on this device; no account or leaderboard is needed. Up to 365 challenge records are kept. Blocking browser storage prevents saving but does not prevent play.

Daily links include a ruleset version (`?daily=2026-09-06&dv=6`). Version 6 adds breakable vent passages and health pickups; its best times are separate from earlier rulesets. Passage placement and pickups repeat for everyone playing the same challenge. The final escape route is the same for every player. Bump `DAILY_RULESET` in `src/daily.ts` when changing layouts, upgrade pools, or gameplay balance. Unsupported or invalid daily links show a short notice and leave ordinary play available; they never silently launch a different daily challenge.

## Gun builds

| Modification | Effect and tradeoff                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Burst fire   | Three committed shots in quick succession, then recovery. Each round deals 10% less damage and has 20% less recoil. Aim can change between rounds. |
| Backblast    | Each discharge also hits a short rear cone for 80% of its total pellet damage. Solid cover blocks it. Shot delays are 15% longer.                  |
| Banker       | One additional bounce and 35% more damage after each reflection, starting with 20% less damage. Works on its own; Bank shot adds two more bounces. |
| Landing shot | A hard landing doubles the next discharge's damage and adds 25% recoil. Base damage is 10% lower. The gun glows when ready.                        |

Burst fire plus Scattershot fires three five-pellet volleys. Landing shot boosts all pellets of the next discharge, then the rest of a burst returns to ordinary damage. The boost lasts until your next shot or room change, so you can jump again and combine it with Airshot. Repeated landings do not stack charges.

Banked rounds change color as they gain damage. Punch through retains its damage reduction after each enemy, and Splinter only creates fragments on the first impact. Backblast fires once per discharge, regardless of pellet count. Pause cancels an unfinished burst while preserving its recovery time.

Existing modifications remain: Heavy hitter, Scattershot, Hair trigger, Bank shot, Punch through, Splinter, Airshot, Kickback, Bloodwork, and Light frame. No extra weapon slots or controls are needed.

## Levels

Escape through three areas, each with its own scenery, lighting, and layout pool:

- **Loading docks, rooms 1–3:** cold overhead lights, cargo shutters, low cover, and wide firing lanes. Two layouts drawn from loading bays, overpasses, staggered cargo, and terraces, then The Loader in its loading bay.
- **Furnace halls, rooms 4–6:** warm boiler light, tall machinery, and tighter routes. Two layouts drawn from pillars, underpasses, a central chimney, a fortress, and slalom passages, then The Press in its machine hall.
- **Rooftops, rooms 7–9:** open sky, a distant skyline, and steel walkways. Two layouts drawn from split decks, gantries, and broken bridges, followed by one of two rooftop boss arenas.

Each run has six different regular layouts and three boss arenas. Seeded mirrored variants change the approach, and enemies use spawn anchors matched to the actual terrain. Background machinery is scenery; solid surfaces have brighter top edges. Area changes happen at room entrances without extra prompts or HUD elements.

Climb stacks, fight from ledges, take lower routes, and use solid cover to break firing lines. The ground beneath raised gaps is safe. Every main route can be crossed with ordinary jumps; airborne recoil lets you skip steps and reach higher firing positions. The controls and HUD stay the same throughout the run.

Touch controls provide left, right, and jump buttons. Hold the arena to aim and fire. Keyboard and mouse offer the most precise control.

## Moving rooms

Regular rooms introduce one moving feature at a time. Room 2 introduces freight lifts, room 4 introduces crushers, and room 7 introduces collapsing platforms. Later regular rooms mix familiar features. The opening room and boss arenas stay clear of them. Placement follows the seed, including Daily Runs, with space around enemy entrances and safe ground underneath.

- **Freight lifts** travel smoothly between two heights. Ride them to reach ledges, or jump and fire downward to launch ahead. Crates can ride too; the deck blocks shots and provides moving cover.
- **Factory crushers** mark their strike lane when you approach. A 1.1-second warning gives you time to move out before the slab drops. It rests briefly, then slowly rises. A hit deals 24 damage and knocks you clear; enemies and props can also be crushed. The top is safe to stand on.
- **Collapsing platforms** crack under your feet for 0.7 seconds before giving way. Jump or recoil away, or drop to the floor below. They rebuild after 3.5 seconds, waiting until their space is clear before becoming solid again.

Rails, warning lights, floor markings, and cracks explain each feature in the arena. Pause and impact pauses freeze their timing. Continuing or retrying resets their state at the room entrance, with the same placement and lift cycle.

## Hidden routes

Look above the main path in the second room of each area for a recessed maintenance vent. Its cracked floor hatch and side panel break after two ordinary rounds, opening a passage to a higher perch. Shoot the hatch from below, then fire downward in the air to climb through. You can also open the side panel from outside. Crowded rooms omit the vent so the ordinary route remains clear.

Some vents contain a small mint health pickup. Touch it to recover 18 health, capped at 100; it stays available while you are at full health. Panels and walls block collection, bullets, aiming lines, and blasts until opened. Breaking metal flies in the shot's direction as harmless debris, with flight hidden when screen shake is disabled.

Passages and pickups follow the run seed, including Daily Runs. Continuing restores the room entrance with its original panels, pickup, and saved health. Boss arenas and the final escape contain none.

## Physics props

Rooms contain up to three props, placed away from enemy entrances and the exit. Tall breakable panels stay off the main traversal route. Some furnace rooms contain a pair of canisters for a chain reaction.

- **Loose crates** can be pushed, stood on, or launched with gunfire. A fast crate impact damages enemies; ordinary pushing is harmless. Repeated shots eventually break the crate.
- **Fuel canisters** launch and light up when shot. A hard impact detonates them, damaging nearby enemies and triggering nearby canisters. Solid cover blocks the blast. Stay clear: close explosions can also hurt you.
- **Breakable panels** stop bullets and aiming lines. Three ordinary rounds break one, opening a new firing lane. Cracks show damage without a health bar.

Props block enemy fire and rear blasts as well as ordinary shots. Banked rounds reflect from their actual rotated surfaces; gun modifications still combine on the same weapon. Surviving props do not prevent a room from clearing. Continuing a run restores its props at the room entrance, like enemies.

## Enemies

New behaviors appear gradually as the run advances:

- **Chargers** brace, then rush in a fixed direction. Bait one into cover: the crash leaves it stunned, harmless to touch, and vulnerable to extra damage.
- **Snipers** track with a thin aiming line. The line becomes solid when their aim locks; move before the fast shot follows. Solid cover stops both the aiming line and the shot.
- **Hoppers** crouch before jumping toward a landing spot. They climb ledges to follow you and pause after landing.

## Rare elites

Each run contains two different elites: one in a regular furnace room and one in a regular rooftop room. An elite replaces one ordinary enemy at a safe existing spawn point. Early rooms and boss arenas contain none. The seed determines both encounters, including in Daily Runs and restored checkpoints.

- **Shielded runners** carry a visible front plate that absorbs 90% of direct shot damage. Blocked shots stop, including piercing rounds and fragments. Recoil overhead or behind them for full damage: they commit to a 0.65-second turn before moving the shield. Crates and explosions can crush through their guard.
- **Twin-shot snipers** have paired barrels and fire twice. The second shot has its own 0.65-second warning; its aim locks for the last 0.4 seconds. Keep moving or get behind cover, then attack during the longer recovery.
- **Volatile flyers** have a spiked body and slowly chase you. Close contact starts a 0.9-second fuse and locks them in place. Leave the marked blast area or destroy them to defuse it. Cover blocks the blast, which can also damage nearby enemies and ignite fuel canisters. They do not shoot or deal contact damage.

Silhouettes, shields, aiming lines, and fuse rings carry the information in the arena. There are no additional controls or elite menus.

## Area bosses

- **Room 3 — The Loader:** a tracked ram that braces for 0.9 seconds before charging in a fixed direction. Jump over its charge or bait it into the low bumpers. A crash leaves it harmless to touch for 1.7 seconds and taking 50% extra damage. It hops the bumpers when repositioning, so it can follow you across the bay.
- **Room 6 — The Press:** an overhead machine that marks a landing column before dropping. The final 0.65 seconds of the warning are locked, giving you time to dodge or recoil upward beside it. Platforms stop the slam; it rests briefly after impact and takes 35% extra damage before rising for another attack.
- **Room 9 — Rooftop boss:** its attacks change at two-thirds and one-third health. Aimed volleys give way to alternating downward fans, then a cycle that adds slow radial volleys with gaps. Each pattern has a visible windup. Phase changes briefly interrupt the boss, and lights on its body show its current phase.

Each boss has its own arena and silhouette. The Loader and Press lead to the usual gun upgrade and 20-health recovery. The final rooftop exit leads to the escape route. Existing room-entrance saves resume with the correct boss; no extra controls or HUD panels are needed.

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

| File                 | Responsibility                                                                         |
| -------------------- | -------------------------------------------------------------------------------------- |
| `src/game.ts`        | Matter.js simulation, movement, recoil, combat, and room progression                   |
| `src/enemies.ts`     | Enemy dimensions, health, attack timing, and boss patterns                             |
| `src/levels.ts`      | Authored obstacle layouts, spawn anchors, traversal routes, and seeded level selection |
| `src/areas.ts`       | Area palettes, parallax scenery, and surface details                                   |
| `src/props.ts`       | Sparse prop placement, rotated hit detection, impact damage, and explosions            |
| `src/rules.ts`       | Gun modifications, seeded choices, swept collisions, and checkpoint validation         |
| `src/daily.ts`       | UTC challenge identity, versioned links, and validated local best times                |
| `src/render.ts`      | Canvas world, camera feedback, character animation, and effects                        |
| `src/main.ts`        | Minimal UI, keyboard/pointer/touch input, pause, saves, and frame loop                 |
| `src/audio.ts`       | Shared Web Audio output, effects, and audio preferences                                |
| `src/music.ts`       | Bounded music scheduling, synthesis, fades, and warning ducking                        |
| `src/music-score.ts` | Original area phrases and read-only combat intensity                                   |
| `src/style.css`      | Game menus and compact HUD                                                             |

Simulation runs at 60 Hz with a maximum of five catch-up steps per rendered frame. Projectiles use swept bounding-box intersections; piercing and bouncing consume the remaining travel within the current tick. Fragments never split again. Per-frame effects, projectile counts, and audio voices are bounded.

The test suite covers actual movement, recoil flight, extreme builds, projectiles, saves, nine-stage combat runs, layout variety, spawn clearances, and traversal in both directions. Enemy checks cover charge telegraphs and wall stuns, sniper aim locks and close cover, hopper landings and low ceilings, boss transitions and attack cycles, and frozen warnings during pause or hitstop. Upgrade checks cover burst timing and cancellation, rear-cone cover, compounded bounces, piercing and fragments, real hard landings, recoil braking, charge consumption, and checkpoint reconstruction.

Prop checks cover sparse placement, baseline route clearance, real crate impacts, safe slow contact, standing and jumping from crates, fuel launch and impact arming, rotated projectile hits, breakable firing lanes, blast occlusion and chains, immediate freezing on death, and fresh prop reconstruction from checkpoints.

Hidden-route checks cover panel collision and destruction, fast and close-muzzle shots, blast cover, physical passage after breaking, health collection and occlusion, harmless bounded debris, daily reproduction, and room-entrance restoration. Placement checks cover mirrored geometry, enemy and hazard clearances, baseline traversal, and actual recoil ascent through the hatch.

Shot-trail checks cover real collision corners, bounded path history, persistent styling after bounces or piercing, fragment exclusions, pause/reset cleanup, and unchanged projectile physics and combat randomness.

Area boss checks cover locked attack warnings, wide-body crashes and platform-edge landings, bumper traversal, safe recovery windows, recoil escapes, attacks at world boundaries, pause and death cleanup, and exactly one upgrade after each intermediate boss.

Elite checks cover sparse deterministic placement, checkpoint reconstruction, directional shielding and flanking, piercing and rear blasts, the sniper's second aim lock, fuse timing and defusing, blast cover and chains, and immediate cancellation on death.

Moving-room checks cover seeded safe placement and traversal, lift riding and recoil escapes, moving cover, crusher warnings and swept damage, collapsing-platform timing and safe rebuilding, and pause, death, and checkpoint resets.

Escape checks cover final-boss entry, ordinary traversal and faster recoil routes, full-width physics and projectiles, permanent platform collapse, safe boarding and departure, checkpoint reconstruction, Daily Run timing, and exactly one victory after extraction.

Music checks cover area phrases and combat intensity, independence from gameplay state and RNG, scheduling after frame stalls, voice cleanup, pause and focus loss, warning ducking, independent music and master switches, and unavailable browser audio.

Daily checks cover UTC rollover and real calendar dates, versioned links, reproducible room and upgrade sequences, continued elapsed time, and corrupt or slower personal records. Browser checks also exercise title and result actions, retries, blocked storage, and both clipboard outcomes.

## Publish

GitHub Pages uses the included GitHub Actions workflow. Pushes to `main` run tests and a production build before deploying the static `dist/` directory. Relative assets also support other static hosts. No server or external game service is needed.

Physics: [Matter.js](https://brm.io/matter-js/) (MIT). Build: [Vite](https://vite.dev/) and [TypeScript](https://www.typescriptlang.org/). Artwork and sound are generated by the game's rendering and audio code. Game source is MIT licensed; dependencies retain their own licenses.
