import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { enemyHealth } from '../src/enemies.ts';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { dailyForDate } from '../src/daily.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';

const { Body, Composite, Query } = Matter;
const step = (g: Game, count = 1, override: Partial<Input> = {}) => {
  for (let i = 0; i < count; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1000, y: 400 },
      ...override,
    });
};

test('later regular enemies require more real base-gun hits while bosses scale for the longer builds', () => {
  const hits: number[] = [];
  for (const stage of [0, 9]) {
    const g = new Game();
    g.start('pressure-scale');
    for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
    g.enemies = [];
    g.waves.clear();
    for (const prop of [...g.props.items]) g.props.remove(prop);
    g.breaches.clear();
    g.hazards.clear();
    for (const body of g.terrain.slice(4)) Composite.remove(g.engine.world, body);
    g.terrain = g.terrain.slice(0, 4);
    g.stage = stage;
    g.spawnEnemy('runner', 700, 400);
    const enemy = g.enemies[0];
    enemy.spawn = 0;
    let count = 0;
    while (enemy.hp > 0 && count < 10) {
      g.addShot({
        pos: { x: 660, y: 400 },
        vel: { x: 80, y: 0 },
        damage: 24,
        life: 1,
        friendly: true,
        radius: 2,
        bounces: 0,
        pierce: 0,
        fragment: false,
        split: false,
      });
      g.updateShots(1 / 60);
      count++;
    }
    assert(enemy.hp <= 0);
    hits.push(count);
    g.spawnEnemy('loader', 1200, 706);
    assert.equal(g.enemies[0].maxHp, enemyHealth('loader', stage));
  }
  assert.deepEqual(hits, [3, 4]);
});

test('later shooters apply faster pressure while retaining their full aim lock and dodge window', () => {
  for (const stage of [0, 4, 8]) {
    const g = new Game();
    g.start('pressure-cadence');
    for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
    g.enemies = [];
    g.waves.clear();
    for (const prop of [...g.props.items]) g.props.remove(prop);
    for (const body of g.terrain.slice(4)) Composite.remove(g.engine.world, body);
    g.terrain = g.terrain.slice(0, 4);
    g.breaches.clear();
    g.hazards.clear();
    g.stage = stage;
    Body.setStatic(g.player, true);
    Body.setPosition(g.player, { x: 1000, y: 450 });
    g.spawnEnemy('shooter', 600, 400);
    const enemy = g.enemies[0];
    enemy.spawn = 0;
    enemy.timer = 0.6;
    const fired: { time: number; speed: number; damage: number }[] = [],
      original = g.enemyShot.bind(g);
    g.enemyShot = (...args) => {
      original(...args);
      const shot = g.shots.at(-1)!;
      fired.push({ time: g.time, speed: Math.hypot(shot.vel.x, shot.vel.y), damage: shot.damage });
    };
    step(g, 8);
    const firstAim = { ...enemy.aim };
    Body.setPosition(g.player, { x: 1000, y: 550 });
    step(g, 5);
    assert.notDeepEqual(enemy.aim, firstAim);
    while (enemy.timer > 0.35) step(g);
    const locked = { ...enemy.aim },
      lockedAt = g.time;
    Body.setPosition(g.player, { x: 1000, y: 200 });
    while (!fired.length) {
      step(g);
      assert.deepEqual(enemy.aim, locked);
    }
    assert(fired[0].time - lockedAt >= 0.35 - 1 / 60 - 1e-8);
    step(g, 25);
    assert.equal(g.hp, 100, 'The locked shot followed the player after their dodge');
    for (let i = 0; i < 120 && fired.length < 2; i++) step(g);
    assert.equal(fired.length, 2);
    const area = stage / 4;
    assert(Math.abs(fired[1].time - fired[0].time - [1.5, 1.35, 1.2][area]) < 0.025);
    assert(Math.abs(fired[0].speed - [7.2, 8, 8.8][area]) < 1e-8);
    assert.equal(fired[0].damage, [14, 16, 18][area]);
  }
});

test('Bloodwork and one room reward leave meaningful damage carried into the next room', () => {
  const g = new Game(),
    seed = 'A';
  g.start(seed, {
    version: 5,
    seed,
    stage: 4,
    hp: 100,
    mods: ['leech', 'magnum', 'rapid'],
    kills: 0,
    elapsed: 0,
  });
  g.damagePlayer(25);
  g.time += 0.8;
  g.damagePlayer(25);
  assert.equal(g.hp, 50);
  const count = g.level.spawns.length;
  assert(count >= 4 && count <= 10);
  const defeated = [];
  for (let i = 0; i < 300 && !g.clear; i++) {
    for (const e of [...g.enemies]) {
      defeated.push(e);
      g.hitEnemy(e, 9999);
    }
    step(g);
  }
  assert(g.clear && !g.waves.pending);
  assert.equal(g.kills, count);
  assert.equal(g.hp, 50 + count * 2);
  for (const e of defeated) g.hitEnemy(e, 9999);
  assert.equal(g.hp, 50 + count * 2, 'Repeated cleanup incorrectly healed the same kill');
  g.openReward();
  const chosen = g.offers[0].id;
  g.chooseMod(chosen);
  assert.equal(g.hp, 50 + count * 2 + 12);
  assert(g.hp < 85, 'Routine room recovery erased the cost of two heavy hits');
  g.chooseMod(chosen);
  assert.equal(g.hp, 50 + count * 2 + 12);
});

test('daily continuation rebuilds the same scaled waves and gun regardless of combat random draws', () => {
  const daily = dailyForDate('2026-09-06')!,
    save: Checkpoint = {
      version: 5,
      seed: daily.seed,
      stage: 9,
      hp: 53,
      mods: ['magnum', 'rapid', 'scatter', 'leech', 'airshot', 'ricochet', 'pierce'],
      kills: 37,
      elapsed: 123.5,
    },
    a = new Game(),
    b = new Game();
  a.start(save.seed, loadCheckpoint(save)!);
  b.start(save.seed, loadCheckpoint(save)!);
  for (let i = 0; i < 1000; i++) a.rng();
  const roster = (g: Game) => g.enemies.map((e) => ({ kind: e.kind, elite: e.elite, hp: e.maxHp }));
  assert.deepEqual(roster(a), roster(b));
  for (const g of [a, b]) {
    for (const e of [...g.enemies]) g.hitEnemy(e, 9999);
    for (let i = 0; i < 180 && g.waves.pending; i++) step(g);
  }
  assert(!a.waves.pending && !b.waves.pending);
  assert.deepEqual(roster(a), roster(b));
  assert.deepEqual(a.gun, b.gun);
  assert.deepEqual(a.gun, getGun(save.mods));
  assert.equal(a.hp, b.hp);
});

test('sustained fire from the old overhead and cover camps cannot win the boss damage race', () => {
  const cases = [
    { stage: 3, seed: 'crane-1', x: 1470, y: 620 },
    { stage: 3, seed: 'crane-1', x: 13, y: 722 },
    { stage: 7, seed: 'kiln-layout-0', x: 700, y: 160 },
    { stage: 7, seed: 'kiln-layout-0', x: 235, y: 722 },
    { stage: 11, seed: 'boss-cheese-0', x: 1490, y: 160 },
    { stage: 19, seed: 'boss-cheese-0', x: 1490, y: 160 },
    { stage: 19, seed: 'boss-cheese-0', x: 355, y: 722 },
  ];
  for (const scenario of cases) {
    const g = new Game(),
      mods =
        scenario.stage === 3
          ? ['magnum', 'rapid', 'kick']
          : [
              'magnum',
              'rapid',
              'kick',
              'airshot',
              'scatter',
              'ricochet',
              'pierce',
              'split',
              'deadeye',
              'execute',
              'burst',
              'light',
              'leech',
              'redline',
              'backblast',
            ].slice(0, scenario.stage);
    g.start(scenario.seed, {
      version: 5,
      seed: scenario.seed,
      stage: scenario.stage,
      hp: 100,
      mods,
      kills: 0,
      elapsed: 0,
    });
    const boss = g.enemies[0];
    Body.setPosition(g.player, { x: scenario.x, y: scenario.y });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    let warnings = 0;
    g.onSound = (sound) => {
      if (['lock', 'charge', 'machine', 'turbine-wind', 'interceptor-lock'].includes(sound))
        warnings++;
    };
    for (let i = 0; i < 3600 && g.mode === 'playing' && boss.hp > 0; i++) {
      const correction = scenario.x - g.player.position.x - g.player.velocity.x * 5;
      step(g, 1, {
        left: correction < -8,
        right: correction > 8,
        fire: true,
        aim: { ...boss.body.position },
      });
    }
    const label = `${boss.kind} (${scenario.x},${scenario.y})`;
    assert.equal(
      g.mode,
      'dead',
      `${label}: passive fire ended with ${g.hp} HP against ${Math.round(boss.hp)} boss HP at ${JSON.stringify(boss.body.position)}, state ${boss.state}, attacks ${boss.attacks}, route ${JSON.stringify(boss.hunt)}`,
    );
    assert(boss.hp > 0 && g.shotCount > 15, label);
    assert(warnings >= 3, `${label}: damage arrived without repeated readable warnings`);
  }
});

test('reacting to the Crane beats the same fight that kills passive sustained fire', () => {
  const results = [false, true].map((reactive) => {
    const g = new Game(),
      seed = 'crane-0';
    g.start(seed, {
      version: 5,
      seed,
      stage: 3,
      hp: 100,
      mods: ['magnum', 'rapid'],
      kills: 7,
      elapsed: 0,
    });
    const boss = g.enemies[0];
    Body.setPosition(g.player, { x: 1000, y: 722 });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    let dodgeUntil = 0,
      dodgeDirection = 1;
    for (let i = 0; i < 3600 && g.mode === 'playing' && boss.hp > 0; i++) {
      const p = g.player.position,
        dx = boss.body.position.x - p.x,
        correction = 1000 - p.x - g.player.velocity.x * 5;
      let move = reactive
          ? dx > 320
            ? 1
            : dx < -320
              ? -1
              : 0
          : correction < -8
            ? -1
            : correction > 8
              ? 1
              : 0,
        jump =
          reactive &&
          g.grounded &&
          Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 20).length > 0;
      const evading =
        reactive && (boss.state === 'rush' || (boss.state === 'windup' && boss.timer <= 0.45));
      if (reactive && boss.state === 'windup' && boss.timer <= 0.45) {
        if (boss.attack === 'sweep') jump ||= g.grounded;
        else {
          dodgeUntil = g.time + 0.65;
          dodgeDirection = p.x < 1000 ? 1 : -1;
        }
      }
      if (reactive && g.time < dodgeUntil) move = dodgeDirection;
      step(g, 1, {
        left: move < 0,
        right: move > 0,
        jump,
        fire: !evading,
        aim: { ...boss.body.position },
      });
    }
    return { hp: g.hp, bossHp: boss.hp, mode: g.mode, attacks: boss.attacks };
  });
  assert.equal(results[0].mode, 'dead');
  assert(results[0].bossHp > 0 && results[0].attacks >= 3);
  assert(results[1].bossHp <= 0 && results[1].hp >= 50);
  assert(
    results[1].attacks >= 3,
    'The reactive build killed the boss before testing repeated dodges',
  );
});

test('the Press cover trap remains winnable by reading its locks and moving between volleys', () => {
  const g = new Game(),
    seed = 'kiln-layout-0';
  g.start(seed, {
    version: 5,
    seed,
    stage: 7,
    hp: 100,
    mods: ['magnum', 'rapid', 'kick', 'airshot', 'scatter'],
    kills: 0,
    elapsed: 0,
  });
  const boss = g.enemies[0];
  Body.setPosition(g.player, { x: 235, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  let dodgeUntil = 0,
    dodgeDirection = 1,
    reacted = false,
    previousX = 235,
    stuck = 0;
  for (let i = 0; i < 5400 && g.mode === 'playing' && boss.hp > 0; i++) {
    const p = g.player.position,
      dx = boss.body.position.x - p.x;
    let move = dx > 320 ? 1 : dx < -320 ? -1 : 0,
      jump = false,
      fire = true;
    stuck = Math.abs(previousX - p.x) < 0.4 ? stuck + 1 : 0;
    previousX = p.x;
    if (
      boss.state === 'windup' &&
      boss.timer <= (boss.attack === 'flak' ? 0.38 : 0.65) &&
      !reacted
    ) {
      reacted = true;
      dodgeDirection = p.x < 1000 ? 1 : -1;
      dodgeUntil = g.time + 1.1;
      jump = g.grounded;
    }
    if (boss.state !== 'windup') reacted = false;
    if (g.time < dodgeUntil) {
      move = dodgeDirection;
      fire = false;
    }
    if (p.x < 160 || p.x > 1840) {
      move = p.x < 160 ? 1 : -1;
      fire = false;
    }
    const blocked = move && Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 20).length;
    if (g.grounded && (blocked || stuck > 25)) jump = true;
    step(g, 1, { left: move < 0, right: move > 0, jump, fire, aim: { ...boss.body.position } });
  }
  assert(boss.hp <= 0, `The Press survived with ${boss.hp} HP; player ${g.hp} HP`);
  assert(g.hp >= 50 && g.mode === 'playing');
  assert(boss.attacks >= 5);
  assert.equal(g.mods.length, 5);
});
