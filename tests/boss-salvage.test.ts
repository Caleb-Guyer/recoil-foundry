import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Shot, type Input } from '../src/game.ts';
import {
  getGun,
  availableMods,
  rewardMods,
  seeded,
  isSalvage,
  MODS,
  SALVAGE_BOSSES,
  loadCheckpoint,
} from '../src/rules.ts';
import { salvageTestFromUrl, testCheckpoint } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
import { CINDER_LIMIT, WIND_LIMIT } from '../src/boss-salvage.ts';
const { Body, Bodies, Composite } = Matter;
const dt = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 50, y: 400 },
};
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function fixture(mods = ['ramjet', 'cinder', 'crosswind']) {
  const g = new Game();
  g.start('salvage-physics');
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
  Body.setPosition(g.player, { x: 400, y: 400 });
  return g;
}
function target(
  g: Game,
  x = 600,
  y = 400,
  kind: Enemy['kind'] = 'shooter',
  elite?: Enemy['elite'],
) {
  g.spawnEnemy(kind, x, y, elite);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  return e;
}
function wall(g: Game, x: number, y = 450, w = 120, h = 20) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function shot(g: Game, extra: Partial<Shot> = {}) {
  g.addShot({
    pos: { x: 600, y: 430 },
    vel: { x: 0, y: 30 },
    damage: 24,
    life: 1,
    friendly: true,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: true,
    ...extra,
  });
  return g.shots.at(-1)!;
}
function launch(g: Game, speed = 16) {
  g.grounded = false;
  Body.setVelocity(g.player, { x: speed - g.gun.recoil, y: 0 });
  g.aim = { x: 0, y: 400 };
  g.fireRound();
}

test('salvage stays out of ordinary pools and replaces exactly one boss reward slot', () => {
  for (let i = 0; i < 100; i++) {
    assert(!rewardMods([], 3, seeded('salvage' + i), { stage: 18 }).some((m) => isSalvage(m.id)));
    const offers = rewardMods(['deadeye'], 3, seeded('salvage' + i), {
      stage: 3,
      salvage: 'ramjet',
    });
    assert.equal(offers.length, 3);
    assert.equal(offers[0].id, 'ramjet');
    assert.equal(offers.filter((m) => isSalvage(m.id)).length, 1);
    assert.equal(new Set(offers.map((m) => m.id)).size, 3);
  }
  assert(!availableMods([]).some((m) => isSalvage(m.id)));
});
test('all early boss variants award their machinery only after a real victory', () => {
  for (const [kind, id] of Object.entries(SALVAGE_BOSSES)) {
    const g = fixture([]),
      e = target(g, 600, 400, kind as Enemy['kind']);
    g.openReward();
    assert(!g.offers.some((m) => isSalvage(m.id)));
    g.setMode('playing');
    g.hitEnemy(e, 99999);
    assert.equal(g.earnedSalvage, id);
    g.openReward();
    assert.equal(g.offers[0].id, id);
    g.chooseMod(id);
    assert(g.mods.includes(id));
    assert.equal(g.earnedSalvage, null);
  }
});
test('Daily boss salvage is one deterministic option and duplicates fall back to normal upgrades', () => {
  const seed = dailyForDate('2026-09-12')!.seed;
  const choices: string[][] = [];
  for (let i = 0; i < 2; i++) {
    const g = fixture([]);
    g.seed = seed;
    const e = target(g, 600, 400, 'loader');
    g.hitEnemy(e, 99999);
    g.openReward();
    choices.push(g.offers.map((m) => m.id));
  }
  assert.deepEqual(choices, [['ramjet'], ['ramjet']]);
  const offers = rewardMods(['ramjet'], 3, seeded(seed), {
    stage: 15,
    overtime: true,
    salvage: 'ramjet',
  });
  assert.equal(offers.length, 3);
  assert(!offers.some((m) => isSalvage(m.id)));
});
test('forged salvage choices are rejected and regular checkpoint continuation retains earned mods', () => {
  const g = fixture([]);
  g.openReward();
  g.offers = [MODS.find((m) => m.id === 'cinder')!];
  g.chooseMod('cinder');
  assert(!g.mods.length);
  assert.equal(g.mode, 'upgrade');
  const save = testCheckpoint('save-salvage', 4);
  save.mods = ['leech', 'light', 'kick', 'ramjet'];
  assert(loadCheckpoint(save));
  const continued = new Game();
  continued.start(save.seed, save);
  assert(continued.mods.includes('ramjet'));
  assert.equal(continued.earnedSalvage, null);
});
test('Ramjet requires a recent airborne recoil launch and meaningful closing speed', () => {
  const g = fixture(['ramjet']),
    e = target(g, 429);
  const hp = e.hp;
  Body.setVelocity(g.player, { x: 18, y: 0 });
  assert(!g.salvage.ram(e));
  near(e.hp, hp);
  g.grounded = true;
  g.salvage.launch({ x: -1, y: 0 }, 5.4);
  assert(!g.salvage.ram(e));
  launch(g, 7);
  assert(!g.salvage.ram(e));
  launch(g);
  g.time += 0.41;
  assert(!g.salvage.ram(e));
  near(e.hp, hp);
});
test('Ramjet scales with speed, bounces off small enemies and cannot repeatedly grind them', () => {
  const damages: number[] = [];
  for (const speed of [11, 18]) {
    const g = fixture(['ramjet']),
      e = target(g, 429);
    e.hp = e.maxHp = 500;
    launch(g, speed);
    assert(g.salvage.ram(e));
    damages.push(500 - e.hp);
    assert(g.player.velocity.x < 0);
    launch(g, speed);
    assert(!g.salvage.ram(e));
    near(e.hp, 500 - damages.at(-1)!);
  }
  assert(damages[1] > damages[0]);
});
test('Ramjet retains directional shields, boss resistance and hostile charge contact', () => {
  for (const [kind, elite] of [
    ['loader', undefined],
    ['charger', undefined],
    ['runner', 'shielded'],
  ] as const) {
    const g = fixture(['ramjet']),
      e = target(g, 429, 400, kind, elite);
    e.hp = e.maxHp = 500;
    Body.setPosition(e.body, { x: 422, y: 400 });
    e.facing = -1;
    if (kind === 'charger') e.state = 'rush';
    const hp = e.hp;
    launch(g, 18);
    assert(!g.salvage.ram(e));
    assert(e.hp < hp);
    if (kind === 'loader' || elite) assert(hp - e.hp < 10);
    g.updateEnemy(e, dt);
    assert(g.hp < 100);
  }
});
test('real Matter collisions trigger Ramjet without allowing damage through walls', () => {
  const g = fixture(['ramjet']),
    e = target(g, 446);
  e.hp = e.maxHp = 500;
  launch(g, 18);
  for (let i = 0; i < 5 && e.hp === 500; i++) g.tick(dt, idle);
  assert(e.hp < 500);
  assert.equal(g.hp, 100);
  for (let i = 0; i < 12; i++) g.tick(dt, idle);
  assert.equal(g.hp, 100);
  const blocked = fixture(['ramjet']),
    behind = target(blocked, 440);
  wall(blocked, 420, 400, 8, 200);
  launch(blocked, 18);
  const hp = behind.hp;
  assert(!blocked.salvage.ram(behind));
  near(behind.hp, hp);
});
test('Cinder rounds create surface patches on real impacts and exclude secondary rounds', () => {
  for (const extra of [
    {},
    { fragment: true },
    { echo: true },
    { reflected: true },
    { friendly: false },
  ]) {
    const g = fixture(['cinder']);
    wall(g, 600);
    shot(g, extra);
    g.updateShots(dt);
    assert.equal(g.salvage.cinders.length, Object.keys(extra).length ? 0 : 1);
  }
});
test('airborne Cinder hits need nearby support instead of leaving floating fire', () => {
  const g = fixture(['cinder']);
  const s = shot(g, { pos: { x: 600, y: 200 } });
  g.salvage.impact(s);
  assert.equal(g.salvage.cinders.length, 0);
  const support = wall(g, 600, 270);
  g.salvage.impact(s);
  assert.equal(g.salvage.cinders[0].body, support);
});
test('Cinder overlaps do not stack damage and expire after active play', () => {
  const g = fixture(['cinder']),
    e = target(g, 600, 418);
  const hp = e.hp;
  const support = wall(g, 600),
    s = shot(g);
  for (const x of [585, 600, 615]) {
    s.pos.x = x;
    g.salvage.impact(s, support, { x: 0, y: -1 });
  }
  g.salvage.beforeStep(dt);
  near(hp - e.hp, 4.8);
  g.time = 0.1;
  g.salvage.beforeStep(dt);
  near(hp - e.hp, 4.8);
  g.time = 0.21;
  g.salvage.beforeStep(dt);
  near(hp - e.hp, 9.6);
  g.time = 1.31;
  g.salvage.beforeStep(dt);
  assert.equal(g.salvage.cinders.length, 0);
});
test('Cinder is blocked by cover and cannot burn through its own supporting wall', () => {
  const g = fixture(['cinder']);
  const support = wall(g, 600, 430, 20, 200);
  const e = target(g, 622, 400),
    s = shot(g, { pos: { x: 588, y: 400 } });
  const hp = e.hp;
  g.salvage.impact(s, support, { x: -1, y: 0 });
  g.salvage.beforeStep(dt);
  near(e.hp, hp);
  const other = target(g, 560, 400);
  wall(g, 580, 400, 4, 90);
  g.time += 0.21;
  const hp2 = other.hp;
  g.salvage.beforeStep(dt);
  near(other.hp, hp2);
});
test('Cinder follows moving and rotating props and disappears with destroyed support', () => {
  const g = fixture(['cinder']);
  const body = wall(g, 600),
    s = shot(g);
  g.salvage.impact(s, body, { x: 0, y: -1 });
  const original = { ...g.salvage.cinders[0].pos };
  Body.translate(body, { x: 50, y: 20 });
  g.salvage.beforeStep(dt);
  near(g.salvage.cinders[0].pos.x, original.x + 50);
  near(g.salvage.cinders[0].pos.y, original.y + 20);
  Body.setAngle(body, Math.PI / 2);
  g.salvage.beforeStep(dt);
  near(g.salvage.cinders[0].outward.x, 1);
  Composite.remove(g.engine.world, body);
  g.salvage.beforeStep(dt);
  assert.equal(g.salvage.cinders.length, 0);
});
test('Cinder ignites exposed fuel while retaining normal boss armor', () => {
  const g = fixture(['cinder']);
  const body = wall(g, 600);
  const s = shot(g);
  g.salvage.impact(s, body, { x: 0, y: -1 });
  const e = target(g, 600, 412, 'loader');
  const hp = e.hp;
  g.props.spawn('canister', 630, 418);
  const fuel = g.props.items.at(-1)!;
  g.salvage.beforeStep(dt);
  near(hp - e.hp, 4.8 * 0.4);
  assert(fuel.detonateAt <= g.time + 0.5);
});
test('Crosswind traces actual flight, bends ordinary bullets and preserves their speed and damage', () => {
  const g = fixture(['crosswind']);
  shot(g, { pos: { x: 500, y: 400 }, vel: { x: 60, y: 0 } });
  g.updateShots(dt);
  assert.equal(g.salvage.gusts.length, 1);
  const hostile = shot(g, {
    friendly: false,
    pos: { x: 530, y: 410 },
    vel: { x: -10, y: 0 },
    damage: 17,
  });
  for (let i = 0; i < 50; i++) g.salvage.beforeStep(dt);
  near(Math.hypot(hostile.vel.x, hostile.vel.y), 10);
  near(hostile.damage, 17);
  assert(hostile.vel.y > 0);
  near(Math.atan2(hostile.vel.y, -hostile.vel.x), 0.28);
  assert(!hostile.friendly);
  assert.equal(g.salvage.gusts.length, 1);
});
test('Crosswind applies only one overlapping field and cannot bend heavy or rival ammunition', () => {
  const g = fixture(['crosswind']);
  const s = shot(g);
  for (let i = 0; i < 10; i++)
    g.salvage.trace({ ...s, id: s.id + i }, { x: 500, y: 400 }, { x: 650, y: 400 });
  const regular = shot(g, { friendly: false, pos: { x: 550, y: 410 }, vel: { x: -10, y: 0 } });
  const heavy = shot(g, {
    friendly: false,
    radius: 8,
    pos: { x: 550, y: 410 },
    vel: { x: -10, y: 0 },
  });
  const rival = shot(g, {
    friendly: false,
    pos: { x: 550, y: 410 },
    vel: { x: -10, y: 0 },
    enemyAmmo: { kind: 'precision' } as Shot['enemyAmmo'],
  });
  g.salvage.beforeStep(dt);
  near(Math.atan2(regular.vel.y, -regular.vel.x), dt * 1.8);
  near(heavy.vel.y, 0);
  near(rival.vel.y, 0);
});
test('Crosswind pushes loose props once, respects cover and expires without residual fields', () => {
  const g = fixture(['crosswind']);
  const s = shot(g);
  g.salvage.trace(s, { x: 500, y: 400 }, { x: 650, y: 400 });
  g.props.spawn('crate', 550, 420);
  const crate = g.props.items.at(-1)!;
  g.salvage.beforeStep(dt);
  near(crate.body.velocity.x, dt * 9);
  wall(g, 550, 411, 100, 4);
  Body.setVelocity(crate.body, { x: 0, y: 0 });
  g.salvage.beforeStep(dt);
  near(crate.body.velocity.x, 0);
  g.time = 0.19;
  g.salvage.beforeStep(dt);
  assert(!g.salvage.gusts.length);
});
test('salvage effect counts remain bounded under dense gunfire', () => {
  const g = fixture(),
    support = wall(g, 1000, 450, 1900, 20),
    s = shot(g);
  for (let i = 0; i < 80; i++) {
    s.pos.x = i * 30;
    g.salvage.impact(s, support, { x: 0, y: -1 });
    g.salvage.trace({ ...s, id: s.id + i }, { x: i * 10, y: 400 }, { x: i * 10 + 60, y: 400 });
  }
  assert.equal(g.salvage.cinders.length, CINDER_LIMIT);
  assert.equal(g.salvage.gusts.length, WIND_LIMIT);
});
test('salvage effects freeze on pause and hitstop and clear on room change and death', () => {
  const g = fixture();
  target(g, 1500);
  const s = shot(g);
  const support = wall(g, 600);
  g.salvage.impact(s, support, { x: 0, y: -1 });
  g.salvage.trace(s, { x: 500, y: 400 }, { x: 560, y: 400 });
  launch(g);
  const at = g.time;
  g.setMode('paused');
  for (let i = 0; i < 20; i++) g.tick(dt, idle);
  near(g.time, at);
  assert(g.salvage.cinders.length && g.salvage.gusts.length);
  g.setMode('playing');
  g.hitStop = 0.1;
  g.tick(dt, idle);
  near(g.time, at);
  g.loadRoom();
  assert(!g.salvage.cinders.length && !g.salvage.gusts.length);
  assert(!g.salvage.ramReady);
  g.salvage.trace(s, { x: 500, y: 400 }, { x: 560, y: 400 });
  g.die();
  assert(!g.salvage.gusts.length);
});
test('salvage test links produce legal isolated builds and reject ambiguous parameters', () => {
  for (const build of ['all', 'ramjet', 'cinder', 'crosswind']) {
    const save = salvageTestFromUrl(new URL('https://test/?test=salvage&build=' + build));
    assert(save && loadCheckpoint(save));
    const g = new Game();
    let saved = false,
      unlocked = false;
    g.onCheckpoint = () => (saved = true);
    g.onBossDefeated = () => (unlocked = true);
    g.startTest(save);
    g.save();
    g.die();
    assert(!saved && !unlocked);
    assert.equal(g.mods.filter(isSalvage).length, build === 'all' ? 3 : 1);
  }
  for (const query of [
    '&test=arc',
    '&build=all&build=cinder',
    '&build=unknown',
    '&daily=2026-09-12',
    '&seed=x',
    '&layout=cable-yard',
  ])
    assert.equal(salvageTestFromUrl(new URL('https://test/?test=salvage' + query)), null);
});

test('rotated hull corners do not extend Cinder burn range', () => {
  const g = fixture(['cinder']),
    e = target(g, 650, 400);
  Body.scale(e.body, 5, 0.3);
  Body.setAngle(e.body, Math.PI / 4);
  const pos = { x: e.body.bounds.max.x - 4, y: e.body.bounds.min.y + 4 };
  const support = wall(g, pos.x, pos.y + 14, 20, 10),
    s = shot(g, { pos });
  g.salvage.impact(s, support, { x: 0, y: -1 });
  const hp = e.hp;
  g.salvage.beforeStep(dt);
  near(e.hp, hp);
});

test('Crosswind does not erase an existing fast prop impulse', () => {
  const g = fixture(['crosswind']),
    s = shot(g);
  g.salvage.trace(s, { x: 500, y: 400 }, { x: 650, y: 400 });
  const crate = g.props.spawn('crate', 550, 415);
  Body.setVelocity(crate.body, { x: 22, y: 19 });
  g.salvage.beforeStep(dt);
  near(crate.body.velocity.x, 22);
  near(crate.body.velocity.y, 19);
});

test('teleport discontinuities cannot produce a cross-map ram or wind trail', () => {
  const g = fixture(),
    e = target(g, 1200, 400);
  launch(g);
  const hp = e.hp;
  g.salvage.beforeStep(dt);
  Body.setPosition(g.player, { x: 1180, y: 400 });
  g.salvage.afterStep();
  near(e.hp, hp);
  const s = shot(g);
  g.salvage.trace(s, { x: 400, y: 400 }, { x: 450, y: 400 });
  g.salvage.trace(s, { x: 1200, y: 400 }, { x: 1250, y: 400 });
  assert.equal(g.salvage.gusts.length, 2);
  assert(g.salvage.gusts.every((f) => Math.abs(f.b.x - f.a.x) === 50));
});

test('Ramjet separation grace never protects against another enemy or a projectile', () => {
  const g = fixture(['ramjet']),
    e = target(g, 424);
  e.hp = 500;
  launch(g);
  assert(g.salvage.ram(e));
  const other = target(g, 400);
  g.updateEnemy(other, dt);
  assert.equal(g.hp, 85);
  g.time += 0.8;
  g.damagePlayer(10, { x: 600, y: 400 });
  assert.equal(g.hp, 75);
});
