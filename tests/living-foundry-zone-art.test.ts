import test from 'node:test';
import assert from 'node:assert/strict';
import { drawLivingCooling } from '../src/living-foundry-cooling-art.ts';
import { drawLivingReclamation } from '../src/living-foundry-reclamation-art.ts';
import { drawLivingRooftops } from '../src/living-foundry-rooftops-art.ts';
import type { LivingFoundryFrame } from '../src/living-foundry-types.ts';

type Operation = { name: string; args: unknown[] };
function canvas() {
  const operations: Operation[] = [];
  let saves = 0;
  const gradient = () => ({
    addColorStop(...args: unknown[]) {
      operations.push({ name: 'colorStop', args });
    },
  });
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key === 'createLinearGradient' || key === 'createRadialGradient')
        return (...args: number[]) => {
          assert(args.every(Number.isFinite));
          operations.push({ name: String(key), args });
          return gradient();
        };
      return (...args: unknown[]) => {
        if (key === 'save') saves++;
        if (key === 'restore') {
          saves--;
          assert(saves >= 0, 'canvas save stack underflow');
        }
        assert(
          args.every((arg) => typeof arg !== 'number' || Number.isFinite(arg)),
          String(key) + ' must have finite geometry',
        );
        assert(
          ![
            'fillText',
            'strokeText',
            'drawImage',
            'getImageData',
            'putImageData',
            'clearRect',
          ].includes(String(key)),
          'native scenery must not add captions, image buffers or whole-view wipes',
        );
        operations.push({ name: String(key), args });
      };
    },
    set(_target, key, value) {
      if (key === 'globalAlpha') assert(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert(Number.isFinite(value) && value > 0);
      operations.push({
        name: 'style:' + String(key),
        args: [typeof value === 'object' ? 'gradient' : value],
      });
      return true;
    },
  });
  return {
    context,
    operations,
    get saves() {
      return saves;
    },
  };
}
const zones = [
  ['cooling', drawLivingCooling],
  ['reclamation', drawLivingReclamation],
  ['rooftops', drawLivingRooftops],
] as const;
const frame = (
  area: LivingFoundryFrame['area'],
  change: Partial<LivingFoundryFrame> = {},
): LivingFoundryFrame => ({
  area,
  variant: 0,
  room: 'authored-room',
  time: 7,
  motion: 5,
  power: 1,
  coolant: 1,
  salvage: 1,
  wind: 0.5,
  reveal: 1,
  revealing: false,
  mirrored: false,
  ...change,
});
const draw = (
  fn: typeof drawLivingCooling,
  state: LivingFoundryFrame,
  reduced = false,
  width = 1280,
  height = 800,
) => {
  const surface = canvas();
  const before = structuredClone(state);
  fn(
    surface.context,
    Object.freeze(state),
    Object.freeze({ x: 240, y: 85 }),
    width,
    height,
    reduced,
  );
  assert.equal(surface.saves, 0, 'scenery must balance canvas state');
  assert.deepEqual(state, before, 'scenery must never mutate its native projection');
  return surface.operations;
};

for (const [area, paint] of zones) {
  test(
    area +
      ' has three authored compositions with bounded, finite, text-free drawing at narrow and wide views',
    () => {
      const signatures = new Set<string>();
      for (const variant of [0, 1, 2] as const) {
        signatures.add(JSON.stringify(draw(paint, frame(area, { variant }))));
        for (const [width, height] of [
          [640, 480],
          [1280, 800],
          [2560, 1100],
        ])
          for (const reduced of [false, true])
            for (const mirrored of [false, true]) {
              const operations = draw(
                paint,
                frame(area, { variant, mirrored }),
                reduced,
                width,
                height,
              );
              assert(
                operations.length < 2200,
                'native architecture must remain a bounded draw budget',
              );
              const paints = operations.filter((op) =>
                ['fill', 'stroke', 'fillRect', 'strokeRect'].includes(op.name),
              );
              assert(
                paints.length < 300,
                'scenery must not accumulate per-frame particles or tiled work',
              );
              assert(paints.length > 30, 'authored landmark must be rendered');
              if (mirrored)
                assert(operations.some((op) => op.name === 'scale' && op.args[0] === -1));
            }
      }
      assert.equal(signatures.size, 3, 'every variant must carry distinct authored architecture');
    },
  );

  test(
    area + ' keeps Reduced Effects static while preserving powered and disabled state information',
    () => {
      for (const variant of [0, 1, 2] as const) {
        const state = frame(area, { variant });
        const base = draw(paint, state, true);
        assert.deepEqual(draw(paint, frame(area, { variant, time: 99, motion: 73 }), true), base);
        assert.notDeepEqual(
          draw(paint, frame(area, { variant, power: 0 }), true),
          base,
          'power state remains visually readable without animation',
        );
        const stopped =
          area === 'cooling'
            ? { coolant: 0 }
            : area === 'reclamation'
              ? { salvage: 0 }
              : { wind: 0 };
        assert.notDeepEqual(
          draw(paint, frame(area, { variant, ...stopped }), true),
          base,
          'disabled native service remains visible without animation',
        );
      }
    },
  );

  test(
    area +
      ' uses native motor phase and stops the disabled service without turning off unrelated lighting',
    () => {
      for (const variant of [0, 1, 2] as const) {
        assert.notDeepEqual(
          draw(paint, frame(area, { variant, motion: 1 })),
          draw(paint, frame(area, { variant, motion: 12 })),
        );
        const stopped =
          area === 'cooling'
            ? { coolant: 0 }
            : area === 'reclamation'
              ? { salvage: 0 }
              : { wind: 0 };
        assert.deepEqual(
          draw(paint, frame(area, { variant, motion: 1, ...stopped })),
          draw(paint, frame(area, { variant, motion: 12, ...stopped })),
        );
      }
    },
  );

  test(
    area + ' reveals its landmark through substantial rigid leaves that slide rather than compress',
    () => {
      for (const variant of [0, 1, 2] as const) {
        const closed = draw(paint, frame(area, { variant, reveal: 0 }));
        const middle = draw(paint, frame(area, { variant, reveal: 0.5 }));
        const opened = draw(paint, frame(area, { variant, reveal: 1 }));
        assert.equal(closed.length, opened.length);
        const changed = opened.flatMap((op, index) =>
          JSON.stringify(op) !== JSON.stringify(closed[index]) ? [{ op, index }] : [],
        );
        assert.equal(changed.length, 2, 'only the two rigid leaf translations change');
        for (const { op, index } of changed) {
          const before = closed[index],
            half = middle[index];
          assert.equal(op.name, 'translate');
          assert.equal(op.args[1], before.args[1], 'leaves retain their full height');
          assert(
            Math.abs(Number(op.args[0]) - Number(before.args[0])) >= 190,
            'leaf travels visibly into its structural pocket',
          );
          assert.equal(
            Number(half.args[0]) - Number(before.args[0]),
            (Number(op.args[0]) - Number(before.args[0])) / 2,
          );
        }
        const paintedRects = (ops: Operation[]) =>
          ops.filter((op) => ['fillRect', 'strokeRect'].includes(op.name));
        assert.deepEqual(
          paintedRects(opened),
          paintedRects(closed),
          'every steel leaf and its stiffeners retain their dimensions while opening',
        );
        const bay = closed.find((op) => op.name === 'rect');
        assert(bay, 'moving leaves stay clipped to one local architectural opening');
        const width = Number(bay.args[2]),
          height = Number(bay.args[3]);
        assert(
          width >= 560 && width <= 720 && height >= 380 && height <= 430,
          'a significant background bay reveals the actual zone landmark',
        );
        const leaves = closed.filter(
          (op) =>
            op.name === 'fillRect' &&
            op.args[0] === 0 &&
            op.args[1] === 0 &&
            Number(op.args[2]) >= 180 &&
            op.args[3] === height,
        );
        assert.equal(leaves.length, 2);
        assert(
          leaves.reduce((sum, op) => sum + Number(op.args[2]), 0) < width * 0.7,
          'a central preview remains visible before the doors open',
        );
      }
    },
  );
}
