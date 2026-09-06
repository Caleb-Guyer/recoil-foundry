import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { EnemyKind, Input, Shot } from '../src/game.ts';
import { getGun } from '../src/rules.ts';

const { Body, Bodies, Composite } = Matter;
type Elite = 'shielded' | 'twin' | 'volatile';

function step(g: Game, count = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < count; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1600, y: 500 },
      ...input,
    });
}

function until(g: Game, condition: () => boolean, limit = 180) {
  for (let i = 0; i < limit && !condition(); i++) step(g);
  assert(condition(), 'Timed out waiting for the enemy state');
}

function fixture(kind: EnemyKind, elite: Elite, x = 600, y = 400) {
  const g = new Game();
  g.start('elite-combat');
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  Body.setPosition(g.player, { x: 1100, y: 721 });
  Body.setStatic(g.player, true);
  g.spawnEnemy(kind, x, y, elite);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 0;
  e.facing = 1;
  return { g, e };
}

function wall(g: Game, x: number, y = 400, w = 10, h = 500) {
  const body = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(body);
  Composite.add(g.engine.world, body);
}

function bullet(g: Game, x: number, y: number, vx: number, damage = 20, pierce = 0) {
  g.addShot({
    pos: { x, y },
    vel: { x: vx, y: 0 },
    damage,
    life: 1.4,
    friendly: true,
    radius: 2.5,
    bounces: 0,
    pierce,
    fragment: false,
    split: false,
  });
}

test('shields resist frontal hits from either facing, leaving the rear and overhead exposed', () => {
  for (const facing of [-1, 1]) {
    for (const [offset, blocked] of [
      [{ x: facing * 100, y: 0 }, true],
      [{ x: facing * -100, y: 0 }, false],
      [{ x: 0, y: -100 }, false],
    ] as const) {
      const { g, e } = fixture('runner', 'shielded');
      e.facing = facing;
      const hp = e.hp;
      const result = g.hitEnemy(e, 20, {
        x: e.body.position.x + offset.x,
        y: e.body.position.y + offset.y,
      });
      assert.equal(result, blocked);
      assert.equal(hp - e.hp, blocked ? 2 : 20);
      if (blocked) assert(e.shieldFlash > 0);
    }
    const { g, e } = fixture('runner', 'shielded');
    e.facing = facing;
    const hp = e.hp;
    assert.equal(g.hitEnemy(e, 20), false);
    assert.equal(hp - e.hp, 20, 'Environmental damage must bypass directional armor');
  }
});

test('a shield turn has a full warning and commits its new direction when the player doubles back', () => {
  const { g, e } = fixture('runner', 'shielded', 600, 724);
  Body.setPosition(g.player, { x: 300, y: 721 });
  step(g);
  assert.equal(e.state, 'windup');
  assert.equal(e.facing, 1);
  const started = g.time;
  Body.setPosition(g.player, { x: 1000, y: 721 });
  step(g, 35);
  assert.equal(e.state, 'windup');
  assert.equal(e.facing, 1);
  until(g, () => e.state === 'recover', 10);
  assert(g.time - started >= 0.65 - 1e-6);
  assert.equal(e.facing, -1, 'The telegraphed turn must not instantly track back');
  step(g, 10);
  assert.equal(e.state, 'recover');
  assert.equal(e.facing, -1);
});

test('a frontal shield stops a piercing shot without spawning splinters or hitting enemies behind it', () => {
  const { g, e } = fixture('runner', 'shielded');
  g.gun = getGun(['pierce', 'split']);
  g.spawnEnemy('shooter', 500, 400);
  const behind = g.enemies.at(-1)!;
  behind.spawn = 0;
  const hp = e.hp;
  bullet(g, 700, 400, -30, 20, g.gun.pierce);
  g.updateShots(0.15);
  assert.equal(hp - e.hp, 2);
  assert.equal(behind.hp, behind.maxHp);
  assert.equal(g.shots.length, 0, 'The shield must also suppress impact fragments');
});

test('backblast checks the actual player side of the shield', () => {
  for (const front of [true, false]) {
    const { g, e } = fixture('runner', 'shielded');
    Body.setPosition(g.player, { x: front ? 700 : 500, y: 400 });
    const hp = e.hp;
    g.fireBackblast({ x: front ? 1 : -1, y: 0 }, 20);
    assert.equal(hp - e.hp, front ? 2 : 20);
  }
});

test('a launched crate damages a shielded runner through its front armor', () => {
  const { g, e } = fixture('runner', 'shielded');
  e.state = 'recover';
  e.timer = 100;
  Body.setStatic(e.body, true);
  const crate = g.props.spawn('crate', 680, 400);
  Body.setVelocity(crate.body, { x: -12, y: 0 });
  const hp = e.hp;
  step(g, 10);
  assert(crate.hits.has(e.id), 'The fixture must produce a real crate collision');
  assert(hp - e.hp >= 28, 'A fast crate must deal full impact damage');
});

test('twin snipers fire exactly two rounds, retarget briefly, and lock the second warning before firing', () => {
  const { g, e } = fixture('sniper', 'twin', 400, 300);
  Body.setPosition(g.player, { x: 1100, y: 600 });
  const fired: Shot[] = [];
  const emit = g.enemyShot.bind(g);
  g.enemyShot = (...args) => {
    emit(...args);
    const shot = g.shots.at(-1)!;
    fired.push({ ...shot, vel: { ...shot.vel } });
  };
  step(g);
  const started = g.time;
  assert.equal(e.state, 'windup');
  step(g, 45);
  assert.equal(fired.length, 0);
  until(g, () => e.state === 'followup', 20);
  assert(g.time - started >= 0.95 - 1e-6);
  assert.equal(fired.length, 1);
  const firstAim = { ...e.aim },
    followupAt = g.time;
  Body.setPosition(g.player, { x: 700, y: 450 });
  step(g);
  assert(Math.abs(e.aim.y - firstAim.y) > 0.01);
  until(g, () => e.timer <= 0.39, 20);
  const locked = { ...e.aim };
  Body.setPosition(g.player, { x: 200, y: 600 });
  step(g, 15);
  assert.equal(fired.length, 1);
  assert.deepEqual(e.aim, locked);
  until(g, () => e.state === 'recover', 15);
  assert(g.time - followupAt >= 0.65 - 1e-6);
  assert.equal(fired.length, 2);
  for (const shot of fired) {
    assert(Math.abs(Math.hypot(shot.vel.x, shot.vel.y) - 18) < 1e-6);
    assert.equal(shot.damage, 20);
  }
  assert(Math.abs(fired[1].vel.x / 18 - locked.x) < 1e-6);
  assert(Math.abs(fired[1].vel.y / 18 - locked.y) < 1e-6);
  step(g, 120);
  assert.equal(fired.length, 2);
});

test('both twin sniper rounds stop at cover, including a wall within the muzzle offset', () => {
  for (const x of [423, 500]) {
    const { g, e } = fixture('sniper', 'twin', 400, 300);
    Body.setPosition(g.player, { x: 800, y: 300 });
    wall(g, x, 300, 4, 200);
    let fired = 0;
    g.onSound = (kind) => {
      if (kind === 'snipe') fired++;
    };
    step(g, 150);
    assert.equal(fired, 2);
    assert.equal(e.state, 'recover');
    assert.equal(g.hp, 100);
    assert.equal(g.shots.length, 0);
  }
});

test('pause and hitstop freeze a twin follow-up, and killing the sniper cancels it', () => {
  const { g, e } = fixture('sniper', 'twin', 400, 300);
  let fired = 0;
  g.onSound = (kind) => {
    if (kind === 'snipe') fired++;
  };
  until(g, () => e.state === 'followup');
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
  assert.equal(fired, 1);
  assert(!g.enemies.includes(e));
});

test('volatile flyers approach without shooting and cannot arm through solid cover', () => {
  const { g, e } = fixture('flyer', 'volatile', 600, 500);
  Body.setPosition(g.player, { x: 1000, y: 500 });
  step(g, 30);
  assert(e.body.position.x > 600);
  assert.equal(e.state, 'idle');
  assert.equal(g.shots.length, 0);
  Body.setPosition(e.body, { x: 600, y: 500 });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  Body.setPosition(g.player, { x: 700, y: 500 });
  wall(g, 650, 500, 10, 300);
  step(g, 10);
  assert.equal(e.state, 'idle');
  assert(!e.body.isStatic);
  assert.equal(g.hp, 100);
});

test('volatile flyers hold still during the full warning and shooting them defuses the blast', () => {
  const { g, e } = fixture('flyer', 'volatile', 600, 500);
  Body.setPosition(g.player, { x: 680, y: 500 });
  let explosions = 0;
  g.onSound = (kind) => {
    if (kind === 'explode') explosions++;
  };
  step(g);
  assert.equal(e.state, 'windup');
  assert(e.body.isStatic);
  const position = { ...e.body.position };
  Body.setPosition(g.player, { x: 900, y: 500 });
  step(g, 40);
  assert(g.enemies.includes(e));
  assert.deepEqual(e.body.position, position);
  assert.equal(explosions, 0);
  bullet(g, position.x + 60, position.y, -30, 9999);
  g.updateShots(0.05);
  assert(!g.enemies.includes(e));
  assert.equal(g.kills, 1);
  step(g, 80);
  assert.equal(explosions, 0);
  assert.equal(g.hp, 100);
});

test('an armed volatile flyer detonates once after its warning without rewarding a self-kill', () => {
  const { g, e } = fixture('flyer', 'volatile', 600, 500);
  g.gun = getGun(['leech']);
  g.hp = 70;
  Body.setPosition(g.player, { x: 680, y: 500 });
  let explosions = 0;
  g.onSound = (kind) => {
    if (kind === 'explode') explosions++;
  };
  step(g);
  const started = g.time;
  step(g, 53);
  assert(g.enemies.includes(e));
  assert.equal(explosions, 0);
  until(g, () => !g.enemies.includes(e), 3);
  assert(g.time - started >= 0.9 - 1e-6);
  assert.equal(explosions, 1);
  assert(g.hp < 70);
  assert.equal(g.kills, 0);
  assert(!Composite.allBodies(g.engine.world).includes(e.body));
  const hp = g.hp;
  step(g, 80);
  assert.equal(g.hp, hp);
  assert.equal(explosions, 1);
});

test('escaping or taking cover avoids a volatile blast, even when that blast destroys the cover', () => {
  for (const useCover of [false, true]) {
    const { g, e } = fixture('flyer', 'volatile', 600, 500);
    Body.setPosition(g.player, { x: 680, y: 500 });
    step(g);
    assert.equal(e.state, 'windup');
    Body.setPosition(g.player, { x: useCover ? 700 : 800, y: 500 });
    const cover = useCover ? g.props.spawn('cover', 650, 500) : null;
    if (cover) cover.hp = 1;
    g.spawnEnemy('shooter', useCover ? 700 : 800, 550);
    const protectedEnemy = g.enemies.at(-1)!;
    protectedEnemy.spawn = 0;
    protectedEnemy.timer = 100;
    until(g, () => !g.enemies.includes(e));
    assert.equal(g.hp, 100);
    assert.equal(protectedEnemy.hp, protectedEnemy.maxHp);
    if (cover) assert(!g.props.items.includes(cover));
  }
});

test('a lethal volatile blast stops later enemies and prop chains without healing a dead player', () => {
  const { g, e } = fixture('flyer', 'volatile', 600, 500);
  g.gun = getGun(['leech']);
  g.hp = 1;
  Body.setPosition(g.player, { x: 680, y: 500 });
  step(g);
  g.spawnEnemy('shooter', 650, 530);
  const later = g.enemies.at(-1)!;
  later.spawn = 0;
  later.hp = 1;
  later.timer = 10;
  const fuel = g.props.spawn('canister', 650, 450);
  g.spawnEnemy('flyer', 670, 470, 'volatile');
  const queued = g.enemies.at(-1)!;
  queued.spawn = 0;
  queued.state = 'windup';
  queued.timer = 0.5;
  e.timer = 0.01;
  step(g);
  assert.equal(g.mode, 'dead');
  assert.equal(g.hp, 0);
  assert.equal(g.kills, 0);
  assert.equal(later.hp, 1);
  assert.equal(later.timer, 10);
  assert.equal(queued.timer, 0.5);
  assert(g.props.items.includes(fuel));
  step(g, 90);
  assert.equal(queued.timer, 0.5);
  assert.equal(g.hp, 0);
});

test('volatile blasts chain nearby fuel once and repeat calls cannot detonate the same flyer again', () => {
  const { g, e } = fixture('flyer', 'volatile', 600, 500);
  Body.setPosition(g.player, { x: 950, y: 500 });
  const first = g.props.spawn('canister', 640, 500),
    second = g.props.spawn('canister', 710, 500);
  g.detonateVolatile(e);
  assert(!g.props.items.includes(first));
  assert(!g.props.items.includes(second));
  assert(!g.enemies.includes(e));
  assert.equal(g.kills, 0);
  const particles = g.particles.length,
    hp = g.hp;
  g.detonateVolatile(e);
  assert.equal(g.particles.length, particles);
  assert.equal(g.hp, hp);
  assert.equal(g.kills, 0);
});
