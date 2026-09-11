import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import {
  beginInterceptorAttack,
  interceptorAngles,
  interceptorLock,
  clearRivalHull,
} from '../src/interceptor.ts';
import {
  INTERCEPTOR_WEAPONS,
  interceptorMove,
  fireWeapon,
  updateArsenal,
  rivalCharge,
} from '../src/interceptor-weapons.ts';
import type { InterceptorMove } from '../src/interceptor-weapons.ts';
import { rivalWarningLanes } from '../src/interceptor-effects.ts';
import { getLevel } from '../src/levels.ts';
import { loadEncounters, testEncounterFromUrl } from '../src/practice.ts';
const { Body, Bodies, Composite } = Matter;
function fixture() {
  const g = new Game();
  assert(g.startPractice({ kind: 'interceptor', seed: 'arsenal-check' }));
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const body of g.terrain.slice(4)) Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 100;
  Body.setPosition(e.body, { x: 600, y: 400 });
  Body.setStatic(e.body, true);
  Body.setPosition(g.player, { x: 1000, y: 400 });
  Body.setStatic(g.player, true);
  return { g, e };
}
function step(g: Game, n = 1) {
  for (let i = 0; i < n; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1000, y: 400 },
    });
}
function until(g: Game, done: () => boolean, max = 600) {
  for (let n = 0; n < max && !done() && g.mode === 'playing'; n++) step(g);
  assert(done(), 'Timed out waiting for a real attack transition');
}
function shots(g: Game, n = 1) {
  for (let i = 0; i < n; i++) {
    g.time += 1 / 60;
    g.updateShots(1 / 60);
  }
}

test('fifteen distinct gun moves have repeatable phase decks independent of combat RNG', () => {
  const { g, e } = fixture(),
    seen = new Set<string>();
  for (let phase = 0; phase < 3; phase++) {
    e.phase = phase;
    for (let attacks = 0; attacks < 30; attacks++) {
      e.attacks = attacks;
      const move = interceptorMove(e, g.seed);
      seen.add(move);
      for (let n = 0; n < 100; n++) g.rng();
      assert.equal(interceptorMove(e, g.seed), move);
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(INTERCEPTOR_WEAPONS).sort());
});

for (const move of Object.keys(INTERCEPTOR_WEAPONS) as InterceptorMove[]) {
  if (move === 'shockwave') continue;
  test(move + ' keeps its full tell, freezes the marked aim and fires the advertised lanes', () => {
    const { g, e } = fixture();
    beginInterceptorAttack(g, e, move);
    const started = g.time,
      spec = INTERCEPTOR_WEAPONS[move];
    assert.equal(e.interceptor!.move, move);
    const fired: { a: number; t: number }[] = [];
    g.enemyShot = (_e, a) => fired.push({ a, t: g.time });
    until(g, () => e.timer <= interceptorLock(e));
    const aim = { ...e.aim },
      angles = interceptorAngles(e);
    assert(rivalWarningLanes(g, e).length >= angles.length);
    Body.setPosition(g.player, { x: 1000, y: 160 });
    while (e.state === 'windup') {
      step(g);
      if (e.state === 'windup') assert.deepEqual(e.aim, aim);
      if (g.time - started < spec.tell - 1e-6) assert.equal(fired.length, 0);
    }
    assert.deepEqual(
      fired.map((f) => f.a),
      angles,
    );
    assert(fired.every((f) => f.t - started >= spec.tell - 1 / 60));
  });
}

test('ricochet warns the bank, hits thin cover physically and only bounces once', () => {
  const { g, e } = fixture();
  Body.setPosition(g.player, { x: 1700, y: 700 });
  const wall = Bodies.rectangle(800, 400, 8, 600, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  beginInterceptorAttack(g, e, 'ricochet');
  e.aim = { x: 1, y: 0 };
  assert(rivalWarningLanes(g, e).some((l) => l.bank));
  fireWeapon(g, e, 'ricochet', e.body.position, [0]);
  const s = g.shots[0];
  for (let n = 0; n < 35 && s.banks === 0; n++) shots(g);
  assert.equal(s.banks, 1);
  assert.equal(s.bounces, 0);
  assert(s.vel.x < 0 && s.pos.x < 796);
  shots(g, 160);
  assert.equal(g.shots.length, 0);
});

test('recall rounds stop visibly before returning along their committed direction', () => {
  const { g, e } = fixture();
  Body.setPosition(g.player, { x: 1700, y: 700 });
  fireWeapon(g, e, 'recall', e.body.position, [0]);
  const s = g.shots[0];
  for (let n = 0; n < 60 && !s.enemyAmmo!.reverse; n++) shots(g);
  const stop = { ...s.pos },
    began = s.enemyAmmo!.age;
  shots(g, 20);
  assert.deepEqual(s.pos, stop);
  assert.equal(s.vel.x, 0);
  Body.setPosition(e.body, { x: 600, y: 200 });
  for (let n = 0; n < 10 && !s.enemyAmmo!.returning; n++) shots(g);
  assert(s.enemyAmmo!.age - began >= 0.38);
  assert(s.vel.x < 0);
  assert.equal(Math.abs(s.vel.y), 0);
});

test('shatter has exactly one delayed split and finite child rounds', () => {
  const { g, e } = fixture();
  Body.setPosition(g.player, { x: 1700, y: 700 });
  fireWeapon(g, e, 'shatter', e.body.position, [0]);
  const parent = g.shots[0];
  shots(g, 40);
  assert.equal(g.shots.length, 1);
  shots(g, 6);
  assert(parent.life <= 0);
  assert.equal(g.shots.length, 5);
  assert(g.shots.every((s) => s.enemyAmmo?.kind === 'scatter'));
  shots(g, 90);
  assert.equal(g.shots.length, 0);
});

test('precision can break loose cover and continue, but solid terrain still stops it', () => {
  const { g, e } = fixture();
  Body.setPosition(g.player, { x: 1700, y: 700 });
  const crate = g.props.spawn('crate', 760, 400);
  Body.setStatic(crate.body, true);
  crate.hp = 80;
  const wall = Bodies.rectangle(900, 400, 8, 600, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  fireWeapon(g, e, 'precision', e.body.position, [0]);
  const s = g.shots[0];
  shots(g, 20);
  assert(!g.props.items.includes(crate));
  assert.equal(s.pierce, 0);
  assert.equal(s.life, 0);
  assert(s.pos.x < 896);
});

test('fuses attach to actual moving cover and keep a full warning; cover blocks the detonation', () => {
  const { g, e } = fixture();
  Body.setPosition(g.player, { x: 1700, y: 700 });
  const crate = g.props.spawn('crate', 780, 400);
  Body.setStatic(crate.body, true);
  fireWeapon(g, e, 'fuse', e.body.position, [0]);
  for (let n = 0; n < 40 && !e.interceptor!.charges.length; n++) shots(g);
  const charge = e.interceptor!.charges[0];
  assert(charge);
  assert.equal(charge.body, crate.body);
  assert.equal(charge.left, 0.9);
  const before = { ...charge.pos };
  Body.setPosition(crate.body, { x: 880, y: 350 });
  updateArsenal(g, e, 0.1);
  assert(Math.abs(charge.pos.x - before.x - 100) < 0.01);
  assert(Math.abs(charge.pos.y - before.y + 50) < 0.01);
  g.props.remove(crate);
  updateArsenal(g, e, 0.1);
  assert.equal(charge.body, undefined);
  e.interceptor!.charges = [];
  Body.setPosition(g.player, { x: 1000, y: 400 });
  const wall = Bodies.rectangle(970, 400, 8, 220, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  rivalCharge(g, e, { x: 900, y: 400 }, 145, 22, 0.9);
  updateArsenal(g, e, 0.89);
  assert.equal(g.hp, 100);
  assert.equal(e.interceptor!.charges.length, 1);
  updateArsenal(g, e, 0.02);
  assert.equal(g.hp, 100);
  assert.equal(e.interceptor!.charges.length, 0);
});

test('countershot catches at most three rounds and locks the complete return fan', () => {
  const { g, e } = fixture();
  beginInterceptorAttack(g, e, 'countershot');
  for (let n = 0; n < 6; n++)
    g.addShot({
      pos: { x: 660, y: 400 },
      vel: { x: -10, y: 0 },
      damage: 20,
      life: 1,
      friendly: true,
      radius: 2,
      bounces: 0,
      pierce: 0,
      fragment: false,
      split: false,
    });
  updateArsenal(g, e, 0.01);
  assert.equal(e.interceptor!.caught, 3);
  assert.equal(g.shots.filter((s) => s.life > 0).length, 3);
  assert.equal(interceptorAngles(e).length, 9);
  e.timer = 0.4;
  const angles = interceptorAngles(e);
  updateArsenal(g, e, 0.1);
  assert.deepEqual(interceptorAngles(e), angles);
});

test('afterimages remain at old firing positions and stop tracking before firing', () => {
  const { g, e } = fixture();
  e.interceptor!.history = [
    { x: 350, y: 200 },
    { x: 800, y: 250 },
  ];
  beginInterceptorAttack(g, e, 'afterimage');
  until(g, () => e.state === 'recover');
  assert.equal(e.interceptor!.echoes.length, 2);
  const echo = e.interceptor!.echoes[0];
  while (echo.left > 0.44) updateArsenal(g, e, 0.01);
  const aim = { ...echo.aim },
    origin = { ...echo.origin };
  Body.setPosition(g.player, { x: 1700, y: 150 });
  updateArsenal(g, e, 0.2);
  assert.deepEqual(echo.aim, aim);
  assert.deepEqual(echo.origin, origin);
  const origins: { x: number; y: number }[] = [];
  g.enemyShot = (_e, _a, _s, _d, p) => {
    if (p) origins.push({ ...p });
  };
  updateArsenal(g, e, 0.25);
  assert(origins.some((p) => p.x === origin.x && p.y === origin.y));
});

test('Fold lands only in its marked free space and cancels when a crate or player blocks it', () => {
  for (const blocked of ['none', 'crate', 'player']) {
    const { g, e } = fixture(),
      from = { ...e.body.position };
    beginInterceptorAttack(g, e, 'fold');
    const gate = e.interceptor!.gate!;
    assert(gate);
    assert(clearRivalHull(g, gate.exit));
    if (blocked === 'crate') {
      const crate = g.props.spawn('crate', gate.exit.x, gate.exit.y);
      Body.setStatic(crate.body, true);
    }
    if (blocked === 'player') Body.setPosition(g.player, gate.exit);
    const pair = [...g.portals.pair];
    until(g, () => e.state !== 'windup');
    assert.deepEqual(g.portals.pair, pair);
    if (blocked === 'none') {
      assert.deepEqual(e.body.position, gate.exit);
      assert.equal(e.state, 'recover');
    } else {
      assert.deepEqual(e.body.position, from);
      assert.equal(g.shots.length, 0);
    }
  }
});

test('the landing attack descends physically and arms its shockwave only at the real surface', () => {
  const { g, e } = fixture();
  Body.setStatic(e.body, false);
  Body.setPosition(g.player, { x: 1700, y: 700 });
  beginInterceptorAttack(g, e, 'shockwave');
  until(g, () => e.state === 'rush');
  assert.equal(e.interceptor!.charges.length, 0);
  assert(e.body.position.y < 450);
  until(g, () => e.state === 'recover');
  assert(e.body.bounds.max.y <= 740.2);
  assert.equal(e.interceptor!.charges.length, 1);
  assert.equal(e.interceptor!.charges[0].left, 0.65);
  assert.equal(g.shots.filter((s) => s.enemyAmmo?.kind === 'shockwave').length, 5);
});

test('pause freezes the arsenal and phase changes, death, and retry cancel owned effects', () => {
  const { g, e } = fixture();
  rivalCharge(g, e, { x: 1000, y: 400 }, 145, 22, 0.9, true);
  fireWeapon(g, e, 'recall', e.body.position, [0]);
  e.interceptor!.echoes.push({ origin: { x: 600, y: 300 }, aim: { x: 1, y: 0 }, left: 0.9 });
  const snapshot = JSON.stringify({
    charges: e.interceptor!.charges,
    echoes: e.interceptor!.echoes,
    ammo: g.shots[0].enemyAmmo,
  });
  g.setMode('paused');
  step(g, 600);
  assert.equal(
    JSON.stringify({
      charges: e.interceptor!.charges,
      echoes: e.interceptor!.echoes,
      ammo: g.shots[0].enemyAmmo,
    }),
    snapshot,
  );
  g.setMode('playing');
  e.hp = e.maxHp * 0.6;
  step(g);
  assert.equal(e.state, 'transition');
  assert.equal(e.interceptor!.charges.length + e.interceptor!.echoes.length, 0);
  assert.equal(g.shots.filter((s) => s.enemyAmmo?.owner === e.id).length, 0);
  rivalCharge(g, e, { x: 1000, y: 400 }, 145, 22, 0.01);
  g.hitEnemy(e, 999999);
  step(g, 60);
  assert.equal(g.hp, 100);
  g.startPractice({ kind: 'interceptor', seed: g.seed });
  assert.equal(g.enemies[0].interceptor!.charges.length, 0);
});

test('Reclamation alternates bosses, legacy victories remain earned, and both exits lead to rooftops', () => {
  const variants = new Set<string>();
  for (let i = 0; i < 80; i++) {
    const seed = 'reclaimer-route-' + i,
      level = getLevel(seed, 15);
    variants.add(level.spawns[0].kind + ':' + level.mirrored);
    assert.equal(level.area, 'reclamation');
    assert.equal(getLevel(seed, 19).spawns[0].kind, 'interceptor');
  }
  assert.deepEqual([...variants].sort(), [
    'boss:false',
    'boss:true',
    'sorter:false',
    'sorter:true',
  ]);
  const entry = testEncounterFromUrl(new URL('https://example.com/?test=reclaimer'))!;
  assert.equal(entry.kind, 'boss');
  const wins = loadEncounters([
    { kind: 'boss', seed: 'old-rooftop-win' },
    { kind: 'sorter', seed: 'old-sorter-win' },
  ]);
  assert.equal(wins.length, 2);
  for (const entry of wins) {
    const g = new Game();
    assert(g.startPractice(entry));
    assert.equal(g.stage, 15);
    assert.equal(g.mods.length, 15);
    assert.equal(g.enemies[0].kind, entry.kind);
  }
});
