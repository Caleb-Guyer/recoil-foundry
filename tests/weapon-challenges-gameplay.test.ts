import test from 'node:test';
import assert from 'node:assert/strict';
import { type Enemy, type Game, type Input } from '../src/game.ts';
import type { ExperimentalWeapon } from '../src/experimental-weapons.ts';
import { fixture, target, Body } from './branches-fixture.ts';
import { loadCheckpoint } from '../src/rules.ts';

function setup() {
  const g = fixture([]);
  g.engine.gravity.y = 1;
  Body.setPosition(g.player, { x: 200, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  const events: { gun: ExperimentalWeapon; current: number; complete: boolean }[] = [];
  g.onWeaponChallengeProgress = (gun, current, complete) => events.push({ gun, current, complete });
  return { g, events, completed: () => events.filter((e) => e.complete).map((e) => e.gun) };
}
function kill(g: Game, x = 250, options: Partial<Enemy> = {}) {
  const e = target(g, x, 722, options.kind);
  Object.assign(e, options);
  g.hitEnemy(e, 1e8);
  return e;
}
function tick(g: Game, input: Partial<Input> = {}) {
  g.tick(1 / 60, {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: false,
    aim: { x: g.player.position.x, y: g.player.position.y + 600 },
    ...input,
  });
}
function sampledFlight(g: Game, midFlight?: () => void, recoil = true, land = true) {
  target(g, 1700, 300);
  g.weaponChallenges.input(false);
  Body.setPosition(g.player, { x: 220, y: 680 });
  g.grounded = false;
  if (recoil) g.weaponChallenges.recoiled(1);
  g.weaponChallenges.afterStep();
  for (let i = 2; i <= 26; i++) {
    Body.setPosition(g.player, { x: 200 + i * 20, y: 600 });
    g.weaponChallenges.afterStep();
    if (i === 15) midFlight?.();
  }
  for (const y of land ? [660, 720, 722] : [660]) {
    Body.setPosition(g.player, { x: 720, y });
    g.weaponChallenges.afterStep();
  }
}

test('Close Quarters requires three distinct real kills at the inclusive 180-unit range', () => {
  const { g, events, completed } = setup();
  kill(g, 380.01);
  kill(g, 380);
  const e = kill(g);
  g.weaponChallenges.defeated(e);
  assert.equal(g.weaponChallenges.progress('bellows').current, 2);
  kill(g);
  assert.deepEqual(completed(), ['bellows']);
  assert.deepEqual(
    events.map((e) => e.current),
    [1, 2, 3],
  );
});

test('spawn warnings, sentries, relays, cleanup and uncredited kills cannot pad either kill challenge', () => {
  const { g, completed } = setup();
  g.weaponChallenges.input(true);
  kill(g, 250, { spawn: 1 });
  kill(g, 250, { kind: 'sentry' });
  kill(g, 250, { eventRole: 'relay' });
  for (const credited of [false, true]) {
    const e = target(g, 250, 722);
    g.hitEnemy(e, 1e8, undefined, true, true, credited, credited ? 'cleanup' : undefined);
  }
  assert.deepEqual(completed(), []);
  assert.equal(g.weaponChallenges.progress('bellows').best, 0);
  assert.equal(g.weaponChallenges.progress('debt-collector').best, 0);
});

test('calling the defeat hook on a living enemy cannot create progress or consume its future kill', () => {
  const { g, events } = setup();
  g.weaponChallenges.input(true);
  const e = target(g, 250, 722);
  g.weaponChallenges.defeated(e);
  assert.deepEqual(events, []);
  g.hitEnemy(e, 1e8);
  assert.equal(g.weaponChallenges.progress('bellows').current, 1);
  assert.equal(g.weaponChallenges.progress('debt-collector').current, 1);
});

test('Hold the Line requires one uninterrupted undamaged hold; releasing preserves best but resets the attempt', () => {
  const { g, completed } = setup();
  g.weaponChallenges.input(true);
  kill(g, 600);
  kill(g, 600);
  g.weaponChallenges.input(false);
  assert.equal(g.weaponChallenges.progress('debt-collector').current, 0);
  assert.equal(g.weaponChallenges.progress('debt-collector').best, 2);
  g.weaponChallenges.input(true);
  kill(g, 600);
  assert.deepEqual(completed(), []);
  kill(g, 600);
  kill(g, 600);
  assert.deepEqual(completed(), ['debt-collector']);
});

for (const cancel of ['damage', 'pause'] as const) {
  test(`${cancel} requires release and a fresh press before another held-trigger kill streak`, () => {
    const { g, completed } = setup();
    g.weaponChallenges.input(true);
    kill(g, 600);
    kill(g, 600);
    if (cancel === 'damage') g.damagePlayer(1);
    else {
      g.setMode('paused');
      g.setMode('playing');
    }
    g.weaponChallenges.input(true);
    for (let i = 0; i < 3; i++) kill(g, 600);
    assert.deepEqual(completed(), []);
    g.weaponChallenges.input(false);
    g.weaponChallenges.input(true);
    for (let i = 0; i < 3; i++) kill(g, 600);
    assert.deepEqual(completed(), ['debt-collector']);
  });
}

test('Continue/loadRoom resets room-local kill evidence and never restores a best as attempt credit', () => {
  const { g, completed } = setup();
  g.weaponChallenges.input(true);
  kill(g);
  kill(g);
  const save = loadCheckpoint(g.checkpointSnapshot());
  assert(save);
  g.start(save.seed, save);
  assert.equal(g.weaponChallenges.progress('bellows').current, 0);
  assert.equal(g.weaponChallenges.progress('debt-collector').current, 0);
  kill(g);
  assert.deepEqual(completed(), []);
});

test('Long Haul separates airborne progress from safe completion and bounds progress events to 50-unit steps', () => {
  const { g, events, completed } = setup();
  sampledFlight(g, () => assert(!completed().includes('switchjack')));
  assert.deepEqual(completed(), ['switchjack']);
  const flight = events.filter((e) => e.gun === 'switchjack');
  assert.deepEqual(
    flight.filter((e) => !e.complete).map((e) => e.current),
    [50, 100, 150, 200, 250, 300, 350, 400, 450, 500],
  );
  assert.deepEqual(flight.at(-1), { gun: 'switchjack', current: 500, complete: true });
});

test('a hostile round hitting on the actual landing frame cancels Long Haul before completion', () => {
  const { g, completed } = setup();
  sampledFlight(g, undefined, true, false);
  assert.equal(g.weaponChallenges.progress('switchjack').best, 500);
  Body.setPosition(g.player, { x: 720, y: 722 });
  g.addShot({
    pos: { x: 720, y: 710 },
    vel: { x: 0, y: 1 },
    damage: 5,
    life: 1,
    friendly: false,
    radius: 3,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  tick(g);
  assert.equal(g.hp, 95);
  assert(!completed().includes('switchjack'));
});

for (const cancel of ['damage', 'pause', 'teleport', 'reset'] as const) {
  test(`Long Haul cannot resume an airborne attempt after ${cancel}`, () => {
    const { g, completed } = setup();
    sampledFlight(g, () => {
      if (cancel === 'damage') g.damagePlayer(1);
      else if (cancel === 'pause') {
        g.setMode('paused');
        g.setMode('playing');
      } else if (cancel === 'teleport') g.weaponChallenges.teleported();
      else g.weaponChallenges.reset();
    });
    assert.deepEqual(completed(), []);
  });
}

test('ordinary jumping, walking, and an unannounced positional jump cannot supply recoil-flight credit', () => {
  const { g, completed } = setup();
  sampledFlight(g, undefined, false);
  assert.deepEqual(completed(), []);
  g.weaponChallenges.input(false);
  Body.setPosition(g.player, { x: 730, y: 680 });
  g.grounded = false;
  g.weaponChallenges.recoiled(1);
  g.weaponChallenges.afterStep();
  Body.setPosition(g.player, { x: 1500, y: 722 });
  g.weaponChallenges.afterStep();
  assert.deepEqual(completed(), []);
});

test('an empty or cleared room cannot start flight progress or spend an authoritative ground query', () => {
  const { g, events } = setup();
  const grounded = g.commendations.weapons.grounded;
  let queries = 0;
  g.commendations.weapons.grounded = () => {
    queries++;
    return grounded.call(g.commendations.weapons);
  };
  for (const clear of [false, true]) {
    g.clear = clear;
    for (let frame = 0; frame < 60; frame++) {
      g.weaponChallenges.input(false);
      g.weaponChallenges.afterStep();
    }
  }
  assert.equal(queries, 0);
  assert.deepEqual(events, []);
});

test('walking off during an empty wave gap cannot lend its old takeoff to a newly active enemy', () => {
  const { g, completed } = setup();
  const oldWave = target(g, 1700, 300);
  g.weaponChallenges.input(false);
  oldWave.hp = 0;
  Body.setPosition(g.player, { x: 200, y: 680 });
  g.grounded = false;
  g.weaponChallenges.afterStep();
  target(g, 1700, 300);
  Body.setPosition(g.player, { x: 220, y: 680 });
  g.weaponChallenges.recoiled(1);
  g.weaponChallenges.afterStep();
  for (let i = 2; i <= 26; i++) {
    Body.setPosition(g.player, { x: 200 + i * 20, y: 600 });
    g.weaponChallenges.afterStep();
  }
  for (const y of [660, 720, 722]) {
    Body.setPosition(g.player, { x: 720, y });
    g.weaponChallenges.afterStep();
  }
  assert.deepEqual(completed(), []);
  assert.equal(g.weaponChallenges.progress('switchjack').best, 0);
});

test('an honest standard pistol flight can earn Long Haul through ordinary Game.tick input', () => {
  const { g, completed } = setup();
  target(g, 1800, 300);
  tick(g);
  for (let frame = 0; frame < 6 * 60 && !completed().includes('switchjack'); frame++) {
    const moving = g.player.position.x < 1500;
    tick(g, {
      right: moving,
      jump: frame === 0,
      jumpHeld: frame < 15,
      fire: frame < 45,
      aim: { x: g.player.position.x - 150, y: g.player.position.y + 600 },
    });
  }
  assert.equal(g.startingGun, 'pistol');
  assert.deepEqual(g.mods, []);
  assert.equal(g.hp, 100);
  assert(g.shotCount > 0);
  assert(
    completed().includes('switchjack'),
    JSON.stringify({
      position: g.player.position,
      progress: g.weaponChallenges.progress('switchjack'),
      time: g.time,
    }),
  );
});

test('real pistol rounds earn the held-trigger challenge with raw Game.tick input', () => {
  const { g, completed } = setup();
  // Low-health static fixture targets isolate real projectile/input bookkeeping.
  for (const x of [500, 650, 800]) {
    const e = target(g, x, 722);
    e.hp = e.maxHp = 20;
  }
  for (let frame = 0; frame < 5 * 60 && !completed().includes('debt-collector'); frame++) {
    const e = g.enemies.find((enemy) => enemy.hp > 0);
    tick(g, { fire: true, aim: e ? { ...e.body.position } : g.aim });
  }
  assert(completed().includes('debt-collector'));
  assert.equal(g.hp, 100);
});

test('Campaign and Daily admit real evidence; practice, private tests and workshop never emit progress', () => {
  for (const mode of ['daily', 'practice', 'private', 'workshop'] as const) {
    const { g, completed, events } = setup();
    if (mode === 'daily') g.seed = 'RF-D82-20261115';
    else if (mode === 'practice') g.practice = { kind: 'loader', seed: 'ISOLATED' };
    else if (mode === 'private') g.testRun = g.checkpointSnapshot();
    else g.workshop.active = true;
    g.weaponChallenges.input(true);
    for (let i = 0; i < 3; i++) kill(g);
    assert.equal(completed().length, mode === 'daily' ? 2 : 0, mode);
    if (mode !== 'daily') assert.deepEqual(events, [], mode);
  }
});
