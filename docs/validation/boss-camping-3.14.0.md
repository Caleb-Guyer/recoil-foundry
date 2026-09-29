# Boss camping audit — 3.14.0

The requested Crane review expanded to all eleven Practice bosses and the Auditor. The audit uses authored arenas and props, both mirrors where applicable, ordinary practice builds, actual damage and healing, and input-based horizontal position correction. Initial positions are fixtures; subsequent movement, recoil, enemy pursuit and cover collisions use the real simulation. No invulnerability or static player bodies are used.

`npm run balance:camping -- all <output.json>` runs 696 cases: both extreme corners, the floor center, an overhead recoil start, authored shelf centers and cover edges, each with firing held and without firing. Each ends at death, boss defeat/retreat, or 40 simulated seconds. Accepted incoming damage is counted even when Leech restores health.

Before this change, 46 cases remained untouched, including seven no-damage kills. Afterward, one case remains untouched and none kills a boss without taking damage. The untouched case is the non-firing overhead start against the Auditor, which retreats on its ordinary visit timer. Six cases have a damage-free interval longer than 15 seconds, down from 65; cover and temporary gaps remain useful. These finite samples do not establish that every possible build or position is impossible to exploit.

## Regression coverage

`tests/boss-camping.test.ts` adds 22 tests covering all boss floor corners, every Crane shelf edge in both mirrors, physical head routing, unchanged primary warnings, the alternate strike response, camping-memory pause/reset, Loader recoil ledges, Kiln shelves and low-debris pursuit, Auditor climbs and its former free-kill pocket, Turbine pressure through loose cover, archived Daily rules, and isolated Crane links that preserve saves/unlocks.

A follow-up extended the long-gap cases to 150 seconds and exposed one Kiln stall after an initial hit. A low prop at tread height was below the ordinary obstacle ray; tiny recoil movements also repeatedly tempted a new mortar before the route could finish. The pursuit now checks its full hull for low debris and uses the settled camper's actual position. The regression reaches the player again, and all seven extended combat cases now resolve through player death or boss defeat rather than reaching the time limit. Existing lifecycle checks verify that the new camping memory is cleared with the encounter.

Existing boss tests retain dodge, cover, collision, phase, interruption and lifecycle assertions. The new route fallback is limited to the Turbine and Interceptor; ordinary enemies keep their original planner. Loader's additional pursuit requires two seconds near the same position, preserving moving campaign behavior. No campaign assertions or pilot controls were weakened.

Current Daily rules are 85; rules 78–84 keep the previous boss behavior. Current Practice rules are 2, separating new scores from preserved earlier records. No save-schema migration is required.

The initial 196 focused boss/Daily/Practice checks and 40 campaign/balance checks passed locally. After the extended Kiln correction, all 75 affected boss, campaign and balance tests passed again, including the 15 scripted weapon campaigns and both real-reward campaigns. Preserved Daily 78 still finished with 52 health. The final 696-case audit and production TypeScript/Vite build passed. Vite's existing large shared-chunk warning remains.

Publication and full-suite results will be recorded after the exact runtime commit completes CI.
