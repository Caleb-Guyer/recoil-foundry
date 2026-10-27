import test from 'node:test';
import assert from 'node:assert/strict';
import { LivingFoundryBackdrop } from '../src/living-foundry-art.ts';
import type { LivingFoundryFrame } from '../src/living-foundry-types.ts';
const frame: LivingFoundryFrame = {
  area: 'docks',
  variant: 0,
  room: 'native',
  time: 0,
  motion: 0,
  power: 1,
  coolant: 0,
  salvage: 0,
  wind: 0,
  reveal: 1,
  revealing: false,
  mirrored: false,
};
function context() {
  const state: Record<string, unknown> = { imageSmoothingEnabled: false };
  const stack: Record<string, unknown>[] = [];
  let transforms = 0,
    images = 0;
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_t, k) {
      if (k === 'save') return () => stack.push({ ...state });
      if (k === 'restore')
        return () => {
          assert(stack.length);
          Object.assign(state, stack.pop());
        };
      if (k === 'createLinearGradient' || k === 'createRadialGradient')
        return () => ({ addColorStop() {} });
      if (k === 'setTransform') return () => transforms++;
      if (k === 'drawImage') return () => images++;
      return k in state ? state[String(k)] : () => {};
    },
    set(_t, k, v) {
      state[String(k)] = v;
      return true;
    },
  });
  return {
    c,
    state,
    get transforms() {
      return transforms;
    },
    get images() {
      return images;
    },
    get depth() {
      return stack.length;
    },
  };
}
test('one bounded scenery raster is reused and paused/reduced frames reuse paint while combat stays at target resolution', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'OffscreenCanvas');
  const sources: { width: number; height: number; out: ReturnType<typeof context> }[] = [];
  class Surface {
    out = context();
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      sources.push(this);
    }
    getContext() {
      return this.out.c;
    }
  }
  Object.defineProperty(globalThis, 'OffscreenCanvas', { value: Surface, configurable: true });
  try {
    const target = context(),
      pass = new LivingFoundryBackdrop();
    const original = structuredClone(frame);
    pass.draw(target.c, frame, { x: 0, y: 0 }, 3440, 1440);
    assert.equal(sources.length, 1);
    assert(sources[0].width <= 960 && sources[0].height <= 600);
    assert.equal(sources[0].out.transforms, 1);
    assert.equal(target.images, 1);
    pass.draw(target.c, { ...frame }, { x: 0, y: 0 }, 3440, 1440);
    assert.equal(sources[0].out.transforms, 1, 'paused identical scenery is not repainted');
    pass.draw(target.c, { ...frame, motion: 1 }, { x: 0, y: 0 }, 3440, 1440);
    assert.equal(sources[0].out.transforms, 2, 'native machinery motion updates paint');
    pass.draw(target.c, { ...frame, power: 0 }, { x: 0, y: 0 }, 3440, 1440);
    assert.equal(sources[0].out.transforms, 3, 'real circuit changes repaint indicators');
    pass.draw(target.c, { ...frame, time: 20, power: 0 }, { x: 0, y: 0 }, 3440, 1440);
    assert.equal(
      sources[0].out.transforms,
      3,
      'irrelevant off-circuit clock cannot invalidate paint',
    );
    pass.draw(target.c, frame, { x: 0, y: 0 }, 3440, 1440, true);
    const staticCount = sources[0].out.transforms;
    pass.draw(target.c, { ...frame, time: 100, motion: 100 }, { x: 0, y: 0 }, 3440, 1440, true);
    assert.equal(
      sources[0].out.transforms,
      staticCount,
      'reduced art has a truly static cached pose',
    );
    pass.draw(target.c, frame, { x: 80, y: 0 }, 3440, 1440, true);
    assert.equal(sources[0].out.transforms, staticCount + 1, 'parallax follows the real camera');
    pass.draw(target.c, frame, { x: 80, y: 0 }, 1280, 720, true);
    assert.equal(sources.length, 1, 'viewport changes resize the same bounded raster');
    assert.equal(target.state.imageSmoothingEnabled, false, 'caller canvas state is restored');
    assert.equal(target.depth, 0);
    assert.equal(sources[0].out.depth, 0);
    assert.deepEqual(frame, original);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'OffscreenCanvas', saved);
    else Reflect.deleteProperty(globalThis, 'OffscreenCanvas');
  }
});
