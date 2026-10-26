# Factory Unbound — 5.27.0 production goal

The user approved every one of the 28 concepts below and explicitly requested a goal. Direct commits and pushes to main are authorized. Do not publish to itch.io until requested separately.

## Acceptance gates

Each item needs real player-facing behavior in Campaign and an isolated demo, native visuals and audio where meaningful, legal drafting/progression, bounded interactions with all six guns and current upgrade families, save/Continue support where state persists, and focused behavioral regression coverage. Labels or counters alone do not satisfy an item. Keep room one calm; advanced content begins in zone two. Preserve old seeded runs and saved progress. Keep the twenty-room Campaign and compact menus. All morphs retain earned patterns and effects.

## Execution matrix

| #   | Concept           | Owner     | Status                        |
| --- | ----------------- | --------- | ----------------------------- |
| 1   | Polarity Rounds   | upgrades  | integrated; native tests pass |
| 2   | Ricochet Harness  | upgrades  | integrated; native tests pass |
| 3   | Spring Rivets     | upgrades  | integrated; native tests pass |
| 4   | Slip Gauge        | upgrades  | integrated; native tests pass |
| 5   | Wake Wire         | upgrades  | integrated; native tests pass |
| 6   | False Silhouette  | upgrades  | integrated; native tests pass |
| 7   | Gimbal Mount      | upgrades  | integrated; native tests pass |
| 8   | Momentum Exchange | upgrades  | integrated; native tests pass |
| 9   | Offset Nozzle     | upgrades  | integrated; native tests pass |
| 10  | Momentum Battery  | upgrades  | integrated; native tests pass |
| 11  | Piston Lance      | morphs    | integrated; native tests pass |
| 12  | Cable Saw         | morphs    | integrated; native tests pass |
| 13  | Seeker Rack       | morphs    | integrated; native tests pass |
| 14  | Foamcaster        | morphs    | integrated; native tests pass |
| 15  | Catch Chamber     | fusions   | integrated; native tests pass |
| 16  | Gate Snare        | fusions   | integrated; native tests pass |
| 17  | Hot Wire          | fusions   | integrated; native tests pass |
| 18  | Ghost Shift       | fusions   | integrated; native tests pass |
| 19  | Windmill          | fusions   | integrated; native tests pass |
| 20  | Scrap Comet       | fusions   | integrated; native tests pass |
| 21  | Vacuum Docks      | districts | integrated; native tests pass |
| 22  | Turntable Works   | districts | integrated; native tests pass |
| 23  | Prism Glassworks  | districts | integrated; native tests pass |
| 24  | Express Airlocks  | districts | integrated; native tests pass |
| 25  | Rework Loop       | districts | integrated; native tests pass |
| 26  | Prototype Leases  | root      | integrated; native tests pass |
| 27  | Power Routing     | root      | integrated; native tests pass |
| 28  | Field Experiments | root      | integrated; native tests pass |

## Shared integration

Root owns game.ts, rules.ts, main.ts, render.ts, catalog, seed/version/save validation, menus and progression. Dedicated modules expose native simulation hooks and draw functions. Route choices live at safe optional service junctions in ordinary later-zone rooms; a declined junction retains the normal room. Existing special jobs and boss arenas remain authored. Lease state is separate from permanent owned fittings. Experiments evolve a selected prototype through real play and a choice of two outcomes.

## Local acceptance and shipping protocol

- [x] All twenty-eight entries integrated and individually demonstrated through native controllers.
- [x] Authored icons, weapon/effect art, physical route machinery and native previews.
- [x] First rooms, old Continue/Daily, Workshop/Practice, profile isolation and all six guns checked.
- [x] Cover, payload budgets, real body placement, timing, pause/hitstop, reset, death and extraction checked.
- [x] Full regular regression: 4,120/4,120 passed. A final seeded Rework reward-variety regression and its 21 related progression checks also passed.
- [x] Dense current-build stress: 720 native simulations; 264 Seeker builds really paint and fire; 288 beam builds preserve their native controls.
- [x] Browser checks on the production bundle: junction, loan selection/comparison, keyboard circuit selection, status in Pause, native Prism room, retry/result isolation and zero console errors.
- [x] Production TypeScript/Vite build and whitespace validation.

The shipping gate is the repository's [Build and deploy workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/workflows/deploy.yml): four regular-test shards and all eight archived maximal-build shards must pass before Pages deployment. Local archived shard 1/8 passed all eight catalog/refit/simulation tests over 1,152 of the 9,216 stable builds. After pushing directly to main, verify the complete workflow and compare deployed files against the tested distribution. Keep the active goal open until that external verification succeeds.

## Integration evidence before release

- All 28 concepts are implemented through production controllers. Strict isolated links cover 37 scenes, six native tools and every compatible conversion.
- Twenty fitting previews earn actual effects with all six tools, preserve owned builds, and write no progress.
- Native route pilots clear all five full patrols and reach real exits. Continue reconstructs mechanisms, route boundaries and genuine damaged Rework terrain.
- Fourteen run-system tests cover loan settlement, bonus-count validation, refit protection, engine guards, real circuitry and actual New Game+ Continue. Circuit placement checks cover 144 native choices plus isolated Docks geometry.
- Additional integration tests verify normal reward acquisition/Continue for every new fitting, archived pools, calm first rooms and full mechanism travel.
- A current-catalog compatibility matrix exercises 720 dense native builds; the 9,216 archived maximal-build identities are retained separately.
- Final deployment evidence belongs to the release goal receipt and the linked GitHub Actions run; it is verified after this source snapshot is pushed.

## Diagnostic limits

Existing boss and progression audits completed without exceptions. Their older RF-C90 routes and pilots are diagnostics, not human win rates, and lack full morph-aware route/control decisions. They do not replace the native fitting, all-six-gun preview, physical-route, actual reward/Continue and dense-build tests above.
