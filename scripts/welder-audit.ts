// Ordinary-input diagnostics; no healing, teleporting or removal of opponents.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { OVERTIME_BUILDS } from '../src/overtime-balance.ts';
import { welderTestFromUrl } from '../src/welder-test.ts';
import { seeded } from '../src/rules.ts';
import { playRoom } from '../tests/room-pilot.ts';

const output = process.argv[2] ?? '.release-assets/welder-audit.json';
const results: unknown[] = [];
for (const area of ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'])
  for (const build of Object.keys(OVERTIME_BUILDS)) {
    const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
    common._nextId = common._seed = 0;
    Math.random = seeded('welder-audit:' + area + ':' + build);
    const g = new Game(),
      save = welderTestFromUrl(
        new URL('https://test/?test=welder&area=' + area + '&build=' + build),
      )!;
    g.startTest(save);
    let peakSeams = 0,
      peakCover = 0,
      welderArrived = false,
      finite = true;
    const tick = g.tick.bind(g);
    g.tick = (...args) => {
      tick(...args);
      peakSeams = Math.max(peakSeams, g.welder.seams.length);
      peakCover = Math.max(peakCover, g.props.items.filter((p) => p.welded).length);
      welderArrived ||= g.enemies.some((e) => e.kind === 'welder');
      finite &&= [g.player, ...g.enemies.map((e) => e.body)].every(
        (b) => Number.isFinite(b.position.x) && Number.isFinite(b.position.y),
      );
    };
    playRoom(g, 90);
    const result = {
      area,
      build,
      seed: save.seed,
      mode: g.mode,
      clear: g.clear,
      seconds: Math.round(g.elapsed * 100) / 100,
      hp: Math.round(g.hp),
      welderArrived,
      welderDefeated: g.welder.state?.status === 'defeated',
      peakSeams,
      peakCover,
      finite,
      remaining: g.enemies.map((e) => ({ kind: e.kind, hp: Math.round(e.hp) })),
    };
    results.push(result);
    console.log(JSON.stringify(result));
    if (!finite || peakSeams > 3 || peakCover > 2) throw new Error('Invalid welding simulation');
  }
mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  JSON.stringify({ ordinaryInputs: true, limitSeconds: 90, results }, null, 2) + '\n',
);
