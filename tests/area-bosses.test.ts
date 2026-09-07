import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { FLAK_TELL, LOADER_TELL, PRESS_LOCK, PRESS_TELL } from '../src/enemies.ts';
import { MODS, loadCheckpoint } from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';
const { Body, Bodies, Composite, Query } = Matter;
function step(g: Game, count = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < count; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1400, y: 400 },
      ...input,
    });
}
function fixture(kind: 'loader' | 'press') {
  const g = new Game();
  g.start('area-boss-test');
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  Body.setPosition(g.player, { x: kind === 'loader' ? 1000 : 600, y: 722 });
  g.spawnEnemy(kind, 600, kind === 'loader' ? 705 : 260);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 100;
  step(g, 10);
  e.timer = 0;
  return { g, e };
}
function wall(g: Game, x: number, y: number, w: number, h: number) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}

test('Loader gives a full tell, commits direction, then rushes at a dodgeable height', () => {
  const { g, e } = fixture('loader');
  step(g);
  assert.equal(e.state, 'windup');
  assert.equal(e.timer, LOADER_TELL);
  const aim = { ...e.aim },
    start = g.time;
  Body.setPosition(g.player, { x: 300, y: 722 });
  step(g, 30);
  assert.equal(e.state, 'windup');
  assert.deepEqual(e.aim, aim);
  for (let i = 0; i < 120 && e.state === 'windup'; i++) step(g);
  assert(g.time - start >= LOADER_TELL - 0.01);
  assert.equal(e.state, 'rush');
  step(g, 3);
  assert(e.body.velocity.x > 14);
  assert(Math.max(...e.body.vertices.map((v) => v.y)) <= 740.2);
});

test('Loader nose catches cover before penetration and its crash is a safe damage window', () => {
  const { g, e } = fixture('loader');
  Body.setPosition(e.body, { x: 800, y: 706 });
  wall(g, 880, 700, 30, 80);
  e.state = 'rush';
  e.timer = 1;
  e.aim = { x: 1, y: 0 };
  Body.setVelocity(e.body, { x: 15, y: 0 });
  step(g);
  assert.equal(e.state, 'recover');
  assert.equal(e.timer, 1.25);
  assert(e.body.bounds.max.x < 865.1);
  const hp = e.hp;
  g.hitEnemy(e, 20);
  assert.equal(hp - e.hp, 25);
  Body.setPosition(g.player, { ...e.body.position });
  step(g);
  assert.equal(g.hp, 100);
});

test('Loader can hop the low arena bumpers while repositioning', () => {
  const { g, e } = fixture('loader');
  Body.setPosition(e.body, { x: 540, y: 706 });
  wall(g, 690, 700, 140, 80);
  e.timer = 1;
  let jumped = false;
  for (let i = 0; i < 160; i++) {
    step(g);
    jumped ||= e.body.velocity.y < -10;
  }
  assert(jumped);
  assert(e.body.position.x > 826);
});

test('Press tracks early, locks the column, and preserves a full escape window', () => {
  const { g, e } = fixture('press');
  step(g);
  assert.equal(e.state, 'windup');
  assert.equal(e.timer, PRESS_TELL);
  Body.setPosition(g.player, { x: 700, y: 722 });
  step(g, 12);
  assert.equal(e.target.x, 700);
  for (let i = 0; i < 90 && e.timer > PRESS_LOCK; i++) step(g);
  const locked = { ...e.target },
    lockTime = g.time;
  Body.setPosition(g.player, { x: 300, y: 722 });
  for (let i = 0; i < 120 && e.state === 'windup'; i++) step(g);
  assert.deepEqual(e.target, locked);
  assert(g.time - lockTime >= PRESS_LOCK - 0.04);
  assert.equal(e.state, 'rush');
});

test('Press warns and fires its ranged counter at players camping either arena boundary', () => {
  for (const right of [false, true]) {
    const { g, e } = fixture('press');
    Body.setPosition(g.player, { x: right ? 1987 : 13, y: 722 });
    Body.setPosition(e.body, { x: right ? 1940 : 60, y: 260 });
    step(g);
    assert.equal(e.state, 'windup');
    assert.equal(e.attack, 'flak');
    assert.equal(e.timer, FLAK_TELL);
    step(g, 130, { left: !right, right });
    assert.equal(g.hp, 86);
  }
});

test('Press catches either edge of a platform, rests on top, and returns overhead', () => {
  for (const x of [545, 855]) {
    const { g, e } = fixture('press');
    wall(g, 700, 511, 200, 22);
    Body.setPosition(e.body, { x, y: 260 });
    Body.setPosition(g.player, { x: 1200, y: 722 });
    e.state = 'rush';
    e.timer = 0.9;
    for (let i = 0; i < 80 && e.state === 'rush'; i++) step(g);
    assert.equal(e.state, 'recover');
    assert(Math.abs(e.body.bounds.max.y - 500) < 0.2);
    const hp = e.hp;
    g.hitEnemy(e, 20);
    assert.equal(hp - e.hp, 25);
    for (let i = 0; i < 200 && e.state !== 'idle'; i++) step(g);
    assert.equal(e.state, 'idle');
    assert(e.body.position.y >= 260 && e.body.position.y <= 263);
  }
});

test('Press hits once during descent and solid platforms protect actors underneath', () => {
  for (const protectedByPlatform of [false, true]) {
    const { g, e } = fixture('press');
    if (protectedByPlatform) wall(g, 600, 511, 240, 22);
    e.state = 'rush';
    e.timer = 0.9;
    for (let i = 0; i < 80 && e.state === 'rush'; i++) step(g);
    assert.equal(e.state, 'recover');
    assert.equal(g.hp, protectedByPlatform ? 100 : 75);
    const hp = g.hp;
    step(g, 30);
    assert.equal(g.hp, hp);
  }
});

test('a Press displaced beneath a shelf returns around its edge without clipping or stalling', () => {
  const { g, e } = fixture('press'),
    shelf = wall(g, 600, 511, 240, 22);
  Body.setPosition(g.player, { x: 1000, y: 722 });
  Body.setPosition(e.body, { x: 600, y: 565 });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  e.state = 'return';
  e.timer = 2;
  let passedEdge = false;
  for (let i = 0; i < 150 && e.state === 'return'; i++) {
    const before = { ...e.body.position };
    step(g);
    assert(Math.hypot(e.body.position.x - before.x, e.body.position.y - before.y) < 10);
    assert(Query.collides(e.body, [shelf]).every((hit) => hit.depth < 1));
    passedEdge ||=
      e.body.bounds.max.x <= shelf.bounds.min.x || e.body.bounds.min.x >= shelf.bounds.max.x;
  }
  assert(passedEdge);
  assert.equal(e.state, 'idle');
  assert(e.body.position.y >= 260 && e.body.position.y <= 263);
  assert.equal(g.hp, 100);
});

test('sideways movement and an airborne recoil escape both evade a marked slam', () => {
  for (const recoil of [false, true]) {
    const { g, e } = fixture('press');
    step(g);
    assert.equal(e.state, 'windup');
    let minY = g.player.position.y;
    for (let i = 0; i < 105; i++) {
      step(g, 1, {
        right: true,
        jump: recoil && i === 0,
        fire: recoil,
        aim: { x: g.player.position.x, y: g.player.position.y + 500 },
      });
      minY = Math.min(minY, g.player.position.y);
    }
    assert.equal(g.hp, 100);
    if (recoil) assert(minY < 220);
  }
});

test('new boss telegraphs freeze through pause and hitstop; death removes the machine', () => {
  for (const kind of ['loader', 'press'] as const) {
    const { g, e } = fixture(kind);
    step(g);
    const timer = e.timer,
      position = { ...e.body.position },
      target = { ...e.target };
    g.setMode('paused');
    step(g, 30);
    assert.equal(e.timer, timer);
    assert.deepEqual(e.body.position, position);
    g.setMode('playing');
    g.hitStop = 0.2;
    step(g, 6);
    assert.equal(e.timer, timer);
    assert.deepEqual(e.target, target);
    g.hitEnemy(e, 9999);
    step(g, 30);
    assert(!g.enemies.includes(e));
    assert(!Composite.allBodies(g.engine.world).includes(e.body));
    assert(g.clear);
  }
});

test('area boss exits award one ordinary upgrade and the rooftop boss opens the escape route', () => {
  for (const stage of [2, 5, 8]) {
    const save: Checkpoint = {
      version: 3,
      seed: 'boss-progress',
      stage,
      hp: 60,
      mods: MODS.slice(0, stage).map((m) => m.id),
      kills: 10,
      elapsed: 50,
    };
    const g = new Game();
    let checkpoint: Checkpoint | null = null;
    g.onCheckpoint = (s) => {
      checkpoint = s;
    };
    g.start(save.seed, loadCheckpoint(save)!);
    assert.equal(g.enemies[0].state, 'idle');
    assert(g.enemies[0].spawn > 0);
    g.hitEnemy(g.enemies[0], 99999);
    Body.setPosition(g.player, { x: 1910, y: 722 });
    step(g, 50);
    assert.equal(g.mode, stage === 8 ? 'playing' : 'upgrade');
    if (stage === 8) {
      assert.equal(g.escape?.phase, 'route');
      assert.equal(loadCheckpoint(checkpoint)?.escape, true);
      assert.equal(g.mods.length, 8);
      continue;
    }
    const hp = g.hp,
      mod = g.offers[0].id;
    g.chooseMod(mod);
    g.chooseMod(mod);
    assert.equal(g.stage, stage + 1);
    assert.equal(g.mods.length, stage + 1);
    assert.equal(g.hp, Math.min(100, hp + 20));
    assert.equal(g.mode, 'playing');
    assert.equal(loadCheckpoint(checkpoint)?.stage, stage + 1);
  }
});
