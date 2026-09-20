import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { replayTestFromUrl } from '../src/death-replay.ts';
import { TimingStats } from '../src/performance-stats.ts';
import {
  STABILITY_CASES,
  startStabilityCase,
  stabilityInput,
  stabilityCounts,
  assertFiniteWorld,
} from '../src/stability-scenarios.ts';

const cycles = Number(process.env.RF_SOAK_CYCLES ?? 120);
assert(Number.isInteger(cycles) && cycles >= 6 && cycles <= 600);
const game = new Game();
const samples: object[] = [],
  baselines = new Map<number, ReturnType<typeof stabilityCounts>>();
const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
let deaths = 0,
  clears = 0,
  menuCycles = 0,
  pauseCycles = 0,
  saved = 0,
  inputSteps = 0,
  portalPairs = 0;
game.onCheckpoint = () => saved++;
const started = performance.now();
function restart(index: number) {
  startStabilityCase(game, index);
  portalPairs += Number(game.portals.linked);
}
for (let cycle = 0; cycle < cycles; cycle++) {
  const index = cycle % STABILITY_CASES.length;
  restart(index);
  const baseline = stabilityCounts(game);
  if (!baselines.has(index)) baselines.set(index, baseline);
  else assert.deepEqual(baseline, baselines.get(index), 'A reset retained old world objects');
  const timing = new TimingStats();
  let peaks = { ...baseline };
  for (let frame = 0; frame < 30 * 60; frame++) {
    if (game.mode !== 'playing' || game.clear) {
      if (game.mode === 'dead') deaths++;
      else clears++;
      restart(index);
    }
    if (frame % 300 === 299) {
      game.setMode('paused');
      const at = game.time,
        p = { ...game.player.position };
      game.tick(1 / 60, stabilityInput(game, frame));
      assert.equal(game.time, at);
      assert.deepEqual(game.player.position, p);
      game.setMode('playing');
      pauseCycles++;
    }
    const input = stabilityInput(game, frame);
    const before = performance.now();
    game.tick(1 / 60, input);
    inputSteps++;
    timing.add(performance.now() - before);
    if (frame % 60 === 0) {
      assertFiniteWorld(game);
      const counts = stabilityCounts(game);
      for (const key of Object.keys(counts) as (keyof typeof counts)[])
        peaks[key] = Math.max(peaks[key], counts[key]);
    }
  }
  game.setMode('title');
  menuCycles++;
  restart(index);
  assert.deepEqual(stabilityCounts(game), baseline, 'Menu/retry changed the reset baseline');
  gc?.();
  const memory = process.memoryUsage();
  samples.push({
    cycle: cycle + 1,
    scenario: STABILITY_CASES[index].id,
    timing: timing.report(),
    peaks,
    heapUsed: memory.heapUsed,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
    rss: memory.rss,
  });
  if ((cycle + 1) % 12 === 0)
    process.stdout.write(`${cycle + 1}/${cycles} cycles; ${deaths} deaths; ${clears} clears\n`);
}
// Repeated actual combat deaths exercise cleanup separately from the strong
// stress builds, which can survive the entire load-driving segment.
const deathSave = replayTestFromUrl(new URL('https://test/?test=replay'))!;
let deathSteps = 0;
const deathMemory: object[] = [];
for (let retry = 0; retry < 60; retry++) {
  game.startTest(deathSave);
  for (let step = 0; step < 60 * 45 && game.mode === 'playing'; step++) {
    game.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: false,
      fire: false,
      aim: { x: 600, y: 500 },
    });
    deathSteps++;
  }
  assert.equal(game.mode, 'dead', 'Combat must actually kill the test player');
  assertFiniteWorld(game);
  deaths++;
  game.setMode('title');
  game.startTest(deathSave);
  gc?.();
  deathMemory.push({
    retry: retry + 1,
    heapUsed: process.memoryUsage().heapUsed,
    counts: stabilityCounts(game),
  });
}
assert.equal(saved, 0, 'Diagnostics must not write campaign progress');
const report = {
  version: JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version,
  runtime: process.version,
  platform: process.platform,
  cycles,
  inputSteps,
  deathSteps,
  equivalentInputMinutes: inputSteps / 3600,
  wallSeconds: (performance.now() - started) / 1000,
  deaths,
  clears,
  pauseCycles,
  menuCycles,
  portalPairs,
  checkpointWrites: saved,
  forcedGC: !!gc,
  note: 'Simulation-only lifecycle soak; not browser FPS, human difficulty, or low-end hardware acceptance. Maxima sampled once per simulated second. Heap sampled after identical room resets and explicit GC when available.',
  samples,
  deathMemory,
};
const path = process.argv[2];
if (path) writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(
  JSON.stringify(
    {
      ...report,
      samples: `${samples.length} measurements`,
      deathMemory: `${deathMemory.length} measurements`,
    },
    null,
    2,
  ) + '\n',
);
