import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import type { Breakable } from '../src/destruction.ts';
import type { Vec } from '../src/rules.ts';
import { drawCracks, drawMaterialTerrain } from '../src/destruction-art.ts';
import { materialTerrainSnapshot } from '../src/material-response.ts';
import {
  materialTestFromUrl,
  materialTestRoom,
  prepareMaterialTest,
} from '../src/material-test.ts';

type Rect = { x: number; y: number; w: number; h: number };
type Paint = { kind: string; style: unknown; points: Vec[]; clip: Rect | null };
function canvas() {
  const ops: unknown[] = [],
    paints: Paint[] = [],
    stack: Record<string, unknown>[] = [];
  let path: Vec[] = [];
  let lastRect: Rect | null = null;
  const state: Record<string, unknown> = {
    globalAlpha: 0.8,
    lineWidth: 1,
    dx: 0,
    dy: 0,
    clipRect: null,
  };
  const point = (x: number, y: number) => ({ x: x + Number(state.dx), y: y + Number(state.dy) });
  const rectangle = (args: number[]) => [
    point(args[0], args[1]),
    point(args[0] + args[2], args[1]),
    point(args[0] + args[2], args[1] + args[3]),
    point(args[0], args[1] + args[3]),
  ];
  const paint = (kind: string, points: Vec[]) => {
    assert(state.clipRect, 'all terrain detail must stay clipped to the real solid');
    paints.push({
      kind,
      style: state[kind.startsWith('fill') ? 'fillStyle' : 'strokeStyle'],
      points: points.map((p) => ({ ...p })),
      clip: { ...(state.clipRect as Rect) },
    });
  };
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (Object.hasOwn(state, key)) return state[String(key)];
      return (...args: number[]) => {
        for (const n of args)
          assert(Number.isFinite(n), String(key) + ' has finite native canvas geometry');
        assert(
          !['drawImage', 'clearRect', 'fillText', 'strokeText', 'setLineDash'].includes(
            String(key),
          ),
          'material detail has no captions, resampled art or attack warnings',
        );
        if (['rect', 'fillRect', 'strokeRect'].includes(String(key)))
          assert(args[2] >= 0 && args[3] >= 0, 'native rectangle dimensions are nonnegative');
        if (key === 'save') stack.push({ ...state });
        else if (key === 'restore') {
          assert(stack.length, 'canvas state is balanced');
          Object.keys(state).forEach((k) => delete state[k]);
          Object.assign(state, stack.pop());
        } else if (key === 'translate') {
          state.dx = Number(state.dx) + args[0];
          state.dy = Number(state.dy) + args[1];
        } else if (key === 'beginPath') {
          path = [];
          lastRect = null;
        } else if (key === 'rect') {
          path.push(...rectangle(args));
          lastRect = {
            x: args[0] + Number(state.dx),
            y: args[1] + Number(state.dy),
            w: args[2],
            h: args[3],
          };
        } else if (key === 'clip') {
          assert(lastRect);
          state.clipRect = { ...lastRect };
        } else if (key === 'moveTo' || key === 'lineTo') path.push(point(args[0], args[1]));
        else if (key === 'arc') {
          assert(args[2] >= 0, 'native arc radius is nonnegative');
          path.push(
            point(args[0] - args[2], args[1] - args[2]),
            point(args[0] + args[2], args[1] + args[2]),
          );
        } else if (key === 'fill' || key === 'stroke') paint(String(key), path);
        else if (key === 'fillRect' || key === 'strokeRect') paint(String(key), rectangle(args));
        ops.push([String(key), ...args]);
      };
    },
    set(_target, key, value) {
      if (key === 'globalAlpha') assert(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert(Number.isFinite(value) && value > 0);
      state[String(key)] = value;
      ops.push(['style:' + String(key), value]);
      return true;
    },
  });
  return {
    c,
    ops,
    paints,
    get depth() {
      return stack.length;
    },
    get alpha() {
      return state.globalAlpha;
    },
  };
}
function course(mirror = false) {
  const f = materialTestFromUrl(
    new URL('https://test/?test=material-response&scene=terrain&v=1' + (mirror ? '&mirror=1' : '')),
  )!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, materialTestRoom(f));
  assert(prepareMaterialTest(g, f));
  return g;
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function hit(g: Game, p: Breakable, damage: number, from: Vec, velocity: Vec) {
  g.addShot({
    pos: from,
    vel: velocity,
    damage,
    life: 3,
    radius: 3,
    friendly: true,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  const shot = g.shots.at(-1)!;
  g.updateShots(1 / 60);
  assert.equal(shot.life, 0, 'native shot is consumed at real terrain');
  return shot;
}
function nativeState(g: Game) {
  return JSON.stringify({
    time: g.time,
    hp: g.hp,
    kills: g.kills,
    mode: g.mode,
    checkpoint: g.checkpointSnapshot(),
    bodies: Matter.Composite.allBodies(g.engine.world).map((b) => ({
      id: b.id,
      position: b.position,
      velocity: b.velocity,
      angle: b.angle,
      static: b.isStatic,
      vertices: b.vertices.map((v) => ({ x: v.x, y: v.y })),
    })),
    solids: g.level.solids,
    route: g.level.route,
    shots: g.shots,
    pieces: g.destruction.pieces.map((p) => materialTerrainSnapshot(g, p)),
    breaks: g.materialResponse.breaks,
  });
}
function draw(g: Game, p: Breakable, reduced = false) {
  const out = canvas();
  assert(drawMaterialTerrain(out.c, g, p, reduced));
  assert.equal(out.depth, 0);
  assert.equal(out.alpha, 0.8);
  return out;
}
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1600, y: 600 },
};

test('native weak walls and loaded shelves retain their solid footprint while construction progresses through real health bands', () => {
  for (const mirror of [false, true]) {
    const g = course(mirror);
    try {
      const [wall, shelf] = g.destruction.pieces;
      assert(wall.rect.h > 28 && shelf.rect.h <= 28);
      for (const p of [wall, shelf]) {
        const hull = JSON.stringify(p.body.vertices.map((v) => ({ x: v.x, y: v.y }))),
          rect = { ...p.rect },
          signatures: string[] = [];
        const bands = [0, p.maxHp * 0.4, p.maxHp * 0.35];
        for (const damage of bands) {
          if (damage) g.destruction.hitBody(p.body, damage, { x: 1, y: 0 });
          const output = draw(g, p, true);
          signatures.push(JSON.stringify(output.ops));
          assert(
            output.paints.length >= 12,
            'native material assembly contains visible construction',
          );
          for (const paint of output.paints)
            assert.deepEqual(paint.clip, {
              x: rect.x + 1,
              y: rect.y + 1,
              w: rect.w - 2,
              h: rect.h - 2,
            });
          assert.equal(JSON.stringify(p.body.vertices.map((v) => ({ x: v.x, y: v.y }))), hull);
          assert.deepEqual(p.rect, rect);
          assert(g.terrain.includes(p.body));
        }
        assert.equal(
          new Set(signatures).size,
          3,
          'intact, worn and critical remaining health have distinct stable material detail',
        );
      }
      assert.notDeepEqual(
        draw(g, wall).ops,
        draw(g, shelf).ops,
        'walls and shelves have different construction',
      );
    } finally {
      dispose(g);
    }
  }
});

test('local chips follow accepted real projectile contacts from either side rather than an arbitrary impact location', () => {
  for (const sign of [-1, 1]) {
    const g = course();
    try {
      const p = g.destruction.pieces[0],
        rect = p.rect,
        y = rect.y + (sign > 0 ? 32 : 82),
        from = { x: sign > 0 ? rect.x - 45 : rect.x + rect.w + 45, y };
      hit(g, p, 22, from, { x: sign * 90, y: 0 });
      assert.equal(p.hp, p.maxHp - 22);
      const observed = materialTerrainSnapshot(g, p)!;
      assert(observed.hit?.local);
      assert(Math.abs(observed.hit.local.y - (y - p.body.position.y)) < 0.01);
      assert(Math.sign(observed.hit.direction!.x) === sign);
      const chip = draw(g, p, true).paints.find(
        (paint) => paint.kind === 'fill' && paint.style === '#213632',
      );
      assert(chip, 'an admitted native hit leaves a captive material chip');
      const ys = chip.points.map((v) => v.y),
        xs = chip.points.map((v) => v.x);
      assert(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - y) < 1);
      const expectedX = sign > 0 ? rect.x + 4 : rect.x + rect.w - 4;
      assert(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - expectedX) < 1);
    } finally {
      dispose(g);
    }
  }
});

test('Reduced Effects preserves health and contact detail while Pause freezes the admitted impact animation', () => {
  const g = course();
  try {
    const p = g.destruction.pieces[0];
    hit(g, p, 45, { x: p.rect.x - 45, y: p.rect.y + 44 }, { x: 90, y: 0 });
    const ordinary = draw(g, p),
      reduced = draw(g, p, true);
    assert(
      ordinary.ops.length > reduced.ops.length,
      'Reduced Effects omits the transient impact ring',
    );
    assert(
      reduced.paints.some((p) => p.style === '#213632'),
      'Reduced Effects retains the actual contact chip',
    );
    g.setMode('paused');
    const before = nativeState(g);
    for (let i = 0; i < 30; i++) {
      g.tick(1 / 60, idle);
      assert.deepEqual(draw(g, p).ops, ordinary.ops);
    }
    assert.equal(nativeState(g), before);
    g.setMode('playing');
    g.time += 1;
    assert.deepEqual(
      draw(g, p, true).ops,
      reduced.ops,
      'static Reduced Effects cues do not depend on animation time',
    );
    assert.notDeepEqual(
      draw(g, p).ops,
      ordinary.ops,
      'normal transient response settles using simulation time',
    );
  } finally {
    dispose(g);
  }
});

test('a collapsed shelf stops painting immediately, releases its real load and leaves break fragments to the shared renderer', () => {
  const g = course();
  try {
    const p = g.destruction.pieces[1],
      load = g.props.items.find((p) => p.kind === 'cover')!;
    assert(load.body.isStatic);
    g.destruction.hitBody(p.body, p.maxHp, { x: 0, y: 1 });
    assert(!load.body.isStatic, 'native support releases its load');
    assert(!g.terrain.includes(p.body));
    assert(
      g.props.items.some((p) => p.kind === 'rubble'),
      'native physical rubble still exists',
    );
    assert(g.materialResponse.breaks.some((b) => b.snapshot.bodyId === p.body.id));
    const out = canvas();
    assert.equal(drawMaterialTerrain(out.c, g, p, false), false);
    assert.deepEqual(
      out.ops,
      [],
      'removed terrain cannot produce a visible ghost platform or duplicate breakup',
    );
    const structural = g.terrain.find((b) => !g.destruction.pieces.some((p) => p.body === b))!;
    assert(structural);
    assert.equal(drawMaterialTerrain(out.c, g, { ...p, body: structural }, false), false);
    assert.deepEqual(
      out.ops,
      [],
      'unregistered structural and excluded support bodies remain plain',
    );
  } finally {
    dispose(g);
  }
});

test('repeated terrain drawing restores canvas state, stays bounded and never consumes random state or writes gameplay', () => {
  const g = course();
  try {
    const p = g.destruction.pieces[0];
    hit(g, p, 50, { x: p.rect.x - 45, y: p.rect.y + 55 }, { x: 90, y: 0 });
    const before = nativeState(g),
      oldRandom = Math.random,
      oldRng = g.rng,
      oldCosmetic = g.cosmeticRandom;
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onSound = () => writes++;
    try {
      Math.random = () => {
        throw new Error('drawing cannot use Math.random');
      };
      g.rng = () => {
        throw new Error('drawing cannot use the combat seed');
      };
      g.cosmeticRandom = () => {
        throw new Error('drawing cannot advance cosmetic streams');
      };
      for (let i = 0; i < 50; i++)
        for (const p of g.destruction.pieces) {
          const out = draw(g, p, i % 2 === 0);
          assert(out.ops.length < 600, 'all native terrain detail has a bounded canvas budget');
        }
      assert.equal(nativeState(g), before);
      assert.equal(writes, 0);
    } finally {
      Math.random = oldRandom;
      g.rng = oldRng;
      g.cosmeticRandom = oldCosmetic;
    }
    for (const rect of [
      { x: 0, y: 0, w: 20000, h: 22 },
      { x: 0, y: 0, w: 20000, h: 130 },
    ]) {
      const out = canvas();
      drawCracks(out.c, { ...p, rect }, true);
      assert(out.ops.length < 650, 'long solids cannot create an unbounded rib loop');
      assert.equal(out.depth, 0);
    }
    for (const rect of [
      { x: 0, y: 0, w: 0, h: 22 },
      { x: NaN, y: 0, w: 100, h: 22 },
      { x: 0, y: 0, w: 9, h: 9 },
    ]) {
      const out = canvas();
      drawCracks(out.c, { ...p, rect }, false);
      assert.equal(out.ops.length, 0, 'invalid standalone geometry fails closed');
    }
  } finally {
    dispose(g);
  }
});
