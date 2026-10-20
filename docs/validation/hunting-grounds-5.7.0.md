# Hunting Grounds 5.7.0 validation

Scope: GitHub issue [#9](https://github.com/Caleb-Guyer/recoil-foundry/issues/9). Two predictable optional hunts, distinct arenas and approaches, reliable entrances, and preserved progression.

## Automated checks

- Deterministic pair selection tested across 400 seeds, including preference for each unbeaten machine.
- Both entrances checked across 100 Campaign seeds, all Security tiers, Cooling Works and Transmission Annex paths: 300 generated room checks, without missing or obstructed entrances.
- Continue checked during approach, sealed combat, pending reward and the returned cleared patrol for all three hunts, including the Annex route.
- A quiet approach cannot auto-clear. Ordinary movement crosses the threshold and creates the physical gate; backward movement and shot traces respect it.
- Invalid, duplicated and mixed-version schedules, future victories, and invalid preview parameters are rejected.
- Skipping one hunt leaves the later hunt available. Reroll credits persist and are consumed separately.
- Recent Runs and Retry retain the chosen pair; previous distinct hunt commendations still unlock the carbine.
- All six starting guns clear each redesigned hunt using ordinary input in isolated simulations, with no saved progress or awards.
- Boss corner-pressure regression caught a free Demolisher kill; its opening warned volley fixes that case. The focused hunt and boss-pressure suite passes 77 tests.
- Final `npm run test:ci`: **3,062 passed, 0 failed**, in 418 seconds. The expanded two-victory reroll test was also rerun directly after its fixture was strengthened: all 9 hunt-route tests pass.

## Production build and browser checks

`npm run build` passes TypeScript checking and the Vite production build. The existing bundle-size advisory remains; there is no build error.

The production preview was checked in the connected browser at 1280 × 720:

- The title's Hunting Grounds announcement fits its dialog, with the Back button visible.
- The marked hunt door, entry instruction and Coil carbine goal badge remain distinct.
- All three approach instructions fit beneath the corridor ceiling and above the player.
- Ordinary rightward movement crosses the threshold, spawns the boss and changes the open threshold to a closed gate. The Bulwark's shields and elevated lanes render together in the active arena.
- Preview links identify themselves as isolated tests and leave Continue and profile rewards untouched.

Screenshots are saved in the workspace's `Hunting Grounds 5.7.0` folder. Formatting and `git diff --check` pass. The main-branch Pages workflow separately requires regression tests and all eight maximal-build shards before deployment; publication should be verified from that workflow and the live title announcement. No itch.io upload is claimed by this receipt.
