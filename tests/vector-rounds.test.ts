import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Shot, type Input } from '../src/game.ts';
import { VECTOR, steerVector } from '../src/vector-rounds.ts';
import {
  getGun,
  availableMods,
  validBuild,
  loadCheckpoint,
  seeded,
  rewardMods,
} from '../src/rules.ts';
import { vectorTestFromUrl, UPGRADE_TEST_BUILDS } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
const { Bodies, Body, Composite } = Matter;
const near = (a: number, b: number, tolerance = 1e-6) =>
  assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1500, y: 300 },
};
function fixture(mods = ['vector', 'afterburner']) {
  const g = new Game();
  g.start('vector-tests');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.destruction.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.mods = mods;
  g.gun = getGun(mods);
  g.aim = { x: 1400, y: 300 };
  Body.setPosition(g.player, { x: 200, y: 300 });
  return g;
}
function round(g: Game, extra: Partial<Shot> = {}) {
  g.addShot({
    pos: { x: 400, y: 300 },
    vel: { x: 22.5, y: 0 },
    damage: 24,
    life: 1.4,
    friendly: true,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
    ...extra,
  });
  return g.shots.at(-1)!;
}
function advance(g: Game, n = 1) {
  for (let i = 0; i < n; i++) {
    g.time += 1 / 60;
    g.updateShots(1 / 60);
  }
}
function target(g: Game, x: number, y: number, shield = false) {
  g.spawnEnemy('shooter', x, y, shield ? 'shielded' : undefined);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.hp = e.maxHp = 1000;
  e.facing = -1;
  return e;
}
function wall(g: Game, x: number, y: number, w: number, h: number) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function boost(g: Game, s: Shot) {
  // A 45-degree curve followed by a steady aiming point, using the same
  // steering and collision loop as real firing.
  g.aim = { x: 1400, y: 600 };
  for (let i = 0; i < 40 && s.life > 0 && !s.vector?.boosted; i++) advance(g);
  assert(s.vector?.boosted, 'curve never settled into Afterburner');
}
test('Vector is shared, its speed tradeoff composes in either order, and Afterburner requires it', () => {
  for (const path of [[], ['deadeye'], ['crossfire'], ['shellshock']]) {
    assert(availableMods(path).some((m) => m.id === 'vector'));
    assert(!availableMods(path).some((m) => m.id === 'afterburner'));
    assert(validBuild([...path, 'vector', 'afterburner']));
    near(getGun([...path, 'vector']).projectileSpeed, getGun(path).projectileSpeed * VECTOR.speed);
    near(getGun(['vector', ...path]).projectileSpeed, getGun(path).projectileSpeed * VECTOR.speed);
    near(getGun([...path, 'vector']).recoil, getGun(path).recoil);
    near(getGun([...path, 'vector']).damage, getGun(path).damage);
  }
  assert(!validBuild(['afterburner', 'vector']));
});
test('ordinary muzzle recoil and every pellet/rear round retain their initial direction', () => {
  for (const mods of [[], ['crossfire', 'scatter', 'backblast', 'backfire'], ['burst']]) {
    const a = fixture(mods),
      b = fixture([...mods, 'vector']);
    a.fireRound();
    b.fireRound();
    assert.deepEqual(b.player.velocity, a.player.velocity);
    assert.equal(b.shots.length, a.shots.length);
    for (const [i, s] of b.shots.entries()) {
      assert(s.vector);
      near(s.vel.x, a.shots[i].vel.x * VECTOR.speed);
      near(s.vel.y, a.shots[i].vel.y * VECTOR.speed);
      const old = { ...s.vel };
      steerVector(s, { x: s.pos.x - s.vel.y * 10, y: s.pos.y + s.vel.x * 10 }, VECTOR.grace);
      assert.deepEqual(s.vel, old);
    }
  }
});
test('steering follows the cursor at a bounded rate, never enemies, and runs out', () => {
  const g = fixture(['vector']),
    s = round(g);
  target(g, 1000, 300);
  g.aim = { x: 400, y: 2000 };
  advance(g, 4);
  assert(s.vel.y > 0);
  near(Math.atan2(s.vel.y, s.vel.x), VECTOR.turnRate / 60);
  const before = { ...g.player.velocity };
  for (let i = 0; i < 80; i++) {
    const a = Math.atan2(s.vel.y, s.vel.x) + Math.PI / 2;
    steerVector(s, { x: s.pos.x + Math.cos(a) * 1000, y: s.pos.y + Math.sin(a) * 1000 }, 1 / 60);
  }
  near(s.vector!.bent, VECTOR.turnBudget);
  const vel = { ...s.vel };
  steerVector(s, { x: -500, y: -500 }, 1);
  assert.deepEqual(s.vel, vel);
  assert.deepEqual(g.player.velocity, before);
  const straight = round(g);
  for (let i = 0; i < 100; i++) steerVector(straight, { x: 2000, y: 300 }, 1 / 60);
  const old = { ...straight.vel };
  steerVector(straight, { x: 400, y: 1000 }, 1 / 60);
  assert.deepEqual(straight.vel, old, 'guidance resumed after timeout');
});
test('a shaped shot curves around cover and reaches an enemy; aiming through cover still collides', () => {
  const g = fixture(['vector']);
  wall(g, 700, 430, 100, 260);
  const e = target(g, 1030, 350);
  const s = round(g, { pos: { x: 400, y: 240 } });
  g.aim = { x: 1400, y: 240 };
  advance(g, 17);
  assert(s.pos.x > 750 && s.pos.y < 300);
  g.aim = { ...e.body.position };
  advance(g, 30);
  assert(e.hp < e.maxHp, 'round missed after clearing cover');
  const stopped = round(g, { pos: { x: 400, y: 430 } });
  g.aim = { x: 1100, y: 430 };
  const hp = e.hp;
  advance(g, 30);
  assert(stopped.life <= 0);
  near(e.hp, hp);
});
test('Afterburner commits one curved round, accelerates once and scales direct and shell damage', () => {
  for (const extra of [[], ['shellshock']]) {
    const g = fixture(['vector', 'afterburner', ...extra]),
      s = round(g);
    const damage = s.damage,
      shell = s.shell?.damage,
      speed = Math.hypot(s.vel.x, s.vel.y);
    boost(g, s);
    near(s.damage, damage * 1.3);
    near(Math.hypot(s.vel.x, s.vel.y), speed * 1.35);
    if (shell) near(s.shell!.damage, shell * 1.3);
    const old = { ...s.vel };
    g.aim = { x: 0, y: 0 };
    advance(g, 2);
    assert.deepEqual(s.vel, old, 'boosted round kept steering');
    near(s.damage, damage * 1.3);
  }
  const g = fixture(),
    s = round(g);
  advance(g, 20);
  assert(!s.vector?.boosted, 'straight shots earned a free damage bonus');
});
test('banking preserves its exit direction and cannot repeat an Afterburner multiplier', () => {
  const g = fixture(['vector', 'afterburner', 'banker']),
    s = round(g, { bounces: 2, bankGrowth: 0.35 });
  boost(g, s);
  const damage = s.damage;
  wall(g, s.pos.x + 50, s.pos.y, 2, 400);
  advance(g, 2);
  assert(s.banks === 1);
  assert(s.vel.x < 0);
  near(s.damage, damage * 1.35);
  const old = { ...s.vel };
  advance(g, 1);
  assert.deepEqual(s.vel, old);
});
test('portals carry the actual velocity and remaining steering budget without a false trail', () => {
  const g = fixture(['vector', 'afterburner', 'fold']);
  assert(g.portals.place({ x: 0, y: 400 }));
  assert(g.portals.place({ x: 2000, y: 400 }));
  const s = round(g, { pos: { x: 25, y: 400 }, vel: { x: -40, y: 0 } });
  s.vector!.bent = 0.4;
  s.vector!.time = 0.2;
  g.aim = { x: 0, y: 400 };
  advance(g);
  assert(s.pos.x > 1900);
  assert(s.vel.x < 0);
  near(s.vector!.bent, 0.4);
  near(s.vector!.time, 0.2);
  assert(s.trace!.points.every((p) => p.x > 1900));
  advance(g, 2);
  assert(s.vel.x < 0, 'guidance erased portal exit velocity');
});
test('Recall owns its return, Convergence finishes its pattern, and secondary rounds stay independent', () => {
  const g = fixture(['vector', 'afterburner', 'recall']),
    s = round(g);
  s.recall!.age = 0.24;
  g.aim = { x: 1500, y: 700 };
  advance(g);
  assert(s.recall!.returning);
  assert(s.vel.x < 0);
  const time = s.vector!.time;
  advance(g, 3);
  near(s.vector!.time, time);
  const shape = round(g, {
    waypoints: [
      { x: 500, y: 300 },
      { x: 600, y: 200 },
    ],
  });
  const v = { ...shape.vel };
  steerVector(shape, { x: 0, y: 600 }, 0.2);
  assert.deepEqual(shape.vel, v);
  near(shape.vector!.time, 0);
  for (const extra of [
    { fragment: true },
    { friendly: false },
    { reflected: true },
    { rail: true },
    { echo: true },
  ])
    assert(!round(g, extra).vector);
});
test('piercing attenuation, shield armor and Fuse carry the boosted payload exactly once', () => {
  const g = fixture(['vector', 'afterburner', 'shellshock', 'fuse']);
  const s = round(g, { pierce: 1 });
  boost(g, s);
  const d = s.damage,
    shell = s.shell!.damage;
  const unit = {
    x: s.vel.x / Math.hypot(s.vel.x, s.vel.y),
    y: s.vel.y / Math.hypot(s.vel.x, s.vel.y),
  };
  const a = target(g, s.pos.x + unit.x * 70, s.pos.y + unit.y * 70);
  const b = target(g, s.pos.x + unit.x * 180, s.pos.y + unit.y * 180);
  advance(g, 9);
  near(a.maxHp - a.hp, d);
  near(b.maxHp - b.hp, d * 0.8);
  assert.equal(g.ballistics.shells.length, 1);
  near(g.ballistics.shells[0].damage, shell * 0.8 * 1.4);
  const shield = fixture(),
    shot = round(shield);
  boost(shield, shot);
  const e = target(shield, shot.pos.x + 70, shot.pos.y + (70 * shot.vel.y) / shot.vel.x, true);
  advance(shield, 5);
  near(e.maxHp - e.hp, shot.damage * 0.1);
});
test('echoes and Orbit releases do not duplicate steering or Afterburner charges', () => {
  const g = fixture(['crossfire', 'afterimage', 'vector', 'afterburner']);
  for (let i = 0; i < 4; i++) g.fireRound();
  assert(g.ballistics.echoes.length > 0);
  g.time = 1;
  g.ballistics.update();
  const echoes = g.shots.filter((s) => s.echo);
  assert(echoes.length > 0);
  assert(echoes.every((s) => !s.vector));
  const orbit = fixture(['crossfire', 'recall', 'afterimage', 'orbit', 'vector', 'afterburner']);
  const s = round(orbit);
  s.recall!.returning = true;
  orbit.fusions.catch(s);
  orbit.fusions.release({ x: 1, y: 0 });
  assert(orbit.shots.some((s) => s.orbitReleased && !s.vector));
});
test('pause, hitstop and retry preserve the right flight state without writing progress', () => {
  const save = vectorTestFromUrl(new URL('https://test/?test=vector'))!;
  const g = new Game();
  g.startTest(save);
  let writes = 0;
  g.onCheckpoint = () => writes++;
  g.onBossDefeated = () => writes++;
  const s = round(g),
    before = structuredClone(s);
  g.setMode('paused');
  for (let i = 0; i < 30; i++) g.tick(1 / 60, idle);
  assert.deepEqual(s, before);
  g.setMode('playing');
  g.hitStop = 0.1;
  g.tick(1 / 60, idle);
  assert.deepEqual(s, before);
  g.save();
  g.startTest(save);
  assert.equal(g.shots.length, 0);
  assert.equal(g.hp, 100);
  assert.equal(writes, 0);
});
test('direct test links and upgrade picker builds are valid and reject conflicting parameters', () => {
  for (const build of ['base', 'evolved', 'volley', 'shell', 'portal']) {
    const save = vectorTestFromUrl(new URL('https://test/?test=vector&build=' + build))!;
    assert(save);
    assert(validBuild(save.mods));
    assert.deepEqual(loadCheckpoint(save), save);
    const g = new Game();
    g.startTest(save);
    assert.equal(g.mode, 'playing');
    assert.equal(g.gun.projectileSpeed, getGun(save.mods).projectileSpeed);
  }
  assert(validBuild(UPGRADE_TEST_BUILDS.vector));
  for (const suffix of [
    '&test=vector',
    '&build=nope',
    '&build=base&build=evolved',
    ...[
      'daily',
      'dv',
      'seed',
      'area',
      'formation',
      'route',
      'mode',
      'layout',
      'variant',
      'mirror',
      'phase',
    ].map((k) => '&' + k + '=x'),
  ])
    assert.equal(vectorTestFromUrl(new URL('https://test/?test=vector' + suffix)), null, suffix);
});
test('seeded rewards can reach both upgrades in order and Daily reconstruction remains deterministic', () => {
  let found = false;
  for (let i = 0; i < 60; i++) {
    const seed = dailyForDate(new Date(Date.UTC(2026, 8, i + 1)).toISOString().slice(0, 10))!.seed;
    const choose = () => {
      const mods: string[] = [];
      const rng = seeded(seed);
      for (let j = 0; j < 19; j++) {
        const offer = rewardMods(mods, 1, rng, { stage: j });
        if (offer.length) mods.push(offer[0].id);
      }
      return mods;
    };
    const a = choose();
    assert.deepEqual(a, choose());
    assert(validBuild(a));
    if (a.includes('afterburner')) {
      assert(a.indexOf('afterburner') > a.indexOf('vector'));
      found = true;
    }
  }
  assert(found);
});
test('dense guided volleys stay bounded, finite and reproducible across legal build paths', () => {
  for (const path of [
    ['crossfire', 'afterimage', 'convergence'],
    ['deadeye', 'rivet', 'fracture'],
    ['shellshock', 'fuse', 'aftershock'],
  ]) {
    const mods = [
      ...path,
      'vector',
      'afterburner',
      'scatter',
      'rapid',
      'backblast',
      'backfire',
      'ricochet',
    ];
    assert(validBuild(mods));
    const run = () => {
      const g = fixture(mods);
      let peak = 0;
      for (let i = 0; i < 180; i++) {
        g.aim = { x: 1050 + Math.cos(i / 17) * 350, y: 330 + Math.sin(i / 13) * 220 };
        if (i % 4 === 0) g.fireRound();
        advance(g);
        g.ballistics.update();
        g.demolition.update();
        peak = Math.max(peak, g.shots.length);
        assert(g.shots.length <= 180);
        assert(g.ballistics.shells.length <= 48);
        for (const s of g.shots) {
          assert([s.pos.x, s.pos.y, s.vel.x, s.vel.y, s.damage, s.life].every(Number.isFinite));
          assert((s.trace?.points.length ?? 0) <= 8);
          assert((s.vector?.bent ?? 0) <= VECTOR.turnBudget + 1e-8);
        }
      }
      assert(peak > 30);
      return g.shots.map((s) => [s.pos.x, s.pos.y, s.damage, s.vector?.boosted]);
    };
    assert.deepEqual(run(), run());
  }
});
