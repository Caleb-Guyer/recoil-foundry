import { writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { switchboardLevel } from '../src/switchboard-layout.ts';
import { testCheckpoint } from '../src/practice.ts';
import { seeded, loadCheckpoint } from '../src/rules.ts';
import { securityTestFromUrl } from '../src/security-test.ts';
import { playRoom } from '../tests/room-pilot.ts';
const results = [];
for (const kind of [
  'loader',
  'crane',
  'press',
  'kiln',
  'condenser',
  'turbine',
  'sorter',
  'boss',
  'interceptor',
  'switchboard',
] as const) {
  const stage = ['loader', 'crane'].includes(kind)
    ? 3
    : ['press', 'kiln'].includes(kind)
      ? 7
      : ['condenser', 'turbine', 'switchboard'].includes(kind)
        ? 11
        : kind === 'interceptor'
          ? 19
          : 15;
  for (const mirror of [false, true])
    for (const security of [0, 2] as const) {
      Matter.Common._nextId = Matter.Common._seed = 0;
      Math.random = seeded('security-audit');
      const seed = Array.from({ length: 200 }, (_, i) => 'security-audit-' + i).find((s) => {
        const l = kind === 'switchboard' ? switchboardLevel(s) : getLevel(s, stage);
        return l.spawns[0].kind === kind && l.mirrored === mirror;
      })!;
      const save = testCheckpoint(seed, stage);
      save.version = 6;
      if (kind === 'switchboard') {
        save.region = 'annex';
        save.annexVersion = 6;
      }
      if (security) save.security = { level: security, rules: 1 };
      if (!loadCheckpoint(save)) throw new Error('Invalid boss build: ' + kind);
      const g = new Game();
      g.startTest(save);
      let counters = 0,
        lastCounter: unknown;
      const result = playRoom(g, 95, () => {
        const c = [...g.securityCombat.counters.values()][0];
        if (c && c !== lastCounter) {
          counters++;
          lastCounter = c;
        }
        return false;
      });
      const row = { kind, mirror, security, seed, counters, ...result };
      results.push(row);
      console.log(JSON.stringify(row));
    }
}
for (const area of ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'])
  for (const mirror of [0, 1]) {
    Matter.Common._nextId = Matter.Common._seed = 0;
    Math.random = seeded('security-audit');
    const save = securityTestFromUrl(
      new URL(`https://game.test/?test=security&level=3&area=${area}&mirror=${mirror}`),
    )!;
    if (!loadCheckpoint(save)) throw new Error('Invalid room build');
    const g = new Game();
    g.startTest(save);
    const row = {
      area,
      mirror,
      security: 3,
      seed: save.seed,
      layout: g.level.id,
      ...playRoom(g, 100),
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }
writeFileSync(
  new URL('../.release-assets/security-inputs-3.16.0.json', import.meta.url),
  JSON.stringify({ ordinaryInputs: true, alteredCombatState: false, results }, null, 2),
);
