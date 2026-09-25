# Recoil Foundry

**One gun. All recoil.**

[Play free on itch.io](https://caleb-guyer.itch.io/recoil-foundry) · [GitHub mirror](https://caleb-guyer.github.io/recoil-foundry/) · [Watch gameplay](https://caleb-guyer.github.io/recoil-foundry/media/gameplay.mp4)

A physics roguelike set inside a hostile factory. Build one gun between fights, use its kick to throw yourself through the air, and survive twenty rooms across five areas. Shoot down. Go up.

![Recoil flight in the Loading Docks](public/media/loading-docks.png)

- **100 upgrades** with branching paths and combinations that change how your gun works.
- Shifting room layouts, physical obstacles, optional fights and surprises worth finding yourself.
- A **Daily Run** with the same seed and fixed upgrade choices for everyone.
- A Logbook to uncover, unlocked boss Practice, a Workshop for builds, and death replays.
- An original procedural soundtrack and separate music/effects controls.

**The full browser release is complete. Latest patch: 2.98.1.** Future fixes and updates can continue. [Release notes](docs/releases/2.98.1.md) · [Download the static site](https://github.com/Caleb-Guyer/recoil-foundry/releases/tag/v2.98.1).

## Controls

| Input                        | Action                     |
| ---------------------------- | -------------------------- |
| A / D or left / right arrows | Move                       |
| Space / W / up arrow         | Jump; hold for more height |
| Mouse                        | Aim                        |
| Left click or F              | Fire                       |
| Right click or E             | Equipped secondary action  |
| Escape / P                   | Pause                      |
| H                            | Controls                   |
| 1–3 at a reward              | Choose an upgrade          |

Shooting downward while airborne lifts you up. Shooting sideways pushes you the other way. **Controls → Try controls** gives you a safe place to learn. Rebind keys in **Settings → Keyboard & mouse**.

## Saves, settings and help

Progress stays in this browser on this device. **Settings → Progress** exports a backup or restores one. Moving to another browser or between itch.io and the GitHub mirror does not move your save automatically; export from the old location, then import at the new one.

If the game is silent, check **Sound**, **Music enabled**, and both volume sliders in Settings. **Reduced effects** lowers shake, flashes and particles while keeping attack warnings visible.

The supported target is **Windows desktop/laptop with keyboard and mouse**. Edge has the most complete verification; basic gameplay is also owner-confirmed in Chrome and Firefox. Controller and touch are experimental. Minimum hardware requirements are not established. [Support and known limitations](docs/browser-support.md).

Found a problem? Open **Settings or Pause → Report an issue** to review game details and create a GitHub draft. Nothing is sent automatically. You can also [report a bug directly](https://github.com/Caleb-Guyer/recoil-foundry/issues/new?template=bug_report.md). Please describe what happened and how to repeat it; a screenshot or replay can help.

## Development

Use Node.js 24, then:

```sh
npm ci
npm run dev
```

`npm test` runs the automated checks. `npm run build` creates the static site in `dist/`. Pushing `main` runs tests, builds and deploys to GitHub Pages.

[Release completion](docs/browser-release-checklist.md) · [Media kit](docs/release-media.md) · [itch.io launch](docs/itch-io/README.md) · [Development history](docs/development-history.md)

A game by Caleb Guyer. Built with TypeScript, Vite and Matter.js. [MIT license](LICENSE) · [Third-party notices](public/third-party-notices.txt).
