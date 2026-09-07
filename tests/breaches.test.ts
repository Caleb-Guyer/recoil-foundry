import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { DEBRIS_LIMIT, PANEL_HP, PICKUP_HEAL } from '../src/breaches.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';

const { Body, Bodies, Composite } = Matter;

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

function fixture() {
  const g = new Game();
  g.start('breach-combat');
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
  g.aim = { x: 1000, y: 400 };
  return g;
}

function enemy(g: Game, x = 700, y = 400) {
  g.spawnEnemy('shooter', x, y);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  return e;
}

function panel(g: Game, x = 600, w = 18) {
  return g.breaches.spawnPanel({ x, y: 300, w, h: 200 });
}

function bullet(g: Game, damage = 24, pierce = 0) {
  g.addShot({
    pos: { x: 500, y: 400 },
    vel: { x: 180, y: 0 },
    damage,
    life: 2,
    friendly: true,
    radius: 2.5,
    bounces: 0,
    pierce,
    fragment: false,
    split: false,
  });
}

function populatedDaily() {
  const g = new Game(),
    challenge = dailyForDate('2026-09-06')!;
  g.start(challenge.seed);
  for (let stage = 0; stage < 8; stage++) {
    if (g.breaches.placement) return g;
    g.openReward();
    g.chooseMod(g.offers[0].id);
  }
  assert.fail('The daily fixture did not encounter a breach room');
}

test('a cracked panel absorbs two ordinary rounds and then removes its physical and sight-line obstruction', () => {
  const g = fixture(),
    p = panel(g),
    target = enemy(g);
  assert.equal(p.hp, PANEL_HP);
  assert(g.solidBodies.includes(p.body));
  g.fire();
  g.updateShots(0.2);
  assert.equal(p.hp, 24);
  assert(g.breaches.panels.includes(p));
  assert.equal(target.hp, target.maxHp);
  assert(g.lineEnd({ x: 500, y: 400 }, { x: 700, y: 400 }).x <= 600);
  g.fire();
  g.updateShots(0.2);
  assert(!g.breaches.panels.includes(p));
  assert(!g.solidBodies.includes(p.body));
  assert(!Composite.allBodies(g.engine.world).includes(p.body));
  assert.equal(target.hp, target.maxHp, 'The breaking round passed through the panel');
  assert.deepEqual(g.lineEnd({ x: 500, y: 400 }, { x: 700, y: 400 }), { x: 700, y: 400 });
});

test('thin panels stop fast piercing rounds, including the round that destroys them', () => {
  const g = fixture(),
    p = panel(g, 600, 4),
    target = enemy(g);
  g.gun = getGun(['pierce']);
  for (let i = 0; i < 2; i++) {
    bullet(g, 24, g.gun.pierce);
    g.updateShots(0.1);
    assert.equal(target.hp, target.maxHp);
    assert.equal(g.shots.length, 0);
  }
  assert(!g.breaches.panels.includes(p));
  bullet(g, 24, g.gun.pierce);
  g.updateShots(0.1);
  assert.equal(target.maxHp - target.hp, 24);
});

test('a panel inside the player muzzle offset still takes the shot instead of swallowing or bypassing it', () => {
  const g = fixture(),
    p = panel(g);
  Body.setPosition(g.player, { x: 584, y: 400 });
  g.fire();
  g.updateShots(1 / 60);
  assert.equal(p.hp, 24);
  assert.equal(g.shots.length, 0);
});

test('enemy muzzle shots and fast hostile projectiles damage the blocking panel before the player', () => {
  for (const x of [500, 570]) {
    const g = fixture(),
      p = panel(g, 600, 4);
    Body.setPosition(g.player, { x: 750, y: 400 });
    g.spawnEnemy('sniper', x, 400);
    const e = g.enemies[0];
    e.spawn = 0;
    g.enemyShot(e, 0, 180, 20);
    g.updateShots(0.1);
    assert.equal(p.hp, PANEL_HP - 20);
    assert.equal(g.hp, 100);
    assert.equal(g.shots.length, 0);
  }
});

test('an intact panel blocks actual movement and breaking it opens a traversable lane', () => {
  const g = fixture();
  const p = g.breaches.spawnPanel({ x: 600, y: 620, w: 18, h: 120 });
  Body.setPosition(g.player, { x: 500, y: 722 });
  step(g, 30, { right: true });
  assert(g.player.bounds.max.x <= p.body.bounds.min.x + 0.5);
  g.aim = { x: 1000, y: g.player.position.y };
  for (let i = 0; i < 2; i++) {
    g.fire();
    g.updateShots(0.1);
  }
  assert(!g.breaches.panels.includes(p));
  step(g, 35, { right: true });
  assert(g.player.position.x > 750);
});

test('backblast opens panels while preserving cover for actors behind the breaking blast', () => {
  const g = fixture(),
    p = panel(g),
    target = enemy(g, 550);
  Body.setPosition(g.player, { x: 650, y: 400 });
  g.fireBackblast({ x: 1, y: 0 }, 24);
  assert.equal(p.hp, 24);
  assert.equal(target.hp, target.maxHp);
  g.fireBackblast({ x: 1, y: 0 }, 24);
  assert(!g.breaches.panels.includes(p));
  assert.equal(target.hp, target.maxHp);
  g.fireBackblast({ x: 1, y: 0 }, 24);
  assert.equal(target.maxHp - target.hp, 24);
});

test('fuel and volatile explosions break visible panels without passing through their own new opening', () => {
  for (const volatile of [false, true]) {
    const g = fixture(),
      p = panel(g, 650),
      target = enemy(g, 700);
    p.hp = 20;
    if (volatile) {
      g.spawnEnemy('flyer', 600, 400, 'volatile');
      const flyer = g.enemies.at(-1)!;
      flyer.spawn = 0;
      g.detonateVolatile(flyer);
    } else {
      const fuel = g.props.spawn('canister', 600, 400);
      g.props.explode(fuel);
    }
    assert(!g.breaches.panels.includes(p));
    assert.equal(target.hp, target.maxHp);
  }
});

test('health pickups stay available at full health, heal only on contact, clamp, and can be collected once', () => {
  for (const hp of [55, 95]) {
    const g = fixture();
    Body.setPosition(g.player, { x: 500, y: 722 });
    g.breaches.pickup = { x: 500, y: 722 };
    let heals = 0;
    g.onSound = (kind) => {
      if (kind === 'mend') heals++;
    };
    step(g, 5);
    assert(g.breaches.pickup);
    assert.equal(heals, 0);
    g.hp = hp;
    step(g);
    assert.equal(g.hp, Math.min(100, hp + PICKUP_HEAL));
    assert.equal(g.breaches.pickup, null);
    assert.equal(heals, 1);
    step(g, 30);
    assert.equal(g.hp, Math.min(100, hp + PICKUP_HEAL));
    assert.equal(heals, 1);
  }
});

test('nearby pickups cannot be collected through an intact panel or solid terrain', () => {
  for (const terrain of [false, true]) {
    const g = fixture();
    g.hp = 60;
    Body.setPosition(g.player, { x: 500, y: 700 });
    g.breaches.pickup = { x: 522, y: 700 };
    const p = terrain ? null : g.breaches.spawnPanel({ x: 514, y: 650, w: 6, h: 90 });
    const wall = terrain ? Bodies.rectangle(517, 695, 6, 90, { isStatic: true }) : null;
    if (wall) {
      g.terrain.push(wall);
      Composite.add(g.engine.world, wall);
    }
    g.breaches.update(1 / 60);
    assert.equal(g.hp, 60);
    assert(g.breaches.pickup);
    if (p) g.breaches.hit(p, 48, { x: 1, y: 0 });
    if (wall) {
      Composite.remove(g.engine.world, wall);
      g.terrain = g.terrain.filter((body) => body !== wall);
    }
    g.breaches.update(1 / 60);
    assert.equal(g.hp, 78);
    assert.equal(g.breaches.pickup, null);
  }
  const distant = fixture();
  distant.hp = 60;
  distant.breaches.pickup = { x: 450, y: 400 };
  distant.breaches.update(1 / 60);
  assert.equal(distant.hp, 60);
  assert(distant.breaches.pickup);
});

test('panel debris is bounded, harmless, temporary, and consumes no combat randomness', () => {
  const g = fixture(),
    control = fixture(),
    bodies = Composite.allBodies(g.engine.world).length;
  for (let i = 0; i < 20; i++) {
    const p = panel(g, 600 + i * 20);
    g.breaches.hit(p, 48, { x: -1, y: 0 });
    assert(g.breaches.debris.length <= DEBRIS_LIMIT);
  }
  assert.equal(g.breaches.debris.length, DEBRIS_LIMIT);
  assert.equal(Composite.allBodies(g.engine.world).length, bodies);
  assert.equal(g.rng(), control.rng());
  const count = g.breaches.debris.length;
  const removed = panel(g, 600);
  g.breaches.hit(removed, 48, { x: 1, y: 0 });
  const debris = structuredClone(g.breaches.debris);
  g.breaches.hit(removed, 48, { x: 1, y: 0 });
  assert.deepEqual(g.breaches.debris, debris);
  assert(count > 0);
  step(g, 180);
  assert.equal(g.breaches.debris.length, 0);
  assert.equal(g.hp, 100);
});

test('pause, hitstop, and death freeze panel damage feedback, debris, and pickup collection', () => {
  for (const freeze of ['paused', 'hitstop', 'dead']) {
    const g = fixture(),
      p = panel(g),
      shattered = panel(g, 680);
    g.breaches.hit(p, 24, { x: 1, y: 0 });
    g.breaches.hit(shattered, 48, { x: 1, y: 0 });
    g.hp = 60;
    g.breaches.pickup = { ...g.player.position };
    if (freeze === 'paused') g.setMode('paused');
    else if (freeze === 'hitstop') g.hitStop = 0.2;
    else g.damagePlayer(9999);
    const before = { flash: p.flash, debris: structuredClone(g.breaches.debris), hp: g.hp };
    step(g, freeze === 'hitstop' ? 5 : 90);
    assert.equal(p.flash, before.flash);
    assert.deepEqual(g.breaches.debris, before.debris);
    assert.equal(g.hp, before.hp);
    assert(g.breaches.pickup);
  }
});

test('checkpoint replay restores fresh breaches and pickup health, while bosses and escape remove their bodies', () => {
  const g = populatedDaily();
  g.hp = 62;
  const saves: Checkpoint[] = [];
  g.onCheckpoint = (save) => {
    if (save) saves.push(save);
  };
  g.save();
  const save = loadCheckpoint(saves[0])!;
  const original = {
    placement: structuredClone(g.breaches.placement),
    pickup: structuredClone(g.breaches.pickup),
    panels: g.breaches.panels.map((p) => p.rect),
  };
  assert(g.breaches.panels.length > 0);
  for (const p of [...g.breaches.panels]) g.breaches.hit(p, 9999, { x: 1, y: 0 });
  g.breaches.pickup = null;
  g.hp = 80;
  g.start(save.seed, save);
  assert.equal(g.hp, 62);
  assert.deepEqual(g.breaches.placement, original.placement);
  assert.deepEqual(g.breaches.pickup, original.pickup);
  assert.deepEqual(
    g.breaches.panels.map((p) => p.rect),
    original.panels,
  );
  assert(g.breaches.panels.every((p) => p.hp === PANEL_HP));
  assert.equal(g.breaches.debris.length, 0);
  const old = [...g.breaches.bodies];
  g.stage = 8;
  g.loadRoom();
  assert.equal(g.breaches.placement, null);
  assert.equal(g.breaches.bodies.length, 0);
  for (const body of old) assert(!Composite.allBodies(g.engine.world).includes(body));
  panel(g);
  g.loadRoom(true);
  assert.equal(g.breaches.bodies.length, 0);
  assert.equal(g.breaches.pickup, null);
  assert.equal(g.breaches.debris.length, 0);
});

test('daily breach placement and intact checkpoint replay are independent of combat RNG consumption', () => {
  const first = populatedDaily(),
    second = new Game();
  const save: Checkpoint = {
    version: 3,
    seed: first.seed,
    stage: first.stage,
    hp: 75,
    mods: [...first.mods],
    kills: 5,
    elapsed: 20,
  };
  for (let i = 0; i < 500; i++) first.rng();
  first.breaches.reset(first.level, first.seed, first.stage);
  second.start(save.seed, loadCheckpoint(save)!);
  assert(first.breaches.placement);
  assert.deepEqual(first.breaches.placement, second.breaches.placement);
  assert.deepEqual(
    first.breaches.panels.map((p) => p.rect),
    second.breaches.panels.map((p) => p.rect),
  );
  assert.deepEqual(first.breaches.pickup, second.breaches.pickup);
});
