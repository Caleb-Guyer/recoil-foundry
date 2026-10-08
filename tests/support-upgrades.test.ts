import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, target, round, advance, beam, Body } from './branches-fixture.ts';
import { getGun, loadCheckpoint, MODS, rewardMods, seeded, validBuild } from '../src/rules.ts';
import { SUPPORT_MODS, SUPPORT } from '../src/support-upgrades.ts';
import { SUPPORT_BUILDS, supportTestFromUrl } from '../src/support-test.ts';
import { Game } from '../src/game.ts';
import { inspectUpgrade } from '../src/upgrade-inspection.ts';
import { DAILY_RULESET, SUPPORTED_DAILY_RULESETS } from '../src/daily.ts';
import { TORCH } from '../src/torch.ts';
import { newCampaignSeed } from '../src/run-seed.ts';
import { playRoom } from './room-pilot.ts';
import { createUpgradeDemo, destroyUpgradeDemo, upgradeDemoInput } from '../src/upgrade-demo.ts';

const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
const mod = (id: string) => MODS.find((m) => m.id === id)!;
function steady(g: Game, seconds = SUPPORT.focusTime, hz = 60) {
  for (let i = 0; i < seconds * hz; i++) g.support.update(1 / hz);
}

test('Collimator tightens the complete ten-ray pattern without changing count or energy', () => {
  const g = fixture([
    'cutting-torch',
    'scatter',
    'prism-array',
    'backblast',
    'backfire',
    'collimator',
  ]);
  beam(g, 1 / 60);
  const open = [...g.torch.segments, ...g.torch.rear].filter((s) => s.muzzle);
  steady(g);
  beam(g, 1 / 60);
  const focused = [...g.torch.segments, ...g.torch.rear].filter((s) => s.muzzle);
  assert.equal(open.length, 20);
  assert.equal(focused.length, 20);
  for (let i = 0; i < 10; i++) {
    const angle = (s: (typeof open)[number]) => Math.atan2(s.dir.y, s.dir.x);
    near(angle(focused[i]), angle(open[i]) * 0.5);
    near(focused[i].power!, open[i].power!);
    near(focused[i].gain, open[i].gain);
  }
  for (let i = 0; i < 9; i++) {
    g.aim = { x: 200 + Math.cos(i + 1) * 500, y: 300 + Math.sin(i + 1) * 500 };
    g.support.update(1 / 60);
  }
  near(g.support.focus, 0);
});

test('Collimator focus is frame-rate independent and preserves shotgun and crossed-lane projectiles', () => {
  for (const hz of [30, 60, 120]) {
    const g = fixture(['scatter', 'collimator']);
    steady(g, 0.3, hz);
    near(g.support.focus, 0.5);
    near(g.support.spreadScale, 0.75);
  }
  for (const mods of [
    ['scatter', 'collimator'],
    ['crossfire', 'convergence', 'scatter', 'collimator'],
  ]) {
    const g = fixture(mods);
    g.startingGun = 'shotgun';
    g.gun = getGun(mods, 'shotgun');
    g.fireRound();
    const open = g.shots.map((s) => Math.atan2(s.vel.y, s.vel.x));
    g.shots = [];
    Body.setPosition(g.player, { x: 200, y: 300 });
    steady(g);
    g.fireRound();
    assert.equal(g.shots.length, g.gun.pellets * g.gun.lanes);
    g.shots.forEach((s, i) => near(Math.atan2(s.vel.y, s.vel.x), open[i] * 0.5));
    assert(
      g.shots.every((s) => !s.waypoints || s.waypoints.every((p) => Number.isFinite(p.x + p.y))),
    );
  }
});

test('Overkill Bank stores actual post-armor excess and spends one capped reserve across a volley', () => {
  const g = fixture(['scatter', 'overkill-bank']);
  const e = target(g, 440);
  e.hp = e.maxHp = 20;
  round(g, { damage: 100 });
  advance(g, 3);
  assert(e.hp <= 0);
  near(g.support.reserve, 40);
  g.shots = [];
  g.fireRound();
  assert.equal(g.shots.length, 5);
  near(
    g.shots.reduce((sum, s) => sum + s.damage, 0),
    g.gun.damage * 5 * 1.5,
  );
  assert(g.shots.every((s) => s.overkillSpent));
  near(g.support.reserve, 0);
  const next = target(g, 440);
  next.hp = next.maxHp = 0.01;
  advance(g, 15);
  assert(next.hp <= 0);
  near(g.support.reserve, 0);
});

test('shielded kills store reduced excess and secondary or uncredited kills cannot bank energy', () => {
  const g = fixture(['overkill-bank']);
  const e = target(g, 440, 300, 'shooter', true);
  e.facing = -1;
  e.hp = e.maxHp = 5;
  round(g, { damage: 100 });
  advance(g, 3);
  near(g.support.reserve, 2.5);
  for (const extra of [
    { fragment: true },
    { echo: true },
    { reflected: true },
    { allied: true },
    { orbitReleased: true as const },
    { overkillSpent: true as const },
  ]) {
    const q = fixture(['overkill-bank']);
    const dead = target(q, 440);
    dead.hp = -80;
    q.support.gunHit(dead, 20, round(q, { damage: 100, ...extra }));
    near(q.support.reserve, 0);
  }
});

test('the reserve boosts charged beam energy once across all ten rays, not each beam frame', () => {
  const totals = [false, true].map((boost) => {
    const g = fixture(['cutting-torch', 'scatter', 'prism-array', 'overkill-bank']);
    const e = target(g, 400);
    Body.scale(e.body, 1, 15);
    if (boost) g.support.reserve = 1000;
    beam(g, g.gun.interval);
    near(g.support.reserve, 0);
    return e.maxHp - e.hp;
  });
  near(totals[1] / totals[0], 1.5);
  const g = fixture(['cutting-torch', 'scatter', 'charge-lens', 'overkill-bank']);
  const e = target(g, 400);
  Body.scale(e.body, 1, 15);
  g.support.reserve = 1000;
  beam(g, g.torch.chargeDuration);
  near(g.support.reserve, 1000);
  beam(g, 0.1, false);
  near(e.maxHp - e.hp, g.gun.damage * g.gun.pellets * TORCH.output * 4 * 1.5);
  near(g.support.reserve, 0);
});

test('steel balls and nailgun burst rounds share the same next-discharge cap', () => {
  for (const startingGun of ['pistol', 'nailgun'] as const) {
    const mods = ['mass-driver', 'scatter', 'overkill-bank'];
    const g = fixture(mods);
    g.startingGun = startingGun;
    g.gun = getGun(mods, startingGun);
    g.support.reserve = 1000;
    g.fireRound();
    assert.equal(g.shots.length, g.gun.pellets);
    assert(g.shots.every((s) => s.massDriver && s.overkillSpent));
    near(g.shots[0].damage, g.gun.damage * 1.5);
    g.shots = [];
    g.fireRound();
    near(g.shots[0].damage, g.gun.damage);
  }
});

test('forward fire, rear fire and the backblast spend the same finite stored damage', () => {
  const g = fixture(['scatter', 'backblast', 'backfire', 'overkill-bank']);
  const base = g.gun.damage * g.gun.pellets;
  g.support.reserve = base * 0.28;
  g.fireRound();
  assert.equal(g.shots.length, 10);
  g.shots.forEach((s) => near(s.damage, g.gun.damage * 1.1));
  near(g.support.reserve, 0);
  assert(g.shots.every((s) => s.overkillSpent));
  const q = fixture([
    'cutting-torch',
    'scatter',
    'prism-array',
    'backblast',
    'backfire',
    'overkill-bank',
  ]);
  const front = target(q, 400),
    rear = target(q, 100);
  Body.scale(front.body, 1, 15);
  Body.scale(rear.body, 1, 15);
  const payload = q.gun.damage * q.gun.pellets * TORCH.output;
  q.support.reserve = payload * 0.32;
  beam(q, 1 / 60);
  const expected = (payload * 1.2 * 1.1) / 60 / q.gun.interval;
  near(front.maxHp - front.hp, expected);
  // Rear target also receives Backblast; its combined energy gets the same 10% boost.
  near(rear.maxHp - rear.hp, expected + payload * 0.8 * 1.1);
  near(q.support.reserve, 0);
});

test('Heat Relay carries half the tracked kill heat to one exposed target, including charged lances', () => {
  for (const charge of [false, true]) {
    const g = fixture([
      'cutting-torch',
      'thermal-runaway',
      'heat-relay',
      ...(charge ? ['charge-lens'] : []),
    ]);
    const first = target(g, 400);
    if (charge) {
      first.hp = 0.01;
      beam(g, g.torch.chargeDuration);
      beam(g, g.gun.interval * 0.25, false);
    } else {
      beam(g, 0.5);
      first.hp = 0.01;
      beam(g, 1 / 60);
    }
    assert(first.hp <= 0);
    assert(g.support.relay > 0);
    const carried = g.support.relay;
    assert(carried <= 0.5);
    target(g, 450);
    if (charge) g.time += g.gun.interval * 1.1;
    beam(g, 1 / 60);
    near(g.support.relay, 0);
    if (charge) {
      beam(g, 0.1);
      beam(g, 0.1, false);
    }
    assert(g.torch.heat >= carried, `${g.torch.heat} < ${carried}`);
    near(g.support.takeHeat(), 0);
  }
});

test('expired heat, shielded targets and outer-ray kills cannot create additional relays', () => {
  const g = fixture(['cutting-torch', 'thermal-runaway', 'heat-relay', 'scatter']);
  g.support.relay = 0.5;
  g.support.relayUntil = g.time + 1;
  g.time += 1.1;
  near(g.support.takeHeat(), 0);
  const outside = target(g);
  outside.hp = -1;
  g.torch.heat = 1;
  g.torch.target = outside.id + 1;
  g.support.gunHit(outside, 1, round(g), true);
  near(g.support.relay, 0);
  const blocked = target(g, 400, 300, 'shooter', true);
  blocked.facing = -1;
  beam(g, 0.2);
  near(g.torch.heat, 0);
});

test('Scrap Armor comes from real cover destruction, absorbs one ordinary bullet and leaves hazards intact', () => {
  const g = fixture(['scrap-armor']);
  const crate = g.props.spawn('crate', 800, 300);
  g.props.hit(crate, 200, { x: 1, y: 0 }, round(g, { damage: 200 }));
  assert(g.support.plate);
  g.shots = [];
  const hp = g.hp;
  round(g, { friendly: false, pos: { x: 250, y: 300 }, vel: { x: -25, y: 0 }, damage: 14 });
  advance(g, 3);
  near(g.hp, hp);
  assert(!g.support.plate);
  assert(g.time < g.support.plateFlashUntil);
  round(g, { friendly: false, pos: { x: 250, y: 300 }, vel: { x: -25, y: 0 }, damage: 14 });
  advance(g, 3);
  near(g.hp, hp - 14);
  g.time += 7;
  g.support.collectPlate(round(g));
  assert(g.support.plate);
  g.damagePlayer(15, undefined, { type: 'fuel' });
  assert(g.support.plate);
  near(g.hp, hp - 29);
});

test('plates cannot stack or refresh, have a six-second recharge, and reject secondary fire', () => {
  const g = fixture(['scrap-armor']);
  const s = round(g);
  g.support.collectPlate(s);
  const expiry = g.support.plateUntil;
  g.time += 1;
  g.support.collectPlate(s);
  near(g.support.plateUntil, expiry);
  for (const extra of [{ radius: 12 }, { damage: 21 }, { blade: true }, { allied: true }])
    assert(!g.support.absorb(round(g, { friendly: false, damage: 14, ...extra })));
  assert(g.support.plate);
  g.time = expiry + 0.01;
  assert(!g.support.plate);
  g.support.collectPlate(s);
  assert(!g.support.plate);
  g.time = SUPPORT.plateCooldown + 0.01;
  g.support.collectPlate(s);
  assert(g.support.plate);
  for (const extra of [{ fragment: true }, { echo: true }, { reflected: true }, { allied: true }]) {
    const q = fixture(['scrap-armor']);
    q.support.collectPlate(round(q, extra));
    assert(!q.support.plate);
  }
});

test('support resources survive pause, reset on retry, room change and death, and stay bounded', () => {
  const g = fixture(['collimator', 'overkill-bank', 'scrap-armor']);
  steady(g);
  g.support.reserve = 10;
  g.support.collectPlate(round(g));
  g.setMode('paused');
  near(g.support.reserve, 10);
  assert(g.support.plate);
  g.setMode('playing');
  g.loadRoom();
  near(g.support.reserve, 0);
  near(g.support.focus, 0);
  assert(!g.support.plate);
  g.support.reserve = 10;
  g.setMode('dead');
  near(g.support.reserve, 0);
});

test('cracked panels and breakable terrain grant a plate only to direct player fire', () => {
  for (const kind of ['panel', 'terrain']) {
    const g = fixture(['scrap-armor']);
    const s = round(g, { damage: 1000 });
    if (kind === 'panel') {
      const panel = g.breaches.spawnPanel({ x: 600, y: 400, w: 100, h: 24 });
      g.breaches.hit(panel, 1000, { x: 1, y: 0 }, s);
    } else {
      const body = g.terrain[0];
      g.destruction.register(body, { x: 0, y: 0, w: 24, h: 100 });
      g.destruction.hitBody(body, 1000, { x: 1, y: 0 }, s);
    }
    assert(g.support.plate);
  }
});

test('support comparison scenarios demonstrate focus, heat transfer, stored excess and bullet absorption', () => {
  const cases: [string, string[]][] = [
    ['collimator', ['cutting-torch', 'scatter', 'prism-array']],
    ['heat-relay', ['cutting-torch', 'thermal-runaway']],
    ['overkill-bank', ['magnum']],
    ['scrap-armor', ['magnum']],
  ];
  for (const [id, parents] of cases) {
    const g = createUpgradeDemo([...parents, id], 'pistol', 'GUN-COMPARISON', id);
    let observed = false;
    for (let step = 0; step < 300; step++) {
      g.tick(1 / 60, upgradeDemoInput(g, step));
      observed ||=
        id === 'collimator'
          ? g.support.focus > 0.9
          : id === 'heat-relay'
            ? g.support.relay > 0
            : id === 'overkill-bank'
              ? g.support.reserve > 0
              : g.support.plate;
    }
    assert(observed, id);
    if (id === 'scrap-armor') near(g.hp, 100);
    destroyUpgradeDemo(g);
  }
});

test('new support upgrades obey prerequisites and are absent from every archived Daily pool', () => {
  assert.equal(DAILY_RULESET, 90);
  assert(!validBuild(['heat-relay']));
  assert(validBuild(['cutting-torch', 'thermal-runaway', 'heat-relay']));
  for (const rules of SUPPORTED_DAILY_RULESETS) {
    const offers = rewardMods(['cutting-torch', 'thermal-runaway'], 200, seeded('support-pool'), {
      stage: 10,
      seed: `RF-D${rules}-2026-10-05`,
    });
    for (const m of SUPPORT_MODS)
      assert.equal(
        offers.some((o) => o.id === m.id),
        rules >= 88,
      );
  }
  for (const m of SUPPORT_MODS) {
    const base = m.id === 'heat-relay' ? ['cutting-torch', 'thermal-runaway'] : [];
    assert(inspectUpgrade(base, mod(m.id), 'pistol').changes.length > 0);
  }
});

test('fresh Campaign seeds offer all four supports while existing seeds retain their old reward sequence', () => {
  const values = [35, 36];
  assert.equal(
    newCampaignSeed('RF-C88-Z', () => values.shift()!),
    'RF-C90-10',
  );
  for (const seed of ['old-campaign', 'RF-C88-new']) {
    const mods = ['cutting-torch', 'thermal-runaway'];
    const offers = rewardMods(mods, 200, seeded(seed), { stage: 10, seed });
    for (const m of SUPPORT_MODS)
      assert.equal(
        offers.some((o) => o.id === m.id),
        seed.startsWith('RF-C88-'),
      );
  }
  const early = rewardMods([], 200, seeded('early'), { stage: 3, seed: 'RF-C88-new' });
  assert(early.every((m) => !SUPPORT_MODS.some((s) => s.id === m.id)));
});

test('support links are valid, deterministic and save-isolated for every gun, build and orientation', () => {
  for (const build of Object.keys(SUPPORT_BUILDS))
    for (const gun of ['pistol', 'shotgun', 'nailgun'])
      for (const mirror of [0, 1])
        for (const room of ['room', 'boss']) {
          const url = new URL(
            `https://test/?test=support&build=${build}&gun=${gun}&mirror=${mirror}&room=${room}&v=4.13.0`,
          );
          const save = supportTestFromUrl(url)!;
          assert(save && loadCheckpoint(save), url.href);
          assert.deepEqual(save, supportTestFromUrl(url));
          const g = new Game();
          const writes: unknown[] = [];
          g.onCheckpoint = (s) => writes.push(s);
          g.startTest(save);
          g.fire();
          g.save();
          g.startTest(save);
          assert.deepEqual(writes, []);
          assert.deepEqual(g.mods, save.mods);
          near(g.support.reserve, 0);
        }
  for (const suffix of [
    '&test=support',
    '&build=heat',
    '&daily=2026-10-05',
    '&seed=x',
    '&gun=unknown',
    '&room=no',
    '&mirror=2',
    '&build=toString',
  ])
    assert.equal(
      supportTestFromUrl(new URL('https://test/?test=support&build=collimator' + suffix)),
      null,
    );
});

test('every support preset clears its actual fight in both orientations with ordinary player input', (t) => {
  for (const build of Object.keys(SUPPORT_BUILDS))
    for (const mirror of [0, 1]) {
      const save = supportTestFromUrl(
        new URL(`https://test/?test=support&build=${build}&mirror=${mirror}`),
      )!;
      const g = new Game();
      g.startTest(save);
      const result = playRoom(g, 120);
      assert(result.clear && result.hp > 0, JSON.stringify({ build, mirror, ...result }));
      t.diagnostic(JSON.stringify({ build, mirror, hp: result.hp, time: result.time }));
    }
});
