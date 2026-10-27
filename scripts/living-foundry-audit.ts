import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import Matter from 'matter-js';
import { drawScenery, type AreaId } from '../src/areas.ts';
import { LivingFoundryBackdrop } from '../src/living-foundry-art.ts';
import type { LivingFoundryFrame } from '../src/living-foundry-types.ts';
import { Game } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import {
  livingFoundryTestFromUrl,
  livingFoundryTestRoom,
  prepareLivingFoundryTest,
  LIVING_FOUNDRY_ZONES,
} from '../src/living-foundry-test.ts';

// Optional local visual audit uses the already-installed media tooling; no new game dependency.
const native = createRequire(resolve('.media-tools/canvas/package.json'));
const { createCanvas } = native('@napi-rs/canvas');
Object.defineProperty(globalThis, 'OffscreenCanvas', {
  value: function (w: number, h: number) {
    return createCanvas(w, h);
  },
  configurable: true,
});
Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true });
const out = resolve(process.argv[2] ?? '../../Living Foundry 5.32.0');
mkdirSync(out, { recursive: true });
const frame = (area: AreaId, variant: 0 | 1 | 2): LivingFoundryFrame => ({
  area,
  variant,
  room: 'audit:' + area,
  time: 12,
  motion: 12,
  power: 1,
  coolant: 0.7,
  salvage: 0.6,
  wind: 0.35,
  reveal: 1,
  revealing: false,
  mirrored: false,
});
const results: unknown[] = [];
for (const [w, h] of [
  [1280, 720],
  [2560, 1440],
])
  for (const area of LIVING_FOUNDRY_ZONES)
    for (const variant of [0, 1, 2] as const)
      for (const reduced of [false, true]) {
        const canvas = createCanvas(w, h);
        const c = canvas.getContext('2d');
        const f = frame(area, variant);
        const backdrop = new LivingFoundryBackdrop();
        const measure = (newScene: boolean) => {
          const samples: number[] = [];
          for (let i = 0; i < 52; i++) {
            f.motion = i / 30;
            f.time = i / 30;
            const before = performance.now();
            newScene
              ? backdrop.draw(c, f, { x: 300, y: 80 }, w, h, reduced)
              : drawScenery(c, area, { x: 300, y: 80 }, w, h);
            // A one-pixel read forces a native raster flush without a full-frame screenshot/readback.
            c.getImageData(0, 0, 1, 1);
            if (i >= 12) samples.push(performance.now() - before);
          }
          samples.sort((a, b) => a - b);
          return { medianMs: samples[20], p95Ms: samples[38], maxMs: samples.at(-1) };
        };
        const before = measure(false);
        const after = measure(true);
        results.push({ area, variant, reduced, width: w, height: h, before, after });
      }
const sheet = createCanvas(1440, 5 * 290),
  sc = sheet.getContext('2d');
sc.fillStyle = '#0c151a';
sc.fillRect(0, 0, sheet.width, sheet.height);
let row = 0;
for (const zone of LIVING_FOUNDRY_ZONES) {
  for (const variant of [0, 1, 2]) {
    const test = livingFoundryTestFromUrl(
      new URL(
        `https://test/?test=living-foundry&zone=${zone}&scene=machinery&variant=${variant}&v=1`,
      ),
    )!;
    const g = new Game();
    g.startTest(test.checkpoint, livingFoundryTestRoom(test));
    prepareLivingFoundryTest(g, test);
    const canvas = createCanvas(1280, 720);
    canvas.getBoundingClientRect = () => ({ width: 1280, height: 720 });
    const renderer = new Renderer(canvas, g);
    const original = JSON.stringify(g.checkpointSnapshot());
    renderer.draw(0, { camera: { x: 80, y: 50 }, scale: 0.85, player: true });
    if (JSON.stringify(g.checkpointSnapshot()) !== original)
      throw Error('Scenery renderer changed native state');
    writeFileSync(resolve(out, `${zone}-composition-${variant}.png`), canvas.toBuffer('image/png'));
    sc.drawImage(canvas, variant * 480, row * 290 + 20, 480, 270);
    sc.fillStyle = '#dce4d9';
    sc.font = '13px monospace';
    sc.fillText(`${zone} / composition ${variant + 1}`, variant * 480 + 8, row * 290 + 15);
    Matter.Composite.clear(g.engine.world, false);
    Matter.Engine.clear(g.engine);
  }
  row++;
}
writeFileSync(resolve(out, 'all-five-zones.png'), sheet.toBuffer('image/png'));
const report = {
  scope:
    'Agent-controlled native Canvas CPU raster audit; not browser GPU frame rate or a human play session.',
  samplesPerCase: 40,
  warmupFrames: 12,
  rasterFlush: 'one-pixel read per frame',
  sceneryOnly: true,
  results,
};
writeFileSync(resolve(out, 'scenery-performance.json'), JSON.stringify(report, null, 2) + '\n');
const rows = results as {
  area: string;
  variant: number;
  reduced: boolean;
  width: number;
  after: { p95Ms: number };
  before: { p95Ms: number };
}[];
console.log(
  JSON.stringify(
    {
      cases: rows.length,
      maxNewP95Ms: Math.max(...rows.map((r) => r.after.p95Ms)),
      maxOldP95Ms: Math.max(...rows.map((r) => r.before.p95Ms)),
      at1280: Math.max(...rows.filter((r) => r.width === 1280).map((r) => r.after.p95Ms)),
      at2560: Math.max(...rows.filter((r) => r.width === 2560).map((r) => r.after.p95Ms)),
      sheet: resolve(out, 'all-five-zones.png'),
    },
    null,
    2,
  ),
);
