import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { branchTestFromUrl } from '../src/branch-builds.ts';
import { seeded } from '../src/rules.ts';
import { playRoom } from '../tests/room-pilot.ts';

const output = process.argv[2] ?? '.release-assets/melt-through-audit.json';
const results: unknown[] = [];
for (const build of ['melt', 'clean-cut', 'blowout', 'melt-beam', 'melt-shell', 'melt-ball'])
  for (const scene of ['room', 'mirror', 'boss']) {
    const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
    common._nextId = common._seed = 0;
    Math.random = seeded('melt-audit:' + build + ':' + scene);
    const g = new Game();
    const save = branchTestFromUrl(
      new URL(
        'https://test/?test=branches&build=' +
          build +
          '&room=' +
          (scene === 'boss' ? 'boss' : 'room') +
          '&mirror=' +
          (scene === 'mirror' ? '1' : '0'),
      ),
    )!;
    g.startTest(save);
    let passages = 0,
      peakShots = 0,
      peakGlows = 0,
      finite = true;
    const begin = g.melt.begin.bind(g.melt);
    g.melt.begin = (...args) => {
      const passed = begin(...args);
      if (passed) passages++;
      return passed;
    };
    const tick = g.tick.bind(g);
    g.tick = (...args) => {
      tick(...args);
      peakShots = Math.max(peakShots, g.shots.length);
      peakGlows = Math.max(peakGlows, g.melt.marks.length);
      finite &&= [g.player, ...g.enemies.map((e) => e.body)].every((b) =>
        Number.isFinite(b.position.x + b.position.y),
      );
      finite &&= g.shots.every((s) =>
        [s.pos.x, s.pos.y, s.vel.x, s.vel.y, s.damage].every(Number.isFinite),
      );
    };
    playRoom(g, 90);
    const result = {
      build,
      scene,
      seed: save.seed,
      mode: g.mode,
      clear: g.clear,
      seconds: Math.round(g.elapsed * 100) / 100,
      hp: Math.round(g.hp),
      passages,
      peakShots,
      peakGlows,
      finite,
      remaining: g.enemies.map((e) => ({ kind: e.kind, hp: Math.round(e.hp) })),
    };
    results.push(result);
    console.log(JSON.stringify(result));
    if (!finite || peakShots > 180 || peakGlows > 32)
      throw new Error('Invalid Melt-through simulation');
  }
mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  JSON.stringify({ ordinaryInputs: true, limitSeconds: 90, results }, null, 2) + '\n',
);
