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
    winch: false,
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
test('real physics settles the rover, moves with cargo, jumps, and preserves rotation lock', () => {
  const g = new Game();
  g.start('physics');
  clean(g);
  tick(g, 80);
  assert(g.grounded);
  const x = g.player.position.x;
  tick(g, 25, { right: true });
  assert(g.player.position.x > x + 40);
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
  g.start('energy');
  clean(g);
  g.energy = 10;
  tick(g, 180, { fire: true });
  assert(g.energy > 55);
  assert(g.shotCount > 10);
});
test('damage immunity prevents repeated collision damage, then expires', () => {
  const g = new Game();
  g.start('damage');
  g.damagePlayer(10);
  g.damagePlayer(10);
  assert.equal(g.hp, 90);
  g.time += 0.61;
  g.damagePlayer(10);
  assert.equal(g.hp, 80);
});
test('lethal projectile freezes state before pickups or later shots can modify results', () => {
  const g = new Game();
  g.start('death-freeze');
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
  g.start('crate');
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
test('the fixed winch reels the core closer, spends energy, and permits firing', () => {
  const g = new Game();
  g.start('winch');
  clean(g);
  tick(g, 80);
  const restDistance = Math.hypot(
    g.cargo.position.x - g.player.position.x,
    g.cargo.position.y - g.player.position.y,
  );
  tick(g, 45, { winch: true, fire: true });
  assert(g.winchActive);
  assert(g.energy < 95);
  assert(g.shotCount >= 4);
  assert(
    Math.hypot(g.cargo.position.x - g.player.position.x, g.cargo.position.y - g.player.position.y) <
      restDistance - 20,
  );
  g.energy = 0;
  g.updateWinch(true, 1 / 60);
  assert.equal(g.winchActive, false);
  assert.equal(g.energy, 0);
});
test('passive towing delivers through every layout without energy', () => {
  for (const seed of ['A', 'B', 'C', 'D', 'E', 'F'])
    for (let stage = 0; stage < 5; stage++) {
      const g = new Game();
      g.start(seed);
      g.stage = stage;
      g.loadRoom();
      for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
      g.enemies = [];
      for (let i = 0; i < 1800 && g.mode === 'playing'; i++) {
        g.energy = 0;
        tick(g, 1, {
          right: g.player.position.x < 2190,
          jump: g.grounded && i % 45 === 0,
          interact: true,
        });
      }
      assert.equal(g.mode, 'upgrade', seed + ':' + stage);
      assert.equal(g.cargoHp, 120);
    }
});
test('hostile rounds damage cargo, armor reduces damage, and cooldown limits bursts', () => {
  const g = new Game();
  g.start('cargo-damage');
  clean(g);
  const shoot = (friendly: boolean) => {
    const p = g.cargo.position;
    g.addShot({
      pos: { x: p.x - 40, y: p.y },
      vel: { x: 30, y: 0 },
      damage: 20,
      life: 2,
      radius: 3,
      friendly,
      kind: 'bullet',
      bounces: 0,
      split: true,
      root: 0,
      color: 'red',
    });
    g.updateShots(1 / 60);
  };
  shoot(true);
  assert.equal(g.cargoHp, 120);
  shoot(false);
  assert.equal(g.cargoHp, 100);
  shoot(false);
  assert.equal(g.cargoHp, 100);
  g.time += 0.46;
  g.techs = ['cargo-armor'];
  g.stats = getStats(g.techs);
  shoot(false);
  assert.equal(g.cargoHp, 86);
});
test('destroying the core ends the run and clears its checkpoint', () => {
  const g = new Game();
  g.start('core-lost');
  clean(g);
  let cleared = false;
  g.onCheckpoint = (s) => {
    if (!s) cleared = true;
  };
  g.damageCargo(999);
  assert.equal(g.mode, 'dead');
  assert.equal(g.failure, 'cargo');
  assert(cleared);
  const elapsed = g.elapsed;
  tick(g, 10, { right: true });
  assert.equal(g.elapsed, elapsed);
});
test('fall recovery and corrupt cargo recovery retain one working tether', () => {
  const g = new Game();
  g.start('recovery');
  clean(g);
  tick(g, 60);
  const hp = g.cargoHp;
  Body.setPosition(g.cargo, { x: 400, y: 1200 });
  tick(g);
  assert(g.cargo.position.y < 900);
  Body.setPosition(g.cargo, { x: NaN, y: NaN });
  tick(g, 120, { right: true });
  for (const body of [g.cargo, g.player])
    for (const p of [body.position, ...body.vertices])
      assert(Number.isFinite(p.x) && Number.isFinite(p.y));
  assert.equal(Composite.allConstraints(g.engine.world).length, 1);
  assert.equal(Composite.allBodies(g.engine.world).filter((b) => b.label === 'cargo').length, 1);
  assert.equal(g.cargoHp, hp);
});
test('fragmentation cannot recurse and shot/particle caps bound heavy builds', () => {
  const g = new Game();
  g.start('fragments');
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
  g.start('grenade');
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
  g.start('complete');
  for (let stage = 0; stage < 6; stage++) {
    assert.equal(g.stage, stage);
    for (const e of [...g.enemies]) g.hitEnemy(e, 99999, 'test', 0);
    Body.setPosition(g.player, { x: 2190, y: 750 });
    Body.setPosition(g.cargo, { x: 2110, y: 775 });
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
test('delivery requires the rover and core, allows patrols, and locks the final dock', () => {
  const g = new Game();
  g.start('delivery');
  Body.setPosition(g.player, { x: 2190, y: 750 });
  tick(g, 1, { interact: true });
  assert.equal(g.mode, 'playing');
  Body.setPosition(g.player, { x: 2190, y: 750 });
  Body.setPosition(g.cargo, { x: 2110, y: 775 });
  tick(g, 1, { interact: true });
  assert.equal(g.mode, 'upgrade');
  assert(g.enemies.length > 0);
  g.stage = 5;
  g.loadRoom();
  g.setMode('playing');
  Body.setPosition(g.player, { x: 2190, y: 750 });
  Body.setPosition(g.cargo, { x: 2110, y: 775 });
  tick(g, 1, { interact: true });
  assert.equal(g.mode, 'playing');
  for (const e of [...g.enemies]) g.hitEnemy(e, 9999, 'test', 0);
  tick(g, 1, { interact: true });
  assert.equal(g.mode, 'won');
});
test('delivery repairs the core and checkpoints its new integrity', () => {
  for (const id of ['dense', 'repair']) {
    const g = new Game();
    g.start('repair');
    g.cargoHp = 30;
    g.hp = 50;
    g.openReward();
    g.offers = [TECHS.find((t) => t.id === id)!];
    let saved: any;
    g.onCheckpoint = (s) => {
      saved = s;
    };
    g.chooseTech(id);
    assert.equal(g.cargoHp, id === 'repair' ? 95 : 55);
    assert.equal(g.hp, 62);
    assert.equal(saved.cargoHp, g.cargoHp);
    assert.equal(Composite.allConstraints(g.engine.world).length, 1);
  }
});
test('checkpoint restores equipment and fresh stage without transient projectiles', () => {
  const g = new Game();
  g.start('save', {
    version: 2,
    seed: 'save',
    stage: 3,
    hp: 67,
    energy: 42,
    techs: ['dense', 'fragment'],
    weapons: ['coil', 'scatter', 'lance', 'mortar'],
    weapon: 'mortar',
    cargoHp: 73,
    kills: 18,
    elapsed: 240,
  });
  assert.equal(g.stage, 3);
  assert.equal(g.hp, 67);
  assert.equal(g.cargoHp, 73);
  assert.equal(g.weapon, 'mortar');
  assert.equal(g.shots.length, 0);
  assert.equal(g.enemies.length, 10);
  assert(g.stats.fragments);
});
test('a stress encounter with every technology remains finite and bounded', () => {
  const g = new Game();
  g.start('stress');
  g.techs = TECHS.map((t) => t.id);
  g.stats = getStats(g.techs);
  g.weapons = ['coil', 'scatter', 'lance', 'mortar'];
  g.weapon = 'mortar';
  g.hp = 1e6;
  for (let i = 0; i < 1200; i++) {
    g.energy = g.stats.maxEnergy;
    g.hurtAt = g.time;
    g.cargoHurtAt = g.time;
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
