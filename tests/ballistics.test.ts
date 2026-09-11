import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Enemy, Input, Shot } from '../src/game.ts';
import {
  MODS,
  MOD_REQUIRES,
  availableMods,
  getGun,
  validBuild,
  loadCheckpoint,
  rewardMods,
  seeded,
} from '../src/rules.ts';
import { CHARGE_TIME, ECHO_DELAY, FUSE_TIME, FUSE_LIMIT, ECHO_LIMIT } from '../src/ballistics.ts';
import { UPGRADE_TEST_BUILDS, upgradeTestFromUrl } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
const { Body, Bodies, Composite, Engine } = Matter;
const near = (a: number, b: number, eps = 1e-5) => assert(Math.abs(a - b) < eps, `${a} != ${b}`);
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1300, y: 400 },
};
function fixture(mods: string[] = []) {
  const g = new Game();
  g.start('ballistics');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.conveyors.clear();
  g.freight.clear();
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.mods = mods;
  g.gun = getGun(mods);
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 500, y: 400 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.aim = { ...idle.aim };
  g.grounded = false;
  return g;
}
function target(g: Game, x = 740, y = 400, kind: Enemy['kind'] = 'shooter') {
  g.spawnEnemy(kind, x, y);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  e.hp = e.maxHp = 10000;
  return e;
}
function wall(g: Game, x: number, y = 400, w = 12, h = 200) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function shot(g: Game, x: number, y = 400, vx = 30, vy = 0, friendly = true) {
  g.addShot({
    pos: { x, y },
    vel: { x: vx, y: vy },
    damage: 24,
    life: 1.4,
    friendly,
    radius: friendly ? 2.5 : 5,
    bounces: g.gun.bounces,
    pierce: g.gun.pierce,
    bankGrowth: g.gun.bankGrowth,
    fragment: false,
    split: false,
  });
  return g.shots.at(-1)!;
}
function step(g: Game, n = 1) {
  for (let i = 0; i < n && g.mode === 'playing'; i++) {
    g.time += 1 / 60;
    g.ballistics.update();
    g.updateShots(1 / 60);
    g.demolition.update();
  }
}
function ancestors(id: string): string[] {
  return MOD_REQUIRES[id] ? [...ancestors(MOD_REQUIRES[id]), MOD_REQUIRES[id]] : [];
}

test('twelve upgrades have legal prerequisite chains, path locks, saves and reachable rewards', () => {
  const ids = [
    'recall',
    'homecoming',
    'capacitor',
    'reserve-cell',
    'countershot',
    'reprisal',
    'rivet',
    'fracture',
    'fuse',
    'linked-fuse',
    'afterimage',
    'parallax',
  ];
  assert.equal(MODS.length, 44);
  for (const id of ids) {
    const parents = ancestors(id),
      build = [...parents, id];
    assert(availableMods(parents).some((m) => m.id === id));
    assert(validBuild(build));
    if (parents.length) assert(!availableMods([]).some((m) => m.id === id));
    assert(
      loadCheckpoint({
        version: 5,
        seed: 'new-mod',
        stage: 6,
        hp: 80,
        mods: build,
        kills: 0,
        elapsed: 0,
      }),
    );
    assert(
      Array.from({ length: 80 }, (_, i) => rewardMods(parents, 3, seeded(id + i)))
        .flat()
        .some((m) => m.id === id),
    );
  }
  assert(!validBuild(['deadeye', 'afterimage']));
  assert(!validBuild(['crossfire', 'rivet']));
  for (const mods of [
    ['recall', 'pierce'],
    ['pierce', 'recall'],
  ])
    assert.equal(getGun(mods).pierce, 3);
});

test('Recall returns through the same enemy and moving the player changes the return angle', () => {
  const g = fixture(['recall', 'pierce']),
    e = target(g, 720);
  const s = shot(g, 530);
  step(g, 14);
  const firstHp = e.hp;
  assert(firstHp < 10000);
  assert(!s.recall?.returning);
  step(g, 1);
  assert(s.recall?.returning);
  Body.setPosition(g.player, { x: 500, y: 420 });
  step(g, 35);
  assert(e.hp < firstHp, `return missed: ${e.hp} ${firstHp}`);
  assert(s.vel.y !== 0);
  assert.equal(g.hp, 100);
});

test('Recall catches without self damage and wall returns obey solid cover', () => {
  const g = fixture(['recall']);
  wall(g, 700);
  const s = shot(g, 530);
  step(g, 6);
  assert(s.recall?.returning);
  assert(s.vel.x < 0);
  assert(s.pos.x < 700);
  step(g, 14);
  assert(!g.shots.includes(s));
  assert.equal(g.hp, 100);
  const h = fixture(['recall']);
  const shield = wall(h, 700);
  const e = target(h, 760);
  shot(h, 530);
  step(h, 80);
  assert.equal(e.hp, 10000);
  assert(h.terrain.includes(shield));
});

test('Homecoming adds return penetration and removes attenuation only on that leg', () => {
  const g = fixture(['recall', 'homecoming']);
  Body.setPosition(g.player, { x: 1200, y: 400 });
  const a = target(g, 730),
    b = target(g, 850);
  const s = shot(g, 650);
  g.ballistics.turn(s);
  s.recall!.skip.clear();
  s.vel.x = 30;
  assert.equal(s.pierce, g.gun.pierce + 2);
  step(g, 9);
  near(10000 - a.hp, 24);
  near(10000 - b.hp, 24);
});

test('Capacitor uses active idle time, doubles exactly one discharge and retains normal air recoil', () => {
  const g = fixture(['capacitor', 'scatter', 'burst', 'backblast', 'backfire']);
  for (let i = 0; i < 50; i++) g.tick(1 / 60, idle);
  assert.equal(g.ballistics.charges, 0);
  g.tick(1 / 60, idle);
  assert.equal(g.ballistics.charges, 1);
  const base = getGun(g.mods).damage;
  g.fire();
  assert.equal(g.shots.length, 10);
  assert(g.shots.every((s) => s.damage === base * 2));
  near(Math.hypot(g.player.velocity.x, g.player.velocity.y), g.gun.recoil);
  g.time += 0.07;
  g.fireRound();
  assert(g.shots.slice(10).every((s) => s.damage === base));
  assert.equal(g.ballistics.charges, 0);
});

test('Reserve cell stores two discharges, caps there, and holding fire cannot recharge a slow gun', () => {
  const g = fixture(['capacitor', 'reserve-cell', 'magnum']);
  for (let i = 0; i < 160; i++) g.tick(1 / 60, idle);
  assert.equal(g.ballistics.charges, 2);
  g.fire();
  assert.equal(g.ballistics.charges, 1);
  g.time += 1;
  g.fire();
  assert.equal(g.ballistics.charges, 0);
  for (let i = 0; i < 140; i++) g.tick(1 / 60, { ...idle, fire: true });
  assert.equal(g.ballistics.charges, 0);
});

test('Countershot detects crossing moving rounds and reflection damages its source', () => {
  const g = fixture(['countershot']),
    e = target(g, 900);
  const outgoing = shot(g, 670, 400, 80),
    incoming = shot(g, 765, 400, -80, 0, false);
  incoming.source = { ...e.body.position };
  step(g);
  assert(incoming.reflected);
  assert(incoming.friendly);
  assert.equal(outgoing.counter, 0);
  assert(incoming.vel.x > 0);
  assert(incoming.fragment);
  step(g, 12);
  assert(e.hp < 10000);
  assert.equal(g.hp, 100);
});

test('Countershot cannot intercept through nearer walls, enemies, the player or blades', () => {
  for (const obstacle of ['wall', 'enemy', 'player', 'blade']) {
    const g = fixture(['countershot']);
    shot(g, 650, 400, 120);
    const b = shot(g, 810, 400, -120, 0, false);
    if (obstacle === 'wall') wall(g, 705);
    if (obstacle === 'enemy') target(g, 695);
    if (obstacle === 'player') Body.setPosition(g.player, { x: 770, y: 400 });
    if (obstacle === 'blade') {
      b.blade = true;
      b.radius = 11;
    }
    step(g);
    assert(!b.reflected, obstacle);
  }
});

test('a returning round cannot reflect a bullet beyond its catch point', () => {
  const g = fixture(['recall', 'countershot']);
  const a = shot(g, 470, 400, 100),
    b = shot(g, 590, 400, -50, 0, false);
  a.recall!.returning = true;
  step(g);
  assert(!g.shots.includes(a));
  assert(!b.reflected);
});

test('one round reflects only one bullet; Reprisal penetrates multiple targets without recursive modifiers', () => {
  const g = fixture(['countershot', 'reprisal', 'split']);
  const s = shot(g, 600, 400, 100),
    a = shot(g, 750, 400, -60, 0, false),
    b = shot(g, 770, 400, -60, 0, false);
  step(g);
  assert.equal([a, b].filter((s) => s.reflected).length, 1);
  assert.equal(s.counter, 0);
  const reflected = [a, b].find((s) => s.reflected)!;
  g.shots = [reflected];
  assert.equal(reflected.pierce, 2);
  assert(!reflected.counter && !reflected.recall && !reflected.shell);
  const x = target(g, 900),
    y = target(g, 1010);
  step(g, 20);
  assert(x.hp < 10000 && y.hp < 10000);
  assert(!g.shots.some((s) => s.fragment && !s.reflected));
});

test('Rivet sweeps enemies against walls, pins briefly, and cannot chain-stun them', () => {
  const g = fixture(['deadeye', 'rivet']),
    e = target(g, 735, 400, 'runner');
  wall(g, 800);
  shot(g, 680);
  step(g, 2);
  assert(g.ballistics.pins.has(e.id));
  const p = { ...e.body.position };
  assert(p.x < 800);
  for (let i = 0; i < 30; i++) {
    g.time += 1 / 60;
    g.updateEnemy(e, 1 / 60);
    Engine.update(g.engine, 1000 / 60);
  }
  near(e.body.position.x, p.x);
  near(e.body.position.y, p.y);
  const until = g.ballistics.pins.get(e.id)!.until;
  shot(g, p.x - 35);
  step(g);
  assert.equal(g.ballistics.pins.get(e.id)!.until, until);
  g.time = until + 0.01;
  assert(!g.ballistics.pinned(e));
  shot(g, p.x - 35);
  step(g);
  assert(!g.ballistics.pins.has(e.id));
});

test('Rivet respects props and player hulls; bosses and frontal shields resist pins', () => {
  for (const kind of [
    'loader',
    'crane',
    'press',
    'kiln',
    'condenser',
    'turbine',
    'interceptor',
    'boss',
  ] as const) {
    const g = fixture(['deadeye', 'rivet']);
    const e = target(g, 735, 400, kind);
    wall(g, 820);
    const p = { ...e.body.position };
    g.ballistics.rivet(e, shot(g, 680));
    assert(!g.ballistics.pins.has(e.id));
    assert.deepEqual(e.body.position, p);
  }
  const g = fixture(['deadeye', 'rivet']);
  const e = target(g, 735, 400, 'runner');
  const crate = g.props.spawn('crate', 790, 400);
  const s = shot(g, 680);
  g.ballistics.rivet(e, s);
  assert(e.body.bounds.max.x <= crate.body.bounds.min.x + 1);
  assert(!g.ballistics.pins.has(e.id));
  const h = fixture(['deadeye', 'rivet']);
  const shield = target(h, 735, 400, 'runner');
  shield.elite = 'shielded';
  shield.facing = -1;
  wall(h, 800);
  shot(h, 680);
  step(h, 2);
  assert(!h.ballistics.pins.has(shield.id));
});

test('Fracture applies once to a subsequent projectile and pin ends if its wall disappears', () => {
  const g = fixture(['deadeye', 'rivet', 'fracture']),
    e = target(g, 735);
  const b = wall(g, 800);
  shot(g, 680);
  step(g, 2);
  assert(g.ballistics.pins.has(e.id));
  const hp = e.hp;
  shot(g, e.body.position.x - 35);
  step(g);
  near(hp - e.hp, 24 * 1.6);
  const next = e.hp;
  shot(g, e.body.position.x - 35);
  step(g);
  near(next - e.hp, 24);
  g.terrain = g.terrain.filter((x) => x !== b);
  Composite.remove(g.engine.world, b);
  assert(!g.ballistics.pinned(e));
});

test('frontal shield hits neither spend nor receive the Fracture bonus', () => {
  const g = fixture(['deadeye', 'rivet', 'fracture']),
    e = target(g, 735, 400, 'runner');
  wall(g, 800);
  shot(g, 680);
  step(g, 2);
  e.elite = 'shielded';
  e.facing = -1;
  const hp = e.hp;
  shot(g, e.body.position.x - 35);
  step(g);
  near(hp - e.hp, 24 * 0.1);
  assert(!g.ballistics.pins.get(e.id)!.fractured);
  e.facing = 1;
  const next = e.hp;
  shot(g, e.body.position.x - 35);
  step(g);
  near(next - e.hp, 24 * 1.6);
  assert(g.ballistics.pins.get(e.id)!.fractured);
});

test('Fuse delays a stronger blast and follows a moving, rotating crate', () => {
  const g = fixture(['shellshock', 'fuse']);
  const crate = g.props.spawn('crate', 740, 400);
  shot(g, 680);
  step(g, 2);
  assert.equal(g.ballistics.shells.length, 1);
  assert.equal(g.demolition.effects.length, 0);
  const fuse = g.ballistics.shells[0],
    initial = { ...fuse.pos };
  Body.setPosition(crate.body, { x: 850, y: 430 });
  Body.setAngle(crate.body, Math.PI / 2);
  g.ballistics.update();
  assert(fuse.pos.x > initial.x + 80);
  assert(fuse.pos.y < 430);
  const e = target(g, fuse.pos.x - 25, fuse.pos.y);
  g.time = fuse.at - 0.001;
  g.ballistics.update();
  assert.equal(e.hp, 10000);
  g.time = fuse.at;
  g.ballistics.update();
  assert(e.hp < 10000);
  assert.equal(g.ballistics.shells.length, 0);
  near(g.demolition.effects[0].damage, 24 * 0.85 * 1.4);
});

test('Fuse attaches to enemies, survives host death, and its explosions respect cover', () => {
  const g = fixture(['shellshock', 'fuse']);
  const e = target(g, 735);
  shot(g, 680);
  step(g, 2);
  const fuse = g.ballistics.shells[0];
  assert.equal(fuse.body, e.body);
  g.hitEnemy(e, 20000);
  g.ballistics.update();
  assert(!fuse.body);
  wall(g, 750);
  const other = target(g, 790);
  g.time = fuse.at;
  g.ballistics.update();
  assert.equal(other.hp, 10000);
  assert.equal(g.ballistics.shells.length, 0);
});

test('Linked fuse ignites only nearby visible charges with a finite delay', () => {
  const g = fixture(['shellshock', 'fuse', 'linked-fuse']);
  const a = shot(g, 600),
    b = shot(g, 640),
    c = shot(g, 720);
  for (const s of [a, b, c]) g.demolition.impact(s);
  const [first, next, covered] = g.ballistics.shells;
  first.at = 0.1;
  next.at = covered.at = 1;
  wall(g, 680);
  g.time = 0.1;
  g.ballistics.update();
  near(next.at, 0.16);
  near(covered.at, 1);
  g.time = 0.17;
  g.ballistics.update();
  assert.equal(g.ballistics.shells.length, 1);
  g.time = 1.01;
  g.ballistics.update();
  assert.equal(g.ballistics.shells.length, 0);
});

test('Fuse composes with bank growth, piercing, aftershock and real delayed blast surfing', () => {
  const g = fixture(['shellshock', 'fuse', 'blast-surf', 'aftershock', 'banker', 'pierce']);
  wall(g, 680);
  const s = shot(g, 600);
  step(g, 3);
  assert.equal(s.banks, 1);
  assert.equal(g.ballistics.shells.length, 0);
  g.demolition.impact(s);
  const fuse = g.ballistics.shells[0];
  near(fuse.damage, 24 * 0.85 * 1.35 * 1.4);
  Body.setPosition(g.player, { x: fuse.pos.x - 35, y: fuse.pos.y - 10 });
  g.time = fuse.at;
  g.ballistics.update();
  assert(Math.hypot(g.player.velocity.x, g.player.velocity.y) > 0);
  assert.equal(g.demolition.pending.length, 1);
});

test('Afterimage copies exactly the fourth discharge, preserves origin, and never repeats recursively', () => {
  const g = fixture(['crossfire', 'afterimage', 'scatter', 'backblast', 'backfire', 'recall']);
  for (let i = 0; i < 4; i++) {
    g.time += 0.3;
    g.fireRound();
  }
  assert.equal(g.ballistics.echoes.length, 1);
  const echo = g.ballistics.echoes[0];
  assert.equal(echo.shots.length, 30);
  const damage = echo.shots[0].damage;
  Body.setPosition(g.player, { x: 700, y: 420 });
  const velocity = { ...g.player.velocity },
    count = g.shotCount;
  g.shots = [];
  g.time = echo.at - 0.001;
  g.ballistics.update();
  assert.equal(g.shots.length, 0);
  g.time = echo.at;
  g.ballistics.update();
  assert.equal(g.shots.length, 30);
  near(g.shots[0].damage, damage * 0.6);
  assert(g.shots.every((s) => s.echo));
  assert(g.shots[0].pos.x < 600);
  assert.deepEqual(g.player.velocity, velocity);
  assert.equal(g.shotCount, count);
  step(g, 120);
  assert.equal(g.ballistics.echoes.length, 0);
});

test('Parallax turns the stored firing geometry to the current aim while basic Afterimage keeps its angle', () => {
  for (const parallax of [false, true]) {
    const g = fixture(['crossfire', 'afterimage', ...(parallax ? ['parallax'] : [])]);
    for (let i = 0; i < 4; i++) g.fireRound();
    const echo = g.ballistics.echoes[0];
    g.aim = { x: echo.origin.x, y: 150 };
    g.shots = [];
    g.time = echo.at;
    g.ballistics.update();
    const center = g.shots[1];
    if (parallax) {
      near(center.vel.x, 0);
      assert(center.vel.y < 0);
    } else {
      assert(center.vel.x > 0);
      near(center.vel.y, 0);
    }
  }
});

test('Afterimage respects newly occupied origins and blocked muzzles; snapshots do not consume charges', () => {
  const g = fixture(['crossfire', 'afterimage', 'capacitor', 'reserve-cell']);
  g.ballistics.charges = 2;
  for (let i = 0; i < 4; i++) g.fireRound();
  const echo = g.ballistics.echoes[0];
  wall(g, echo.origin.x);
  g.shots = [];
  g.ballistics.charges = 1;
  g.time = echo.at;
  g.ballistics.update();
  assert.equal(g.shots.length, 0);
  assert.equal(g.ballistics.charges, 1);
  const h = fixture(['crossfire', 'afterimage']);
  for (let i = 0; i < 4; i++) h.fireRound();
  const second = h.ballistics.echoes[0];
  const wallBody = wall(h, 520);
  h.shots = [];
  h.time = second.at;
  h.ballistics.update();
  assert(h.shots.every((s) => s.pos.x <= wallBody.bounds.min.x));
  step(h);
  assert(!h.shots.length);
});

test('pause and hitstop freeze charge, fuse and echo clocks; rooms, death and retry clear transient state', () => {
  const g = fixture(['shellshock', 'fuse', 'capacitor']);
  const s = shot(g, 600);
  g.demolition.impact(s);
  g.ballistics.charge(CHARGE_TIME, false);
  const time = g.time,
    at = g.ballistics.shells[0].at;
  g.setMode('paused');
  for (let i = 0; i < 100; i++) g.tick(1 / 60, idle);
  near(g.time, time);
  near(g.ballistics.shells[0].at, at);
  assert.equal(g.ballistics.charges, 1);
  g.setMode('playing');
  g.hitStop = 0.1;
  for (let i = 0; i < 5; i++) g.tick(1 / 60, idle);
  near(g.time, time);
  assert.equal(g.ballistics.shells.length, 1);
  g.setMode('dead');
  assert.equal(g.ballistics.shells.length, 0);
  assert.equal(g.ballistics.charges, 0);
  g.start('again');
  assert.equal(g.ballistics.pins.size, 0);
  assert.equal(g.ballistics.echoes.length, 0);
});

test('all six test presets retry safely, preserve normal saves and use valid build paths', () => {
  const g = new Game();
  let writes = 0,
    unlocks = 0;
  g.onCheckpoint = () => writes++;
  g.onBossDefeated = () => unlocks++;
  for (const key of Object.keys(UPGRADE_TEST_BUILDS)) {
    const save = upgradeTestFromUrl(new URL('https://example.com/?test=upgrades&build=' + key))!;
    assert(loadCheckpoint(save));
    assert(validBuild(save.mods));
    g.startTest(save);
    const layout = g.level.id;
    g.hp = 20;
    g.die();
    g.startTest(g.testRun!);
    assert.equal(g.hp, 100);
    assert.equal(g.level.id, layout);
    assert.deepEqual(g.mods, save.mods);
  }
  assert.equal(writes, 0);
  assert.equal(unlocks, 0);
  for (const query of [
    '?test=upgrades&build=bad',
    '?test=upgrades&build=recall&build=fuse',
    '?test=upgrades&test=upgrades',
    '?test=upgrades&daily=2026-09-10',
    '?test=upgrades&seed=x',
    '?test=upgrades&area=rooftops',
  ])
    assert.equal(upgradeTestFromUrl(new URL('https://example.com/' + query)), null);
  assert(upgradeTestFromUrl(new URL('https://example.com/?test=upgrades')));
  const daily = dailyForDate('2026-09-10')!;
  const a = new Game(),
    b = new Game();
  a.start(daily.seed);
  b.start(daily.seed);
  for (let i = 0; i < 15; i++) {
    a.openReward();
    b.openReward();
    assert.equal(a.offers.length, 1);
    assert.deepEqual(a.offers, b.offers);
    a.chooseMod(a.offers[0].id);
    b.chooseMod(b.offers[0].id);
  }
});

test('dense combinations stay bounded, finite and deterministic without changing gameplay RNG for visuals', () => {
  for (const mods of [
    [
      'crossfire',
      'afterimage',
      'parallax',
      'scatter',
      'rapid',
      'burst',
      'recall',
      'homecoming',
      'countershot',
      'split',
      'bloom',
      'backblast',
      'backfire',
    ],
    [
      'shellshock',
      'fuse',
      'linked-fuse',
      'aftershock',
      'chain-reaction',
      'blast-surf',
      'scatter',
      'rapid',
      'burst',
      'recall',
      'homecoming',
      'ricochet',
      'pierce',
    ],
  ]) {
    assert(validBuild(mods));
    const g = fixture(mods);
    wall(g, 800);
    wall(g, 450);
    for (let i = 0; i < 600; i++) {
      if (i % 3 === 0) g.fireRound();
      step(g);
      assert(g.shots.length <= 180);
      assert(g.ballistics.shells.length <= FUSE_LIMIT);
      assert(g.ballistics.echoes.filter((e) => !e.fired).length <= ECHO_LIMIT);
      for (const s of g.shots)
        assert(Number.isFinite(s.pos.x + s.pos.y + s.vel.x + s.vel.y + s.damage));
    }
    g.shots = [];
    step(g, 150);
    assert.equal(g.ballistics.shells.length, 0);
    assert.equal(g.ballistics.echoes.length, 0);
  }
});

test('Recall and Countershot retain their behavior after actual portal transit', () => {
  const g = fixture(['fold', 'recall', 'countershot']);
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 1100, y: 740 }));
  const s = shot(g, 600, 710, 0, 45);
  step(g);
  assert(s.pos.x > 1000);
  assert(s.recall && s.counter === 1);
  assert(s.vel.y < 0);
  const b = shot(g, s.pos.x, s.pos.y - 55, 0, 35, false);
  step(g);
  assert(b.reflected);
  assert(s.counter === 0);
  assert(s.recall);
  step(g, 18);
  assert(s.recall.returning);
  assert.equal(g.hp, 100);
});

test('a stuck fuse travels through a portal on its host and still detonates at the new position', () => {
  const g = fixture(['fold', 'shellshock', 'fuse']);
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 1100, y: 740 }));
  const crate = g.props.spawn('crate', 600, 700),
    s = shot(g, 600, 675, 0, 30);
  g.demolition.impact(s, crate.body);
  const fuse = g.ballistics.shells[0];
  Body.setVelocity(crate.body, { x: 0, y: 18 });
  for (let i = 0; i < 5 && crate.body.position.x < 1000; i++) {
    g.time += 1 / 60;
    g.portals.beforeStep();
    Engine.update(g.engine, 1000 / 60);
    g.ballistics.update();
  }
  assert(crate.body.position.x > 1000);
  assert(fuse.pos.x > 1000);
  g.time = fuse.at;
  g.ballistics.update();
  assert(g.demolition.effects[0].pos.x > 1000);
});

test('sustained Countershot pressure stays bounded and small bullets remain dangerous outside the firing lane', () => {
  const g = fixture(['countershot', 'reprisal', 'scatter', 'crossfire', 'rapid', 'burst']);
  const shooter = target(g, 1050);
  for (let i = 0; i < 240; i++) {
    if (i % 3 === 0) {
      g.fireRound();
      g.enemyShot(shooter, Math.PI);
    }
    step(g);
    assert(g.shots.length <= 180);
  }
  g.shots = [];
  const side = shot(g, 500, 330, 0, 30, false);
  step(g, 3);
  assert(!side.reflected);
  assert(g.hp < 100);
});
