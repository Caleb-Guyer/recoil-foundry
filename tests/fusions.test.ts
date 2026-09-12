import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Enemy, Input, Shot } from '../src/game.ts';
import {
  availableMods,
  FUSION_REQUIRES,
  getGun,
  isFusion,
  loadCheckpoint,
  MODS,
  rewardMods,
  seeded,
  validBuild,
} from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';
import { FUSION_TEST_BUILDS, fusionTestFromUrl, testCheckpoint } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
import { FUSE_TIME, FUSE_LIMIT } from '../src/ballistics.ts';
import { ORBIT_LIMIT, ORBIT_TIME, RAIL_RECOIL } from '../src/fusions.ts';
const { Body, Bodies, Composite, Engine } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1400, y: 400 },
};
const near = (a: number, b: number, eps = 1e-5) => assert(Math.abs(a - b) < eps, `${a} != ${b}`);
function fixture(mods: string[]) {
  const g = new Game();
  g.start('fusions');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.conveyors.clear();
  g.freight.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.mods = mods;
  g.gun = getGun(mods);
  g.stage = 8;
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 500, y: 400 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.aim = { ...idle.aim };
  g.grounded = false;
  return g;
}
function target(g: Game, x: number, y = 400, kind: Enemy['kind'] = 'charger') {
  g.spawnEnemy(kind, x, y);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  e.hp = e.maxHp = 100000;
  return e;
}
function wall(g: Game, x: number, y = 400, w = 12, h = 260) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function step(g: Game, n = 1) {
  for (let i = 0; i < n; i++) {
    g.time += 1 / 60;
    g.ballistics.update();
    g.updateShots(1 / 60);
    g.demolition.update();
    g.fusions.expire();
  }
}
function charge(g: Game, count = 1) {
  for (let i = 0; i < 51 * count; i++) g.ballistics.charge(1 / 60, false);
}
function shell(g: Game, x: number, y = 400, body?: Matter.Body) {
  g.addShot({
    pos: { x, y },
    vel: { x: 30, y: 0 },
    damage: 24,
    life: 1.4,
    friendly: true,
    radius: 2.5,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  const s = g.shots.pop()!;
  g.demolition.impact(s, body);
  return g.ballistics.shells.at(-1)!;
}
function collect(g: Game) {
  g.fireRound();
  for (let i = 0; i < 65 && !g.fusions.orbit.length; i++) step(g);
  assert(g.fusions.orbit.length > 0, 'Recall never reached the player');
}

test('fusions require both parents and exclude every other fusion, including forged builds', () => {
  for (const [id, parents] of Object.entries(FUSION_REQUIRES)) {
    assert(!availableMods([]).some((m) => m.id === id));
    for (const parent of parents) assert(!availableMods([parent]).some((m) => m.id === id));
    assert(availableMods(parents).some((m) => m.id === id));
    assert(validBuild([...parents, id]));
    assert(!validBuild([id, ...parents]));
    assert(!availableMods([...parents, id]).some((m) => isFusion(m.id)));
    for (const other of Object.keys(FUSION_REQUIRES))
      assert(!validBuild([...parents, id, ...FUSION_REQUIRES[other], other]));
  }
});

test('fusion rewards open after the second boss, repeat by seed, and favor Overtime', () => {
  for (const [id, parents] of Object.entries(FUSION_REQUIRES)) {
    let normal = 0,
      overtime = 0;
    for (let i = 0; i < 5000; i++) {
      const seed = id + i;
      for (const stage of [0, 2, 3, 6])
        assert(!rewardMods(parents, 3, seeded(seed), { stage }).some((m) => isFusion(m.id)));
      const a = rewardMods(parents, 3, seeded(seed), { stage: 7 });
      assert.deepEqual(a, rewardMods(parents, 3, seeded(seed), { stage: 7 }));
      assert.equal(new Set(a.map((m) => m.id)).size, a.length);
      normal += +a.some((m) => m.id === id);
      overtime += +rewardMods(parents, 3, seeded(seed), { stage: 0, overtime: true }).some(
        (m) => m.id === id,
      );
    }
    assert(normal > 50 && normal < 600, `${id}: ${normal}`);
    assert(overtime > normal * 2 && overtime < 2000, `${id}: ${normal}/${overtime}`);
  }
});

test('actual rewards, Daily choices and Continue preserve fusion eligibility', () => {
  for (const seed of ['FUSION-REWARDS', dailyForDate('2026-09-11')!.seed]) {
    const g = new Game();
    g.start(seed, {
      ...testCheckpoint(seed, 7),
      mods: ['deadeye', 'capacitor', 'magnum', 'kick', 'light', 'pierce', 'scatter'],
    });
    g.openReward();
    const copy = new Game();
    copy.start(seed, { ...testCheckpoint(seed, 7), mods: [...g.mods] });
    copy.openReward();
    assert.deepEqual(g.offers, copy.offers);
    if (seed.startsWith('RF-D')) assert.equal(g.offers.length, 1);
    // Exercise the same acceptance gate as a genuinely rolled fusion card.
    g.offers = [MODS.find((m) => m.id === 'rail-spike')!];
    let saved: Checkpoint | null = null;
    g.onCheckpoint = (s) => (saved = s);
    g.chooseMod('rail-spike');
    assert.equal(g.stage, 8);
    assert(g.mods.includes('rail-spike'));
    assert(loadCheckpoint(saved));
    const resumed = new Game();
    resumed.start(seed, loadCheckpoint(saved)!);
    assert.deepEqual(resumed.mods, g.mods);
    assert(!availableMods(resumed.mods).some((m) => isFusion(m.id)));
  }
  const early = fixture(['deadeye', 'capacitor']);
  early.stage = 6;
  early.openReward();
  early.offers = [MODS.find((m) => m.id === 'rail-spike')!];
  early.chooseMod('rail-spike');
  assert.equal(early.stage, 6);
});

test('old exhausted Overtime builds with repairs resume and can earn their new fusion', () => {
  const mods = ['deadeye'];
  for (;;) {
    const next = availableMods(mods).find((m) => !isFusion(m.id));
    if (!next) break;
    mods.push(next.id);
  }
  const save: Checkpoint = {
    ...testCheckpoint('OLD-REPAIR', 0),
    mods,
    stage: mods.length - 19 + 1,
    overtime: { baseMods: 19, repairs: 1 },
  };
  assert(loadCheckpoint(save));
  const g = new Game();
  g.start(save.seed, save);
  g.openReward();
  assert.deepEqual(
    g.offers.map((m) => m.id),
    ['rail-spike'],
  );
  let saved: Checkpoint | null = null;
  g.onCheckpoint = (s) => (saved = s);
  g.chooseMod('rail-spike');
  assert(loadCheckpoint(saved));
  g.openReward();
  assert.deepEqual(
    g.offers.map((m) => m.id),
    ['repair'],
  );
  const hp = g.hp;
  g.chooseMod('repair');
  assert.equal(g.hp, Math.min(100, hp + 24));
  assert(loadCheckpoint(saved));
  assert(
    !loadCheckpoint({ ...save, mods: mods.filter((id) => id !== 'light'), stage: save.stage - 1 }),
  );
});

test('Rail spike merges charged forward and rear pellets and applies one larger recoil impulse', () => {
  const g = fixture([
    'deadeye',
    'capacitor',
    'scatter',
    'backblast',
    'backfire',
    'kick',
    'rail-spike',
  ]);
  charge(g);
  const damage = g.gun.damage * 2 * 5 * 2;
  g.fire();
  assert.equal(g.shots.length, 1);
  const s = g.shots[0];
  near(s.damage, damage);
  assert(s.rail);
  assert.equal(s.pierce, 4);
  assert.equal(s.vel.x, 72);
  near(g.player.velocity.x, -g.gun.recoil * RAIL_RECOIL);
  assert(g.shake > 3.8);
  assert.equal(g.ballistics.charges, 0);
  g.shots = [];
  g.fireRound();
  assert.equal(g.shots.length, 10);
  assert(g.shots.every((s) => !s.rail));
});

test('Rail spike retains charge bonuses, burst discharge costs and much stronger air recoil', () => {
  const mods = [
    'deadeye',
    'capacitor',
    'reserve-cell',
    'burst',
    'landing',
    'fold',
    'slingshot',
    'rail-spike',
  ];
  const g = fixture(mods);
  charge(g, 2);
  g.landingReady = true;
  g.evolutions.slingReady = true;
  g.fire();
  near(g.shots[0].damage, g.gun.damage * 2 * 2 * 1.5);
  g.fireRound();
  assert.equal(g.ballistics.charges, 0);
  assert(g.shots[1].rail);
  g.fireRound();
  assert(!g.shots[2].rail);
  const ground = fixture(['deadeye', 'capacitor', 'rail-spike']);
  ground.grounded = true;
  const air = fixture(['deadeye', 'capacitor', 'rail-spike']);
  charge(ground);
  charge(air);
  ground.fire();
  air.fire();
  near(air.player.velocity.x / ground.player.velocity.x, 1 / 0.21);
});

test('Rail spike sweeps through aligned enemies at full strength but stops at cover', () => {
  const g = fixture(['deadeye', 'capacitor', 'rail-spike']);
  const enemies = [target(g, 620), target(g, 715), target(g, 805)];
  wall(g, 880);
  const protectedEnemy = target(g, 920);
  charge(g);
  g.fire();
  const damage = g.shots[0].damage;
  step(g, 9);
  for (const e of enemies) near(100000 - e.hp, damage);
  assert.equal(protectedEnemy.hp, 100000);
  assert.equal(g.shots.length, 0);
  const close = fixture(['deadeye', 'capacitor', 'rail-spike']);
  wall(close, 522);
  const e = target(close, 570);
  charge(close);
  close.fire();
  step(close, 3);
  assert.equal(e.hp, 100000, 'Rail spawned beyond a blocked muzzle');
});

test('Rail spike keeps banks, recall, counterfire and boss armor', () => {
  const g = fixture(['deadeye', 'capacitor', 'rail-spike', 'banker', 'recall', 'countershot']);
  wall(g, 700);
  charge(g);
  g.fire();
  const s = g.shots[0],
    damage = s.damage;
  assert(s.recall);
  assert.equal(s.counter, 1);
  step(g, 3);
  assert.equal(s.banks, 1);
  near(s.damage, damage * 1.35);
  assert(s.vel.x < 0);
  const h = fixture(['deadeye', 'capacitor', 'rail-spike']);
  const boss = target(h, 720, 400, 'loader');
  boss.state = 'windup';
  boss.aim = { x: -1, y: 0 };
  charge(h);
  h.fire();
  const raw = h.shots[0].damage;
  step(h, 5);
  assert(boss.hp < 100000);
  assert(100000 - boss.hp <= raw);
});

test('Orbit catches real returning rounds and launches one finite volley at the new aim', () => {
  const g = fixture(['crossfire', 'recall', 'orbit', 'homecoming']);
  collect(g);
  const stored = g.fusions.orbit.length;
  const damage = g.fusions.orbit[0].shot.damage;
  g.aim = { x: 500, y: 100 };
  g.fireRound();
  const released = g.shots.filter((s) => s.orbitReleased);
  assert.equal(released.length, stored);
  assert.equal(g.fusions.orbit.length, 0);
  assert(released.every((s) => s.vel.y < -29 && Math.abs(s.vel.x) < 2));
  near(released[0].damage, damage);
  assert(released.every((s) => !s.recall && !s.discharge && s.pierce === 3));
  for (const s of released) {
    g.ballistics.turn(s);
    g.fusions.catch(s);
  }
  assert.equal(g.fusions.orbit.length, 0);
  assert.equal(g.hp, 100);
});

test('Orbit retains spent charges, caps storage and excludes fragments and echo recycling', () => {
  const g = fixture(['crossfire', 'recall', 'orbit', 'countershot', 'afterimage']);
  g.fireRound();
  const s = g.shots[1];
  g.ballistics.turn(s);
  s.counter = 0;
  s.bounces = 0;
  for (let i = 0; i < 60; i++) g.fusions.catch({ ...s, id: i });
  assert.equal(g.fusions.orbit.length, ORBIT_LIMIT);
  g.fusions.reset();
  for (const variant of [{ fragment: true }, { echo: true }, { orbitReleased: true }])
    g.fusions.catch({ ...s, ...variant });
  assert.equal(g.fusions.orbit.length, 0);
  g.fusions.catch(s);
  g.fusions.release({ x: 1, y: 0 });
  const released = g.shots.at(-1)!;
  assert.equal(released.counter, 0);
  assert.equal(released.bounces, 0);
  for (let i = 0; i < 3; i++) g.fireRound();
  assert.equal(g.ballistics.echoes.length, 1);
  assert(g.ballistics.echoes[0].shots.every((s) => !s.orbitReleased));
});

test('Orbit cannot spawn stored shots through nearby cover and honors the shared shot cap', () => {
  const g = fixture(['crossfire', 'recall', 'orbit']);
  collect(g);
  wall(g, 522);
  g.aim = { x: 1200, y: 400 };
  const e = target(g, 600);
  g.fireRound();
  step(g, 10);
  assert.equal(e.hp, 100000);
  const h = fixture(['crossfire', 'recall', 'orbit']);
  collect(h);
  const stored = h.fusions.orbit.length;
  const template = h.shots[0] ?? h.fusions.orbit[0].shot;
  while (h.shots.length < 180) h.shots.push({ ...structuredClone(template), id: ++h.id });
  h.fireRound();
  assert.equal(h.shots.length, 180);
  assert.equal(h.fusions.orbit.length, stored);
  h.time += ORBIT_TIME;
  h.fusions.expire();
  assert.equal(h.fusions.orbit.length, 0);
});

test('Orbit follows portal travel without a cross-map shot trail and releases damaging rounds', () => {
  const g = fixture(['crossfire', 'recall', 'orbit', 'fold']);
  collect(g);
  assert(g.portals.place({ x: 2000, y: 400 }));
  assert(g.portals.place({ x: 0, y: 400 }));
  Body.setPosition(g.player, { x: 1960, y: 400 });
  Body.setVelocity(g.player, { x: 15, y: 0 });
  for (let i = 0; i < 10 && g.player.position.x > 1000; i++) {
    g.portals.beforeStep();
    Engine.update(g.engine, 1000 / 60);
  }
  assert(g.player.position.x < 200);
  g.shots = [];
  g.fusions.release({ x: 1, y: 0 });
  assert(g.shots.length);
  assert(g.shots.every((s) => s.pos.x < 240 && s.prev.x === s.pos.x));
  const e = target(g, 350);
  step(g, 12);
  assert(e.hp < 100000);
});

test('Implosion attracts enemies and loose props while bosses, machinery and the player resist', () => {
  const g = fixture(['shellshock', 'fuse', 'implosion']);
  shell(g, 800);
  const e = target(g, 920),
    boss = target(g, 800, 500, 'loader');
  const prop = g.props.spawn('crate', 900, 460),
    cover = g.props.spawn('cover', 770, 500);
  g.fusions.beforeStep(1 / 60);
  assert(e.body.velocity.x < 0);
  assert(prop.body.velocity.x < 0);
  assert(prop.body.velocity.y < 0);
  near(boss.body.velocity.x, 0);
  near(boss.body.velocity.y, 0);
  near(cover.body.velocity.x, 0);
  near(g.player.velocity.x, 0);
  assert.equal(g.hp, 100);
  assert.equal(e.state, 'idle');
  assert.equal(e.timer, 100);
});

test('Implosion is blocked by terrain and intact props, including rotated cover', () => {
  for (const kind of ['wall', 'prop']) {
    const g = fixture(['shellshock', 'fuse', 'implosion']);
    shell(g, 800);
    const e = target(g, 930),
      visible = target(g, 720);
    if (kind === 'wall') wall(g, 850);
    else {
      const p = g.props.spawn('cover', 850, 400);
      Body.setAngle(p.body, 0.15);
    }
    g.fusions.beforeStep(1 / 60);
    near(e.body.velocity.x, 0);
    assert(visible.body.velocity.x > 0);
  }
});

test('Implosion applies the strongest field once and keeps physical bodies on their side of walls', () => {
  const speeds = [1, FUSE_LIMIT].map((n) => {
    const g = fixture(['shellshock', 'fuse', 'implosion']);
    for (let i = 0; i < n; i++) shell(g, 800);
    const prop = g.props.spawn('crate', 900, 400);
    g.time = 0.4;
    g.fusions.beforeStep(1 / 60);
    return prop.body.velocity.x;
  });
  near(speeds[0], speeds[1]);
  const g = fixture(['shellshock', 'fuse', 'implosion']);
  shell(g, 800);
  const prop = g.props.spawn('crate', 910, 400);
  const b = wall(g, 850);
  Body.setVelocity(prop.body, { x: -8, y: 0 });
  for (let i = 0; i < 35; i++) {
    g.time += 1 / 60;
    g.fusions.beforeStep(1 / 60);
    Engine.update(g.engine, 1000 / 60);
  }
  assert(prop.body.bounds.min.x >= b.bounds.max.x - 1);
});

test('Implosion follows moving attachments, loses destroyed hosts and ends when linked fuses ignite', () => {
  const g = fixture(['shellshock', 'fuse', 'implosion', 'linked-fuse', 'aftershock']);
  const host = target(g, 800);
  const s = shell(g, 780, 400, host.body);
  Body.setPosition(host.body, { x: 1100, y: 420 });
  Body.setAngle(host.body, Math.PI / 2);
  const victim = target(g, 1200, 400);
  g.fusions.beforeStep(1 / 60);
  near(s.pos.x, 1100);
  near(s.pos.y, 400);
  assert(victim.body.velocity.x < 0);
  g.hitEnemy(host, 1e9);
  g.ballistics.positionShells();
  assert(!s.body);
  const linked = shell(g, 1150, 400);
  linked.at = g.time + 1;
  g.time = s.at;
  g.ballistics.update();
  near(linked.at, g.time + 0.06);
  assert(g.demolition.pending.length);
  g.time += 0.061;
  g.ballistics.update();
  assert.equal(g.ballistics.shells.length, 0);
  Body.setVelocity(victim.body, { x: 0, y: 0 });
  g.hitStop = 0;
  g.fusions.beforeStep(1 / 60);
  near(victim.body.velocity.x, 0);
});

test('Implosion can drive a real crate into a resisting boss before the charge explodes', () => {
  const g = fixture(['shellshock', 'fuse', 'implosion']);
  const boss = target(g, 1010, 400, 'loader');
  shell(g, boss.body.bounds.min.x - 2.5, 400, boss.body);
  const prop = g.props.spawn('crate', 845, 400);
  for (let i = 0; i < 42 && boss.hp === 100000; i++) {
    g.time += 1 / 60;
    g.fusions.beforeStep(1 / 60);
    g.props.beforeStep();
    Engine.update(g.engine, 1000 / 60);
    g.props.afterStep(1 / 60);
  }
  assert(
    boss.hp < 100000,
    `crate stayed at ${prop.body.position.x}, speed ${prop.body.velocity.x}`,
  );
  assert.equal(g.demolition.effects.length, 0, 'damage came from a premature explosion');
  assert(g.ballistics.shells.length > 0);
});

test('fusion state freezes on pause and hitstop and resets on room changes, retries, death and extraction', () => {
  for (const mode of ['paused', 'upgrade'] as const) {
    const g = fixture(['crossfire', 'recall', 'orbit']);
    collect(g);
    g.setMode(mode);
    const before = structuredClone(g.fusions.orbit),
      time = g.time;
    for (let i = 0; i < 100; i++) g.tick(1 / 60, idle);
    assert.deepEqual(g.fusions.orbit, before);
    assert.equal(g.time, time);
  }
  const g = fixture(['crossfire', 'recall', 'orbit']);
  collect(g);
  g.hitStop = 1;
  const before = structuredClone(g.fusions.orbit),
    time = g.time;
  g.tick(1 / 60, idle);
  assert.deepEqual(g.fusions.orbit, before);
  assert.equal(g.time, time);
  g.loadRoom();
  assert.equal(g.fusions.orbit.length, 0);
  const h = fixture(['shellshock', 'fuse', 'implosion']);
  shell(h, 800);
  const e = target(h, 900);
  h.hitStop = 1;
  h.tick(1 / 60, idle);
  near(e.body.velocity.x, 0);
  h.die();
  assert.equal(h.ballistics.shells.length, 0);
  const escape = fixture(['crossfire', 'recall', 'orbit']);
  collect(escape);
  escape.stage = 19;
  escape.clear = true;
  escape.startEscape();
  assert.equal(escape.fusions.orbit.length, 0);
});

test('fusion test links are legal, reject ambiguous parameters and isolate saves and Practice unlocks', () => {
  for (const [id, mods] of Object.entries(FUSION_TEST_BUILDS)) {
    const url = new URL('https://example.com/?test=fusions&build=' + id);
    const save = fusionTestFromUrl(url)!;
    assert(save);
    assert(loadCheckpoint(save));
    assert(validBuild(mods));
    const g = new Game();
    let writes = 0,
      wins = 0;
    g.onCheckpoint = () => writes++;
    g.onBossDefeated = () => wins++;
    g.startTest(save);
    assert.deepEqual(g.mods, mods);
    assert.equal(g.stage, 8);
    g.hp = 20;
    g.startTest(g.testRun!);
    assert.equal(g.hp, 100);
    assert.equal(g.fusions.orbit.length, 0);
    g.spawnEnemy('loader', 800, 400);
    g.hitEnemy(g.enemies.at(-1)!, 1e9);
    g.save();
    g.die();
    assert.equal(writes, 0);
    assert.equal(wins, 0);
  }
  assert(fusionTestFromUrl(new URL('https://example.com/?test=fusions')));
  for (const query of [
    'test=fusions&test=fusions',
    'test=fusions&build=orbit&build=implosion',
    'test=fusions&build=__proto__',
    'test=fusions&daily=2026-09-11',
    'test=fusions&seed=x',
    'test=fusions&area=rooftops',
    'test=fusions&dv=34',
  ])
    assert.equal(fusionTestFromUrl(new URL('https://example.com/?' + query)), null);
});
