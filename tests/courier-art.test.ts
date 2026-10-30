import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import {
  drawCourier,
  drawCourierPortrait,
  drawCourierWorld,
  drawCourierWrecks,
} from '../src/courier-art.ts';
import { courierPose, courierSnapshot, COURIER_WRECK_LIFE } from '../src/courier-pose.ts';
import { specialDeliveryFromUrl, prepareSpecialDelivery } from '../src/special-delivery-test.ts';
import { COURIER_DOOR, COURIER_DOOR_TIME } from '../src/courier.ts';
import { Renderer } from '../src/render.ts';

interface Op {
  name: string;
  args: unknown[];
}
function canvas() {
  const ops: Op[] = [],
    stack: Record<string, unknown>[] = [],
    values: Record<string, unknown> = { globalAlpha: 0.85, lineWidth: 1 };
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key in values) return values[String(key)];
      if (key === 'createLinearGradient' || key === 'createRadialGradient')
        return () => ({ addColorStop() {} });
      if (key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (key === 'getLineDash') return () => [];
      if (key === 'measureText') return () => ({ width: 50 });
      return (...args: unknown[]) => {
        if (key === 'save') stack.push({ ...values });
        if (key === 'restore') {
          assert(stack.length, 'every restore must have a save');
          Object.keys(values).forEach((k) => delete values[k]);
          Object.assign(values, stack.pop());
        }
        for (const arg of args)
          if (typeof arg === 'number') assert(Number.isFinite(arg), String(key));
        if (key === 'arc' || key === 'ellipse') assert(Number(args[2]) >= 0);
        if (key === 'fillRect' || key === 'strokeRect')
          assert(Number(args[2]) >= 0 && Number(args[3]) >= 0);
        ops.push({ name: String(key), args });
      };
    },
    set(_target, key, value) {
      if (key === 'globalAlpha') assert(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert(Number.isFinite(value) && value > 0);
      values[String(key)] = value;
      ops.push({ name: 'style:' + String(key), args: [value] });
      return true;
    },
  });
  return {
    c,
    ops,
    get depth() {
      return stack.length;
    },
  };
}
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1450, y: 700 },
};
function fixture(scene = 'animations', mirror = false) {
  const f = specialDeliveryFromUrl(
    new URL(`https://test/?test=special-delivery&scene=${scene}${mirror ? '&mirror=1' : ''}&v=1`),
  )!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint);
  assert(prepareSpecialDelivery(g, f));
  return g;
}
function tick(g: Game, n = 1) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, idle);
}
function until(g: Game, done: () => boolean, max = 1800) {
  for (let i = 0; i < max && !done(); i++) tick(g);
  assert(done());
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function state(g: Game) {
  return JSON.stringify({
    time: g.time,
    hp: g.hp,
    kills: g.kills,
    shots: g.shots,
    enemy: g.courier.enemy && {
      hp: g.courier.enemy.hp,
      pos: g.courier.enemy.body.position,
      velocity: g.courier.enemy.body.velocity,
    },
    opening: g.courier.opening,
    cargo: g.courier.cargo && {
      position: g.courier.cargo.position,
      velocity: g.courier.cargo.velocity,
    },
    presentation: g.courier.presentation.wrecks,
    events: g.courier.presentation.events,
    saved: g.checkpointSnapshot(),
  });
}
function alive(g: Game) {
  until(g, () => !!g.courier.enemy && g.courier.enemy.spawn <= 0);
  return g.courier.enemy!;
}
const sealedCases = (ops: Op[]) =>
  ops.filter((o) => o.name === 'style:fillStyle' && o.args[0] === '#f3d99d').length;
const healthBars = (ops: Op[]) =>
  ops.filter((o) => o.name === 'fillRect' && o.args[0] === -11.5 && o.args[1] === 7.5).length;

test('Courier production and portrait rigs share articulated finite balanced geometry without a portrait health bar', () => {
  for (const mirror of [false, true]) {
    const g = fixture('animations', mirror),
      e = alive(g),
      live = canvas(),
      portrait = canvas(),
      explicit = canvas();
    try {
      drawCourier(live.c, g, e);
      drawCourier(portrait.c, g, e, true, true);
      drawCourierPortrait(explicit.c, g, e, true);
      assert.deepEqual(portrait.ops, explicit.ops);
      assert(live.ops.length > 200);
      assert.equal(sealedCases(live.ops), 1);
      assert.equal(sealedCases(portrait.ops), 1);
      assert.equal(healthBars(live.ops), 2);
      assert.equal(healthBars(portrait.ops), 0);
      assert.equal(live.depth + portrait.depth + explicit.depth, 0);
      assert(!portrait.ops.some((o) => ['fillText', 'strokeText'].includes(o.name)));
    } finally {
      dispose(g);
    }
  }
});

test('actual driven wheels, boost and airborne suspension produce distinct production poses', () => {
  const g = fixture(),
    e = alive(g);
  try {
    const first = canvas();
    drawCourier(first.c, g, e);
    const oldWheel = courierPose(courierSnapshot(g, e)).wheelAngle;
    until(g, () => !!g.courier.enemy && courierPose(courierSnapshot(g, e)).wheelAngle !== oldWheel);
    const driven = canvas();
    drawCourier(driven.c, g, e);
    assert.notDeepEqual(driven.ops, first.ops);
    until(g, () => g.courier.boost > 0);
    const boost = canvas();
    drawCourier(boost.c, g, e);
    assert(courierPose(courierSnapshot(g, e)).boost > 0);
    assert.notDeepEqual(boost.ops, driven.ops);
    until(g, () => e.body.velocity.y < -2);
    assert.equal(courierPose(courierSnapshot(g, e)).mode, 'airborne');
    const air = canvas();
    drawCourier(air.c, g, e);
    assert.notDeepEqual(air.ops, driven.ops);
  } finally {
    dispose(g);
  }
});

test('accepted native hull hits produce local marks and health-threshold wear without mutating gameplay while drawing', () => {
  const g = fixture('reactions'),
    e = alive(g);
  try {
    const signatures: string[] = [];
    for (const damage of [0, e.maxHp * 0.36, e.maxHp * 0.36]) {
      if (damage) g.hitEnemy(e, damage, { x: e.body.position.x - 80, y: e.body.position.y });
      const s = courierSnapshot(g, e),
        out = canvas(),
        before = state(g),
        rng = g.rng;
      g.rng = () => {
        throw new Error('Art consumed combat randomness');
      };
      try {
        drawCourier(out.c, g, e);
      } finally {
        g.rng = rng;
      }
      assert.equal(state(g), before);
      assert.equal(s.wear, signatures.length);
      if (damage) assert(s.hit?.local && courierPose(s).hitStrength > 0);
      signatures.push(JSON.stringify(out.ops));
    }
    assert.equal(new Set(signatures).size, 3);
  } finally {
    dispose(g);
  }
});

test('actual death shows an unlit empty rig and exactly one authoritative physical case', () => {
  const g = fixture('shutdown'),
    e = alive(g);
  try {
    g.hitEnemy(e, 1e6, { x: e.body.position.x - 50, y: e.body.position.y });
    assert.equal(g.courier.presentation.wrecks.length, 1);
    assert(g.courier.cargo);
    const wreck = canvas(),
      world = canvas();
    drawCourierWrecks(wreck.c, g);
    drawCourierWorld(world.c, g);
    assert.equal(sealedCases(wreck.ops), 0);
    assert.equal(sealedCases(world.ops), 1);
    assert.equal(healthBars(wreck.ops), 0);
    assert(
      !wreck.ops.some(
        (o) =>
          o.name === 'style:fillStyle' &&
          ['#e6bd79', '#edc486', '#f3d99d'].includes(String(o.args[0])),
      ),
    );
    const positions = [g.courier.cargo.position, g.courier.presentation.wrecks[0].position];
    assert.notEqual(positions[0], positions[1]);
    assert.equal(wreck.depth + world.depth, 0);
  } finally {
    dispose(g);
  }
});

test('shutdown poses progress to an inert wreck, Reduced Effects is steady and both expire normally', () => {
  const g = fixture('wreckage'),
    e = alive(g);
  try {
    g.hitEnemy(e, 1e6);
    const first = canvas();
    drawCourierWrecks(first.c, g);
    tick(g, 30);
    const later = canvas();
    drawCourierWrecks(later.c, g);
    assert.notDeepEqual(first.ops, later.ops);
    const reducedA = canvas(),
      reducedB = canvas();
    drawCourierWrecks(reducedA.c, g, true);
    drawCourierWrecks(reducedB.c, g, true);
    assert.deepEqual(reducedA.ops, reducedB.ops);
    assert.equal(sealedCases(reducedA.ops), 0);
    tick(g, Math.ceil(COURIER_WRECK_LIFE * 60) + 30);
    const ended = canvas();
    drawCourierWrecks(ended.c, g);
    assert.equal(ended.ops.length, 0);
    assert(g.courier.cargo, 'expiring cosmetic wreckage must not consume the real cargo');
  } finally {
    dispose(g);
  }
});

test('Pause freezes live and wreck artwork at the native simulation time', () => {
  for (const defeated of [false, true]) {
    const g = fixture(),
      e = alive(g);
    try {
      if (defeated) g.hitEnemy(e, 1e6);
      g.setMode('paused');
      const before = state(g),
        a = canvas();
      if (!defeated) drawCourier(a.c, g, e);
      drawCourierWorld(a.c, g);
      tick(g, 120);
      const b = canvas();
      if (!defeated) drawCourier(b.c, g, e);
      drawCourierWorld(b.c, g);
      assert.equal(state(g), before);
      assert.deepEqual(a.ops, b.ops);
    } finally {
      dispose(g);
    }
  }
});

test('native hatch drive follows exact opening progress and resets when the Courier is pulled away', () => {
  const g = fixture('escape');
  try {
    alive(g);
    until(g, () => g.courier.opening >= 1);
    const progress = g.courier.opening / COURIER_DOOR_TIME,
      a = canvas();
    drawCourierWorld(a.c, g);
    assert(a.ops.some((o) => o.name === 'rotate' && o.args[0] === progress * Math.PI * 5));
    const e = g.courier.enemy!;
    Matter.Body.setPosition(e.body, { x: COURIER_DOOR.x - 105, y: 720 });
    Matter.Body.setVelocity(e.body, { x: -3, y: 0 });
    tick(g);
    assert.equal(g.courier.opening, 0);
    const reset = canvas();
    drawCourierWorld(reset.c, g);
    assert.notDeepEqual(reset.ops, a.ops);
    assert(g.courier.enemy && !g.courier.cargo && g.courier.presentation.wrecks.length === 0);
    until(g, () => !g.courier.enemy);
    assert.equal(g.courier.state?.status, 'lost');
    assert(!g.courier.cargo && g.courier.presentation.wrecks.length === 0);
    const escaped = canvas();
    drawCourierWorld(escaped.c, g);
    assert.equal(sealedCases(escaped.ops), 0);
    const close = g.courier.presentation.events.find((event) => event.kind === 'escape');
    assert(close && close.snapshot && close.snapshot.opening >= COURIER_DOOR_TIME);
    const closure = canvas();
    drawCourierWorld(closure.c, g);
    assert(closure.ops.some((o) => o.name === 'rotate' && Number(o.args[0]) > 0));
    const reduced = canvas();
    drawCourierWorld(reduced.c, g, true);
    assert(!reduced.ops.some((o) => o.name === 'rotate' && Number(o.args[0]) > 0));
    g.setMode('paused');
    tick(g, 30);
    const frozen = canvas();
    drawCourierWorld(frozen.c, g);
    assert.deepEqual(closure.ops, frozen.ops);
    g.setMode('playing');
    tick(g, 40);
    const closed = canvas();
    drawCourierWorld(closed.c, g);
    assert(!closed.ops.some((o) => o.name === 'rotate' && Number(o.args[0]) > 0));
  } finally {
    dispose(g);
  }
});

test('actual pickup removes the physical body, shows native recovered exit cargo and creates no reward itself', () => {
  const g = fixture('cargo'),
    e = alive(g);
  try {
    g.hitEnemy(e, 1e6);
    assert(g.courier.cargo);
    const beforeHp = g.hp,
      beforeMods = [...g.mods],
      cargo = g.courier.cargo;
    Matter.Body.setPosition(g.player, { ...cargo.position });
    Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
    until(g, () => g.courier.state?.status === 'collected', 30);
    assert.equal(g.courier.state?.status, 'collected');
    assert.equal(g.courier.cargo, null);
    const out = canvas();
    drawCourierWorld(out.c, g);
    assert.equal(sealedCases(out.ops), 1);
    assert(out.ops.some((o) => o.name === 'translate' && o.args[0] === 1862 && o.args[1] === 728));
    assert.equal(g.hp, beforeHp);
    assert.deepEqual(g.mods, beforeMods);
    assert(!g.courierReward);
  } finally {
    dispose(g);
  }
});

test('production Renderer retains the shared Courier portrait and puts inert wrecks beneath the physical case', () => {
  const g = fixture(),
    e = alive(g),
    out = canvas();
  try {
    const element = {
      getContext: () => out.c,
      getBoundingClientRect: () => ({ width: 960, height: 600 }),
    } as unknown as HTMLCanvasElement;
    const r = new Renderer(element, g);
    r.drawEnemies(true);
    assert.equal(healthBars(out.ops), 0);
    g.hitEnemy(e, 1e6);
    out.ops.length = 0;
    r.draw(1000, { camera: { x: 0, y: 400 }, scale: 1, player: true, navigation: false });
    const inactive = out.ops.findIndex(
      (o) => o.name === 'style:fillStyle' && o.args[0] === '#3b4942',
    );
    const cargo = out.ops.findIndex((o) => o.name === 'style:fillStyle' && o.args[0] === '#f3d99d');
    assert(inactive >= 0 && cargo > inactive);
    assert.equal(out.depth, 0);
  } finally {
    dispose(g);
  }
});
