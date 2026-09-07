import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { distance, getGun } from '../src/rules.ts';
import { recordShotTrace, SHOT_TRAIL_LENGTH, SHOT_TRAIL_POINTS } from '../src/shot-trails.ts';
import type { ShotTrace } from '../src/shot-trails.ts';

const { Body, Bodies, Composite } = Matter;

function fixture() {
  const g = new Game();
  g.start('shot-trail-regression');
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const enemy of g.enemies) Composite.remove(g.engine.world, enemy.body);
  g.enemies = [];
  g.waves.clear();
  for (const body of g.terrain.slice(4)) Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  g.hazards.clear();
  g.breaches.clear();
  Body.setPosition(g.player, { x: 400, y: 400 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  return g;
}

function wall(g: Game, x = 620) {
  const body = Bodies.rectangle(x, 400, 20, 680, { isStatic: true });
  g.terrain.push(body);
  Composite.add(g.engine.world, body);
  return body;
}

function round(g: Game, overrides: Partial<Parameters<Game['addShot']>[0]> = {}) {
  g.addShot({
    pos: { x: 590, y: 390 },
    vel: { x: 30, y: 20 },
    damage: 10,
    life: 2,
    friendly: true,
    radius: 2,
    bounces: 1,
    pierce: 0,
    fragment: false,
    split: false,
    ...overrides,
  });
  return g.shots.at(-1)!;
}

function input(overrides: Partial<Input> = {}): Input {
  return {
    left: false,
    right: false,
    jump: false,
    jumpHeld: true,
    fire: false,
    aim: { x: 520, y: 600 },
    ...overrides,
  };
}

function bounded(trace: ShotTrace) {
  assert(trace.points.length <= SHOT_TRAIL_POINTS);
  let length = 0;
  for (let i = 1; i < trace.points.length; i++)
    length += distance(trace.points[i - 1], trace.points[i]);
  assert(length <= SHOT_TRAIL_LENGTH + 1e-8, `Trail retained ${length}px`);
}

function physicalState(g: Game) {
  return {
    mode: g.mode,
    hp: g.hp,
    kills: g.kills,
    time: g.time,
    player: { pos: g.player.position, vel: g.player.velocity },
    enemies: g.enemies.map((e) => ({
      hp: e.hp,
      state: e.state,
      timer: e.timer,
      pos: e.body.position,
      vel: e.body.velocity,
    })),
    shots: g.shots.map(({ trace: _trace, hits, ...shot }) => ({ ...shot, hits: [...hits] })),
  };
}

test('a real diagonal bank records its contact and outward nudge instead of cutting across the corner', () => {
  const g = fixture(),
    obstacle = wall(g),
    shot = round(g);
  const initial = shot.trace!.points[0];
  g.updateShots(1 / 60);
  assert.equal(shot.bounces, 0);
  assert.deepEqual(shot.vel, { x: -30, y: 20 });
  assert.deepEqual(shot.trace!.points, [
    { x: 590, y: 390 },
    { x: 608, y: 402 },
    { x: 607, y: 402 },
    { x: 595, y: 410 },
  ]);
  assert.equal(shot.trace!.points[1].x, obstacle.bounds.min.x - shot.radius);
  assert(shot.trace!.points.every((p) => p.x <= obstacle.bounds.min.x - shot.radius));
  assert.notStrictEqual(shot.trace!.points.at(-1), shot.pos);
  assert.notStrictEqual(initial, shot.prev);
  const recorded = structuredClone(shot.trace!.points);
  shot.pos.x -= 5;
  shot.prev.y += 5;
  assert.deepEqual(shot.trace!.points, recorded, 'A mutable physics vector changed the saved path');
  bounded(shot.trace!);
});

test('bank and piercing styles survive their last charge, while ordinary, hostile, and splinter rounds have no trace', () => {
  const g = fixture();
  wall(g);
  g.gun = getGun(['ricochet', 'pierce', 'split']);
  g.spawnEnemy('shooter', 550, 400);
  const target = g.enemies[0];
  target.spawn = 0;
  Body.setStatic(target.body, true);
  const shot = round(g, { pos: { x: 520, y: 400 }, vel: { x: 100, y: 0 }, pierce: 1 });
  g.updateShots(1 / 60);
  assert(g.shots.includes(shot));
  assert.equal(target.hp, target.maxHp - 10);
  assert.equal(shot.bounces, 0);
  assert.equal(shot.pierce, 0);
  assert.equal(shot.trace!.bank, true);
  assert.equal(shot.trace!.pierce, true);
  assert.equal(shot.damage, 8);
  assert.equal(g.shots.filter((s) => s.fragment).length, 3);
  assert(g.shots.filter((s) => s.fragment).every((s) => s.trace === undefined));
  assert.equal(round(g, { bounces: 0, pierce: 0 }).trace, undefined);
  assert.equal(round(g, { friendly: false, pierce: 1 }).trace, undefined);
  assert.equal(round(g, { fragment: true, pierce: 1 }).trace, undefined);
});

test('dense paths remain bounded and recording trails leaves real combat physics and seeded randomness unchanged', () => {
  const trace: ShotTrace = { bank: true, pierce: false, points: [] };
  for (let i = 0; i < 40; i++) {
    const point = { x: i, y: i % 2 };
    recordShotTrace(trace, point);
    point.x = -1000;
    assert.deepEqual(trace.points.at(-1), { x: i, y: i % 2 });
    bounded(trace);
  }
  assert.deepEqual(
    trace.points,
    Array.from({ length: 8 }, (_, i) => ({ x: i + 32, y: i % 2 })),
  );
  recordShotTrace(trace, { x: 1039, y: 1 });
  assert.deepEqual(trace.points, [
    { x: 991, y: 1 },
    { x: 1039, y: 1 },
  ]);
  bounded(trace);

  const traced = fixture(),
    control = fixture();
  const addControlShot = control.addShot.bind(control);
  control.addShot = (data) => {
    addControlShot(data);
    for (const shot of control.shots) shot.trace = undefined;
  };
  for (const g of [traced, control]) {
    wall(g, 650);
    g.gun = getGun(['scatter', 'ricochet', 'pierce', 'split']);
    g.spawnEnemy('shooter', 520, 600);
    const target = g.enemies[0];
    target.spawn = 0;
    target.timer = 100;
    target.hp = target.maxHp = 10000;
    Body.setStatic(target.body, true);
  }
  let banked = false,
    pierced = false,
    fragmented = false;
  for (let frame = 0; frame < 180; frame++) {
    const controls = input({
      fire: true,
      right: frame % 90 < 25,
      left: frame % 90 >= 45 && frame % 90 < 65,
      jump: frame === 60,
    });
    traced.tick(1 / 60, controls);
    control.tick(1 / 60, controls);
    assert.deepEqual(physicalState(traced), physicalState(control), `Diverged on frame ${frame}`);
    for (const shot of traced.shots) {
      banked ||= shot.banks > 0;
      pierced ||= shot.hits.size > 0;
      fragmented ||= shot.fragment;
      if (shot.trace) bounded(shot.trace);
    }
  }
  assert(banked && pierced && fragmented, 'The comparison did not exercise all collision paths');
  assert.deepEqual(
    Array.from({ length: 5 }, () => traced.rng()),
    Array.from({ length: 5 }, () => control.rng()),
  );
});

test('pause and hit stop freeze existing traces, and room loads and retries discard them', () => {
  const g = fixture(),
    shot = round(g, { pos: { x: 700, y: 300 }, vel: { x: 1, y: 0 } });
  g.tick(1 / 60, input());
  const saved = structuredClone({ pos: shot.pos, life: shot.life, trace: shot.trace });
  g.setMode('paused');
  for (let i = 0; i < 30; i++) g.tick(1 / 60, input({ fire: true }));
  assert.deepEqual({ pos: shot.pos, life: shot.life, trace: shot.trace }, saved);
  g.setMode('playing');
  g.hitStop = 0.1;
  for (let i = 0; i < 4; i++) g.tick(1 / 60, input());
  assert.deepEqual({ pos: shot.pos, life: shot.life, trace: shot.trace }, saved);
  g.hitStop = 0;
  g.tick(1 / 60, input());
  assert.notDeepEqual(shot.trace, saved.trace);
  const oldTrace = shot.trace!;
  g.loadRoom();
  assert.equal(g.shots.length, 0);
  const nextShot = round(g);
  assert.notStrictEqual(nextShot.trace, oldTrace);
  assert.equal(nextShot.trace!.points.length, 1);
  g.start(g.seed);
  assert.equal(g.shots.length, 0);
});
