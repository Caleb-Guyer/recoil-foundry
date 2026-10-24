import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import {
  CAMERA_MODES,
  loadCameraMode,
  cameraFrameDelta,
  cameraBaseScale,
  combatCameraScale,
  combatCameraTarget,
  advanceCombatCamera,
  type CameraMode,
  type CombatCameraInput,
} from '../src/combat-camera.ts';
import { finaleCinemaScale } from '../src/finale-cinema-art.ts';
import { recoilTrialCheckpoint } from '../src/recoil-trial-rules.ts';

const modes = Object.keys(CAMERA_MODES) as CameraMode[];
function input(overrides: Partial<CombatCameraInput> = {}): CombatCameraInput {
  return {
    width: 1280,
    height: 720,
    worldWidth: 2000,
    worldTop: -620,
    player: { x: 1000, y: 100 },
    velocity: { x: 0, y: 0 },
    aim: { x: 1400, y: 100 },
    mode: 'follow',
    ...overrides,
  };
}
function finite(frame: { x: number; y: number; scale: number }) {
  assert(Object.values(frame).every(Number.isFinite));
  assert(frame.scale > 0);
}
function inside(frame: { x: number; y: number; scale: number }, i: CombatCameraInput) {
  finite(frame);
  const w = i.width / frame.scale,
    h = i.height / frame.scale;
  assert(frame.x >= -1e-7 && frame.x + w <= i.worldWidth + 1e-7);
  assert(frame.y >= i.worldTop - 1e-7 && frame.y + h <= 835 + 1e-7);
  assert(i.player.x >= frame.x - 1e-7 && i.player.x <= frame.x + w + 1e-7);
  assert(i.player.y >= frame.y - 1e-7 && i.player.y <= frame.y + h + 1e-7);
}

function surface(width = 1280, height = 720) {
  let size = { width, height };
  type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number };
  let m: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const stack: Matrix[] = [];
  const multiply = (a: number, b: number, c: number, d: number, e: number, f: number) => {
    m = {
      a: m.a * a + m.c * b,
      b: m.b * a + m.d * b,
      c: m.a * c + m.c * d,
      d: m.b * c + m.d * d,
      e: m.a * e + m.c * f + m.e,
      f: m.b * e + m.d * f + m.f,
    };
  };
  const canvas = { width, height, getBoundingClientRect: () => size };
  const target = {
    canvas,
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
      m = { a, b, c, d, e, f };
    },
    getTransform() {
      return { ...m };
    },
    save() {
      stack.push({ ...m });
    },
    restore() {
      m = stack.pop() ?? m;
    },
    translate(x: number, y: number) {
      multiply(1, 0, 0, 1, x, y);
    },
    scale(x: number, y: number) {
      multiply(x, 0, 0, y, 0, 0);
    },
    rotate(a: number) {
      multiply(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0);
    },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: (s: string) => ({ width: s.length * 7 }),
    getLineDash: () => [],
  };
  const ctx = new Proxy(target, {
    get: (t, k) => (k in t ? Reflect.get(t, k) : () => {}),
    set: (t, k, v) => Reflect.set(t, k, v),
  });
  return {
    canvas: Object.assign(canvas, { getContext: () => ctx }) as unknown as HTMLCanvasElement,
    resize(w: number, h: number) {
      size = { width: w, height: h };
    },
  };
}
function fixture(width = 1280, height = 720, tall = false) {
  const g = new Game();
  g.start('camera-regression');
  if (tall) g.level.recoilTrial = 'launch';
  const out = surface(width, height),
    r = new Renderer(out.canvas, g);
  r.reduced = true;
  return { g, r, out };
}
function draw(r: Renderer, frames = 1) {
  for (let i = 0; i < frames; i++) r.draw(r.last + 1000 / 60);
}

test('camera choices are safe and the three modes have a visible, bounded purpose in ordinary rooms', () => {
  for (const bad of [null, undefined, {}, 1, 'zoom', 'FOLLOW', '__proto__'])
    assert.equal(loadCameraMode(bad), 'follow');
  for (const mode of modes) assert.equal(loadCameraMode(mode), mode);
  for (const [width, height] of [
    [1280, 720],
    [960, 600],
  ]) {
    const i = input({ width, height, worldTop: 0 });
    const steady = combatCameraScale({ ...i, mode: 'steady' }),
      wide = combatCameraScale({ ...i, mode: 'wide' });
    assert(steady / wide > 1.08, 'Wide must remain visibly wider even with normal room bounds');
    assert(combatCameraScale({ ...i, velocity: { x: 25, y: 0 } }) < combatCameraScale(i) * 0.93);
    assert.equal(combatCameraScale({ ...i, mode: 'steady', velocity: { x: 25, y: -25 } }), steady);
    assert.equal(combatCameraScale({ ...i, mode: 'wide', velocity: { x: 25, y: 25 } }), wide);
    assert(height / wide <= 835);
  }
});

test('vertical anticipation opens the route ahead while preserving horizontal aim and velocity lead', () => {
  const i = input(),
    scale = combatCameraScale(i),
    idle = combatCameraTarget(i, scale);
  const climb = combatCameraTarget({ ...i, velocity: { x: 0, y: -20 } }, scale);
  const fall = combatCameraTarget({ ...i, velocity: { x: 0, y: 20 } }, scale);
  assert.equal(climb.x, idle.x);
  assert.equal(fall.x, idle.x);
  assert(climb.y < idle.y - 60);
  assert(fall.y > idle.y + 70);
  assert.deepEqual(combatCameraTarget({ ...i, velocity: { x: 0, y: 0.8 } }, scale), idle);
  const gentle = combatCameraTarget({ ...i, mode: 'steady', velocity: { x: 0, y: 20 } }, scale);
  assert(gentle.y > idle.y && gentle.y < fall.y);
  const sideways = combatCameraTarget(
    { ...i, velocity: { x: 7, y: 0 }, aim: { x: 1300, y: 0 } },
    scale,
  );
  assert(Math.abs(sideways.x - (1000 - (1280 / scale) * 0.42 + 30 + 35)) < 1e-6);
});

test('frame stalls, tiny ground motion and pause do not cause zoom pulses or unbounded motion', () => {
  assert.equal(cameraFrameDelta(900, 1000), 0);
  assert.equal(cameraFrameDelta(Infinity, 1), 0);
  assert.equal(cameraFrameDelta(10000, 0), 0.05);
  const i = input(),
    start = combatCameraTarget(i);
  for (const n of [0, NaN, -1]) assert.deepEqual(advanceCombatCamera(start, i, n), start);
  const fast = { ...i, velocity: { x: 20, y: -16 } };
  assert.deepEqual(advanceCombatCamera(start, fast, 500), advanceCombatCamera(start, fast, 0.05));
  const next = advanceCombatCamera(start, fast, 1 / 60);
  assert(Math.abs(next.scale - start.scale) < 0.004);
  for (let n = 0; n < 60; n++)
    assert.equal(combatCameraScale({ ...i, velocity: { x: 0.2, y: 0.7 } }), start.scale);
});

test('all camera modes keep finite player framing within small, large, tall, wide and mirrored room limits', () => {
  for (const [width, height] of [
    [320, 240],
    [960, 600],
    [1280, 720],
    [3800, 720],
    [360, 1800],
    [1, 1],
  ])
    for (const worldTop of [0, -620])
      for (const mode of modes)
        for (const p of [
          { x: 35, y: worldTop + 30 },
          { x: 1000, y: 150 },
          { x: 1965, y: 800 },
        ]) {
          const i = input({
            width,
            height,
            worldTop,
            mode,
            player: p,
            velocity: { x: 23, y: -25 },
          });
          let frame = { x: NaN, y: Infinity, scale: NaN };
          for (let n = 0; n < 10; n++) {
            frame = advanceCombatCamera(frame, i, 1 / 60);
            inside(frame, i);
          }
        }
  finite(
    advanceCombatCamera(
      { x: NaN, y: NaN, scale: NaN },
      input({
        width: NaN,
        height: 0,
        worldWidth: NaN,
        worldTop: NaN,
        velocity: { x: Infinity, y: NaN },
      }),
      NaN,
    ),
  );
});

test('native Renderer starts at the real descent position, smoothly leads climbs/falls and freezes on pause', () => {
  const { g, r } = fixture(1280, 720, true);
  Matter.Body.setPosition(g.player, { x: 1000, y: -480 });
  r.reset();
  draw(r);
  assert(
    g.player.position.y >= r.camera.y && g.player.position.y <= r.camera.y + r.height / r.scale,
  );
  Matter.Body.setPosition(g.player, { x: 1000, y: 100 });
  Matter.Body.setVelocity(g.player, { x: 0, y: -20 });
  r.reset();
  draw(r);
  const climb = r.camera.y;
  Matter.Body.setVelocity(g.player, { x: 0, y: 20 });
  draw(r, 30);
  assert(r.camera.y > climb + 90);
  const before = { ...r.camera, scale: r.scale };
  g.mode = 'paused';
  for (let n = 0; n < 10; n++) r.draw(r.last + 1000);
  assert.deepEqual({ ...r.camera, scale: r.scale }, before);
  g.mode = 'playing';
  r.draw(r.last - 50);
  assert.deepEqual({ ...r.camera, scale: r.scale }, before);
});

test('real portal revisions snap framing, retries reset at the player, and resize preserves world aim mapping', () => {
  const { g, r, out } = fixture(960, 600, true);
  for (const mode of modes) {
    r.cameraMode = mode;
    Matter.Body.setPosition(g.player, { x: 300, y: 690 });
    Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
    r.reset();
    draw(r);
    Matter.Body.setPosition(g.player, { x: 1700, y: -460 });
    g.portals.revision++;
    draw(r);
    const expected = combatCameraTarget(
      input({
        width: 960,
        height: 600,
        player: g.player.position,
        velocity: g.player.velocity,
        aim: g.aim,
        mode,
      }),
    );
    assert.equal(r.camera.x, expected.x);
    assert.equal(r.camera.y, expected.y);
    for (const [w, h] of [
      [320, 240],
      [1280, 720],
      [360, 1800],
    ]) {
      out.resize(w, h);
      r.resize();
      draw(r);
      for (const point of [g.player.position, { x: 1400, y: 300 }]) {
        const canvas = r.toCanvas(point),
          world = r.toWorld(canvas.x, canvas.y);
        assert(Math.hypot(world.x - point.x, world.y - point.y) < 1e-6);
      }
      inside(
        { ...r.camera, scale: r.scale },
        input({ width: w, height: h, player: g.player.position, worldTop: g.worldTop }),
      );
    }
    out.resize(960, 600);
    r.resize();
  }
});

test('explicit archive and drill frames remain exact and do not change gameplay or stored progress', () => {
  const { g, r } = fixture();
  let writes = 0;
  g.onCheckpoint = () => writes++;
  const before = JSON.stringify(g.checkpointSnapshot());
  const random = Math.random,
    rng = g.rng;
  Math.random = g.rng = () => {
    throw Error('Camera consumed RNG');
  };
  try {
    for (const mode of modes) {
      r.cameraMode = mode;
      const frame = { camera: { x: 20, y: -160 }, scale: 0.32, player: false, navigation: false };
      r.draw(0, frame);
      assert.equal(r.scale, 0.32);
      assert.deepEqual(r.camera, frame.camera);
      const fixed = {
        camera: { x: 20, y: 770 - r.height / (r.width / 900) },
        scale: r.width / 900,
      };
      r.draw(1, fixed);
      assert.equal(r.scale, fixed.scale);
      assert.deepEqual(r.camera, fixed.camera);
    }
  } finally {
    Math.random = random;
    g.rng = rng;
  }
  assert.equal(JSON.stringify(g.checkpointSnapshot()), before);
  assert.equal(writes, 0);
});

test('launch courses retain their centered horizontal composition while vertical anticipation stays active', () => {
  const g = new Game(),
    cp = recoilTrialCheckpoint('launch', 'pistol');
  g.startTest(cp);
  assert(g.recoil.active);
  const out = surface(),
    r = new Renderer(out.canvas, g);
  r.reduced = true;
  Matter.Body.setPosition(g.player, { x: 1000, y: 0 });
  Matter.Body.setVelocity(g.player, { x: 0, y: -20 });
  r.reset();
  draw(r);
  assert(Math.abs(r.camera.x - (1000 - r.width / r.scale / 2)) < 1e-6);
  const climb = r.camera.y;
  Matter.Body.setVelocity(g.player, { x: 0, y: 20 });
  draw(r, 30);
  assert(r.camera.y > climb + 90);
});

test('finale film framing and Clock Out retain their original camera composition in every mode', () => {
  const g = new Game();
  g.start('RF-C99-camera-finale', {
    version: 6,
    seed: 'RF-C99-camera-finale',
    stage: 19,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
  });
  assert(g.finale.cinema);
  const out = surface(),
    r = new Renderer(out.canvas, g);
  for (const state of ['boarding', 'airlift', 'destruction', 'escape'] as const) {
    Object.assign(g.finale.cinema!, { state, clock: 3, active: true });
    const frames = [];
    for (const mode of modes) {
      r.cameraMode = mode;
      r.camera = { x: 0, y: 0 };
      r.scale = 1;
      r.last = 0;
      r.draw(1000);
      assert.equal(r.scale, finaleCinemaScale(g, cameraBaseScale(720), 1280, 720, false));
      frames.push({ ...r.camera, scale: r.scale });
    }
    assert.deepEqual(frames[0], frames[1]);
    assert.deepEqual(frames[1], frames[2]);
  }
  const ordinary = fixture();
  ordinary.g.clockOut.active = true;
  const before = { ...ordinary.r.camera };
  draw(ordinary.r);
  assert.deepEqual(ordinary.r.camera, before);
});
