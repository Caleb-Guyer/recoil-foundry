import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { testCheckpoint } from '../src/practice.ts';
import { LoaderRemaster, CraneRemaster, FIRST_SHIFT_DOCKS as C } from '../src/first-shift-docks.ts';
import { LOADER_COLLAPSE_TELL } from '../src/loader-arena.ts';

const { Body, Bodies, Composite, Engine } = Matter;
const DT = 1 / 60;
type Rig = LoaderRemaster | CraneRemaster;
function seedFor(kind: 'loader' | 'crane', mirror = false, revision = false) {
  for (let i = 0; i < 256; i++) {
    const seed = `${revision ? 'RF-C103-' : 'DOCKS-UNIT-'}${kind}-${i}`;
    const level = getLevel(seed, 3);
    if (level.mirrored === mirror && level.spawns.some((s) => s.kind === kind)) return seed;
  }
  throw new Error('No native docks seed');
}
function fixture(kind: 'loader' | 'crane', phase = 0) {
  const seed = seedFor(kind),
    g = new Game();
  g.startTest(testCheckpoint(seed, 3));
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const body of g.terrain.slice(4)) Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.loaderArena.clear();
  Body.setPosition(g.player, { x: 1000, y: 722 });
  Body.setStatic(g.player, true);
  Body.setPosition(e.body, { x: 600, y: kind === 'loader' ? 706 : 150 });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  if (e.crane) {
    e.crane.head = { x: 600, y: 300 };
    e.crane.prev = { ...e.crane.head };
    e.crane.from = { ...e.crane.head };
    e.crane.to = { ...e.crane.head };
    Body.setPosition(e.crane.body, e.crane.head);
  }
  e.spawn = 0;
  e.hp = e.maxHp * [1, 0.6, 0.25][phase];
  for (let i = 0; i < 30; i++) Engine.update(g.engine, 1000 / 60);
  const rig = kind === 'loader' ? new LoaderRemaster(g, e) : new CraneRemaster(g, e);
  return { g, e, rig };
}
function step(g: Game, rig: Rig, count = 1) {
  for (let i = 0; i < count; i++) {
    if (g.hitStop > 0) {
      g.hitStop = Math.max(0, g.hitStop - DT);
      continue;
    }
    g.time += DT;
    g.elapsed += DT;
    rig.update(DT);
    Engine.update(g.engine, 1000 / 60);
  }
}
function until(g: Game, rig: Rig, done: () => boolean, max = 2400) {
  for (let i = 0; i < max && !done(); i++) step(g, rig);
  assert(done(), `did not reach expected state: ${rig.state}/${rig.remaining}/${rig.move}`);
}

test('Loader ram gives its full warning, locks direction and uses native physical travel', () => {
  const { g, e, rig } = fixture('loader');
  until(g, rig, () => rig.state === 'windup');
  assert.equal(e.attack, 'aimed');
  assert.equal(rig.duration, C.ramTell);
  assert.equal(rig.cues.length, 1);
  assert.equal(rig.cues[0].kind, 'hull');
  const at = g.time;
  Body.setPosition(g.player, { x: 300, y: 722 });
  step(g, rig, 6);
  assert.equal(e.aim.x, -1);
  until(g, rig, () => rig.remaining <= C.loaderLock);
  Body.setPosition(g.player, { x: 1000, y: 722 });
  until(g, rig, () => rig.state === 'rush');
  assert.equal(e.aim.x, -1);
  assert(g.time - at >= C.ramTell - 1e-8);
  const x = e.body.position.x;
  step(g, rig, 5);
  assert(e.body.position.x < x - 30);
  assert(
    rig.cues.every(
      (c) => c.kind === 'hull' && c.active && c.halfWidth === 56 && c.halfHeight === 34,
    ),
  );
});

test('Loader native hull stops at solid cover and retains its final active collision cue', () => {
  const { g, e, rig } = fixture('loader');
  const wall = Bodies.rectangle(850, 500, 50, 480, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  until(g, rig, () => rig.state === 'windup');
  const cue = rig.cues[0];
  assert.equal(cue.kind, 'hull');
  if (cue.kind !== 'hull') throw new Error('expected hull');
  assert(cue.to.x + cue.halfWidth <= 825.001);
  until(g, rig, () => rig.state === 'rush');
  until(g, rig, () => rig.state === 'recover');
  assert(Math.max(...e.body.vertices.map((v) => v.x)) < 825.1);
  assert(rig.cues.length && rig.cues.every((c) => c.active));
  step(g, rig);
  assert.equal(rig.cues.length, 0);
  assert.equal(rig.duration, C.loaderRecovery);
});

test('Crane tells mark its actual rectangular head path and lock before the physical strike', () => {
  const { g, e, rig } = fixture('crane');
  until(g, rig, () => rig.state === 'windup');
  assert.notEqual(e.attack, 'flak');
  assert.equal(rig.duration, C.hookTell);
  const first = rig.cues[0];
  assert.equal(first.kind, 'hull');
  if (first.kind !== 'hull') throw new Error('expected hull');
  assert.equal(first.halfWidth, 25);
  assert.equal(first.halfHeight, 23);
  const at = g.time;
  until(g, rig, () => rig.remaining <= 0.45);
  const from = { ...e.crane!.from },
    to = { ...e.crane!.to };
  Body.setPosition(g.player, { x: 1200, y: 620 });
  until(g, rig, () => rig.state === 'rush');
  assert.deepEqual(e.crane!.from, from);
  assert.deepEqual(e.crane!.to, to);
  assert(g.time - at >= C.hookTell - 1e-8);
  const initial = { ...e.crane!.head };
  step(g, rig, 4);
  assert(Math.hypot(initial.x - e.crane!.head.x, initial.y - e.crane!.head.y) > 20);
  assert.equal(e.crane!.body.isSensor, false);
  assert.equal(e.crane!.body.position.x, e.crane!.head.x);
});

test('Crane head cannot sweep through newly placed terrain or hurt the player behind it', () => {
  const { g, e, rig } = fixture('crane');
  until(g, rig, () => rig.state === 'windup');
  until(g, rig, () => rig.remaining <= 0.45);
  const from = e.crane!.from,
    to = e.crane!.to;
  assert(Math.abs(to.x - from.x) > 200);
  const x = from.x + (to.x - from.x) * 0.45;
  const wall = Bodies.rectangle(x, 600, 40, 280, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  const hp = g.hp;
  until(g, rig, () => rig.state === 'rush');
  until(g, rig, () => rig.state === 'recover');
  assert.equal(g.hp, hp);
  assert.equal(Matter.Query.collides(e.crane!.body, [wall]).length, 0);
  assert(rig.cues.length && rig.cues.every((c) => c.active));
  step(g, rig);
  assert.equal(rig.cues.length, 0);
});

for (const kind of ['loader', 'crane'] as const)
  test(`${kind} phases add separately warned linked actions and preserve a final recovery`, () => {
    const groupSizes = [];
    for (const phase of [0, 1, 2]) {
      const { g, e, rig } = fixture(kind, phase);
      let warnings = 0,
        last = 'idle';
      for (let frame = 0; frame < 3600 && g.mode === 'playing'; frame++) {
        step(g, rig);
        if (rig.state === 'windup' && last !== 'windup') {
          warnings++;
          assert(rig.duration >= 1.1);
        }
        last = rig.state;
        if (warnings > 0 && rig.state === 'recover' && rig.duration > 1) break;
      }
      assert.equal(rig.state, 'recover');
      assert.equal(rig.duration, kind === 'loader' ? C.loaderRecovery : C.craneRecovery);
      assert.equal(e.phase, phase);
      groupSizes.push(warnings);
    }
    assert.deepEqual(groupSizes, [1, 2, 3]);
  });

for (const kind of ['loader', 'crane'] as const)
  test(`${kind} freezes on pause/hitstop and cancels committed sequences on phase/death`, () => {
    const { g, e, rig } = fixture(kind);
    until(g, rig, () => rig.state === 'windup');
    const snapshot = { remaining: rig.remaining, cues: rig.cues };
    g.setMode('paused');
    rig.update(1);
    assert.equal(rig.remaining, snapshot.remaining);
    assert.deepEqual(rig.cues, snapshot.cues);
    g.setMode('playing');
    g.hitStop = 1;
    rig.update(DT);
    assert.equal(rig.remaining, snapshot.remaining);
    g.hitStop = 0;
    e.hp = e.maxHp * 0.6;
    step(g, rig);
    assert.equal(rig.phase, 1);
    assert.equal(rig.state, 'transition');
    assert.equal(rig.cues.length, 0);
    assert.equal(rig.duration, C.transition);
    e.hp = 0;
    rig.update(DT);
    assert(rig.cancelled);
    assert.equal(rig.cues.length, 0);
    e.hp = e.maxHp;
    step(g, rig, 120);
    assert.equal(g.shots.length, 0);
  });

for (const mirror of [false, true])
  test(`Loader mirror=${mirror}: revised AI preserves both native threshold cargo warnings and real collapses`, () => {
    const seed = seedFor('loader', mirror, true),
      g = new Game();
    g.startTest(testCheckpoint(seed, 3));
    const e = g.enemies.find((e) => e.kind === 'loader')!;
    assert(e);
    assert(g.bossRemaster.owns(e));
    assert.equal(g.loaderArena.active, true);
    assert.equal(g.loaderArena.supports.length, 2);
    Body.setStatic(g.player, true);
    const tick = () =>
      g.tick(DT, {
        left: false,
        right: false,
        jump: false,
        jumpHeld: true,
        fire: false,
        aim: { x: 1000, y: 200 },
      });
    for (const [index, fraction] of [0.64, 0.29].entries()) {
      e.hp = e.maxHp * fraction;
      const support = g.loaderArena.supports[index];
      for (let frame = 0; frame < 240 && support.state === 'braced'; frame++) tick();
      assert.equal(support.state, 'warning');
      const at = g.time,
        release = support.releaseAt;
      assert(
        release - at >= LOADER_COLLAPSE_TELL - 1e-8,
        'threshold skipped its complete native cargo warning',
      );
      while (g.time + DT < release - 1e-6) {
        assert(support.cargo.body.isStatic);
        assert(g.terrain.includes(support.barrier.body));
        tick();
      }
      for (let frame = 0; frame < 8 && support.state === 'warning'; frame++) tick();
      assert.equal(support.state, 'spent');
      assert(g.time - at >= LOADER_COLLAPSE_TELL - 1e-8);
      assert.equal(support.cargo.body.isStatic, false);
      assert.equal(support.cargo.cargo!.state, 'loose');
      assert(!g.terrain.includes(support.barrier.body));
      assert(!Composite.allBodies(g.engine.world).includes(support.barrier.body));
    }
    assert.equal(g.shotCount, 0);
    assert.equal(g.kills, 0);
  });
