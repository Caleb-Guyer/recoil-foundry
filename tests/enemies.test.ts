import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { EnemyKind } from '../src/game.ts';
import { bossPhase, attackTell } from '../src/enemies.ts';
import { getLevel } from '../src/levels.ts';
const { Body, Bodies, Composite } = Matter;
function fixture(kind: EnemyKind, x = 600, y = 724) {
  const g = new Game();
  g.start('enemies');
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  Body.setPosition(g.player, { x: 1100, y: 721 });
  g.spawnEnemy(kind, x, y);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 100;
  step(g, 10);
  e.timer = 0;
  return { g, e };
}
function step(g: Game, n = 1) {
  for (let i = 0; i < n; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: false,
      fire: false,
      aim: { x: 1600, y: 500 },
    });
}
function wall(g: Game, x: number, y: number, w: number, h: number) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
test('enemy behaviors enter gradually and retain deterministic terrain-safe anchors', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++)
    for (let stage = 0; stage < 20; stage++) {
      const level = getLevel('types-' + i, stage);
      assert.deepEqual(level, getLevel('types-' + i, stage));
      assert.equal(new Set(level.spawns.map((s) => `${s.x},${s.y}`)).size, level.spawns.length);
      for (const e of level.spawns) {
        seen.add(e.kind);
        if (stage === 0) assert(!['charger', 'sniper', 'hopper'].includes(e.kind));
        if (stage < 2) assert.notEqual(e.kind, 'sniper');
        if (stage < 4) assert.notEqual(e.kind, 'hopper');
      }
    }
  for (const kind of ['charger', 'sniper', 'hopper']) assert(seen.has(kind));
});
test('chargers give a full warning, commit direction, and stun against cover rather than the floor', () => {
  const { g, e } = fixture('charger');
  step(g);
  assert.equal(e.state, 'windup');
  step(g, 39);
  assert.equal(e.state, 'windup');
  assert(e.body.velocity.x < 4);
  step(g, 5);
  assert.equal(e.state, 'rush');
  assert(e.body.velocity.x > 10);
  Body.setPosition(g.player, { x: 200, y: 721 });
  step(g, 4);
  assert.equal(e.state, 'rush');
  assert(e.body.velocity.x > 10);
  wall(g, e.body.position.x + 44, 680, 30, 120);
  step(g);
  assert.equal(e.state, 'recover');
  assert(Math.abs(e.body.velocity.x) < 0.1);
  const hp = e.hp;
  g.hitEnemy(e, 10);
  assert.equal(hp - e.hp, 14);
  step(g, 35);
  assert.equal(e.state, 'recover');
  assert.equal(g.shots.length, 0);
  step(g, 40);
  assert.equal(e.state, 'idle');
});
test('snipers track during warning, lock before firing, and fire one fast dodgeable shot', () => {
  const { g, e } = fixture('sniper', 400, 300);
  assert(e.body.isStatic);
  step(g);
  assert.equal(e.state, 'windup');
  step(g, 20);
  const before = { ...e.aim };
  Body.setPosition(g.player, { x: 850, y: 200 });
  step(g);
  assert(Math.abs(e.aim.y - before.y) > 0.1);
  while (e.timer > 0.3) step(g);
  const locked = { ...e.aim };
  const time = g.time;
  Body.setPosition(g.player, { x: 250, y: 600 });
  step(g, 16);
  assert.deepEqual(e.aim, locked);
  assert.equal(g.shots.length, 0);
  while (e.state === 'windup') step(g);
  assert(g.time - time >= 0.28);
  assert.equal(g.shots.length, 1);
  assert.equal(e.state, 'recover');
  const shot = g.shots[0];
  assert(Math.abs(Math.hypot(shot.vel.x, shot.vel.y) - 18) < 0.001);
  assert(Math.abs(shot.vel.y / 18 - locked.y) < 0.001);
  step(g, 60);
  assert.equal(g.hp, 100);
});
test('fast enemy shots stop at thin cover, including cover within the muzzle offset', () => {
  for (const x of [423, 500]) {
    const { g, e } = fixture('sniper', 400, 300);
    Body.setPosition(g.player, { x: 700, y: 300 });
    wall(g, x, 300, 4, 180);
    const end = g.lineEnd(e.body.position, { x: 1400, y: 300 });
    assert.equal(end.x, x - 2);
    g.enemyShot(e, 0, 18, 20);
    for (let i = 0; i < 30; i++) g.updateShots(1 / 60);
    assert.equal(g.hp, 100);
    assert.equal(g.shots.length, 0);
  }
});
test('hoppers crouch, clear a raised ledge in either direction, and recover after landing', () => {
  for (const reverse of [false, true]) {
    const { g, e } = fixture('hopper', reverse ? 1300 : 600);
    wall(g, 950, 675, 280, 130);
    Body.setPosition(g.player, { x: reverse ? 900 : 1000, y: 591 });
    step(g);
    assert.equal(e.state, 'windup');
    step(g, 18);
    assert.equal(e.state, 'windup');
    assert(Math.abs(e.body.velocity.y) < 1);
    let landed = false;
    for (let i = 0; i < 180; i++) {
      step(g);
      if (
        e.state === 'recover' &&
        e.body.position.x > 810 &&
        e.body.position.x < 1090 &&
        e.body.position.y < 600
      ) {
        landed = true;
        break;
      }
    }
    assert(landed, 'Hopper failed to land on raised cover');
    assert.equal(g.shots.length, 0);
    step(g, 10);
    assert.equal(e.state, 'recover');
  }
});
test('hoppers recover after hitting a low ceiling instead of staying in their launch state', () => {
  const { g, e } = fixture('hopper');
  wall(g, 1000, 580, 2000, 30);
  let recovered = false;
  for (let i = 0; i < 300; i++) {
    step(g);
    if (e.state === 'recover') recovered = true;
    assert(Number.isFinite(e.body.position.x));
    assert(e.body.position.y > 595, 'Hopper crossed the solid ceiling');
  }
  assert(recovered);
});
test('boss phases switch at health thresholds and cancel a pending attack with a transition', () => {
  assert.equal(bossPhase(1000, 1000), 0);
  assert.equal(bossPhase(2000 / 3, 1000), 1);
  assert.equal(bossPhase(1000 / 3, 1000), 2);
  const { g, e } = fixture('boss', 600, 240);
  e.state = 'windup';
  e.timer = 0.01;
  e.hp = 300;
  step(g);
  assert.equal(e.phase, 2);
  assert.equal(e.state, 'transition');
  assert.equal(e.timer, 0.75);
  assert.equal(g.shots.length, 0);
  step(g, 44);
  assert.equal(e.state, 'transition');
  assert.equal(g.shots.length, 0);
  step(g, 2);
  assert.equal(e.state, 'idle');
  for (let i = 0; i < 60 && e.state === 'idle'; i++) step(g);
  assert.equal(e.state, 'windup');
  assert(e.timer > 0.75);
  assert.equal(g.shots.length, 0);
});
test('boss attacks cycle from aimed volleys to fans and radial volleys with full windups', () => {
  const expected = [
    ['aimed', 'fan', 'aimed'],
    ['aimed', 'fan', 'ring'],
    ['fan', 'ring', 'aimed'],
  ];
  for (let phase = 0; phase < 3; phase++) {
    const { g, e } = fixture('boss', 600, 200);
    e.hp = e.maxHp * [1, 0.6, 0.3][phase];
    e.phase = phase;
    e.timer = 0;
    const fired: string[] = [];
    let warningAt = 0;
    for (let i = 0; i < 1000 && fired.length < 3; i++) {
      const state = e.state,
        attacks = e.attacks;
      g.time += 1 / 60;
      g.updateEnemy(e, 1 / 60);
      if (state !== 'windup' && e.state === 'windup') warningAt = g.time;
      if (e.attacks > attacks) {
        assert(g.time - warningAt >= attackTell(e.attack) - 0.001);
        assert.equal(
          g.shots.length,
          (e.attack === 'ring' ? 12 : e.attack === 'fan' ? 7 : 5) *
            (phase > 0 && e.attack !== 'ring' ? 2 : 1),
        );
        fired.push(e.attack);
        g.shots = [];
      }
    }
    assert.deepEqual(fired, expected[phase]);
  }
});
test('rooftop fan and ring volleys track the player early and preserve their locked orientation through firing', () => {
  for (const attack of ['fan', 'ring'] as const) {
    const { g, e } = fixture('boss', 600, 200);
    e.hp = e.maxHp * (attack === 'fan' ? 0.6 : 0.3);
    e.phase = attack === 'fan' ? 1 : 2;
    e.attacks = 1;
    step(g);
    assert.equal(e.state, 'windup');
    assert.equal(e.attack, attack);
    const started = g.time,
      firstAim = { ...e.aim };
    Body.setPosition(g.player, { x: 900, y: 300 });
    step(g, 10);
    assert.notDeepEqual(e.aim, firstAim);
    while (e.timer > 0.3) step(g);
    const locked = { ...e.aim },
      lockedAt = g.time;
    Body.setPosition(g.player, { x: 300, y: 600 });
    while (e.state === 'windup') {
      step(g);
      if (e.state === 'windup') assert.deepEqual(e.aim, locked);
    }
    assert(g.time - started >= attackTell(attack) - 1e-8);
    assert(g.time - lockedAt >= 0.3 - 1 / 60);
    const shots = g.shots.filter((shot) => !shot.friendly);
    assert.equal(shots.length, attack === 'fan' ? 7 : 12);
    const base = Math.atan2(locked.y, locked.x),
      speed = attack === 'fan' ? 11.2 : 7.8;
    for (const [i, shot] of shots.entries()) {
      const angle = base + (attack === 'fan' ? (i - 3) * 0.27 : (i * Math.PI) / 6 + Math.PI / 12);
      assert(Math.abs(shot.vel.x - Math.cos(angle) * speed) < 1e-8);
      assert(Math.abs(shot.vel.y - Math.sin(angle) * speed) < 1e-8);
    }
  }
});
test('pause and hitstop freeze attack warnings, and death removes queued attackers', () => {
  const { g, e } = fixture('sniper', 400, 300);
  step(g);
  const timer = e.timer;
  g.setMode('paused');
  step(g, 90);
  assert.equal(e.timer, timer);
  g.setMode('playing');
  g.hitStop = 0.1;
  step(g, 5);
  assert.equal(e.timer, timer);
  g.hitEnemy(e, 9999);
  step(g, 100);
  assert.equal(g.enemies.length, 0);
  assert.equal(g.shots.length, 0);
  g.start('again');
  assert(g.enemies.every((e) => e.state === 'idle' && e.attacks === 0 && e.phase === 0));
});
