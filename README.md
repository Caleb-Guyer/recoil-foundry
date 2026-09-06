# Recoil Foundry

**Weaponize your momentum.**

A single-player physics action roguelike built for the browser. Pilot an experimental machine through a failing research facility, combine technologies, and shut down the prime mover.

**[Play Recoil Foundry](https://caleb-guyer.github.io/recoil-foundry/)**

## The experiment

- Six sectors: five combat encounters and a reactor boss.
- Four weapons: coil driver, scatter array, photon lance, and impulse mortar.
- Two starting fields: reflect projectiles with the repulsor, or catch and throw crates with the tractor.
- Sixteen technologies with explicit effects, tradeoffs, and equipment prerequisites.
- Physical recoil, ricochets, fragmentation, thrown-object damage, beam penetration, and explosions that launch objects.
- Seeded room layouts, encounters, and rewards. Three authored platform layouts are populated procedurally; the reactor has its own arena.
- Local checkpoints at sector entrances, run records, optional sound, reduced screen shake, and touch controls.

Desktop keyboard and mouse are the primary input. The interface also provides touch movement/field controls; touch and aim inside the arena to fire.

## Controls

| Action | Input |
| --- | --- |
| Move | A / D or left / right arrows |
| Jump | W, Space, or up arrow |
| Crouch | S or down arrow |
| Aim / fire | Mouse / left click |
| Field | Hold right click or Shift |
| Switch weapon | 1–4, Q, or mouse wheel |
| Activate cleared exit | E near the exit |
| Pause | Escape or P |
| Choose technology | Click a card or press 1–3 |

Shoot downward with the scatter array to extend jumps. The coil driver does not consume energy; it remains useful while advanced weapons recharge. Explosions push you without self-damage. Clearing each of the first three sectors unlocks another weapon.

Death ends the current run. Reloading or choosing **Resume** reconstructs the latest sector from its entrance checkpoint, including the saved loadout. Checkpoints and records are stored in this browser and do not sync across devices. Seeds reproduce generated content within this game version, not exact physics replays.

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

The production build is a static `dist/` directory. Relative asset paths support a GitHub Pages project URL or another static host. The interface requests Google Fonts and has local system-font fallbacks; the game runtime and physics engine are bundled in the build.

## Architecture

| File | Purpose |
| --- | --- |
| `src/game.ts` | Fixed-step simulation, combat, enemy behavior, field interactions, and progression |
| `src/rules.ts` | Technology definitions, derived stats, seeded generation, collision helpers, save validation |
| `src/render.ts` | Canvas rendering, camera, geometric machinery, projectiles, and effects |
| `src/main.ts` | Input, native dialogs, HUD, checkpoint persistence, and game loop |
| `src/audio.ts` | Procedural Web Audio effects |
| `src/style.css` | Responsive game interface |

Matter.js simulates the player, enemies, platforms, and crates at 60 Hz. Lightweight projectiles use swept bounding-box intersections, which prevent tunneling through thin obstacles. Collider bounds are an intentional approximation for projectile hits on rotated shapes.

Simulation work is bounded to five catch-up steps per rendered frame. The world pauses when the page loses focus or becomes hidden. Projectiles, particles, and enemies have explicit caps. Cosmetic randomness uses a separate source from encounter and reward generation.

Technology stats are recalculated from the owned set. Secondary fragments cannot fragment again; induction credits are capped per trigger pull; crate impacts have per-target cooldowns. Object impact damage uses incoming velocity, before the physics solver slows the crate.

## Validation

Automated Node tests exercise actual Matter.js movement and grounding, crouch rotation, energy recovery, field reflection/capture, thrown-crate damage, grenade idempotence, bounded fragmentation, save validation, all six progression stages, and a stress encounter. The stat tests cover every pair of the sixteen technologies. Production builds type-check the application first.

## Deploy to GitHub Pages

In repository **Settings → Pages**, select **GitHub Actions** as the source. The included workflow installs dependencies, runs the test suite, builds the static game, and deploys `dist/` on pushes to `main`.

The application needs no server, account, API key, or database. There are no online leaderboards or multiplayer systems in this release.

## Credits

Original game implementation inspired by the systemic physics combat of [N-Gon](https://github.com/landgreen/n-gon).

- Physics: [Matter.js](https://brm.io/matter-js/) by Liam Brummitt and contributors (MIT).
- Build tools: [Vite](https://vite.dev/) and [TypeScript](https://www.typescriptlang.org/).
- Typefaces: Barlow, Barlow Condensed, and IBM Plex Mono through Google Fonts.
- Artwork: procedural geometric game rendering. Audio: synthesized Web Audio effects.

Game source is available under the MIT license. Dependency licenses remain with their respective authors.
