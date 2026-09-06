import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { getStats, TECHS } from '../src/rules.ts';
const { Body, Composite } = Matter;
function input(p: Partial<Input> = {}): Input {
  return {
    left: false,
    right: false,
    crouch: false,
    jump: false,
    fire: false,
    field: false,
    interact: false,
    aim: { x: 1000, y: 700 },
    ...p,
  };
}
function clean(g: Game) {
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of g.props) Composite.remove(g.engine.world, p.body);
  g.props = [];
}
function tick(g: Game, n = 1, patch: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, input(patch));
}
test('real physics settles player, moves, jumps, and preserves crouch rotation lock', () => {
  const g = new Game();
  g.start('physics', 'repulsor');
  clean(g);
  tick(g, 80);
  assert(g.grounded);
  const x = g.player.position.x;
  tick(g, 25, { right: true });
  assert(g.player.position.x > x + 70);
  tick(g, 1, { crouch: true });
  assert.equal(g.player.inertia, Infinity);
  tick(g, 1);
  assert.equal(g.player.inertia, Infinity);
  const y = g.player.position.y;
  tick(g, 1, { jump: true });
  tick(g, 8);
  assert(g.player.position.y < y - 55);
  assert(Math.abs(g.player.angle) < 0.01);
});
test('continuous free coil fire permits energy recovery', () => {
  const g = new Game();
  g.start('energy', 'repulsor');
  clean(g);
  g.energy = 10;
  tick(g, 180, { fire: true });
  assert(g.energy > 55);
  assert(g.shotCount > 10);
});
test('damage immunity prevents repeated collision damage, then expires', () => {
  const g = new Game();
  g.start('damage', 'repulsor');
  g.damagePlayer(10);
  g.damagePlayer(10);
  assert.equal(g.hp, 90);
  g.time += 0.61;
  g.damagePlayer(10);
  assert.equal(g.hp, 80);
});
test('lethal projectile freezes state before pickups or later shots can modify results', () => {
  const g = new Game();
  g.start('death-freeze', 'repulsor');
  clean(g);
  g.hp = 1;
  const p = g.player.position;
  g.drops.push({ pos: { ...p }, type: 'health', phase: 0 });
  g.addShot({
    pos: { x: p.x + 35, y: p.y },
    vel: { x: -30, y: 0 },
    damage: 10,
    life: 2,
    radius: 5,
    friendly: false,
    kind: 'bullet',
    bounces: 0,
    split: true,
    root: 0,
    color: 'red',
  });
  let capturedHp = -1;
  g.onChange = () => {
    if (g.mode === 'dead') capturedHp = g.hp;
  };
  tick(g);
  assert.equal(g.mode, 'dead');
  assert.equal(g.hp, 0);
  assert.equal(capturedHp, 0);
  assert.equal(g.drops.filter((drop) => drop.type === 'health').length, 1);
});
test('a thrown crate damages the boss using its incoming impact speed', () => {
  const g = new Game();
  g.start('crate', 'tractor');
  clean(g);
  g.spawnEnemy('boss', 1100, 500);
  const e = g.enemies[0];
  const body = Matter.Bodies.rectangle(1030, 500, 40, 40, { density: 0.0018 });
  Composite.add(g.engine.world, body);
  g.props.push({ body, launched: true, hitAt: new Map(), impactSpeed: 20 });
  Body.setVelocity(body, { x: 1, y: 0 });
  g.updateProps();
  assert(e.hp < e.maxHp);
  const hp = e.hp;
  g.updateProps();
  assert.equal(e.hp, hp);
});
test('repulsor reflects hostile projectiles and spends energy', () => {
  const g = new Game();
  g.start('field', 'repulsor');
  clean(g);
  const p = g.player.position;
  g.addShot({
    pos: { x: p.x + 80, y: p.y },
    vel: { x: -7, y: 0 },
    damage: 10,
    life: 3,
    radius: 4,
    friendly: false,
    kind: 'bullet',
    bounces: 0,
    split: true,
    root: 0,
    color: 'red',
  });
  g.updateField(true, 1 / 60);
  assert(g.shots[0].friendly);
  assert(g.shots[0].vel.x > 0);
  assert(g.energy < 100);
});
test('tractor captures and launches a nearby crate', () => {
  const g = new Game();
  g.start('tractor', 'tractor');
  clean(g);
  const p = g.player.position;
  const body = Matter.Bodies.rectangle(p.x + 80, p.y, 36, 36);
  Composite.add(g.engine.world, body);
  g.props.push({ body, launched: false, hitAt: new Map() });
  g.aim = { x: p.x + 400, y: p.y };
  g.updateField(true, 1 / 60);
  assert(g.held);
  g.updateField(false, 1 / 60);
  assert.equal(g.held, null);
  assert(g.props[0].launched);
  assert(body.velocity.x > 15);
});
test('fragmentation cannot recurse and shot/particle caps bound heavy builds', () => {
  const g = new Game();
  g.start('fragments', 'repulsor');
  g.techs = ['fragment'];
  g.stats = getStats(g.techs);
  g.fire();
  const shot = g.shots[0];
  g.fragment(shot);
  const count = g.shots.length;
  g.fragment(shot);
  for (const fragment of g.shots.filter((s) => s.kind === 'fragment')) g.fragment(fragment);
  assert.equal(g.shots.length, count);
  assert.equal(count, 4);
  for (let i = 0; i < 500; i++)
    g.addShot({
      pos: { x: 0, y: 0 },
      vel: { x: 1, y: 0 },
      damage: 1,
      life: 1,
      radius: 2,
      friendly: true,
      kind: 'fragment',
      bounces: 0,
      split: true,
      root: 0,
      color: 'red',
    });
  assert.equal(g.shots.length, 220);
  g.burst({ x: 0, y: 0 }, 1000, 'red', 1);
  assert.equal(g.particles.length, 450);
});
test('grenade detonation is idempotent', () => {
  const g = new Game();
  g.start('grenade', 'repulsor');
  clean(g);
  g.spawnEnemy('sentry', 900, 740);
  g.addShot({
    pos: { x: 840, y: 740 },
    vel: { x: 0, y: 0 },
    damage: 10,
    life: 0.1,
    radius: 7,
    friendly: true,
    kind: 'grenade',
    bounces: 10,
    split: false,
    root: 1,
    color: 'purple',
  });
  const e = g.enemies[0],
    s = g.shots[0];
  g.explode(s);
  const hp = e.hp;
  g.explode(s);
  assert.equal(e.hp, hp);
  assert(hp < e.maxHp);
});
test('all six stages progress, unlock weapons, save entrances, and reach victory', () => {
  const g = new Game();
  let saved = 0;
  let cleared = false;
  const transitions: string[] = [];
  g.onCheckpoint = (s) => {
    if (s) saved++;
    else cleared = true;
  };
  g.onChange = () => transitions.push(g.mode);
  g.start('complete', 'repulsor');
  for (let stage = 0; stage < 6; stage++) {
    assert.equal(g.stage, stage);
    for (const e of [...g.enemies]) g.hitEnemy(e, 99999, 'test', 0);
    Body.setPosition(g.player, { x: 2190, y: 750 });
    tick(g, 1, { interact: true });
    if (stage < 5) {
      assert.equal(g.mode, 'upgrade');
      assert.equal(g.offers.length, 3);
      const before = transitions.length;
      g.chooseTech(g.offers[0].id);
      assert.equal(g.mode, 'playing');
      assert.deepEqual(transitions.slice(before), ['playing']);
      assert.equal(g.enemies.length > 0, true);
    }
  }
  assert.equal(g.mode, 'won');
  assert.equal(g.weapons.length, 4);
  assert.equal(g.techs.length, 5);
  assert.equal(saved, 6);
  assert(cleared);
});
test('exit is unavailable with hostiles remaining and death clears checkpoint', () => {
  const g = new Game();
  let cleared = false;
  g.onCheckpoint = (s) => {
    if (!s) cleared = true;
  };
  g.start('exit', 'repulsor');
  Body.setPosition(g.player, { x: 2190, y: 750 });
  tick(g, 1, { interact: true });
  assert.equal(g.stage, 0);
  assert.equal(g.mode, 'playing');
  g.damagePlayer(9999);
  assert.equal(g.mode, 'dead');
  assert(cleared);
});
test('checkpoint restores equipment and fresh stage without transient projectiles', () => {
  const g = new Game();
  g.start('save', 'tractor', {
    version: 1,
    seed: 'save',
    stage: 3,
    hp: 67,
    energy: 42,
    techs: ['dense', 'fragment'],
    weapons: ['coil', 'scatter', 'lance', 'mortar'],
    weapon: 'mortar',
    field: 'tractor',
    kills: 18,
    elapsed: 240,
  });
  assert.equal(g.stage, 3);
  assert.equal(g.hp, 67);
  assert.equal(g.weapon, 'mortar');
  assert.equal(g.shots.length, 0);
  assert.equal(g.enemies.length, 10);
  assert(g.stats.fragments);
});
test('a stress encounter with every technology remains finite and bounded', () => {
  const g = new Game();
  g.start('stress', 'tractor');
  g.techs = TECHS.map((t) => t.id);
  g.stats = getStats(g.techs);
  g.weapons = ['coil', 'scatter', 'lance', 'mortar'];
  g.weapon = 'mortar';
  g.hp = 1e6;
  for (let i = 0; i < 1200; i++) {
    g.energy = g.stats.maxEnergy;
    g.hurtAt = g.time;
    tick(g, 1, {
      fire: true,
      right: i % 240 < 100,
      jump: i % 90 === 0,
      aim: g.enemies[0] ? { ...g.enemies[0].body.position } : { x: 1600, y: 600 },
    });
  }
  assert.equal(g.mode, 'playing');
  assert(g.elapsed > 19);
  for (const b of Composite.allBodies(g.engine.world))
    assert(Number.isFinite(b.position.x) && Number.isFinite(b.position.y));
  assert(g.shots.length <= 220);
  assert(g.particles.length <= 450);
  assert(Composite.allBodies(g.engine.world).length < 90);
});
