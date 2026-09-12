import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Shot, type Input } from '../src/game.ts';
import {
  availableMods,
  getGun,
  loadCheckpoint,
  validBuild,
  rewardMods,
  seeded,
  distance,
} from '../src/rules.ts';
import { tetherTestFromUrl } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
import { TETHER_LIFE, TETHER_MARK_LIFE } from '../src/tethers.ts';
const { Body, Bodies, Composite, Engine, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1200, y: 400 },
};
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function fixture(mods = ['tether']) {
  const g = new Game();
  g.start('tether-tests');
  g.stage = 8;
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.conveyors.clear();
  g.destruction.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.level.solids = [];
  g.level.route = [];
  g.mods = mods;
  g.gun = getGun(mods);
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 1500, y: 400 });
  return g;
}
function target(g: Game, x: number, y = 400, kind: Enemy['kind'] = 'charger') {
  g.spawnEnemy(kind, x, y);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  return e;
}
function fire(g: Game, e: Enemy, extra: Partial<Shot> = {}) {
  g.addShot({
    pos: { x: e.body.position.x - 40, y: e.body.position.y },
    vel: { x: 32, y: 0 },
    damage: 8,
    life: 1,
    friendly: true,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
    ...extra,
  });
  const s = g.shots.at(-1)!;
  g.updateShots(1 / 60);
  return s;
}
function link(g: Game, a: Enemy, b: Enemy) {
  fire(g, a);
  fire(g, b);
  assert(g.tethers.link);
  return g.tethers.link;
}
function physics(g: Game, count = 1) {
  for (let i = 0; i < count; i++) {
    g.time += 1 / 60;
    g.hitStop = 0;
    g.tethers.beforeStep(1 / 60);
    g.props.beforeStep();
    g.portals.beforeStep();
    Engine.update(g.engine, 1000 / 60);
    g.props.afterStep(1 / 60);
    g.tethers.afterStep();
  }
}
function wall(g: Game, x: number, y = 400, width = 12, height = 180) {
  const b = Bodies.rectangle(x, y, width, height, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}

test('Tether rounds and Snapback are shared, legal rewards with a required parent and unchanged gun stats', () => {
  for (const path of [[], ['deadeye'], ['crossfire'], ['shellshock']]) {
    assert(availableMods(path).some((m) => m.id === 'tether'));
    assert(!availableMods(path).some((m) => m.id === 'snapback'));
    const mods = [...path, 'tether', 'snapback'];
    assert(validBuild(mods));
    assert.deepEqual(getGun(mods), getGun(path));
    assert(
      loadCheckpoint({
        version: 5,
        seed: 'tether-save',
        stage: 6,
        hp: 80,
        mods,
        kills: 0,
        elapsed: 0,
      }),
    );
  }
  assert(!validBuild(['snapback', 'tether']));
  for (const id of ['tether', 'snapback'])
    assert(
      Array.from({ length: 80 }, (_, i) =>
        rewardMods(id === 'snapback' ? ['tether'] : [], 3, seeded(id + i)),
      )
        .flat()
        .some((m) => m.id === id),
    );
});
test('actual primary hits create one cable; repeated shots never refresh or replace it', () => {
  const g = fixture(),
    a = target(g, 500),
    b = target(g, 700),
    c = target(g, 880);
  fire(g, a);
  assert.equal(g.tethers.mark?.enemy, a);
  const expiry = g.tethers.mark!.until;
  g.time += 0.4;
  fire(g, a);
  assert.equal(g.tethers.mark!.until, expiry);
  fire(g, b);
  const l = g.tethers.link!;
  assert.equal(l.a, a);
  assert.equal(l.b, b);
  assert.equal(g.tethers.mark, null);
  g.time += 1;
  fire(g, c);
  assert.equal(g.tethers.link, l);
  near(l.until, TETHER_LIFE + 0.4);
});
test('fragments, echoes, reflected bullets, zero damage and unavailable targets cannot create hooks', () => {
  for (const extra of [{ fragment: true }, { echo: true }, { reflected: true }, { damage: 0 }]) {
    const g = fixture(),
      a = target(g, 500);
    fire(g, a, extra);
    assert.equal(g.tethers.mark, null);
  }
  const g = fixture(),
    a = target(g, 500);
  a.spawn = 0.5;
  const s = fire(g, a);
  assert.equal(g.tethers.mark, null);
  a.spawn = 0;
  s.friendly = false;
  g.tethers.hit(a, s);
  assert.equal(g.tethers.mark, null);
  s.friendly = true;
  a.hp = 0;
  g.tethers.hit(a, s);
  assert.equal(g.tethers.mark, null);
  const plain = fixture([]),
    e = target(plain, 500);
  fire(plain, e);
  assert.equal(plain.tethers.mark, null);
});
test('shield fronts and lethal hits do not create an invisible or dead anchor', () => {
  const g = fixture();
  g.spawnEnemy('runner', 500, 400, 'shielded');
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.facing = -1;
  fire(g, e);
  assert.equal(g.tethers.mark, null);
  e.facing = 1;
  fire(g, e);
  assert.equal(g.tethers.mark?.enemy, e);
  fire(g, e, { damage: 999 });
  assert.equal(g.tethers.mark, null);
});
test('one piercing round can link two targets; Recall cannot hook the same target twice', () => {
  const g = fixture(['tether', 'recall']),
    a = target(g, 500),
    b = target(g, 565);
  fire(g, a, { vel: { x: 120, y: 0 }, pierce: 2 });
  assert.equal(g.tethers.link?.a, a);
  assert.equal(g.tethers.link?.b, b);
  const l = g.tethers.link;
  for (let i = 0; i < 30; i++) {
    g.time += 1 / 60;
    g.ballistics.flight(g.shots[0], 1 / 60);
    g.updateShots(1 / 60);
    if (!g.shots.length) break;
  }
  assert.equal(g.tethers.link, l);
});
test('cover and excessive separation reject links and move the waiting hook to the new target', () => {
  for (const far of [false, true]) {
    const g = fixture(),
      a = target(g, 450),
      b = target(g, far ? 1000 : 650);
    if (!far) wall(g, 550);
    fire(g, a);
    fire(g, b);
    assert.equal(g.tethers.link, null);
    assert.equal(g.tethers.mark?.enemy, b);
  }
  const g = fixture(),
    a = target(g, 450),
    b = target(g, 650);
  link(g, a, b);
  wall(g, 550);
  g.tethers.beforeStep(1 / 60);
  assert.equal(g.tethers.link, null);
  assert.equal(g.tethers.thrown.size, 0);
});
test('taut cables transfer equal momentum without changing positions or pulling slack cables', () => {
  const g = fixture(),
    a = target(g, 450),
    b = target(g, 650);
  Body.setMass(b.body, a.body.mass * 2);
  const l = link(g, a, b);
  Body.setVelocity(a.body, { x: 0, y: 0 });
  Body.setVelocity(b.body, { x: 0, y: 0 });
  g.tethers.beforeStep(1 / 60);
  near(a.body.velocity.x, 0);
  near(b.body.velocity.x, 0);
  Body.setPosition(b.body, { x: 690, y: 400 });
  const before = { ...a.body.position };
  g.tethers.beforeStep(1 / 60);
  assert(a.body.velocity.x > 0 && b.body.velocity.x < 0);
  near(a.body.velocity.x * a.body.mass + b.body.velocity.x * b.body.mass, 0);
  assert.deepEqual(a.body.position, before);
  assert(g.tethers.link === l);
  physics(g, 12);
  assert(a.body.position.x > before.x);
});
test('all bosses and fixed gunners anchor cables without receiving pull or losing their attack state', () => {
  for (const kind of [
    'loader',
    'crane',
    'press',
    'kiln',
    'condenser',
    'turbine',
    'sorter',
    'interceptor',
    'boss',
    'shooter',
    'sniper',
  ] as const) {
    const g = fixture(),
      a = target(g, 400, 400, kind),
      b = target(g, 650);
    link(g, a, b);
    Body.setVelocity(a.body, { x: 0, y: 0 });
    Body.setVelocity(b.body, { x: 0, y: 0 });
    Body.setPosition(b.body, { x: 685, y: 400 });
    const state = a.state;
    g.tethers.beforeStep(1 / 60);
    near(a.body.velocity.x, 0);
    near(a.body.velocity.y, 0);
    assert.equal(a.state, state);
    assert(b.body.velocity.x < 0);
  }
});
test('Snapback yanks both enemies inward, then real contact deals one bounded hit to each', () => {
  const g = fixture(['tether', 'snapback']),
    a = target(g, 500),
    b = target(g, 680);
  link(g, a, b);
  Body.setPosition(b.body, { x: 745, y: 400 });
  Body.setVelocity(a.body, { x: -3, y: 0 });
  Body.setVelocity(b.body, { x: 5, y: 0 });
  const hp = [a.hp, b.hp];
  g.tethers.beforeStep(1 / 60);
  assert.equal(g.tethers.link, null);
  assert.equal(g.tethers.thrown.size, 2);
  assert(a.body.velocity.x > 0 && b.body.velocity.x < 0);
  assert.equal(a.hp, hp[0]);
  assert.equal(b.hp, hp[1]);
  physics(g, 20);
  assert(a.hp < hp[0] && b.hp < hp[1]);
  assert(hp[0] - a.hp <= 64 * 1.4 && hp[1] - b.hp <= 64 * 1.4);
  const after = [a.hp, b.hp];
  physics(g, 15);
  assert.deepEqual([a.hp, b.hp], after);
});
test('Snapback survives normal enemy steering long enough for an actual collision', () => {
  const g = fixture(['tether', 'snapback']),
    a = target(g, 500),
    b = target(g, 680);
  link(g, a, b);
  Body.setPosition(b.body, { x: 745, y: 400 });
  Body.setVelocity(a.body, { x: 0, y: 0 });
  Body.setVelocity(b.body, { x: 0, y: 0 });
  const hp = [a.hp, b.hp];
  g.tethers.beforeStep(1 / 60);
  for (let i = 0; i < 25; i++) g.tick(1 / 60, idle);
  assert(a.hp < hp[0] && b.hp < hp[1]);
  assert(Number.isFinite(a.body.position.x));
});
test('Snapback against a boss pulls only the small enemy and respects boss armor on collision', () => {
  const g = fixture(['tether', 'snapback']),
    a = target(g, 400, 400, 'loader'),
    b = target(g, 590);
  link(g, a, b);
  Body.setPosition(b.body, { x: 655, y: 400 });
  Body.setVelocity(a.body, { x: 0, y: 0 });
  Body.setVelocity(b.body, { x: 0, y: 0 });
  const hp = a.hp;
  g.tethers.beforeStep(1 / 60);
  near(a.body.velocity.x, 0);
  assert.equal(g.tethers.thrown.size, 1);
  assert(b.body.velocity.x < 0);
  physics(g, 16);
  assert(a.hp < hp);
  assert(hp - a.hp <= 64 * 0.4 + 1e-7);
});
test('walls can stop a snapped enemy; collisions stay physical and cannot hit protected enemies through cover', () => {
  const g = fixture(['tether', 'snapback']),
    a = target(g, 500),
    b = target(g, 680),
    protectedEnemy = target(g, 850);
  link(g, a, b);
  Body.setPosition(b.body, { x: 745, y: 400 });
  Body.setVelocity(a.body, { x: 0, y: 0 });
  Body.setVelocity(b.body, { x: 0, y: 0 });
  g.tethers.beforeStep(1 / 60);
  const obstacle = wall(g, 600, 400, 24);
  const hp = protectedEnemy.hp;
  physics(g, 15);
  assert(a.body.position.x < 600 && b.body.position.x > 600);
  assert.equal(protectedEnemy.hp, hp);
  assert(!Query.collides(a.body, [obstacle]).some((c) => c.depth > 1));
});
test('moving crates break cables, and destroyed cover stops blocking new links', () => {
  const g = fixture(['tether', 'snapback']),
    a = target(g, 450),
    b = target(g, 650);
  link(g, a, b);
  const crate = g.props.spawn('crate', 550, 400);
  Body.setAngle(crate.body, 0.65);
  g.tethers.afterStep();
  assert.equal(g.tethers.link, null);
  assert.equal(g.tethers.thrown.size, 0);
  g.props.remove(crate);
  g.time += 0.3;
  link(g, a, b);
  assert(g.tethers.link);
});
test('an actual portal crossing breaks the cable and cancels post-snap impact payloads', () => {
  const g = fixture(['tether', 'fold', 'snapback']),
    a = target(g, 500, 710),
    b = target(g, 680, 710);
  link(g, a, b);
  const floor = g.terrain.find((body) => body.bounds.min.y >= 739)!;
  assert(floor);
  g.portals.pair = [
    { pos: { x: 500, y: 740 }, normal: { x: 0, y: -1 }, body: floor },
    { pos: { x: 1100, y: 740 }, normal: { x: 0, y: -1 }, body: floor },
  ];
  Body.setPosition(a.body, { x: 500, y: 713 });
  Body.setVelocity(a.body, { x: 0, y: 14 });
  physics(g, 2);
  assert(a.body.position.x > 1000);
  assert.equal(g.tethers.link, null);
  assert.equal(g.tethers.mark, null);
  assert.equal(g.tethers.thrown.size, 0);
});
test('marks and cables expire, and pause, hitstop, death, retries and room changes cleanly bound their state', () => {
  const g = fixture(),
    a = target(g, 450),
    b = target(g, 650);
  fire(g, a);
  g.time += TETHER_MARK_LIFE + 0.01;
  g.tethers.beforeStep(1 / 60);
  assert.equal(g.tethers.mark, null);
  link(g, a, b);
  const l = g.tethers.link!,
    time = g.time;
  g.setMode('paused');
  for (let i = 0; i < 60; i++) g.tick(1 / 60, idle);
  assert.equal(g.time, time);
  assert.equal(g.tethers.link, l);
  g.setMode('playing');
  g.hitStop = 0.2;
  g.tick(1 / 60, idle);
  assert.equal(g.time, time);
  assert.equal(g.tethers.link, l);
  g.hitStop = 0;
  g.time = l.until + 0.01;
  g.tethers.beforeStep(1 / 60);
  assert.equal(g.tethers.link, null);
  g.time += 0.3;
  link(g, a, b);
  g.hitEnemy(a, 999);
  assert.equal(g.tethers.link, null);
  for (const mode of ['dead', 'won', 'title'] as const) {
    g.setMode('playing');
    g.tethers.mark = { enemy: b, until: g.time + 3 };
    g.setMode(mode);
    assert.equal(g.tethers.mark, null);
    assert.equal(g.tethers.effects.length, 0);
  }
  g.setMode('playing');
  fire(g, b);
  g.loadRoom();
  assert.equal(g.tethers.mark, null);
  assert.equal(g.tethers.link, null);
});
test('Snapback does not refill volatile timers, cancel their warning or displace pinned enemies', () => {
  const g = fixture(['tether', 'snapback']);
  g.spawnEnemy('runner', 450, 400, 'volatile');
  const a = g.enemies.at(-1)!;
  a.spawn = 0;
  const b = target(g, 650);
  link(g, a, b);
  a.state = 'windup';
  a.timer = 0.27;
  Body.setPosition(b.body, { x: 710, y: 400 });
  g.tethers.beforeStep(1 / 60);
  assert.equal(a.state, 'windup');
  assert.equal(a.timer, 0.27);
  assert(!g.tethers.staggered(a));
  const h = fixture(),
    x = target(h, 450),
    y = target(h, 650);
  link(h, x, y);
  Body.setPosition(y.body, { x: 690, y: 400 });
  Body.setVelocity(x.body, { x: 0, y: 0 });
  h.ballistics.pins.set(x.id, {
    pos: { ...x.body.position },
    surface: h.terrain[0],
    surfacePos: { ...h.terrain[0].position },
    until: h.time + 1,
    fractured: false,
  });
  h.tethers.beforeStep(1 / 60);
  near(x.body.velocity.x, 0);
});
test('the direct test is legal, isolated from saves and Practice, and Daily rewards remain deterministic', () => {
  const save = tetherTestFromUrl(new URL('https://test/?test=tether'))!;
  assert(loadCheckpoint(save));
  assert(validBuild(save.mods));
  assert(save.mods.includes('snapback'));
  const g = new Game();
  let writes = 0,
    unlocks = 0;
  g.onCheckpoint = () => writes++;
  g.onBossDefeated = () => unlocks++;
  g.startTest(save);
  const id = g.level.id;
  g.die();
  g.startTest(g.testRun!);
  assert.equal(g.hp, 100);
  assert.equal(g.level.id, id);
  assert.equal(writes, 0);
  assert.equal(unlocks, 0);
  for (const suffix of [
    '&test=tether',
    '&daily=2026-09-12',
    '&mode=overtime',
    '&build=tether',
    '&seed=x',
    '&route=low',
  ])
    assert.equal(tetherTestFromUrl(new URL('https://test/?test=tether' + suffix)), null);
  const seed = dailyForDate('2026-09-12')!.seed,
    a = new Game(),
    b = new Game();
  a.start(seed);
  b.start(seed);
  a.enemies = [];
  b.enemies = [];
  a.waves.clear();
  b.waves.clear();
  a.openReward();
  b.openReward();
  assert.equal(a.offers.length, 1);
  assert.deepEqual(a.offers, b.offers);
});

test('a rushing charger drags a flyer through their cable under normal AI', () => {
  const g = fixture(),
    a = target(g, 480, 550),
    b = target(g, 620, 500, 'flyer');
  link(g, a, b);
  a.state = 'rush';
  a.aim = { x: -1, y: 0 };
  a.timer = 1;
  const initial = b.body.position.x;
  // The free flyer steers right toward the player; the taut cable pulls left.
  for (let i = 0; i < 24; i++) g.tick(1 / 60, idle);
  assert(b.body.position.x < initial, `Flyer stayed at ${b.body.position.x}`);
  assert(g.tethers.link);
  assert(distance(a.body.position, b.body.position) > 100);
});

test('dense volleys keep one cable, two snap payloads and bounded effects across repeated targets', () => {
  const g = fixture([
    'crossfire',
    'scatter',
    'burst',
    'pierce',
    'ricochet',
    'split',
    'tether',
    'snapback',
  ]);
  for (let i = 0; i < 12; i++) target(g, 380 + (i % 6) * 90, 260 + Math.floor(i / 6) * 130);
  for (let i = 0; i < 240; i++) {
    const e = g.enemies[i % g.enemies.length];
    if (!e) break;
    fire(g, e, { damage: 1, pierce: 2, split: true });
    physics(g);
    assert(g.tethers.thrown.size <= 2);
    assert(g.tethers.effects.length <= 2);
    for (const e of g.enemies)
      assert(Number.isFinite(e.body.position.x) && Number.isFinite(e.body.velocity.y));
  }
  g.tethers.reset();
  assert.equal(g.tethers.thrown.size, 0);
  assert.equal(g.tethers.mark, null);
});

test('normal opposing movement can naturally stretch and trigger Snapback', () => {
  const g = fixture(['tether', 'snapback']),
    a = target(g, 480, 550),
    b = target(g, 620, 500, 'flyer');
  link(g, a, b);
  let snaps = 0;
  g.onSound = (kind) => {
    if (kind === 'tether-snap') snaps++;
  };
  a.state = 'rush';
  a.aim = { x: -1, y: 0 };
  a.timer = 1;
  for (let i = 0; i < 50; i++) g.tick(1 / 60, idle);
  assert.equal(snaps, 1);
  assert.equal(g.tethers.link, null);
});
