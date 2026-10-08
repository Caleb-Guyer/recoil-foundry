import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, target, beam, wall, Body } from './branches-fixture.ts';
import { TORCH } from '../src/torch.ts';
import { getGun, loadCheckpoint, MODS, modDescription, validBuild } from '../src/rules.ts';
import { inspectUpgrade } from '../src/upgrade-inspection.ts';
import { CONTINUITY_BUILDS, continuityTestFromUrl } from '../src/continuity-test.ts';
import { Game } from '../src/game.ts';
import { RESONATOR } from '../src/cross-fusions.ts';
import { withParents } from '../src/branch-builds.ts';
import { playRoom } from './room-pilot.ts';
import { projectileLights } from '../src/projectile-light.ts';
import { DAILY_RULESET, dailyForDate, SUPPORTED_DAILY_RULESETS } from '../src/daily.ts';
import { createUpgradeDemo, destroyUpgradeDemo } from '../src/upgrade-demo.ts';
import { dailyStartingGun, STARTING_GUN_IDS } from '../src/starting-guns.ts';

const near = (a: number, b: number, tolerance = 1e-5) =>
  assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const mod = (id: string) => MODS.find((m) => m.id === id)!;

for (const prism of [false, true])
  test(`${prism ? 'ten Prism' : 'five Scattershot'} rays hit separate targets and share their declared damage budget`, () => {
    const g = fixture(['cutting-torch', 'scatter', ...(prism ? ['prism-array'] : [])]);
    const angles = [-2, -1, 0, 1, 2].flatMap((i) =>
      (prism ? [-0.09, 0.09] : [0]).map((offset) => i * 0.105 + offset),
    );
    const enemies = angles.map((a) => {
      const e = target(g, 1000, 297 + Math.tan(a) * 800);
      Body.scale(e.body, 0.2, 0.2);
      return e;
    });
    beam(g, 0.1);
    assert.equal(g.torch.segments.filter((s) => s.muzzle).length, prism ? 10 : 5);
    assert.equal(new Set(g.torch.segments.map((s) => s.ray)).size, prism ? 10 : 5);
    const total =
      (g.gun.damage * g.gun.pellets * TORCH.output * 0.1 * (prism ? 1.2 : 1)) / g.gun.interval;
    for (let i = 0; i < enemies.length; i++) {
      const weight = Math.abs(angles[i]) < 0.02 ? 0.8 / (prism ? 2 : 1) : 0.2 / (prism ? 8 : 4);
      near(enemies[i].maxHp - enemies[i].hp, total * weight);
    }
    near(
      enemies.reduce((sum, e) => sum + e.maxHp - e.hp, 0),
      (g.gun.damage * g.gun.pellets * TORCH.output * 0.1 * (prism ? 1.2 : 1)) / g.gun.interval,
    );
    assert.equal(g.shots.length, 0);
    assert.equal(g.shotCount, 1, 'Rays do not mint extra discharges');
  });

test("taking Scattershot preserves the laser's focused damage at range", () => {
  const damage = [[], ['scatter'], ['scatter', 'prism-array']].map((extra) => {
    const g = fixture(['cutting-torch', ...extra]);
    const e = target(g, 1000);
    beam(g, 0.1);
    return e.maxHp - e.hp;
  });
  near(damage[1] / damage[0], 1.024);
  near(damage[2] / damage[0], 1.2288);
});

test('beam and scatter acquisition order, native shotgun pellets and nailgun pulses keep their patterns', () => {
  for (const startingGun of STARTING_GUN_IDS)
    for (const mods of [
      ['scatter', 'cutting-torch', 'prism-array'],
      ['cutting-torch', 'scatter', 'prism-array'],
    ]) {
      assert(validBuild(mods));
      const g = fixture(mods);
      g.startingGun = startingGun;
      g.gun = getGun(mods, startingGun);
      const e = target(g, 400);
      Body.scale(e.body, 1, 15);
      beam(g, 0.1);
      assert.equal(g.torch.segments.filter((s) => s.muzzle).length, g.gun.pellets * 2);
      assert(e.hp < e.maxHp);
      assert.equal(g.gun.burstCount, startingGun === 'nailgun' ? 3 : 1);
    }
});

test('charged spread spends one stored cell and one landing bonus for all five lances', () => {
  const g = fixture([
    'cutting-torch',
    'scatter',
    'charge-lens',
    'capacitor',
    'reserve-cell',
    'landing',
  ]);
  const e = target(g, 400);
  Body.scale(e.body, 1, 15);
  g.ballistics.charges = 2;
  g.landingReady = true;
  beam(g, 1.2);
  near(e.hp, e.maxHp);
  assert.equal(g.shotCount, 0);
  beam(g, 0.1, false);
  assert.equal(g.torch.segments.filter((s) => s.muzzle).length, 5);
  near(e.maxHp - e.hp, g.gun.damage * g.gun.pellets * TORCH.output * 4 * 2 * 2);
  assert.equal(g.shotCount, 1);
  assert.equal(g.ballistics.charges, 1);
  assert(!g.landingReady);
});

test('all spread modes preserve total damage across 30, 60 and 120 Hz', () => {
  for (const extra of [[], ['prism-array'], ['burst', 'pulse-chamber'], ['charge-lens']]) {
    const damage = [];
    for (const hz of [30, 60, 120]) {
      const g = fixture(['cutting-torch', 'scatter', ...extra]);
      const e = target(g, 400);
      Body.scale(e.body, 1, 15);
      beam(g, 1.2, true, 1 / hz);
      if (extra.includes('charge-lens')) beam(g, 0.3, false, 1 / hz);
      damage.push(e.maxHp - e.hp);
    }
    assert(damage.every((n) => n > 0));
    near(damage[0], damage[1]);
    near(damage[1], damage[2]);
  }
});

test('Thermal Runaway keeps its declared bonus across every ray touching the tracked target', () => {
  for (const extra of [[], ['prism-array'], ['charge-lens']]) {
    const amounts = [false, true].map((hot) => {
      const g = fixture([
        'cutting-torch',
        'scatter',
        ...extra,
        ...(hot ? ['thermal-runaway'] : []),
      ]);
      const e = target(g, 400);
      Body.scale(e.body, 1, 15);
      beam(g, 2);
      if (extra.includes('charge-lens')) beam(g, 0.1, false);
      return e.maxHp - e.hp;
    });
    near(amounts[1] / amounts[0], extra.includes('charge-lens') ? 1.75 : 1.46875);
  }
});

test('a spread shares its contact impulse instead of multiplying knockback per ray', () => {
  const impulses = [[], ['scatter'], ['scatter', 'prism-array']].map((extra) => {
    const g = fixture(['cutting-torch', ...extra]);
    const e = target(g, 400);
    Body.scale(e.body, 1, 15);
    Body.setStatic(e.body, false);
    beam(g, 1 / 60);
    return e.body.velocity.x * g.gun.interval;
  });
  assert(impulses[0] > 0);
  assert(impulses[1] >= impulses[0] * 0.95 && impulses[1] <= impulses[0]);
  assert(impulses[2] >= impulses[0] && impulses[2] <= impulses[0] * 1.2);
});

test('Splinter releases three fragments per ray once per pulse and retains total fragment energy', () => {
  for (const prism of [false, true]) {
    const g = fixture(['cutting-torch', 'scatter', 'split', ...(prism ? ['prism-array'] : [])]);
    const e = target(g, 400);
    Body.scale(e.body, 1, 15);
    beam(g, 0.1);
    assert.equal(g.shots.length, prism ? 30 : 15);
    assert(g.shots.every((s) => s.fragment && s.split));
    near(
      g.shots.reduce((sum, s) => sum + s.damage, 0),
      g.gun.damage * g.gun.pellets * TORCH.output * 0.6 * (prism ? 1.2 : 1),
    );
    beam(g, 0.1);
    assert.equal(g.shots.length, prism ? 30 : 15, 'A held pulse cannot duplicate its fragments');
    g.updateShots(1 / 60);
    assert(g.shots.length > 0, 'Outward fragments must survive their source contact');
    assert(
      g.shots.some((s) => Math.hypot(s.pos.x - s.prev.x, s.pos.y - s.prev.y) > 5),
      'The real fragment spray travels away from its source instead of clipping into it',
    );
  }
});

test('rear rays keep their own identities and do not cancel forward thrust', () => {
  const g = fixture(['cutting-torch', 'scatter', 'prism-array', 'backblast', 'backfire']);
  Body.setPosition(g.player, { x: 700, y: 300 });
  g.aim = { x: 1700, y: 300 };
  const front = target(g, 1050),
    rear = target(g, 350);
  Body.scale(front.body, 1, 15);
  Body.scale(rear.body, 1, 15);
  beam(g, 0.1);
  assert.equal(g.torch.segments.filter((s) => s.muzzle).length, 10);
  assert.equal(g.torch.rear.filter((s) => s.muzzle).length, 10);
  assert.equal(new Set([...g.torch.segments, ...g.torch.rear].map((s) => s.ray)).size, 20);
  near(front.maxHp - front.hp, rear.maxHp - rear.hp);
  assert(g.player.velocity.x < 0);
});

test('the shared light budget covers both beam fans, including the outer rays', () => {
  const g = fixture(['cutting-torch', 'scatter', 'prism-array', 'backblast', 'backfire']);
  Body.setPosition(g.player, { x: 700, y: 300 });
  g.aim = { x: 1700, y: 300 };
  beam(g, 1 / 60);
  const lights = projectileLights(g, { x: 0, y: 0, w: 2400, h: 800 });
  assert(lights.length <= 32);
  for (const path of [...g.torch.segments, ...g.torch.rear])
    assert(
      lights.some((l) => Math.hypot(l.pos.x - path.b.x, l.pos.y - path.b.y) < l.radius),
      'Every beam tip should have light; the first ray cannot consume the whole budget',
    );
  assert(lights.some((l) => l.pos.x < g.player.position.x - 300));
  assert(lights.some((l) => l.pos.x > g.player.position.x + 300));
});

test('each ray respects rotated cover, muzzle obstruction, banks and penetration', () => {
  const g = fixture(['cutting-torch', 'scatter', 'prism-array', 'ricochet', 'pierce']);
  const e = target(g, 700);
  Body.scale(e.body, 1, 15);
  const cover = wall(g, 350, 300, 24, 500);
  Body.setAngle(cover, 0.1);
  beam(g, 0.1);
  near(e.hp, e.maxHp);
  assert.equal(g.torch.segments.filter((s) => s.muzzle).length, 10);
  assert(g.torch.segments.filter((s) => s.muzzle).every((s) => s.body === cover));
  Body.setPosition(g.player, { x: 345, y: 300 });
  beam(g, 0.1);
  near(e.hp, e.maxHp);
  const piercing = fixture(['cutting-torch', 'scatter', 'pierce']);
  const enemies = [350, 500, 650, 800].map((x) => {
    const enemy = target(piercing, x);
    Body.scale(enemy.body, 1, 15);
    return enemy;
  });
  beam(piercing, 0.1);
  assert(enemies.slice(0, 3).every((enemy) => enemy.hp < enemy.maxHp));
  near(enemies[3].hp, enemies[3].maxHp);
  const banking = fixture(['cutting-torch', 'scatter', 'ricochet', 'banker']);
  wall(banking, 700, 300, 24, 500);
  beam(banking, 0.1);
  for (let ray = 0; ray < 5; ray++)
    assert(banking.torch.segments.some((s) => s.ray === ray && s.weaponTrace?.banked));
});

test('rays sum their first contact against a solid prop without shooting through its destruction', () => {
  const g = fixture(['cutting-torch', 'scatter', 'magnum']);
  const crate = g.props.spawn('crate', 300, 297);
  assert(crate);
  const hp = crate.hp;
  const e = target(g, 700);
  Body.scale(e.body, 1, 15);
  beam(g, 1 / 60);
  near(hp - crate.hp, g.gun.damage * g.gun.pellets * TORCH.output);
  near(e.hp, e.maxHp);
});

test('Resonator keeps every ray that actually crosses the portal in one delayed discharge', () => {
  const g = fixture([...withParents([], ['resonator'])!, 'scatter']);
  wall(g, 320, 400, 40, 600);
  assert(g.portals.place({ x: 300, y: 300 }));
  assert(g.portals.place({ x: 1300, y: 740 }));
  const e = target(g, 1300, 500);
  Body.scale(e.body, 15, 1);
  beam(g, 0.55);
  assert.equal(g.fusions.resonator.pending.length, 1);
  const p = g.fusions.resonator.pending[0];
  assert.equal(p.rays.length, 5);
  const hp = e.hp,
    count = g.shotCount,
    velocity = { ...g.player.velocity };
  g.time = p.at + 0.01;
  g.fusions.resonator.update();
  near(
    hp - e.hp,
    p.rays.reduce((sum, ray) => sum + ray.damage * ray.origin.gain, 0),
  );
  assert.equal(g.shotCount, count);
  assert.deepEqual(g.player.velocity, velocity);
  assert(g.fusions.resonator.pending.length <= RESONATOR.limit);
  assert.equal(new Set(g.fusions.resonator.effects[0].segments.map((s) => s.ray)).size, 5);
});

test('upgrade copy and comparisons show the combined beam count in either acquisition order', () => {
  assert.match(modDescription(mod('cutting-torch'), ['scatter']), /5 separate beams/);
  assert.match(modDescription(mod('scatter'), ['cutting-torch']), /5 separate beams/);
  assert.match(modDescription(mod('prism-array'), ['cutting-torch', 'scatter']), /10 angled beams/);
  assert.match(
    modDescription(mod('scatter'), ['cutting-torch', 'prism-array']),
    /10 separate beams/,
  );
  assert.match(
    modDescription(mod('scatter'), ['cutting-torch', 'charge-lens']),
    /5 charged lances/,
  );
  assert.deepEqual(
    inspectUpgrade(['cutting-torch'], mod('scatter'), 'pistol').changes.find(
      (c) => c.label === 'Pattern',
    ),
    {
      label: 'Pattern',
      before: '1 beam',
      after: '5 beams',
    },
  );
  assert.deepEqual(
    inspectUpgrade(['cutting-torch', 'scatter'], mod('prism-array'), 'pistol').changes.find(
      (c) => c.label === 'Pattern',
    ),
    {
      label: 'Pattern',
      before: '5 beams',
      after: '10 beams',
    },
  );
});

test('archived Dailies keep their original wide-beam damage while new Daily identities use the spread', () => {
  assert.equal(DAILY_RULESET, 90);
  for (const ruleset of SUPPORTED_DAILY_RULESETS) {
    const daily = dailyForDate('2026-10-05', ruleset)!;
    const g = fixture(['cutting-torch', 'scatter']);
    g.seed = daily.seed;
    const e = target(g);
    beam(g, 0.1);
    const old = ruleset < 87;
    assert.equal(g.torch.segments.filter((s) => s.muzzle).length, old ? 1 : 5);
    near(
      e.maxHp - e.hp,
      (g.gun.damage * g.gun.pellets * TORCH.output * 0.1 * (old ? 1 : 0.8)) / g.gun.interval,
    );
    assert.equal(g.torch.legacyPattern, old);
  }
  assert.notEqual(dailyForDate('2026-10-05', 86)!.seed, dailyForDate('2026-10-05')!.seed);
  for (const branch of ['prism-array', 'charge-lens', 'pulse-chamber']) {
    const g = fixture([
      'cutting-torch',
      'scatter',
      ...(branch === 'pulse-chamber' ? ['burst'] : []),
      branch,
    ]);
    g.seed = dailyForDate('2026-10-05', 86)!.seed;
    const e = target(g, 400);
    Body.scale(e.body, 1, 15);
    beam(g, 1.2);
    if (branch === 'charge-lens') beam(g, 0.1, false);
    assert(e.hp < e.maxHp);
    assert.equal(g.torch.segments.filter((s) => s.muzzle).length, branch === 'prism-array' ? 2 : 1);
  }
});

test('archived Daily descriptions, comparison stats and live previews match the preserved gun', () => {
  const seed = dailyForDate('2026-10-05', 86)!.seed;
  assert.match(modDescription(mod('scatter'), ['cutting-torch'], 'pistol', seed), /wider beam/);
  assert.match(
    modDescription(mod('cutting-torch'), ['scatter'], 'pistol', seed),
    /continuous beam/,
  );
  const inspection = inspectUpgrade(
    ['cutting-torch'],
    mod('scatter'),
    'pistol',
    100,
    undefined,
    seed,
  );
  assert(!inspection.changes.some((c) => c.label === 'Pattern'));
  assert.match(inspection.connections[0], /beam width/);
  const g = createUpgradeDemo(['cutting-torch', 'scatter'], dailyStartingGun(seed)!, seed);
  assert(g.testRun && g.torch.legacyPattern);
  g.time += 1 / 60;
  g.torch.beforeStep(1 / 60, true);
  g.torch.afterStep(1 / 60);
  assert.equal(g.torch.segments.filter((s) => s.muzzle).length, 1);
  destroyUpgradeDemo(g);
});

test('new play links are legal, deterministic, repeatable and isolated for every gun and orientation', () => {
  for (const build of Object.keys(CONTINUITY_BUILDS))
    for (const gun of ['pistol', 'shotgun', 'nailgun'])
      for (const mirror of [0, 1]) {
        const url = new URL(
          `https://test/?test=continuity&build=${build}&gun=${gun}&mirror=${mirror}`,
        );
        const save = continuityTestFromUrl(url)!;
        assert(loadCheckpoint(save), url.href);
        assert.deepEqual(save, continuityTestFromUrl(url));
        const g = new Game();
        const writes: unknown[] = [];
        g.onCheckpoint = (s) => writes.push(s);
        g.startTest(save);
        assert(g.testRun && !g.workshop.active);
        assert.equal(g.startingGun, gun);
        g.fire();
        g.save();
        assert.deepEqual(writes, []);
        g.startTest(save);
        assert.deepEqual(g.mods, save.mods);
        assert.equal(g.shotCount, 0);
      }
  for (const extra of [
    '&test=continuity',
    '&build=prism&build=charge',
    '&gun=laser',
    '&gun=pistol&gun=shotgun',
    '&room=no',
    '&mirror=2',
    '&build=constructor',
    '&daily=1',
    '&workshop=1',
    '&combo=precision',
  ])
    assert.equal(continuityTestFromUrl(new URL('https://test/?test=continuity' + extra)), null);
  assert.equal(continuityTestFromUrl(new URL('https://test/?test=other')), null);
});

test('significant changed combos clear their actual test rooms using normal health, movement and fire', (t) => {
  for (const build of Object.keys(CONTINUITY_BUILDS))
    for (const mirror of [0, 1]) {
      const g = new Game();
      g.startTest(
        continuityTestFromUrl(
          new URL(`https://test/?test=continuity&build=${build}&mirror=${mirror}`),
        )!,
      );
      const result = { build, mirror, ...playRoom(g, 70) };
      assert(result.clear, JSON.stringify(result));
      assert(g.torch.segments.length + g.torch.rear.length <= TORCH.maxSegments);
      t.diagnostic(JSON.stringify(result));
    }
});
