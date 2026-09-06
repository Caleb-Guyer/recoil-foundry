# Recoil Foundry

**Get the core home.**

A physics salvage roguelike for the browser. You're a scrap-yard rover towing the last working power core out of a failing freight facility. Its security system still considers the cargo stolen.

**[Play Recoil Foundry](https://caleb-guyer.github.io/recoil-foundry/)**

## The job

- Haul a physical core cart across six freight yards. Bring both rover and cargo to each lift; ordinary patrols can be fought or outrun.
- One fixed winch. The cable tows for free; hold right click or Shift to spend energy reeling the core closer. You can shoot while winching.
- Protect two things: the rover and its cargo. Hostile rounds damage the core; friendly fire, terrain, and debris don't. Losing either ends the run.
- Deliveries repair the rover and core, restore energy, and offer upgrades. Cargo cages absorb damage; patch kits improve repairs; a geared winch saves power.
- Four salvaged tools: rivet gun, breacher, cutting laser, and demo launcher. The first three deliveries unlock the next weapon.
- Sixteen upgrades with explicit effects and tradeoffs. Recoil, ricochets, fragments, beam penetration, and explosive debris interact through physics.
- Defeat the yard warden to unlock the final loading dock, then extract the core.

The game uses seeded layouts, patrols, and rewards. Three platform layouts receive procedural debris and encounters; the last dock has its own arena. Desktop keyboard and mouse are the primary input. Touch movement and winch buttons are also provided; hold the arena to aim and fire.

## Controls

| Action         | Input                             |
| -------------- | --------------------------------- |
| Move           | A / D or left / right arrows      |
| Jump           | W, Space, or up arrow             |
| Crouch         | S or down arrow                   |
| Aim / fire     | Mouse / left click                |
| Reel in core   | Hold right click or Shift         |
| Switch weapon  | 1–4, Q, or mouse wheel            |
| Deliver core   | E at a lift with the cargo nearby |
| Pause          | Escape or P                       |
| Choose upgrade | Click a card or press 1–3         |

The rivet gun costs no energy, so it remains available while the winch and advanced tools recharge. Explosions launch the rover and loose debris without self-damage. The core stays safe from your tools.

Checkpoints save at yard entrances. **Continue** reconstructs that yard with its saved loadout and rover/core integrity. Death clears the checkpoint. Saves and records stay in this browser and don't sync across devices. Older saves migrate to the fixed winch and cargo upgrades. Seeds reproduce generated content within this version, not exact physics replays.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

The production build is a static `dist/` directory. Relative asset paths support GitHub Pages project URLs and other static hosts. Fonts use the system sans-serif family; all game assets and the physics engine are bundled locally.

## Architecture

| File            | Purpose                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| `src/game.ts`   | Fixed-step physics, combat, towing, cargo damage, deliveries, and progression      |
| `src/rules.ts`  | Upgrade stats, seeded generation, collision helpers, save validation and migration |
| `src/render.ts` | Canvas rendering, camera, rover, tow cable, cargo, and effects                     |
| `src/main.ts`   | Input, dialogs, compact HUD, persistence, and game loop                            |
| `src/audio.ts`  | Synthesized Web Audio effects                                                      |
| `src/style.css` | Responsive game interface                                                          |

Matter.js runs at 60 Hz. The rover and cargo are connected by a spring constraint with a shorter rest length under power. Cargo collides with terrain only, preventing debris or stationary sentries from blocking delivery. Projectiles use swept bounding-box intersections with terrain, cover, and valid targets. Collider bounds approximate rotated shapes.

Simulation catches up at most five steps per rendered frame and pauses when the page loses focus. Enemies, projectiles, and particles have explicit caps. Cosmetic randomness stays separate from encounter and reward generation. Upgrade stats are recalculated from the owned set; fragments cannot split recursively; energy credits are capped per trigger pull; debris impact damage uses incoming speed and per-target cooldowns.

## Validation

Node tests exercise actual Matter.js movement and grounding, zero-energy towing across layouts, simultaneous winch/fire input, cargo damage and repairs, fall recovery, delivery gates, all six stages, save migration, collision damage, grenade idempotence, bounded fragmentation, and a stress encounter. Stat tests cover every pair of the sixteen upgrades. Production builds type-check the application first.

## Deploy to GitHub Pages

In repository **Settings → Pages**, select **GitHub Actions** as the source. The included workflow installs dependencies, runs tests, builds the game, and deploys `dist/` on pushes to `main`.

The game needs no server, account, API key, or database.

## Dependencies and assets

- Physics: [Matter.js](https://brm.io/matter-js/) by Liam Brummitt and contributors (MIT).
- Build tools: [Vite](https://vite.dev/) and [TypeScript](https://www.typescriptlang.org/).
- Artwork: procedural geometric rendering. Audio: synthesized Web Audio effects.

Game source is available under the MIT license. Dependency licenses remain with their respective authors.
