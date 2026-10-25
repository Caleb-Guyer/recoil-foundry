import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { TurbineRemaster, TURBINE_REMASTER as C } from '../src/turbine-remaster.ts';
import { turbineWind } from '../src/turbine.ts';

const { Body, Bodies, Composite, Engine } = Matter;
const DT = 1 / 60;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function fixture(phase = 0, ng = false) {
  const g = new Game();
  // Direct rig tests use the old dispatcher identity so it cannot update a rig twice.
  g.start('turbine-remaster-unit');
  g.stage = 11;
  g.loadRoom();
  g.bossRemaster.clear();
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const enemy of g.enemies) Composite.remove(g.engine.world, enemy.body);
  g.enemies = [];
  g.waves.clear();
  g.breaches.clear();
  g.hazards.clear();
  for (const body of g.terrain.slice(4)) Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  g.spawnEnemy('turbine', 600, 400);
  const e = g.enemies[0];
  e.spawn = 0;
  if (ng) g.overtime = { baseMods: 8, repairs: 0, remix: 2 };
  e.hp = e.maxHp * [1, 0.6, 0.25][phase];
  Body.setStatic(e.body, true);
  Body.setPosition(g.player, { x: 1000, y: 400 });
  Body.setStatic(g.player, true);
  const ai = new TurbineRemaster(g, e);
  return { g, e, ai };
}
function step(g: Game, ai: TurbineRemaster, count = 1, physics = false) {
  for (let i = 0; i < count; i++) {
    g.time += DT;
    ai.update(DT);
    if (physics) Engine.update(g.engine, 1000 / 60);
  }
}
function until(g: Game, ai: TurbineRemaster, done: () => boolean, max = 1800) {
  for (let i = 0; i < max; i++) {
    if (done()) return;
    step(g, ai);
  }
  assert.fail(`Rotor did not reach expected state: ${JSON.stringify(ai.snapshot)}`);
}
function windup(g: Game, ai: TurbineRemaster) {
  until(g, ai, () => ai.state === 'windup');
}
function active(g: Game, ai: TurbineRemaster) {
  until(g, ai, () => ai.state === 'active');
}

test('opening gust fully warns, tracks early, locks aim and shares one fixed muzzle with its blades', () => {
  const { g, e, ai } = fixture();
  windup(g, ai);
  assert.equal(ai.move, 'gust');
  assert.equal(ai.duration, C.gustTell);
  assert.equal(ai.cues.length, 3);
  assert(ai.cues.every((cue) => !cue.active && !cue.locked && cue.progress === 0));
  assert.deepEqual(e.turbine!.angles, [], 'native blade tells must not duplicate custom rays');
  const started = g.time;
  const first = { ...e.aim };
  Body.setPosition(g.player, { x: 1100, y: 500 });
  step(g, ai, 8);
  assert.notDeepEqual(e.aim, first);
  until(g, ai, () => ai.remaining <= C.lock);
  const locked = { ...e.aim };
  const origin = ai.snapshot.origin;
  assert(ai.cues.every((cue) => cue.locked));
  Body.setPosition(g.player, { x: 900, y: 100 });
  Body.setPosition(e.body, { x: origin.x + 80, y: origin.y });
  active(g, ai);
  assert.deepEqual(e.aim, locked);
  assert.deepEqual(e.body.position, origin);
  assert(g.time - started >= C.gustTell - 1e-8);
  assert.equal(g.shots.length, 0);
  step(g, ai, 16);
  assert.equal(g.shots.length, 1);
  const s = g.shots[0];
  assert(s.blade && !s.friendly);
  assert.equal(s.damage, 22);
  assert.equal(s.radius, 11);
  near(Math.hypot(s.vel.x, s.vel.y), 9.6);
  const expected = ai.snapshot.rounds.find((r) => r.fired)!;
  near(Math.atan2(s.vel.y, s.vel.x), expected.angle);
});

test('all queued gust blades fit the active window in every native phase', () => {
  for (const phase of [0, 1, 2]) {
    const { g, e, ai } = fixture(phase);
    windup(g, ai);
    const expected = ai.snapshot.rounds.length;
    assert.equal(expected, phase === 0 ? 6 : 10);
    assert(Math.max(...ai.snapshot.rounds.map((r) => r.at)) < C.gustDuration);
    active(g, ai);
    until(g, ai, () => ai.state === 'recover');
    assert.equal(g.shots.length, expected);
    assert(g.shots.every((s) => s.blade && s.radius === 11 && s.damage === 22));
    assert.equal(e.turbine!.active, 0);
    assert.equal(turbineWind(g, e, { x: 1000, y: 400 }), 0);
    assert(ai.remaining >= C.linkedOpening);
  }
});

test('native wind stays finite, does not damage, and applies only during the committed active gust', () => {
  const { g, e, ai } = fixture();
  windup(g, ai);
  assert.equal(turbineWind(g, e, { x: 1000, y: 400 }), 0);
  active(g, ai);
  step(g, ai, 15);
  assert(turbineWind(g, e, { x: 1000, y: 400 }) > 0.99);
  assert.equal(turbineWind(g, e, { x: 1500, y: 400 }), 0);
  assert.equal(turbineWind(g, e, { x: 900, y: 650 }), 0);
  assert.equal(turbineWind(g, e, { x: 500, y: 400 }), 0);
  assert.equal(g.hp, 100);
  Body.setStatic(g.player, false);
  Body.setVelocity(g.player, { x: 0, y: 0 });
  step(g, ai);
  assert(g.player.velocity.x > 0);
});

test('actual walls shelter the player from wind and clip all blade warning paths', () => {
  const { g, e, ai } = fixture();
  windup(g, ai);
  const wall = Bodies.rectangle(800, 400, 12, 700, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  assert(ai.cues.every((cue) => cue.kind === 'segment' && cue.to.x <= 783.001));
  active(g, ai);
  step(g, ai, 20);
  assert.equal(turbineWind(g, e, g.player.position), 0);
  for (let i = 0; i < 110; i++) {
    g.time += DT;
    ai.update(DT);
    g.updateShots(DT);
  }
  assert.equal(g.hp, 100);
  assert.equal(g.shots.length, 0, 'wide blades must collide with the thin real wall');
});

test('loose cover is pushed but shelters downwind objects until its actual hull moves away', () => {
  const { g, e, ai } = fixture();
  windup(g, ai);
  active(g, ai);
  step(g, ai, 15);
  const cover = g.props.spawn('crate', 850, 400);
  const fuel = g.props.spawn('canister', 1050, 400);
  Body.setStatic(g.player, false);
  Body.setVelocity(g.player, { x: 0, y: 0 });
  assert.equal(turbineWind(g, e, g.player.position), 0);
  step(g, ai);
  assert(cover.body.velocity.x > 0);
  near(fuel.body.velocity.x, 0);
  near(g.player.velocity.x, 0);
  assert.equal(cover.hp, cover.maxHp);
  assert(!Number.isFinite(fuel.armedAt));
  Body.setPosition(cover.body, { x: 850, y: 650 });
  assert(turbineWind(g, e, g.player.position) > 0);
});

test('blade sweep follows the gust with a fresh complete warning and a real recovery opening', () => {
  const { g, e, ai } = fixture();
  windup(g, ai);
  active(g, ai);
  until(g, ai, () => ai.state === 'recover');
  assert.equal(ai.remaining, C.recover);
  const before = e.hp;
  g.hitEnemy(e, 100);
  near(before - e.hp, 135);
  g.shots = [];
  until(g, ai, () => ai.state === 'windup' && ai.move === 'sweep');
  assert.equal(ai.duration, C.sweepTell);
  assert.equal(ai.remaining, C.sweepTell);
  assert.equal(ai.cues.length, 3);
  assert(ai.cues.every((cue) => !cue.locked && !cue.active && cue.progress === 0));
  const start = g.time;
  active(g, ai);
  assert(g.time - start >= C.sweepTell - 1e-8);
  assert.equal(turbineWind(g, e, { x: 1000, y: 400 }), 0);
  until(g, ai, () => ai.state === 'recover');
  assert.equal(g.shots.length, 3);
  assert.equal(e.attacks, 2);
});

test('crosswind and overdrive link different strikes with exposed gaps and every full new warning', () => {
  for (const [phase, ng, expected] of [
    [1, false, ['gust', 'sweep']],
    [2, false, ['gust', 'sweep', 'gust']],
    [1, true, ['gust', 'sweep', 'gust']],
    [2, true, ['gust', 'sweep', 'gust', 'sweep']],
  ] as const) {
    const { g, e, ai } = fixture(phase, ng);
    const strikes: string[] = [];
    for (const strike of expected) {
      windup(g, ai);
      strikes.push(ai.snapshot.strike);
      assert.equal(ai.remaining, strike === 'gust' ? C.gustTell : C.sweepTell);
      assert(ai.cues.every((cue) => cue.progress === 0 && !cue.locked));
      active(g, ai);
      until(g, ai, () => ai.state === 'recover');
      if (strikes.length < expected.length) assert.equal(ai.remaining, C.linkedOpening);
      else assert(ai.remaining >= C.recover);
    }
    assert.deepEqual(strikes, [...expected]);
    assert.equal(e.attacks, 1);
  }
});

test('phase break immediately cancels wind and queued blades before showing a fresh harder cycle', () => {
  const { g, e, ai } = fixture();
  windup(g, ai);
  active(g, ai);
  step(g, ai, 20);
  const fired = g.shots.length;
  e.hp = e.maxHp * 0.6;
  step(g, ai);
  assert.equal(ai.state, 'transition');
  assert.equal(ai.phase, 1);
  assert.equal(ai.remaining, C.transition);
  assert.equal(ai.cues.length, 0);
  assert.equal(ai.snapshot.rounds.length, 0);
  assert.equal(turbineWind(g, e, g.player.position), 0);
  step(g, ai, 55);
  assert.equal(g.shots.length, fired);
  windup(g, ai);
  assert.equal(ai.move, 'crosswind');
  assert.equal(ai.remaining, C.gustTell);
});

test('pause, hitstop and invalid time cannot advance warning locks or release queued attacks', () => {
  for (const activeState of [false, true]) {
    const { g, ai } = fixture(2);
    windup(g, ai);
    if (activeState) active(g, ai);
    const snapshot = ai.snapshot;
    g.setMode('paused');
    step(g, ai, 120);
    assert.deepEqual(ai.snapshot, snapshot);
    g.setMode('playing');
    g.hitStop = 0.2;
    step(g, ai, 120);
    assert.deepEqual(ai.snapshot, snapshot);
    g.hitStop = 0;
    for (const dt of [NaN, Infinity, -1, 0]) ai.update(dt);
    assert.deepEqual(ai.snapshot, snapshot);
    assert.equal(g.shots.length, 0);
  }
});

test('death, removal and explicit cancellation never release another gust or scheduled blade', () => {
  for (const stop of ['death', 'remove', 'cancel'] as const) {
    const { g, e, ai } = fixture(2);
    windup(g, ai);
    active(g, ai);
    step(g, ai, 16);
    const fired = g.shots.length;
    if (stop === 'death') e.hp = 0;
    else if (stop === 'remove') g.enemies = [];
    else ai.cancel();
    step(g, ai, 600);
    assert(ai.cancelled);
    assert.equal(ai.cues.length, 0);
    assert.equal(g.shots.length, fired);
    assert.equal(turbineWind(g, e, { x: 1000, y: 400 }), 0);
  }
});

test('linked relocation moves the real hull through a legal route and only warns after acquiring a lane', () => {
  const { g, e, ai } = fixture(1);
  Body.setStatic(e.body, false);
  windup(g, ai);
  active(g, ai);
  until(g, ai, () => ai.state === 'recover');
  until(g, ai, () => ai.state === 'reposition');
  const from = { ...e.body.position };
  const health = e.hp;
  for (let frame = 0; frame < 300 && ai.state !== 'windup'; frame++) step(g, ai, 1, true);
  assert.notDeepEqual(e.body.position, from);
  assert.equal(e.hp, health);
  assert.equal(ai.state, 'windup');
  assert.equal(ai.snapshot.strike, 'sweep');
  assert.equal(ai.remaining, C.sweepTell);
  assert(e.body.position.x > 45 && e.body.position.x < g.worldWidth - 45);
  assert(e.body.position.y > 45 && e.body.position.y < 695);
});

test('two gust waves share one warning per pending lane without hiding the second release', () => {
  for (const phase of [0, 1, 2]) {
    const { g, ai } = fixture(phase);
    windup(g, ai);
    const count = phase === 0 ? 3 : 5;
    assert.equal(ai.snapshot.rounds.length, count * 2);
    assert.equal(ai.cues.length, count);
    active(g, ai);
    // The first wave has fully fired while every second-wave blade is pending.
    until(g, ai, () => ai.snapshot.rounds.filter((round) => round.fired).length === count);
    assert(ai.snapshot.activeAge < 1.1);
    assert.equal(g.shots.length, count);
    assert.equal(ai.cues.length, count);
    assert(ai.cues.every((cue) => cue.locked && cue.progress === 1));
    until(g, ai, () => ai.state === 'recover');
    assert.equal(g.shots.length, count * 2);
    assert.equal(ai.cues.length, 0);
  }
});
