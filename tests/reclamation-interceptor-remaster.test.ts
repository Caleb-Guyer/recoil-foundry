import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import {
  ReclamationInterceptorRemaster,
  RECLAMATION_INTERCEPTOR_REMASTER as C,
} from '../src/reclamation-interceptor-remaster.ts';
import { bossHasLane } from '../src/boss-hunt.ts';

const { Body, Bodies, Composite, Engine } = Matter;
const DT = 1 / 60;
function fixture(phase = 0, ng = false) {
  const g = new Game();
  g.start('reclamation-interceptor-unit');
  g.stage = 15;
  g.loadRoom();
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.breaches.clear();
  g.hazards.clear();
  for (const body of g.terrain.slice(4)) Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  if (ng) g.overtime = { baseMods: 8, repairs: 0, remix: 5 };
  Body.setPosition(g.player, { x: 1000, y: 400 });
  Body.setStatic(g.player, true);
  g.spawnEnemy('boss', 600, 300);
  const e = g.enemies[0];
  e.spawn = 0;
  e.hp = e.maxHp * [1, 0.6, 0.25][phase];
  const ai = new ReclamationInterceptorRemaster(g, e);
  return { g, e, ai };
}
function step(g: Game, ai: ReclamationInterceptorRemaster, frames = 1, physics = false) {
  for (let i = 0; i < frames; i++) {
    g.time += DT;
    g.hitStop = Math.max(0, g.hitStop - DT);
    ai.update(DT);
    if (physics) Engine.update(g.engine, DT * 1000);
  }
}
function until(
  g: Game,
  ai: ReclamationInterceptorRemaster,
  done: () => boolean,
  max = 1500,
  physics = false,
) {
  for (let i = 0; i < max; i++) {
    if (done()) return;
    step(g, ai, 1, physics);
  }
  assert.fail(`Interceptor did not reach expected state: ${JSON.stringify(ai.snapshot)}`);
}
function firstWarning(g: Game, ai: ReclamationInterceptorRemaster) {
  until(g, ai, () => ai.state === 'windup');
}

test('interceptor salvo fully warns, locks, releases exactly committed ordinary rounds, and exposes native recovery', () => {
  const { g, e, ai } = fixture();
  firstWarning(g, ai);
  assert.equal(ai.move, 'salvo');
  assert.equal(ai.duration, C.salvoTell);
  assert.equal(ai.cues.length, 1);
  assert.equal(ai.cues[0].locked, false);
  const initialAim = { ...e.aim },
    started = g.time;
  Body.setPosition(g.player, { x: 1100, y: 550 });
  step(g, ai, 10);
  assert.notDeepEqual(e.aim, initialAim);
  until(g, ai, () => ai.remaining <= C.lock);
  const aim = { ...e.aim };
  assert(ai.cues.every((cue) => cue.locked));
  const warned = ai.cues[0];
  assert.equal(warned.kind, 'segment');
  Body.setPosition(g.player, { x: 900, y: 100 });
  until(g, ai, () => ai.state === 'active');
  assert(g.time - started >= C.salvoTell - 1e-8);
  assert.deepEqual(e.aim, aim);
  assert.equal(g.shots.length, 1);
  assert.equal(e.state, 'followup');
  until(g, ai, () => ai.state === 'recover');
  assert.equal(g.shots.length, 3);
  for (const shot of g.shots) {
    assert.equal(shot.friendly, false);
    assert.equal(shot.radius, 5);
    assert.equal(shot.damage, C.damage);
    assert(Math.abs(Math.hypot(shot.vel.x, shot.vel.y) - 11.2) < 1e-8);
    assert(Math.abs(Math.atan2(shot.vel.y, shot.vel.x) - Math.atan2(aim.y, aim.x)) < 1e-8);
  }
  assert.equal(e.state, 'recover');
  const before = e.hp;
  g.hitEnemy(e, 100);
  assert.equal(before - e.hp, 100, 'native exposed-state damage changed');
  assert.equal(ai.remaining, C.recover);
});

test('fork has a real central gap and clips all four warnings to live cover', () => {
  const { g, e, ai } = fixture();
  until(g, ai, () => ai.state === 'windup' && ai.move === 'fork');
  assert.equal(ai.cues.length, 4);
  const wall = Bodies.rectangle(800, 400, 40, 700, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  assert(ai.cues.every((cue) => cue.kind === 'segment' && cue.to.x <= 775.001));
  const aim = Math.atan2(e.aim.y, e.aim.x);
  const angles = ai.cues.map((cue) => {
    assert.equal(cue.kind, 'segment');
    if (cue.kind !== 'segment') throw new Error('Expected segment');
    return Math.atan2(cue.to.y - cue.from.y, cue.to.x - cue.from.x);
  });
  assert(angles.every((angle) => Math.abs(angle - aim) >= 0.15));
  g.shots = [];
  until(g, ai, () => ai.state === 'recover');
  assert.equal(g.shots.length, 4);
  const hp = g.hp;
  for (let i = 0; i < 160; i++) g.updateShots(DT);
  assert.equal(g.hp, hp);
  assert.equal(g.shots.length, 0);
});

test('last phase aperture shows all twelve paths before release and keeps four genuine gaps', () => {
  const { g, e, ai } = fixture(2);
  firstWarning(g, ai);
  assert.equal(ai.move, 'aperture');
  assert.equal(ai.duration, C.apertureTell);
  assert.equal(ai.cues.length, 12);
  assert(ai.cues.every((cue) => cue.locked));
  const aim = { ...e.aim };
  Body.setPosition(g.player, { x: 300, y: 500 });
  step(g, ai, 15);
  assert.deepEqual(e.aim, aim);
  until(g, ai, () => ai.state === 'active');
  assert.equal(g.shots.length, 12);
  const angles = g.shots
    .map((s) => (Math.atan2(s.vel.y, s.vel.x) + Math.PI * 4) % (Math.PI * 2))
    .sort((a, b) => a - b);
  const gaps = angles.map(
    (a, i) => (angles[(i + 1) % angles.length] - a + Math.PI * 2) % (Math.PI * 2),
  );
  assert.equal(gaps.filter((gap) => gap > 0.6).length, 4);
});

test('crosscut earns a real relocated second angle and gives it a complete fresh tell', () => {
  const { g, e, ai } = fixture(1);
  firstWarning(g, ai);
  assert.equal(ai.move, 'crosscut');
  const firstPosition = { ...e.body.position };
  until(g, ai, () => ai.state === 'recover');
  assert.equal(ai.remaining, C.linkedOpening);
  until(g, ai, () => ai.state === 'relocate');
  assert.equal(ai.cues.length, 0);
  until(g, ai, () => ai.state === 'windup', 1200, true);
  assert(distance(firstPosition, e.body.position) > 100);
  assert.equal(ai.duration, C.salvoTell);
  assert.equal(ai.progress, 0);
  assert.equal(ai.cues.length, 3);
  assert(ai.cues.every((cue) => !cue.locked));
});

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

test('real solid blocks force a collision-safe firing route instead of firing through the wall', () => {
  const { g, e, ai } = fixture(1);
  const wall = Bodies.rectangle(800, 480, 50, 520, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  assert.equal(bossHasLane(g, e), false);
  let moved = false;
  const initial = { ...e.body.position };
  for (let i = 0; i < 1200 && ai.state !== 'windup'; i++) {
    step(g, ai, 1, true);
    moved ||= distance(initial, e.body.position) > 100;
    const collisions = Matter.Query.collides(e.body, [wall]);
    assert(
      collisions.every((hit) => hit.depth < 0.6),
      'the route entered real terrain',
    );
  }
  assert(moved);
  assert.equal(ai.state, 'windup');
  assert.equal(g.shots.length, 0);
  assert(bossHasLane(g, e));
});

test('NG+ starts in phase two and crosscut chains three fully warned salvos', () => {
  const { g, ai } = fixture(0, true);
  assert.equal(ai.phase, 1);
  let warnings = 0;
  let previous = ai.state;
  for (let frame = 0; frame < 2400 && ai.enemy.attacks === 0; frame++) {
    step(g, ai, 1, true);
    if (ai.state === 'windup' && previous !== 'windup') {
      warnings++;
      assert.equal(ai.duration, C.salvoTell);
      assert.equal(ai.progress, 0);
    }
    previous = ai.state;
  }
  assert.equal(warnings, 3);
  assert.equal(ai.enemy.attacks, 1);
  assert.equal(g.shots.length, 28);
  assert.equal(ai.state, 'recover');
});

test('phase transition drops pending attacks, pause and hitstop freeze the rig, and cancellation is final', () => {
  const { g, e, ai } = fixture();
  firstWarning(g, ai);
  const before = ai.snapshot;
  g.mode = 'paused';
  ai.update(0.1);
  assert.deepEqual(ai.snapshot, before);
  g.mode = 'playing';
  g.hitStop = 0.2;
  ai.update(0.1);
  assert.deepEqual(ai.snapshot, before);
  g.hitStop = 0;
  ai.update(Number.NaN);
  ai.update(-1);
  assert.deepEqual(ai.snapshot, before);
  e.hp = e.maxHp * 0.25;
  ai.update(DT);
  assert.equal(ai.phase, 2);
  assert.equal(ai.state, 'transition');
  assert.equal(ai.duration, C.transition);
  assert.equal(ai.cues.length, 0);
  assert.equal(g.shots.length, 0);
  step(g, ai, 30);
  assert.equal(g.shots.length, 0);
  ai.cancel();
  step(g, ai, 600);
  assert(ai.cancelled);
  assert.equal(ai.cues.length, 0);
  assert.equal(g.shots.length, 0);
});

test('dead or removed interceptors cannot emit pending rounds', () => {
  for (const removed of [false, true]) {
    const { g, e, ai } = fixture();
    firstWarning(g, ai);
    if (removed) g.enemies = [];
    else e.hp = 0;
    step(g, ai, 300);
    assert(ai.cancelled);
    assert.equal(ai.cues.length, 0);
    assert.equal(g.shots.length, 0);
  }
});

test('locked salvo and aperture origins resist outside impulses and all scheduled rounds share the warned muzzle', () => {
  for (const phase of [0, 2]) {
    const { g, e, ai } = fixture(phase);
    firstWarning(g, ai);
    until(g, ai, () => ai.cues.every((cue) => cue.locked));
    const cue = ai.cues[0];
    assert.equal(cue.kind, 'segment');
    if (cue.kind !== 'segment') throw new Error('Expected segment');
    const origin = { ...cue.from };
    Body.setPosition(e.body, { x: origin.x + 180, y: origin.y + 90 });
    Body.setVelocity(e.body, { x: 10, y: 8 });
    step(g, ai);
    assert.deepEqual(e.body.position, origin);
    assert(
      ai.cues.every(
        (warning) => warning.kind === 'segment' && distance(warning.from, origin) < 1e-8,
      ),
    );
    until(g, ai, () => ai.state === 'active');
    const initialCount = g.shots.length;
    Body.setPosition(e.body, { x: origin.x - 140, y: origin.y - 70 });
    Body.setVelocity(e.body, { x: -12, y: -6 });
    step(g, ai);
    assert.deepEqual(e.body.position, origin);
    until(g, ai, () => ai.state === 'recover');
    assert(g.shots.length >= initialCount);
    for (const shot of g.shots)
      assert(
        Math.abs(distance(shot.pos, origin) - 55) < 1e-7,
        'a committed shot moved to an unannounced muzzle',
      );
  }
});
