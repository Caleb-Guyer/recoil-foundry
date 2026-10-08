import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { drawTorch } from '../src/torch-art.ts';
import { segmentInCombatView } from '../src/combat-readability.ts';
import Matter from 'matter-js';

function canvas() {
  const strokes: { color: unknown; lines: number }[] = [];
  let lines = 0,
    arcs = 0;
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(target, key) {
      if (key === 'beginPath') return () => (lines = 0);
      if (key === 'lineTo') return () => lines++;
      if (key === 'stroke') return () => strokes.push({ color: target.strokeStyle, lines });
      if (key === 'arc') return () => arcs++;
      return key in target ? Reflect.get(target, key) : () => {};
    },
    set(target, key, value) {
      return Reflect.set(target, key, value);
    },
  });
  return {
    c,
    strokes,
    get arcs() {
      return arcs;
    },
  };
}
function dense() {
  const g = new Game();
  g.mode = 'playing';
  g.mods = ['cutting-torch', 'scatter'];
  g.gun.pellets = 5;
  const body = Matter.Bodies.rectangle(500, 300, 20, 20);
  g.torch.segments = Array.from({ length: 120 }, (_, ray) => ({
    a: { x: 100, y: 300 },
    b: { x: 500, y: 300 + ray / 100 },
    dir: { x: 1, y: 0 },
    gain: 1,
    ray,
    power: ray % 2 ? 0.1 : 0.6,
    body,
  }));
  // Public getters derive active/equipped from ordinary state.
  g.torch.active = true;
  return g;
}
test('dense beams retain every visible core with only two halo strokes and one clustered impact', () => {
  const g = dense(),
    before = structuredClone(g.torch.segments),
    out = canvas();
  drawTorch(out.c, g, false, { x: 0, y: 0, w: 700, h: 600 });
  assert.equal(out.strokes.filter((s) => s.color === '#ebad68').length, 2);
  assert.equal(out.strokes.filter((s) => s.color === '#ffd59b').length, 120);
  assert.equal(out.arcs, 1);
  assert.deepEqual(g.torch.segments, before, 'Rendering cannot alter traces or damage');
});
test('reduced effects retain all cores without halo fog, and entirely offscreen rays avoid drawing', () => {
  const g = dense(),
    out = canvas();
  drawTorch(out.c, g, true, { x: 0, y: 0, w: 700, h: 600 });
  assert.equal(out.strokes.filter((s) => s.color === '#ebad68').length, 0);
  assert.equal(out.strokes.filter((s) => s.color === '#ffd59b').length, 120);
  const hidden = canvas();
  drawTorch(hidden.c, g, false, { x: 800, y: 0, w: 700, h: 600 });
  assert.equal(hidden.strokes.length, 0);
  assert(
    segmentInCombatView({ x: -100, y: 10 }, { x: 900, y: 10 }, { x: 0, y: 0, w: 700, h: 600 }),
  );
  assert(
    segmentInCombatView({ x: -10, y: -10 }, { x: -10, y: 100 }, { x: 0, y: 0, w: 700, h: 600 }, 16),
  );
});
