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

Shoot downward in the air to climb. Shoot sideways to launch yourself the other way. Recoil is almost five times stronger in the air; steering preserves speed above the normal running limit. Clear every enemy, then walk through the door on the right. The final room has a boss.

You always carry **one gun**. Ten possible modifications change its shots, recoil, handling, or healing: Heavy hitter, Scattershot, Hair trigger, Bank shot, Punch through, Splinter, Airshot, Kickback, Bloodwork, and Light frame. Choose one of three after each room; each choice also restores 20 health.

## Levels

Each run selects eight different obstacle layouts, then one of two boss arenas. Twelve regular layouts include loading bays, overpasses, terraces, pillar halls, underpasses, split decks, gantries, a central chimney, a fortress, broken bridges, and a slalom through overhead blocks. Seeded mirrored variants change the approach, and enemies use spawn anchors matched to the actual terrain.

Climb stacks, fight from ledges, take lower routes, and use solid cover to break firing lines. The ground beneath raised gaps is safe. Every main route can be crossed with ordinary jumps; airborne recoil lets you skip steps and reach higher firing positions. The controls and HUD stay the same throughout the run.

Touch controls provide left, right, and jump buttons. Hold the arena to aim and fire. Keyboard and mouse offer the most precise control.

## Feel

- Buffered jumps, coyote time, variable jump height, and quick ground acceleration.
- Strong airborne recoil, preserved momentum, and bounded speeds.
- Directional camera kick and short screen shake, muzzle flashes, casings, impact sparks, kill pauses, and landing squash.
- Layered procedural gunfire and impact audio.
- A single health bar and room counter during play. Gun details and settings stay in the pause screen.

Screen shake can be disabled in Settings or Pause and initially respects the device's reduced-motion preference. Audio starts after a player interaction. The game pauses when the tab loses focus.

Checkpoints save at room entrances. Continue reconstructs that room with its modified gun and saved health. Death clears the checkpoint. This rebuild uses a new save format; runs from the previous game rules do not resume. Saves stay in this browser. A `?seed=YOURSEED` URL repeats room layouts and upgrade selection within this version.

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

| File            | Responsibility                                                                         |
| --------------- | -------------------------------------------------------------------------------------- |
| `src/game.ts`   | Matter.js simulation, movement, recoil, combat, and room progression                   |
| `src/levels.ts` | Authored obstacle layouts, spawn anchors, traversal routes, and seeded level selection |
| `src/rules.ts`  | Gun modifications, seeded choices, swept collisions, and checkpoint validation         |
| `src/render.ts` | Canvas world, camera feedback, character animation, and effects                        |
| `src/main.ts`   | Minimal UI, keyboard/pointer/touch input, pause, saves, and frame loop                 |
| `src/audio.ts`  | Layered Web Audio effects                                                              |
| `src/style.css` | Game menus and compact HUD                                                             |

Simulation runs at 60 Hz with a maximum of five catch-up steps per rendered frame. Projectiles use swept bounding-box intersections; piercing and bouncing consume the remaining travel within the current tick. Fragments never split again. Per-frame effects, projectile counts, and audio voices are bounded.

The test suite covers actual movement, jump height, recoil flight, momentum preservation, camera feedback, restart timing, wall containment under extreme builds, piercing, fragmentation, saves, progression, seeded layout variety, clear spawn positions, and traversal of every layout in both directions.

## Publish

GitHub Pages uses the included GitHub Actions workflow. Pushes to `main` run tests and a production build before deploying the static `dist/` directory. Relative assets also support other static hosts. No server or external game service is needed.

Physics: [Matter.js](https://brm.io/matter-js/) (MIT). Build: [Vite](https://vite.dev/) and [TypeScript](https://www.typescriptlang.org/). Artwork and sound are generated by the game's rendering and audio code. Game source is MIT licensed; dependencies retain their own licenses.
