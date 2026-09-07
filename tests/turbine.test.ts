import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { getGun, loadCheckpoint, distance } from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import { loadEncounters, practiceCheckpoint } from '../src/practice.ts';
import {
  TURBINE_LOCK,
  TURBINE_GUST_TELL,
  TURBINE_SWEEP_TELL,
  TURBINE_GUST_TIME,
  TURBINE_RECOVER,
  turbineWind,
  applyTurbineWind,
  turbineAngles,
} from '../src/turbine.ts';
import { dodgePilot } from './combat-pilot.ts';
const { Body, Bodies, Composite } = Matter;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function step(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1400, y: 300 },
      ...input,
    });
}
function seedFor(mirrored = false) {
  for (let i = 0; i < 100; i++) {
    const seed = 'turbine-fight-' + i,
      level = getLevel(seed, 8);
    if (level.spawns[0].kind === 'turbine' && level.mirrored === mirrored) return seed;
  }
  throw Error('Missing arena');
}
function fixture() {
  const g = new Game();
  const seed = seedFor();
  g.start(seed, { version: 3, seed, stage: 8, hp: 100, mods: [], elapsed: 0, kills: 0 });
  for (const prop of [...g.props.items]) g.props.remove(prop);
  g.hazards.clear();
  g.breaches.clear();
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 0;
  Body.setPosition(e.body, { x: 600, y: 400 });
  Body.setStatic(e.body, true);
  Body.setPosition(g.player, { x: 1000, y: 400 });
  Body.setStatic(g.player, true);
  return { g, e };
}
function until(g: Game, done: () => boolean, limit = 600) {
  for (let i = 0; i < limit && !done() && g.mode === 'playing'; i++) step(g);
  assert(done(), 'The expected transition never arrived');
}

test('Cooling Works independently selects both bosses and mirrors with identical seeded retries and Daily entrances', () => {
  const variants = new Set<string>();
  for (let i = 0; i < 80; i++) {
    const seed = 'turbine-choice-' + i,
      level = getLevel(seed, 8);
    variants.add(level.spawns[0].kind + ':' + level.mirrored);
    assert.deepEqual(level, getLevel(seed, 8));
    for (const stage of [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11])
      assert.deepEqual(getLevel(seed, stage, 'turbine'), getLevel(seed, stage, 'condenser'));
  }
  assert.equal(variants.size, 4);
  const day = dailyForDate('2026-09-07')!;
  const g = new Game();
  g.start(day.seed, {
    version: 3,
    seed: day.seed,
    stage: 8,
    mods: [],
    hp: 63,
    elapsed: 40,
    kills: 0,
  });
  const level = structuredClone(g.level);
  g.start(day.seed, {
    version: 3,
    seed: day.seed,
    stage: 8,
    mods: [],
    hp: 63,
    elapsed: 40,
    kills: 0,
  });
  assert.deepEqual(g.level, level);
});

test('gust aims early then locks the whole marked fan before any force or blade can arrive', () => {
  const { g, e } = fixture();
  step(g);
  assert.equal(e.state, 'windup');
  assert.equal(e.attack, 'gust');
  near(e.timer, TURBINE_GUST_TELL);
  const began = g.time,
    first = { ...e.aim };
  Body.setPosition(g.player, { x: 1050, y: 540 });
  step(g, 8);
  assert.notDeepEqual(e.aim, first);
  until(g, () => e.timer <= TURBINE_LOCK);
  const aim = { ...e.aim },
    rig = structuredClone(e.turbine),
    locked = g.time;
  Body.setPosition(g.player, { x: 900, y: 200 });
  while (e.state === 'windup') {
    assert.equal(turbineWind(g, e, { x: 1000, y: 400 }), 0);
    assert.equal(g.shots.length, 0);
    step(g);
    assert.deepEqual(e.aim, aim);
    assert.deepEqual(e.turbine?.angles, rig?.angles);
  }
  assert(g.time - began >= TURBINE_GUST_TELL - 1e-8);
  assert(g.time - locked >= TURBINE_LOCK - 1 / 60);
  assert.equal(e.state, 'rush');
  assert.equal(g.shots.length, 0);
  near(e.timer, TURBINE_GUST_TIME);
});

test('gust releases two fully marked blade passes then exposes its rotor; sweeps have their own complete warning', () => {
  const { g, e } = fixture();
  const launched: { time: number; angle: number }[] = [];
  const fire = g.enemyShot.bind(g);
  g.enemyShot = (...args) => {
    launched.push({ time: g.time, angle: args[1] });
    fire(...args);
  };
  step(g);
  until(g, () => e.state === 'rush');
  const began = g.time,
    angles = [...e.turbine!.angles];
  until(g, () => e.state === 'recover');
  assert.equal(launched.length, 6);
  assert.deepEqual(
    launched.map((s) => s.angle),
    [...angles, ...angles],
  );
  assert(launched[0].time - began >= 0.25 - 1e-8);
  assert(launched[3].time - launched[0].time >= 0.95 - 1 / 60 - 1e-8);
  near(e.timer, TURBINE_RECOVER);
  assert.equal(turbineWind(g, e, g.player.position), 0);
  const open = e.hp;
  g.hitEnemy(e, 100);
  near(open - e.hp, 135);
  until(g, () => e.state === 'windup');
  assert.equal(e.attack, 'sweep');
  near(e.timer, TURBINE_SWEEP_TELL);
  const closed = e.hp;
  g.hitEnemy(e, 100);
  near(closed - e.hp, 32);
  assert.equal(turbineAngles(e).length, 3);
});

test('airflow adds to recoil momentum, is stronger airborne, stays bounded, and cannot reach behind or through cover', () => {
  const { g, e } = fixture();
  e.state = 'rush';
  e.attack = 'gust';
  e.aim = { x: 1, y: 0 };
  e.turbine = { origin: { x: 600, y: 400 }, angles: [], active: 1, sent: 0 };
  Body.setStatic(g.player, false);
  Body.setVelocity(g.player, { x: 10, y: -8 });
  g.grounded = true;
  applyTurbineWind(g, e, 1 / 60);
  const groundPush = g.player.velocity.x - 10;
  Body.setVelocity(g.player, { x: 10, y: -8 });
  g.grounded = false;
  applyTurbineWind(g, e, 1 / 60);
  assert(g.player.velocity.x - 10 > groundPush * 3);
  near(g.player.velocity.y, -8);
  Body.setVelocity(g.player, { x: 22.9, y: -8 });
  applyTurbineWind(g, e, 1 / 60);
  near(g.player.velocity.x, 23);
  for (const p of [
    { x: 400, y: 400 },
    { x: 1500, y: 400 },
    { x: 1000, y: 100 },
  ])
    assert.equal(turbineWind(g, e, p), 0);
  const wall = Bodies.rectangle(800, 400, 24, 220, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  assert.equal(turbineWind(g, e, g.player.position), 0);
  Body.setVelocity(g.player, { x: 14, y: -5 });
  applyTurbineWind(g, e, 1 / 60);
  near(g.player.velocity.x, 14);
  near(g.player.velocity.y, -5);
});

test('gusts move exposed loose props while their hulls shelter objects farther downwind', () => {
  const { g, e } = fixture();
  e.state = 'rush';
  e.attack = 'gust';
  e.aim = { x: 1, y: 0 };
  e.turbine = { origin: { x: 600, y: 400 }, angles: [], active: 1, sent: 0 };
  const cover = g.props.spawn('crate', 850, 400);
  const fuel = g.props.spawn('canister', 1050, 400);
  applyTurbineWind(g, e, 1 / 60);
  assert(cover.body.velocity.x > 0);
  near(fuel.body.velocity.x, 0);
  assert.equal(cover.hp, cover.maxHp);
  assert(!Number.isFinite(fuel.armedAt));
});

test('wide blades collide with thin cover, damage crates, arm fuel and cannot spawn past cover inside the muzzle', () => {
  for (const material of ['wall', 'crate', 'canister', 'muzzle'] as const) {
    const { g, e } = fixture();
    let prop;
    if (material === 'wall' || material === 'muzzle') {
      const wall = Bodies.rectangle(material === 'wall' ? 800 : 644, 400, 8, 160, {
        isStatic: true,
      });
      g.terrain.push(wall);
      Composite.add(g.engine.world, wall);
    } else prop = g.props.spawn(material, 800, 400);
    g.enemyShot(e, 0, 28, 22, e.body.position, true);
    if (material === 'muzzle') assert.equal(g.shots.length, 0);
    else {
      assert(g.shots[0].blade);
      assert.equal(g.shots[0].radius, 11);
    }
    for (let i = 0; i < 20; i++) g.updateShots(1 / 60);
    assert.equal(g.hp, 100);
    assert.equal(g.shots.length, 0);
    if (material === 'crate') assert.equal(prop!.hp, prop!.maxHp - 22);
    if (material === 'canister') assert(Number.isFinite(prop!.armedAt));
  }
});

test('blade portals preserve their hostile damage, size and reflected velocity', () => {
  const { g, e } = fixture();
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 1400, y: 740 }));
  Body.setPosition(e.body, { x: 600, y: 650 });
  g.enemyShot(e, Math.PI / 2, 45, 22, e.body.position, true);
  g.updateShots(1 / 60);
  const s = g.shots[0];
  assert(s);
  near(s.pos.x, 1400);
  assert(s.vel.y < 0);
  assert(s.blade && !s.friendly);
  assert.equal(s.damage, 22);
  assert.equal(s.radius, 11);
});

test('pauses, impact pauses, phase changes, death and continuation cannot leak queued gusts or blades', () => {
  const { g, e } = fixture();
  step(g);
  until(g, () => e.state === 'rush');
  step(g, 3);
  const rig = structuredClone(e.turbine),
    timer = e.timer;
  g.setMode('paused');
  step(g, 120);
  assert.deepEqual(e.turbine, rig);
  near(e.timer, timer);
  g.setMode('playing');
  g.hitStop = 0.1;
  step(g, 5);
  assert.deepEqual(e.turbine, rig);
  near(e.timer, timer);
  g.hitStop = 0;
  e.hp = e.maxHp * 0.6;
  step(g);
  assert.equal(e.state, 'transition');
  assert.equal(e.turbine!.angles.length, 0);
  assert.equal(turbineWind(g, e, g.player.position), 0);
  let checkpoint: Checkpoint | null = null;
  g.onCheckpoint = (value) => {
    checkpoint = value;
  };
  g.save();
  assert(loadCheckpoint(checkpoint));
  const resumed = new Game();
  resumed.start(g.seed, checkpoint!);
  assert.equal(resumed.enemies[0].kind, 'turbine');
  assert.deepEqual(resumed.enemies[0].turbine!.angles, []);
  assert.equal(resumed.shots.length, 0);
  const shots = g.shots.length;
  g.hitEnemy(e, 999999);
  step(g, 180);
  assert.equal(g.enemies.length, 0);
  assert(g.shots.length <= shots);
  assert(!Composite.allBodies(g.engine.world).includes(e.body));
});

test('Turbine victories unlock only after defeat and old Condenser victories retain their original practice arena', () => {
  const seed = seedFor(),
    g = new Game(),
    victories: string[] = [];
  g.onBossDefeated = (kind) => victories.push(kind);
  g.start(seed, { version: 3, seed, stage: 8, hp: 100, mods: [], elapsed: 0, kills: 0 });
  const e = g.enemies[0];
  step(g, 45);
  g.hitEnemy(e, 100);
  assert.deepEqual(victories, []);
  assert.deepEqual(loadEncounters([]), []);
  g.hitEnemy(e, 999999);
  assert.deepEqual(victories, ['turbine']);
  const entry = loadEncounters([{ kind: 'turbine', seed }])[0];
  assert(entry);
  const checkpoint = practiceCheckpoint(entry)!;
  assert.equal(checkpoint.mods.length, 8);
  assert(g.startPractice(entry));
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 999999);
  step(g, 20);
  assert.equal(g.mode, 'won');
  assert.deepEqual(victories, ['turbine']);
  const old = loadEncounters([{ kind: 'condenser', seed }])[0];
  assert(old);
  assert(g.startPractice(old));
  assert.equal(g.level.id, 'condenser-hall');
  assert.equal(g.enemies[0].kind, 'condenser');
  assert.deepEqual(g.level, getLevel(seed, 8, 'condenser'));
});

for (const mirror of [false, true])
  test(`Turbine can be beaten with normal health and an eight-upgrade gun, mirror=${mirror}`, () => {
    const seed = seedFor(mirror),
      g = new Game();
    assert(g.startPractice({ kind: 'turbine', seed }));
    const e = g.enemies[0];
    for (let i = 0; i < 60 * 150 && g.mode === 'playing'; i++) step(g, 1, dodgePilot(g, e));
    assert.equal(
      g.mode,
      'won',
      `${g.hp} HP, ${Math.round(e.hp)} boss HP at ${JSON.stringify(g.player.position)}`,
    );
    assert(g.hp > 0);
    assert.equal(g.mods.length, 8);
    assert(g.shotCount > 20);
    assert.equal(g.enemies.length, 0);
    assert.equal(g.escape, null);
  });

test('the rotor finds pressure against overhead, corner and cover camps in either arena orientation', () => {
  for (const mirror of [false, true])
    for (const place of [
      { x: 45, y: 722 },
      { x: 355, y: 722 },
      { x: 1490, y: 160 },
    ]) {
      const seed = seedFor(mirror),
        g = new Game();
      g.start(seed, {
        version: 3,
        seed,
        stage: 8,
        hp: 100,
        kills: 0,
        elapsed: 0,
        mods: ['magnum', 'rapid', 'kick', 'airshot', 'scatter', 'ricochet', 'pierce', 'split'],
      });
      const e = g.enemies[0],
        x = mirror ? 2000 - place.x : place.x;
      Body.setPosition(g.player, { x, y: place.y });
      Body.setVelocity(g.player, { x: 0, y: 0 });
      for (let i = 0; i < 3600 && g.mode === 'playing' && e.hp > 0; i++) {
        const correction = x - g.player.position.x - g.player.velocity.x * 5;
        step(g, 1, {
          left: correction < -8,
          right: correction > 8,
          fire: true,
          aim: { ...e.body.position },
        });
      }
      assert.equal(
        g.mode,
        'dead',
        `${mirror} ${JSON.stringify(place)}: ${g.hp} player HP, ${e.hp} boss HP`,
      );
      assert(e.hp > 0 && g.shotCount > 15);
    }
});
