import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const source = (name: string) => pathToFileURL(resolve(process.argv[3] ?? '.', 'src', name)).href;
const { Game } = (await import(source('game.ts'))) as typeof import('../src/game.ts');
const { Renderer } = (await import(source('render.ts'))) as typeof import('../src/render.ts');
const { STABILITY_CASES, startStabilityCase, stabilityInput } = (await import(
  source('stability-scenarios.ts')
)) as typeof import('../src/stability-scenarios.ts');
const { GAME_VERSION } = (await import(source('version.ts'))) as typeof import('../src/version.ts');

const require = createRequire(
  resolve(process.env.RF_CANVAS_PACKAGE ?? '.media-tools/canvas/package.json'),
);
const { createCanvas } = require('@napi-rs/canvas');
const Matter = createRequire(resolve('package.json'))('matter-js');
Object.defineProperty(globalThis, 'OffscreenCanvas', {
  value: function (w: number, h: number) {
    return createCanvas(w, h);
  },
  configurable: true,
});
Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true });
const canvas = createCanvas(1280, 720);
canvas.getBoundingClientRect = () => ({ width: 1280, height: 720 });
function stats(values: number[]) {
  const v = [...values].sort((a, b) => a - b);
  return {
    samples: v.length,
    meanMs: values.reduce((a, b) => a + b, 0) / v.length,
    p50Ms: v[Math.ceil(v.length * 0.5) - 1],
    p95Ms: v[Math.ceil(v.length * 0.95) - 1],
    maxMs: v.at(-1),
  };
}
const rows = [];
for (const id of ['beam', 'explosions', 'heat-mortar']) {
  const index = STABILITY_CASES.findIndex((c) => c.id === id),
    g = new Game(),
    r = new Renderer(canvas, g);
  const sim: number[] = [],
    draw: number[] = [],
    reset: number[] = [];
  const methods: Record<string, { calls: number; ms: number }> = {};
  for (const name of [
    'drawEnemies',
    'drawProps',
    'drawPlayer',
    'drawTell',
    'drawParticles',
    'drawShots',
  ]) {
    const original = (r as any)[name];
    if (typeof original !== 'function') continue;
    (r as any)[name] = function (...args: any[]) {
      const t = performance.now();
      const value = original.apply(this, args);
      const m = (methods[name] ??= { calls: 0, ms: 0 });
      m.calls++;
      m.ms += performance.now() - t;
      return value;
    };
  }
  let retries = 0,
    clears = 0;
  for (let round = 0; round < 5; round++) {
    let t = performance.now();
    startStabilityCase(g, index);
    r.reset();
    reset.push(performance.now() - t);
    for (let tick = 0; tick < 600; tick++) {
      if (g.mode !== 'playing' || g.clear) {
        if (g.clear) clears++;
        else retries++;
        t = performance.now();
        startStabilityCase(g, index);
        r.reset();
        reset.push(performance.now() - t);
      }
      t = performance.now();
      g.tick(1 / 60, stabilityInput(g, tick));
      const ms = performance.now() - t;
      t = performance.now();
      r.draw(((round * 600 + tick) * 1000) / 60);
      const render = performance.now() - t;
      if (tick >= 120) {
        sim.push(ms);
        draw.push(render);
      }
    }
  }
  rows.push({
    scenario: id,
    simulation: stats(sim),
    render: stats(draw),
    transition: stats(reset),
    retries,
    clears,
    methods,
  });
  Matter.Engine.clear(g.engine);
  Matter.Composite.clear(g.engine.world, false);
}
const report = {
  version: GAME_VERSION,
  node: process.version,
  canvas: '@napi-rs/canvas; CPU renderer, not browser FPS',
  viewport: { width: 1280, height: 720, pixelRatio: 1 },
  methodology:
    'Five deterministic 600-tick rounds per scenario; first 120 ticks excluded. Real simulation, renderer and ordinary inputs. Audio/replay excluded. Sequential execution; no CPU throttling.',
  rows,
};
writeFileSync(process.argv[2] ?? 'render-performance.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
