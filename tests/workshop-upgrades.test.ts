import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableMods,
  getGun,
  loadCheckpoint,
  MODS,
  rewardMods,
  seeded,
  validBuild,
  type Vec,
} from '../src/rules.ts';
import { WORKSHOP_MODS } from '../src/workshop-upgrades.ts';
import { branchTestFromUrl, maxCombos, withParents } from '../src/branch-builds.ts';
import {
  fixture,
  round,
  target,
  wall,
  advance,
  beam,
  Body,
  Composite,
} from './branches-fixture.ts';
import { GRAPNEL } from '../src/grapnel.ts';
import { COLD } from '../src/cryogenic.ts';
import { SCRAP } from '../src/scrap-feed.ts';
import { pocketBank, POCKET } from '../src/corner-pocket.ts';
import { traceTorch } from '../src/torch.ts';
import { firstSolid } from '../src/collisions.ts';
import type { Game, Input, Enemy } from '../src/game.ts';

const idle = (g: Game, extra: Partial<Input> = {}): Input => ({
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: g.aim,
  ...extra,
});
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const cableBuild = ['tether', 'grapnel'];
const convoyBuild = ['suspension', 'crosshatch', 'convoy'];
const thermalBuild = ['coolant-rounds', 'cinder', 'thermal-shock'];
const pocketBuild = ['ricochet', 'banker', 'corner-pocket'];
const scrapBuild = ['split', 'scrap-feed'];

test('all five additions are legal, reachable, saved, represented in max builds and have isolated presets', () => {
  assert.equal(MODS.length, 100);
  assert.equal(WORKSHOP_MODS.length, 5);
  const combos = maxCombos();
  for (const m of WORKSHOP_MODS) {
    const build = withParents([], [m.id])!;
    assert(validBuild(build), m.id);
    assert(!availableMods([]).some((other) => other.id === m.id));
    assert(
      combos.some((c) => c.mods.includes(m.id)),
      m.id,
    );
    assert(
      loadCheckpoint({
        version: 6,
        seed: 'workshop-upgrades',
        stage: 8,
        hp: 100,
        mods: build,
        kills: 0,
        elapsed: 0,
      }),
    );
  }
  for (const pair of [
    ['grapnel', 'snapback'],
    ['convoy', 'thread-the-needle'],
    ['convoy', 'tripline'],
    ['thermal-shock', 'flywheel'],
  ]) {
    assert.equal(withParents([], pair), null);
    assert.equal(withParents([], [...pair].reverse()), null);
  }
  assert(
    !rewardMods(['coolant-rounds', 'cinder'], 100, seeded('early'), { stage: 6 }).some(
      (m) => m.id === 'thermal-shock',
    ),
  );
  assert(
    rewardMods(['coolant-rounds', 'cinder'], 100, seeded('late'), { stage: 8 }).some(
      (m) => m.id === 'thermal-shock',
    ),
  );
  for (const key of ['grapnel', 'convoy', 'thermal', 'pocket', 'scrap']) {
    const save = branchTestFromUrl(new URL('https://test/?test=branches&build=' + key))!;
    assert(save && validBuild(save.mods));
  }
});

test('Grapnel attaches through actual airborne wall impacts, keeps tangential recoil and replaces enemy links', () => {
  const g = fixture(cableBuild);
  const support = wall(g, 550, 300, 20, 400);
  round(g);
  advance(g, 8);
  assert.equal(g.grapnel.anchor?.body, support);
  Body.setVelocity(g.player, { x: -8, y: 10 });
  g.grapnel.beforeStep();
  assert(Math.abs(g.player.velocity.x) < 0.2);
  near(g.player.velocity.y, 10);
  const a = target(g, 300),
    b = target(g, 450);
  g.tethers.hit(a, round(g));
  g.tethers.hit(b, round(g));
  assert.equal(g.tethers.link, null);
  assert.equal(g.tethers.mark, null);
});

test('Grapnel jump detaches without buying another anchor; only landing rearms it', () => {
  const g = fixture(cableBuild);
  const body = wall(g, 550, 300, 20, 400);
  const s = round(g, { pos: { x: 537, y: 300 } });
  g.grapnel.impact(s, body, { x: -1, y: 0 });
  assert(g.grapnel.anchor);
  target(g, 1000);
  g.tick(1 / 60, idle(g, { jump: true }));
  assert(!g.grapnel.anchor);
  assert(g.grapnel.used);
  g.grapnel.impact(s, body, { x: -1, y: 0 });
  assert(!g.grapnel.anchor);
  g.grounded = true;
  g.grapnel.input();
  g.grounded = false;
  g.grapnel.impact(s, body, { x: -1, y: 0 });
  assert(g.grapnel.anchor);
});

test('Grapnel expires, detaches from removed/occluded hosts and cannot anchor through cover or on fragments', () => {
  for (const event of ['expiry', 'destroyed', 'cover', 'teleport']) {
    const g = fixture(cableBuild),
      body = wall(g, 550, 300, 20, 400);
    g.grapnel.impact(round(g, { pos: { x: 537, y: 300 } }), body, { x: -1, y: 0 });
    assert(g.grapnel.anchor);
    if (event === 'expiry') g.time += GRAPNEL.life + 0.01;
    if (event === 'destroyed') {
      g.terrain = g.terrain.filter((b) => b !== body);
      Composite.remove(g.engine.world, body);
    }
    if (event === 'cover') wall(g, 400, 300, 20, 300);
    if (event === 'teleport') Body.setPosition(g.player, { x: 800, y: 300 });
    g.grapnel.beforeStep();
    assert.equal(g.grapnel.anchor, null, event);
    assert(g.grapnel.used, event);
  }
  const g = fixture(cableBuild),
    body = wall(g, 550, 300, 20, 400);
  for (const flags of [
    { fragment: true },
    { echo: true },
    { reflected: true },
    { friendly: false },
  ])
    g.grapnel.impact(round(g, { pos: { x: 537, y: 300 }, ...flags }), body, { x: -1, y: 0 });
  assert(!g.grapnel.anchor);
  wall(g, 400, 300, 20, 300);
  g.grapnel.impact(round(g, { pos: { x: 537, y: 300 } }), body, { x: -1, y: 0 });
  assert(!g.grapnel.anchor);
});

test('Grapnel follows a moving host without changing its motion; beam hits can anchor too', () => {
  const g = fixture([...cableBuild, 'deadeye', 'cutting-torch']);
  const body = wall(g, 550, 300, 20, 400);
  beam(g, 0.04);
  assert(g.grapnel.anchor);
  const before = { ...g.grapnel.anchor.pos };
  Body.setPosition(body, { x: 570, y: 310 });
  Body.setVelocity(body, { x: 4, y: 2 });
  g.grapnel.beforeStep();
  assert(g.grapnel.anchor);
  near(g.grapnel.anchor.pos.x, before.x + 20);
  near(g.grapnel.anchor.pos.y, before.y + 10);
  near(body.velocity.x, 4);
  near(body.velocity.y, 2);
});

test('Convoy trails real movement, releases from its current positions and retains immediate recoil', () => {
  const g = fixture([...convoyBuild, 'scatter']);
  g.stasis.input(true);
  g.fireRound();
  assert(g.player.velocity.x < 0);
  advance(g, 14);
  const rounds = [...g.stasis.stock];
  assert.equal(rounds.length, 5);
  const original = rounds.map((s) => ({ ...s.pos }));
  for (let i = 0; i < 45; i++) {
    Body.setPosition(g.player, { x: 200 + i * 7, y: 300 - i * 2 });
    advance(g);
  }
  assert(rounds.some((s, i) => Math.hypot(s.pos.x - original[i].x, s.pos.y - original[i].y) > 40));
  const positions = rounds.map((s) => ({ ...s.pos }));
  g.aim = { x: 1000, y: 250 };
  g.stasis.input(false);
  for (const [i, s] of rounds.entries()) {
    assert.equal(s.stasis?.phase, 'released');
    assert.deepEqual(s.pos, positions[i]);
    const d = { x: g.aim.x - s.pos.x, y: g.aim.y - s.pos.y };
    near(s.vel.x * d.y - s.vel.y * d.x, 0);
  }
});

test('Convoy follows corners with swept cover checks and cannot ferry rounds through a new obstruction', () => {
  const g = fixture(convoyBuild);
  g.stasis.input(true);
  const s = round(g, { pos: { x: 220, y: 300 } });
  advance(g, 12);
  const cover = wall(g, 480, 270, 30, 60);
  for (let i = 0; i < 65; i++) {
    const p = i < 25 ? { x: 200 + i * 7, y: 300 } : { x: 375, y: 300 - (i - 25) * 5 };
    Body.setPosition(g.player, p);
    const before = { ...s.pos };
    advance(g);
    if (s.life > 0) assert(!firstSolid(before, s.pos, { x: s.radius, y: s.radius }, [cover]));
  }
  assert(s.life > 0);
  wall(g, s.pos.x, s.pos.y, 30, 30);
  advance(g);
  assert.equal(s.life, 0);
});

test('Convoy has a smaller finite stock, inert movement, expiry and portal discontinuity cleanup', () => {
  const g = fixture([...convoyBuild, 'recall', 'mass-driver']);
  g.stasis.input(true);
  for (let i = 0; i < 22; i++) round(g);
  assert.equal(g.stasis.stock.length, 15);
  const e = target(g, 500, 300),
    hp = e.hp;
  for (const s of g.stasis.stock) {
    s.stasis!.phase = 'parked';
    s.pos = { x: 500, y: 300 };
  }
  g.stasis.update();
  assert.equal(e.hp, hp);
  g.stasis.teleported();
  assert.equal(g.stasis.stock.length, 0);
  assert.equal(e.hp, hp);
  round(g);
  g.time += 2.6;
  g.stasis.update();
  assert.equal(g.stasis.stock.length, 0);
});

test('Convoy pause preserves stock and terminal states clear it with cable and scrap state', () => {
  for (const mode of ['dead', 'won', 'title'] as const) {
    const g = fixture(convoyBuild);
    g.stasis.input(true);
    round(g);
    advance(g, 12);
    const count = g.stasis.stock.length;
    g.setMode('paused');
    assert.equal(g.stasis.stock.length, count);
    assert(!g.stasis.held);
    g.grapnel.used = true;
    g.scrap.loaded = true;
    g.setMode(mode);
    assert.equal(g.stasis.stock.length, 0);
    assert(!g.grapnel.used);
    assert(!g.scrap.loaded);
  }
});

function chill(g: Game, e: Enemy, amount = COLD.threshold) {
  const state = g.cryogenic.state(e);
  state.cold = amount;
  state.touched = g.time;
  return state;
}
test('Thermal Shock scales with cold, consumes once, pushes exposed debris and obeys cover', () => {
  for (const amount of [12, 24, 48]) {
    const g = fixture(thermalBuild),
      e = target(g, 500),
      nearby = target(g, 540),
      hidden = target(g, 640);
    const cover = wall(g, 590, 300, 16, 200),
      prop = g.props.spawn('crate', 520, 360);
    chill(g, e, amount);
    g.cryogenic.steam(e, { x: 480, y: 300 });
    near(e.maxHp - e.hp, amount);
    assert(nearby.hp < nearby.maxHp);
    assert.equal(hidden.hp, hidden.maxHp);
    assert(Math.hypot(prop.body.velocity.x, prop.body.velocity.y) > 0);
    const hp = e.hp;
    g.cryogenic.steam(e, { x: 480, y: 300 });
    assert.equal(e.hp, hp);
    assert.equal(g.cryogenic.state(e).cold, 0);
    assert(g.terrain.includes(cover));
  }
});

test('actual Cinder burn ticks trigger steam, and steam kills cannot recurse into Flashpoint', () => {
  const g = fixture([...thermalBuild, 'flashpoint']),
    floor = wall(g, 500, 330, 300, 20),
    e = target(g, 500, 300),
    other = target(g, 550, 300);
  const s = round(g, { pos: { x: 500, y: 319 } });
  g.salvage.impact(s, floor, { x: 0, y: -1 });
  e.hp = 10;
  chill(g, e);
  chill(g, other, 24);
  g.salvage.beforeStep(1 / 60);
  assert(e.hp <= 0);
  assert.equal(g.salvageEvolutions.flashes.length, 0);
  assert(g.salvage.cinders.length > 0);
  assert(other.hp < other.maxHp);
});

test('steam consumes frozen/ready cold and preserves boss AI, velocity and armor on every boss', () => {
  const g = fixture([...thermalBuild, 'deep-freeze']),
    e = target(g);
  const cold = chill(g, e, 0);
  cold.frozen = g.time + 0.4;
  cold.immune = g.time + 2;
  g.cryogenic.steam(e, { x: 580, y: 300 });
  near(e.maxHp - e.hp, 48);
  assert(!g.cryogenic.frozen(e));
  for (const kind of [
    'loader',
    'crane',
    'press',
    'kiln',
    'sorter',
    'condenser',
    'turbine',
    'interceptor',
    'boss',
  ] as const) {
    const g = fixture(thermalBuild),
      boss = target(g, 500, 300, kind);
    Body.setStatic(boss.body, false);
    Body.setVelocity(boss.body, { x: 3, y: 4 });
    boss.state = 'windup';
    boss.timer = 0.8;
    const state = chill(g, boss, 0);
    state.ready = true;
    g.cryogenic.steam(boss, { x: 480, y: 300 });
    assert(boss.hp < boss.maxHp && boss.maxHp - boss.hp <= 48);
    assert.equal(boss.state, 'windup');
    assert.equal(boss.timer, 0.8);
    near(boss.body.velocity.x, 3);
    near(boss.body.velocity.y, 4);
    assert(!g.cryogenic.frozen(boss));
    assert(!state.ready);
  }
});

test('a shield blocks steam ignition from its protected side', () => {
  const g = fixture(thermalBuild),
    e = target(g, 500, 300, 'shooter', true);
  e.facing = -1;
  chill(g, e);
  g.cryogenic.steam(e, { x: 480, y: 300 });
  assert.equal(e.hp, e.maxHp);
  assert.equal(g.cryogenic.state(e).cold, 48);
  g.cryogenic.steam(e, { x: 520, y: 300 });
  assert(e.hp < e.maxHp);
});

test('Corner Pocket redirects an actual first wall bounce, removes only its direct-hit penalty and cannot spend again', () => {
  const g = fixture(pocketBuild);
  wall(g, 600, 300, 20, 600);
  target(g, 450, 200);
  const s = round(g);
  const damage = s.damage;
  advance(g, 9);
  assert(s.pocketSpent);
  assert(s.vel.x < 0 && s.vel.y < 0);
  near(s.damage, (damage * (1 + g.gun.bankGrowth)) / POCKET.direct);
  const after = s.damage;
  assert(!pocketBank(g, s, g.terrain.at(-1), { x: -1, y: 0 }));
  assert.equal(s.damage, after);
  near(getGun(pocketBuild).damage, getGun(['ricochet', 'banker']).damage * POCKET.direct);
});

test('Corner Pocket spends its first bank even without an exposed target; cover and backfaces block targeting', () => {
  const g = fixture(pocketBuild),
    support = wall(g, 600, 300, 20, 500);
  wall(g, 500, 250, 20, 200);
  target(g, 400, 200);
  target(g, 700, 300);
  const s = round(g, { pos: { x: 585, y: 300 }, vel: { x: -25, y: 0 } });
  const v = { ...s.vel };
  assert(!pocketBank(g, s, support, { x: -1, y: 0 }));
  assert(s.pocketSpent);
  assert.deepEqual(s.vel, v);
  target(g, 550, 400);
  assert(!pocketBank(g, s, support, { x: -1, y: 0 }));
  assert.deepEqual(s.vel, v);
});

test('Corner Pocket supports steel balls, Vector grace, Rail and Recall without replenishing budgets', () => {
  for (const extra of [
    ['mass-driver', 'skid-plate', 'vector'],
    ['deadeye', 'capacitor', 'rail-spike'],
    ['recall', 'retrace'],
  ]) {
    const g = fixture([...pocketBuild, ...extra]),
      support = wall(g, 600, 300, 20, 600);
    target(g, 450, 200);
    const s = round(g, {
      pos: { x: 580, y: 300 },
      vel: { x: 25, y: 0 },
      rail: extra.includes('rail-spike'),
    });
    const banks = s.bounces;
    if (s.massDriver) g.massDriver.bounce(s, { x: -1, y: 0 }, support);
    else {
      s.vel.x = -25;
      pocketBank(g, s, support, { x: -1, y: 0 });
    }
    assert(s.pocketSpent);
    assert(s.vel.y < 0);
    assert(s.bounces <= banks);
    if (s.vector) assert(s.vector.grace > 0);
    const spent = s.damage;
    if (s.recall) {
      g.ballistics.turn(s);
      pocketBank(g, s, support, { x: 1, y: 0 });
    }
    assert.equal(s.damage, spent);
    for (const flags of [{ fragment: true }, { echo: true }, { reflected: true }]) {
      const secondary = round(g, { pos: { x: 585, y: 300 }, ...flags });
      assert(!pocketBank(g, secondary, support, { x: -1, y: 0 }));
      assert(!secondary.pocketSpent);
    }
  }
});

test('Corner Pocket beams use the same first-bank target and carry spent state in portal continuations', () => {
  const g = fixture([...pocketBuild, 'deadeye', 'cutting-torch']);
  wall(g, 600, 300, 20, 600);
  const e = target(g, 450, 200);
  const segments = traceTorch(g);
  assert(segments.some((s) => s.enemy === e));
  near(segments.find((s) => s.enemy === e)!.gain, (1 + g.gun.bankGrowth) / POCKET.direct);
  const origin = {
    from: { x: 580, y: 400 },
    dir: { x: 1, y: 0 },
    remaining: 900,
    banks: 2,
    pierce: 0,
    gain: 1,
    radius: 1.5,
    pocketSpent: true,
  };
  const continuation = traceTorch(g, false, 0, 12, { used: true }, origin);
  assert(!continuation.some((s) => s.enemy === e));
  assert(continuation[1].gain <= 1 + g.gun.bankGrowth);
});

test('Scrap Feed loads through real direct crate hits and pays one fixed blast on the next discharge', () => {
  const g = fixture(scrapBuild),
    p = g.props.spawn('crate', 450, 300);
  round(g, { damage: 200 });
  advance(g, 2);
  assert(!g.props.items.includes(p));
  assert(g.scrap.loaded);
  g.shots = [];
  g.fireRound();
  assert(!g.scrap.loaded);
  const fragments = g.shots.filter((s) => s.fragment);
  assert.equal(fragments.length, SCRAP.rounds);
  near(
    fragments.reduce((sum, s) => sum + s.damage, 0),
    SCRAP.rounds * SCRAP.damage,
  );
  g.fireRound();
  assert.equal(g.shots.filter((s) => s.fragment).length, SCRAP.rounds);
});

test('Scrap Feed does not load from rubble, secondary shots, environmental destruction or duplicate beam pulses', () => {
  for (const flags of [
    { fragment: true },
    { echo: true },
    { reflected: true },
    { friendly: false },
  ]) {
    const g = fixture(scrapBuild),
      p = g.props.spawn('crate', 450, 300),
      s = round(g, flags);
    g.props.hit(p, 200, { x: 1, y: 0 }, s);
    assert(!g.scrap.loaded);
  }
  const g = fixture(scrapBuild);
  const rubble = g.props.spawn('rubble', 450, 300);
  g.props.hit(rubble, 200, { x: 1, y: 0 }, round(g));
  assert(!g.scrap.loaded);
  g.props.hit(g.props.spawn('crate', 450, 300), 200, { x: 1, y: 0 });
  assert(!g.scrap.loaded);
  const s = round(g, { feedGeneration: 42 });
  g.props.hit(g.props.spawn('cover', 450, 300), 200, { x: 1, y: 0 }, s);
  assert(g.scrap.loaded);
  g.scrap.fire({ x: 1, y: 0 });
  g.props.hit(g.props.spawn('cover', 480, 300), 200, { x: 1, y: 0 }, s);
  assert(!g.scrap.loaded);
  const fragment = g.shots.find((s) => s.fragment)!;
  g.props.hit(g.props.spawn('cover', 500, 300), 200, { x: 1, y: 0 }, fragment);
  assert(!g.scrap.loaded);
});

test('Scrap Feed works with beam pulses, breakable terrain and panels but fragments cannot pass cover', () => {
  const g = fixture([...scrapBuild, 'deadeye', 'cutting-torch']);
  const p = g.props.spawn('cover', 450, 300);
  p.hp = 1;
  beam(g, 0.02);
  assert(g.scrap.loaded);
  beam(g, g.gun.interval + 0.05);
  assert.equal(g.shots.filter((s) => s.fragment && s.damage === SCRAP.damage).length, SCRAP.rounds);
  const h = fixture(scrapBuild),
    s = round(h, { feedGeneration: 1 });
  const panel = h.breaches.spawnPanel({ x: 500, y: 200, w: 16, h: 200 });
  h.breaches.hit(panel, 100, { x: 1, y: 0 }, s);
  assert(h.scrap.loaded);
  h.scrap.reset();
  const body = wall(h, 600, 300, 16, 200);
  h.destruction.register(body, { x: 592, y: 200, w: 16, h: 200 });
  h.destruction.hitBody(body, 200, { x: 1, y: 0 }, s);
  assert(h.scrap.loaded);
  const blocked = target(h, 270, 300);
  wall(h, 235, 300, 10, 100);
  h.scrap.fire({ x: 1, y: 0 });
  h.shots = h.shots.filter((s) => s.fragment);
  advance(h, 15);
  assert.equal(blocked.hp, blocked.maxHp);
  assert.equal(h.shots.length, 0);
});
