# Boss camping audit — 3.14.0

The requested Crane review expanded to all eleven Practice bosses and the Auditor. The audit uses authored arenas and props, both mirrors where applicable, ordinary practice builds, actual damage and healing, and input-based horizontal position correction. Initial positions are fixtures; subsequent movement, recoil, enemy pursuit and cover collisions use the real simulation. No invulnerability or static player bodies are used.

`npm run balance:camping -- all <output.json>` runs 696 cases: both extreme corners, the floor center, an overhead recoil start, authored shelf centers and cover edges, each with firing held and without firing. Each ends at death, boss defeat/retreat, or 40 simulated seconds. Accepted incoming damage is counted even when Leech restores health. [Per-boss results](boss-camping-summary-3.14.0.json) identify the compared commits.

Before this change, 46 cases remained untouched, including seven no-damage kills. Afterward, one case remains untouched and none kills a boss without taking damage. The untouched case is the non-firing overhead start against the Auditor, which retreats on its ordinary visit timer. Six cases have a damage-free interval longer than 15 seconds, down from 65; cover and temporary gaps remain useful. These finite samples do not establish that every possible build or position is impossible to exploit.

## Regression coverage

`tests/boss-camping.test.ts` adds 22 tests covering all boss floor corners, every Crane shelf edge in both mirrors, physical head routing, unchanged primary warnings, the alternate strike response, camping-memory pause/reset, Loader recoil ledges, Kiln shelves and low-debris pursuit, Auditor climbs and its former free-kill pocket, Turbine pressure through loose cover, archived Daily rules, and isolated Crane links that preserve saves/unlocks.

A follow-up extended the long-gap cases to 150 seconds and exposed one Kiln stall after an initial hit. A low prop at tread height was below the ordinary obstacle ray; tiny recoil movements also repeatedly tempted a new mortar before the route could finish. The pursuit now checks its full hull for low debris and uses the settled camper's actual position. The regression reaches the player again, and all seven extended combat cases now resolve through player death or boss defeat rather than reaching the time limit. Existing lifecycle checks verify that the new camping memory is cleared with the encounter.

Existing boss tests retain dodge, cover, collision, phase, interruption and lifecycle assertions. The new route fallback is limited to the Turbine and Interceptor; ordinary enemies keep their original planner. Loader's additional pursuit requires two seconds near the same position, preserving moving campaign behavior. No campaign assertions or pilot controls were weakened.

Current Daily rules are 85; rules 78–84 keep the previous boss behavior. Current Practice rules are 2, separating new scores from preserved earlier records. No save-schema migration is required.

The initial 196 focused boss/Daily/Practice checks and 40 campaign/balance checks passed locally. After the extended Kiln correction, all 75 affected boss, campaign and balance tests passed again, including the 15 scripted weapon campaigns and both real-reward campaigns. Preserved Daily 78 still finished with 52 health. The final 696-case audit and production TypeScript/Vite build passed. Vite's existing large shared-chunk warning remains.

## Published artifact and host checks — 28 September 2026

- Runtime commit: `50a3e08f82a66f41a56ef13903ed31300ee855b5`.
- [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36509499679): **2,125 tests passed**, zero failed, cancelled or skipped; production build and deployment passed. Test duration was 830.495 seconds. The superseded first candidate was cancelled when the final Kiln fix was pushed; it was not tagged.
- [Release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36510732958): passed for `v3.14.0` on the exact runtime commit, including its successful-Pages-CI gate.
- [Official archive](https://github.com/Caleb-Guyer/recoil-foundry/releases/tag/v3.14.0): `recoil-foundry-v3.14.0-site.zip`, 9,792,837 bytes, SHA-256 `a2df93fa7beaf2d5b0bd516ebcab9e8a71a78129bdc4a063bf4c0bf2f819eaf1`. Download size and GitHub's digest matched. Its 17 files contain root `index.html` and four valid relative entry assets, with no source, tests, dependency tree, source maps or traversal entries.
- itch.io upload `19459508` contains the same verified bytes, using the existing replacement filename and displaying **Recoil Foundry 3.14.0 — Boss pursuit**. Browser playback was checked and the editor confirmed Saved.
- The local production preview started both Crane mirrors, paused/resumed and retried. Pages started the deployed Crane fight and visibly showed version 3.14.0 in About. Its existing Room 2 / 1 discovery / no Practice victories, blueprints or records survived the isolated test. Browser warning/error logs were empty.
- The new public itch.io iframe reported 3.14.0 in About and retained Continue daily, Room 1 / no discoveries, Practice victories, blueprints or records. Sound/Music settings were unchanged; warning/error logs were empty. Its iframe screenshot captured the dialog background without its text despite visible DOM, normal computed visibility and working controls, so itch.io version/save verification here uses the UI accessibility output. A public Pages screenshot supplies visual version evidence. This is not a fresh physical-browser or low-end-device acceptance test.

Publication checks are complete. The preceding stable `v3.13.1` remains immutable; reverting through a new release must preserve the new Daily identity and Practice record separation.
