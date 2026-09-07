import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
const { Body, Bodies, Composite } = Matter;
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function step(g: Game, count = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < count; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1500, y: 300 },
      ...input,
    });
}
function fixture(mods: string[]) {
  const g = new Game();
  g.start('upgrades');
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.mods = mods;
  g.gun = getGun(mods);
  step(g, 60);
  Body.setPosition(g.player, { x: 600, y: 300 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  g.landingSpeed = 0;
  g.aim = { x: 1500, y: 300 };
  return g;
}
function target(g: Game, x: number, y = 300) {
  g.spawnEnemy('shooter', x, y);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  return e;
}
function wall(g: Game, x: number, y = 300, w = 4, h = 180) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
}
test('Kickback adds damage without slowing fire and preserves its airborne recoil boost', () => {
  for (const mods of [[], ['magnum', 'scatter'], ['airshot', 'landing']]) {
    const ordinary = fixture(mods),
      boosted = fixture([...mods, 'kick']);
    ordinary.landingReady = boosted.landingReady = mods.includes('landing');
    ordinary.fire();
    boosted.fire();
    close(boosted.gun.interval, ordinary.gun.interval);
    close(boosted.player.velocity.x, ordinary.player.velocity.x * 1.4);
    assert.equal(boosted.shots.length, ordinary.shots.length);
    for (let i = 0; i < ordinary.shots.length; i++)
      close(boosted.shots[i].damage, ordinary.shots[i].damage * 1.2);
  }
});

test('Backblast fires full-strength projectiles beyond its cone in both directions', () => {
  const g = fixture(['backblast']);
  const rear = target(g, 380),
    front = target(g, 820);
  g.fire();
  assert.equal(g.shots.length, 2);
  close(g.shots[0].vel.x, -g.shots[1].vel.x);
  close(g.player.velocity.x, -g.gun.recoil);
  close(g.shootAt - g.time, getGun([]).interval * 1.4);
  assert.equal(rear.hp, rear.maxHp, 'the cone extended beyond its range');
  g.updateShots(1 / 6);
  close(rear.maxHp - rear.hp, g.gun.damage);
  close(front.maxHp - front.hp, g.gun.damage);
});

test('Backblast mirrors scatter, air damage and one landing charge through all three burst rounds', () => {
  const g = fixture(['backblast', 'burst', 'scatter', 'airshot', 'landing', 'kick']);
  g.landingReady = true;
  g.fire();
  const first = [...g.shots];
  assert.equal(first.length, 10);
  close(g.player.velocity.x, -g.gun.recoil * 1.25);
  for (let i = 0; i < 5; i++) {
    close(first[i].vel.x, -first[i + 5].vel.x);
    close(first[i].vel.y, -first[i + 5].vel.y);
    close(first[i].damage, g.gun.damage * g.gun.airDamage * 2);
    close(first[i + 5].damage, first[i].damage);
    assert(first[i].charged && first[i + 5].charged);
    assert.notEqual(first[i].hits, first[i + 5].hits);
  }
  step(g, 16);
  assert.equal(g.shotCount, 3);
  assert.equal(g.shots.length, 30);
  assert.equal(g.shots.filter((s) => s.charged).length, 10);
  for (const shot of g.shots.filter((s) => !s.charged))
    close(shot.damage, g.gun.damage * g.gun.airDamage);
  assert.equal(g.landingReady, false);
  assert(g.shootAt - g.time > 0.8);
});

test('backward rounds use real bounce, piercing and nonrecursive splinter collisions', () => {
  const g = fixture(['backblast', 'banker', 'ricochet', 'pierce', 'split']);
  wall(g, 360);
  const first = target(g, 450),
    second = target(g, 400);
  g.fire();
  const rear = g.shots.find((s) => s.vel.x < 0)!;
  assert.equal(rear.bounces, 3);
  assert.equal(rear.pierce, 2);
  assert(rear.trace?.bank && rear.trace.pierce);
  g.updateShots(1 / 6);
  close(first.maxHp - first.hp, g.gun.damage);
  close(second.maxHp - second.hp, g.gun.damage * 0.8);
  assert.equal(rear.banks, 1);
  close(rear.damage, g.gun.damage * 0.8 ** 2 * 1.35);
  const fragments = g.shots.filter((s) => s.fragment);
  assert.equal(fragments.length, 3);
  for (const shot of fragments) {
    assert.equal(shot.bounces, 0);
    g.splitShot(shot);
  }
  assert.equal(g.shots.filter((s) => s.fragment).length, 3);
});

test('a wall inside the rear muzzle blocks the backward volley before it can hit actors', () => {
  const g = fixture(['backblast', 'banker']);
  wall(g, 577);
  const enemy = target(g, 530);
  g.fire();
  const rear = g.shots.find((s) => s.vel.x < 0)!;
  assert(rear.pos.x > 579);
  g.updateShots(1 / 60);
  assert.equal(rear.banks, 1);
  assert(rear.vel.x > 0);
  assert.equal(enemy.hp, enemy.maxHp);
});

test('backward projectiles hit props through the normal impact path', () => {
  const g = fixture(['backblast']);
  const fuel = g.props.spawn('canister', 380, 297);
  g.fire();
  assert.equal(fuel.armedAt, Infinity);
  g.updateShots(1 / 6);
  assert(Number.isFinite(fuel.armedAt));
  assert(fuel.body.velocity.x < -8);
});

test('one click commits three rounds, uses one recoil per discharge, and has recovery', () => {
  const g = fixture(['burst', 'scatter']);
  g.fire();
  close(g.player.velocity.x, -g.gun.recoil);
  step(g, 13);
  assert.equal(g.shotCount, 3);
  assert.equal(g.shots.length, 15);
  assert.equal(g.burstRemaining, 0);
  const remaining = g.shootAt - g.time;
  assert(remaining > 0.5);
  step(g, 20, { fire: true });
  assert.equal(g.shotCount, 3);
  while (g.time < g.shootAt) step(g);
  step(g, 1, { firePressed: true });
  assert.equal(g.shotCount, 4);
});
test('hitstop freezes a burst; pause cancels its remainder without removing recovery', () => {
  const g = fixture(['burst']);
  g.fire();
  const time = g.time,
    deadline = g.shootAt;
  g.hitStop = 0.1;
  step(g, 5);
  assert.equal(g.time, time);
  assert.equal(g.shotCount, 1);
  assert.equal(g.burstRemaining, 2);
  step(g, 12);
  assert.equal(g.shotCount, 3);
  while (g.time < deadline) step(g);
  g.fire();
  const secondDeadline = g.shootAt;
  g.setMode('paused');
  step(g, 60);
  assert.equal(g.burstRemaining, 0);
  g.setMode('playing');
  step(g, 8, { fire: true });
  assert.equal(g.shotCount, 4);
  assert.equal(g.shootAt, secondDeadline);
});
test('death, room changes and fresh runs discard pending rounds and landing charge', () => {
  const g = fixture(['burst', 'landing']);
  g.fire();
  g.landingReady = true;
  g.damagePlayer(9999);
  step(g, 60);
  assert.equal(g.shotCount, 1);
  assert.equal(g.burstRemaining, 0);
  g.start('fresh');
  assert.equal(g.burstRemaining, 0);
  assert.equal(g.landingReady, false);
  assert.equal(g.landingSpeed, 0);
  g.mods = ['burst', 'landing'];
  g.gun = getGun(g.mods);
  g.fire();
  g.landingReady = true;
  g.stage = 1;
  g.loadRoom();
  assert.equal(g.burstRemaining, 0);
  assert.equal(g.landingReady, false);
});
test('backblast hits the rear cone once per discharge and respects range and cover', () => {
  const g = fixture(['backblast', 'scatter']);
  const rear = target(g, 550),
    front = target(g, 650),
    far = target(g, 430),
    side = target(g, 550, 200),
    covered = target(g, 480);
  wall(g, 520);
  g.fire();
  close(rear.maxHp - rear.hp, g.gun.damage * g.gun.pellets * 0.8);
  for (const e of [front, far, side, covered]) assert.equal(e.hp, e.maxHp);
  assert(g.blast.life > 0);
  assert.equal(g.blast.dir.x, -1);
});
test('backblast uses the shot direction and safely handles boss cleanup', () => {
  const g = fixture(['backblast']);
  g.aim = { x: 0, y: 300 };
  const right = target(g, 660);
  g.fire();
  assert(right.hp < right.maxHp);
  g.spawnEnemy('boss', 690, 300);
  const boss = g.enemies.at(-1)!;
  boss.spawn = 0;
  boss.hp = 1;
  g.spawnEnemy('flyer', 700, 150);
  g.fire();
  assert.equal(g.enemies.length, 0);
  assert.equal(g.kills, 3);
});
test('Banker works alone, stacks with Bank shot, and compounds only on reflections', () => {
  assert.equal(getGun(['banker']).bounces, 1);
  assert.equal(getGun(['banker', 'ricochet']).bounces, 3);
  assert.deepEqual(getGun(['banker', 'ricochet']), getGun(['ricochet', 'banker']));
  const g = fixture(['banker', 'ricochet']);
  wall(g, 750);
  wall(g, 450);
  g.fire();
  const shot = g.shots[0],
    initial = shot.damage;
  let bounces = 0;
  for (let i = 0; i < 60 && shot.life > 0; i++) {
    g.updateShots(1 / 60);
    if (shot.banks !== bounces) {
      bounces = shot.banks;
      close(shot.damage, initial * 1.35 ** bounces);
    }
  }
  assert.equal(bounces, 3);
  assert(shot.life <= 0);
});
test('Banker preserves piercing attenuation and creates nonrecursive unbanked fragments', () => {
  const g = fixture(['banker', 'pierce', 'split']);
  wall(g, 750);
  const first = target(g, 560),
    second = target(g, 500);
  g.fire();
  const shot = g.shots[0];
  shot.pos = { x: 650, y: 300 };
  shot.vel = { x: 450, y: 0 };
  g.updateShots(1 / 60);
  const damage = g.gun.damage * 1.35;
  close(first.maxHp - first.hp, damage);
  close(second.maxHp - second.hp, damage * 0.8);
  const fragments = g.shots.filter((s) => s.fragment);
  assert.equal(fragments.length, 3);
  for (const s of fragments) {
    // The first wall impact splinters before the reflected parent gains damage.
    close(s.damage, g.gun.damage * 0.2);
    assert.equal(s.bounces, 0);
    assert.equal(s.bankGrowth, 0);
    g.splitShot(s);
  }
  assert.equal(g.shots.filter((s) => s.fragment).length, 3);
});
test('a close wall catches a player round inside its muzzle offset instead of being bypassed', () => {
  const g = fixture(['banker']);
  wall(g, 623);
  const enemy = target(g, 690);
  g.fire();
  const shot = g.shots[0];
  assert(shot.pos.x < 621);
  g.updateShots(1 / 60);
  assert.equal(shot.banks, 1);
  assert(shot.vel.x < 0);
  assert.equal(enemy.hp, enemy.maxHp);
});
test('a real hard landing arms one shot, while standing and short falls do not rearm it', () => {
  const g = fixture(['landing']);
  Body.setPosition(g.player, { x: 900, y: 440 });
  Body.setVelocity(g.player, { x: 0, y: 12 });
  for (let i = 0; i < 90 && !g.grounded; i++) step(g);
  assert(g.grounded);
  assert(g.landingReady);
  g.fire();
  const powered = g.shots[0];
  assert(powered.charged);
  close(powered.damage, g.gun.damage * 2);
  assert.equal(g.landingReady, false);
  g.fire();
  assert.equal(g.shots.at(-1)!.charged, false);
  close(g.shots.at(-1)!.damage, g.gun.damage);
  step(g, 120);
  assert.equal(g.landingReady, false);
  Body.setPosition(g.player, { x: 900, y: 685 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  step(g, 60);
  assert(g.grounded);
  assert.equal(g.landingReady, false);
});
test('recoil braking before contact prevents a hard landing charge', () => {
  const g = fixture(['landing', 'kick', 'magnum']);
  Body.setPosition(g.player, { x: 900, y: 680 });
  Body.setVelocity(g.player, { x: 0, y: 12 });
  step(g, 1, { firePressed: true, aim: { x: 900, y: 1200 } });
  step(g, 60);
  assert(g.grounded);
  assert.equal(g.landingReady, false);
});
test('Landing shot empowers all pellets of the next discharge, then the burst returns to normal', () => {
  const g = fixture(['landing', 'burst', 'scatter']);
  g.landingReady = true;
  g.fire();
  close(g.player.velocity.x, -g.gun.recoil * 1.25);
  step(g, 13);
  assert.equal(g.shots.length, 15);
  const powered = g.shots.filter((s) => s.charged),
    ordinary = g.shots.filter((s) => !s.charged);
  assert.equal(powered.length, 5);
  assert.equal(ordinary.length, 10);
  powered.forEach((s) => close(s.damage, g.gun.damage * 2));
  ordinary.forEach((s) => close(s.damage, g.gun.damage));
});
test('new gun builds survive checkpoints without saving transient burst or landing state', () => {
  const save = {
    version: 3 as const,
    seed: 'mods',
    stage: 4,
    hp: 75,
    mods: ['burst', 'backblast', 'banker', 'landing'],
    kills: 20,
    elapsed: 65,
  };
  assert.equal(loadCheckpoint(save), save);
  const g = new Game();
  g.start(save.seed, save);
  assert.deepEqual(g.gun, getGun(save.mods));
  assert.equal(g.burstRemaining, 0);
  assert.equal(g.landingReady, false);
});
