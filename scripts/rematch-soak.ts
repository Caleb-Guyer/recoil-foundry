import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { writeFileSync } from 'node:fs';
import { Game } from '../src/game.ts';
import {
  RoomRematch,
  rematchEntry,
  roomRematchSnapshot,
  rematchPreviewFromUrl,
} from '../src/room-rematch.ts';
import { stabilityInput, stabilityCounts } from '../src/stability-scenarios.ts';
import { TimingStats } from '../src/performance-stats.ts';
import { GAME_VERSION } from '../src/version.ts';

const timing = new TimingStats();
const samples = [];
let writes = 0,
  resets = 0,
  opened = 0;
const original = new Game();
original.startTest(
  rematchPreviewFromUrl(new URL('https://test/?test=rematch&scene=mortar&v=1'))!.checkpoint,
);
const entry = rematchEntry(original)!;
original.die({ type: 'shot', enemy: 'mortar' });
const snapshot = roomRematchSnapshot(original, entry)!;
const saved = JSON.stringify(snapshot);
for (let cycle = 0; cycle < 120; cycle++) {
  const before = performance.now();
  const session = new RoomRematch(snapshot);
  timing.add(performance.now() - before);
  opened++;
  session.game.onCheckpoint = () => writes++;
  const baseline = stabilityCounts(session.game);
  for (let retry = 0; retry < 4; retry++) {
    session.game.setMode('playing');
    for (let tick = 0; tick < 180; tick++) session.tick(1 / 60, stabilityInput(session.game, tick));
    const start = performance.now();
    session.reset();
    timing.add(performance.now() - start);
    resets++;
    const current = stabilityCounts(session.game);
    assert.equal(current.bodies, baseline.bodies);
    assert.equal(current.constraints, baseline.constraints);
    assert.equal(current.shots, baseline.shots);
    assert.equal(current.pairs, baseline.pairs);
  }
  session.dispose();
  assert.equal(Matter.Composite.allBodies(session.game.engine.world).length, 0);
  assert.equal(session.game.engine.pairs.list.length, 0);
  assert.equal(JSON.stringify(snapshot), saved);
  if ((cycle + 1) % 10 === 0) {
    globalThis.gc?.();
    samples.push({ cycle: cycle + 1, heapBytes: process.memoryUsage().heapUsed });
  }
}
assert.equal(original.mode, 'dead');
assert.equal(writes, 0);
Matter.Composite.clear(original.engine.world, false);
Matter.Engine.clear(original.engine);
const report = {
  version: GAME_VERSION,
  methodology:
    'Node simulation lifecycle audit, not browser/GPU memory. 120 independent rematch opens, four three-second input sequences and resets per open. Exact fresh-body/pair/projectile counts after every reset; no saved progress. Heap sampled after explicit GC if available.',
  opened,
  resets,
  writes,
  timing: timing.report(),
  forcedGC: !!globalThis.gc,
  samples,
};
writeFileSync(process.argv[2] ?? 'rematch-soak.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
