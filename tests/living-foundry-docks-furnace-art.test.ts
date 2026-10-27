import test from 'node:test';
import assert from 'node:assert/strict';
import { drawLivingDocks } from '../src/living-foundry-docks-art.ts';
import { drawLivingFurnace } from '../src/living-foundry-furnace-art.ts';
import type { LivingFoundryFrame } from '../src/living-foundry-types.ts';

type Operation = {
  op: string;
  args: unknown[];
  fill: unknown;
  stroke: unknown;
  alpha: number;
  width: number;
};
function canvas() {
  const operations: Operation[] = [];
  const state: Record<string, unknown> = {
    fillStyle: '#fff',
    strokeStyle: '#000',
    globalAlpha: 1,
    lineWidth: 1,
  };
  const stack: Record<string, unknown>[] = [];
  let gradients = 0;
  const record = (op: string, args: unknown[]) =>
    operations.push({
      op,
      args,
      fill: state.fillStyle,
      stroke: state.strokeStyle,
      alpha: Number(state.globalAlpha),
      width: Number(state.lineWidth),
    });
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key === 'save') return () => stack.push({ ...state });
      if (key === 'restore')
        return () => {
          assert(stack.length, 'canvas state must balance');
          Object.assign(state, stack.pop());
        };
      if (key === 'createLinearGradient' || key === 'createRadialGradient')
        return (...args: number[]) => {
          assert(args.every(Number.isFinite));
          gradients++;
          const result = {
            kind: String(key),
            args,
            stops: [] as [number, string][],
            addColorStop(at: number, color: string) {
              assert(at >= 0 && at <= 1);
              this.stops.push([at, color]);
            },
          };
          return result;
        };
      if (key in state) return state[String(key)];
      return (...args: unknown[]) => {
        assert(!['fillText', 'strokeText'].includes(String(key)), 'scenery has no text');
        assert(
          args.every((v) => typeof v !== 'number' || Number.isFinite(v)),
          String(key),
        );
        if (['fillRect', 'rect'].includes(String(key)))
          assert(Number(args[2]) >= 0 && Number(args[3]) >= 0, 'nonnegative rectangles');
        record(String(key), args);
      };
    },
    set(_target, key, value) {
      if (key === 'globalAlpha') assert(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert(Number.isFinite(value) && value > 0);
      state[String(key)] = value;
      return true;
    },
  });
  return {
    c,
    operations,
    state,
    get depth() {
      return stack.length;
    },
    get gradients() {
      return gradients;
    },
  };
}
const frame = (area: 'docks' | 'furnace', variant: 0 | 1 | 2): LivingFoundryFrame => ({
  area,
  variant,
  room: 'authored-room',
  time: 42,
  motion: 17,
  power: 1,
  coolant: 0.4,
  salvage: 0.2,
  wind: 0.1,
  reveal: 0.6,
  revealing: true,
  mirrored: false,
});
const scenes = [
  ['docks', drawLivingDocks],
  ['furnace', drawLivingFurnace],
] as const;
for (const [area, draw] of scenes) {
  test(
    area +
      ' has three authored deterministic compositions with bounded work and balanced canvas state',
    () => {
      const signatures = new Set<string>();
      for (const variant of [0, 1, 2] as const)
        for (const mirrored of [false, true])
          for (const size of [
            [960, 540],
            [2200, 1000],
            [3600, 1600],
          ]) {
            const f = { ...frame(area, variant), mirrored };
            const before = JSON.stringify(f),
              camera = { x: 1750, y: 320 };
            const a = canvas(),
              b = canvas();
            draw(a.c, f, camera, size[0], size[1], false);
            draw(b.c, f, camera, size[0], size[1], false);
            assert.equal(JSON.stringify(a.operations), JSON.stringify(b.operations));
            assert.equal(a.depth, 0);
            assert.equal(a.state.fillStyle, '#fff');
            assert.equal(a.state.strokeStyle, '#000');
            assert.equal(a.state.globalAlpha, 1);
            assert.equal(
              JSON.stringify(f),
              before,
              'drawing never advances or changes scene state',
            );
            assert(
              a.operations.length < 1800,
              area + ' work is bounded independently of viewport size: ' + a.operations.length,
            );
            assert(a.gradients <= 12, area + ' only uses a few soft light gradients');
            assert(
              a.operations.some(
                (o) =>
                  o.op === 'fillRect' &&
                  o.args[0] === 0 &&
                  o.args[1] === 0 &&
                  o.args[2] === size[0] &&
                  o.args[3] === size[1],
              ),
              'the entire viewport has a sky',
            );
            if (!mirrored && size[0] === 960) signatures.add(JSON.stringify(a.operations));
          }
      assert.equal(signatures.size, 3, 'variants change actual scenery rather than a label');
    },
  );
  test(
    area +
      ' uses only the powered motion clock; reduced effects retain static machinery and reveals',
    () => {
      for (const variant of [0, 1, 2] as const) {
        const f = frame(area, variant),
          camera = { x: 0, y: 0 };
        const normal = canvas(),
          later = canvas(),
          moving = canvas(),
          r1 = canvas(),
          r2 = canvas();
        draw(normal.c, f, camera, 1200, 850, false);
        draw(later.c, { ...f, time: 999999 }, camera, 1200, 850, false);
        assert.equal(
          JSON.stringify(normal.operations),
          JSON.stringify(later.operations),
          'elapsed/menu time cannot drive motors',
        );
        draw(moving.c, { ...f, motion: 290 }, camera, 1200, 850, false);
        assert.notEqual(
          JSON.stringify(normal.operations),
          JSON.stringify(moving.operations),
          'the connected machinery actually runs',
        );
        draw(r1.c, f, camera, 1200, 850, true);
        draw(r2.c, { ...f, time: 999999, motion: 290 }, camera, 1200, 850, true);
        assert.equal(
          JSON.stringify(r1.operations),
          JSON.stringify(r2.operations),
          'Reduced Effects has a steady machine pose',
        );
        const closed = canvas(),
          open = canvas();
        draw(closed.c, { ...f, reveal: 0 }, camera, 1200, 850, true);
        draw(open.c, { ...f, reveal: 1 }, camera, 1200, 850, true);
        assert.notEqual(
          JSON.stringify(closed.operations),
          JSON.stringify(open.operations),
          'static accessibility keeps the actual bay state',
        );
        const off = canvas(),
          offLater = canvas();
        draw(off.c, { ...f, power: 0 }, camera, 1200, 850, false);
        draw(offLater.c, { ...f, power: 0, time: 99999 }, camera, 1200, 850, false);
        assert.equal(
          JSON.stringify(off.operations),
          JSON.stringify(offLater.operations),
          'a stopped powered clock does not drift during loss of power',
        );
        assert(
          off.operations.some((o) => o.alpha === 0),
          'unpowered task lights extinguish',
        );
      }
    },
  );
}
