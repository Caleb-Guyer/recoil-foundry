import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import {
  MODS,
  MOD_REQUIRES,
  FUSION_REQUIRES,
  getGun,
  loadCheckpoint,
  REPAIR_REWARD,
} from '../src/rules.ts';
import { BRANCH_PARENTS } from '../src/upgrade-branches.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { inspectUpgrade } from '../src/upgrade-inspection.ts';
import { createUpgradeDemo, destroyUpgradeDemo, upgradeDemoInput } from '../src/upgrade-demo.ts';
import { upgradePreviewTestFromUrl, UPGRADE_PREVIEW_PRESETS } from '../src/upgrade-preview-test.ts';

const mod = (id: string) => MODS.find((m) => m.id === id)!;
function parents(id: string, collected: string[] = []): string[] {
  for (const parent of [
    ...(MOD_REQUIRES[id] ? [MOD_REQUIRES[id]] : []),
    ...(BRANCH_PARENTS[id] ?? []),
    ...(FUSION_REQUIRES[id] ?? []),
  ]) {
    if (collected.includes(parent)) continue;
    parents(parent, collected);
    collected.push(parent);
  }
  return [...new Set(collected)];
}

test('every offered upgrade compares the combined gun without mutating ownership or inventing nonfinite stats', () => {
  for (const gun of STARTING_GUN_IDS)
    for (const offer of MODS) {
      const base = parents(offer.id),
        original = [...base];
      const result = inspectUpgrade(base, offer, gun);
      assert.deepEqual(base, original);
      assert.deepEqual(result.beforeMods, base);
      assert.deepEqual(result.afterMods, [...base, offer.id]);
      for (const change of result.changes) {
        assert.notEqual(change.before, change.after);
        assert(!/NaN|Infinity|undefined/.test(change.before + change.after));
      }
      for (const name of base) {
        if (!result.connections.some((s) => s.includes(mod(name).name))) continue;
        assert(base.includes(name));
      }
    }
});

test('native shotgun pellets and nailgun burst cadence show actual tradeoffs', () => {
  const shotgun = inspectUpgrade([], mod('scatter'), 'shotgun');
  assert.deepEqual(
    shotgun.changes.find((c) => c.label === 'Pellets'),
    { label: 'Pellets', before: '5', after: '9' },
  );
  assert.deepEqual(
    shotgun.changes.find((c) => c.label === 'Hit / pellet'),
    { label: 'Hit / pellet', before: '12', after: '10.7' },
  );
  const burst = inspectUpgrade([], mod('burst'), 'nailgun');
  assert.deepEqual(
    burst.changes.find((c) => c.label === 'Shots / s'),
    { label: 'Shots / s', before: '4.4', after: '5.5' },
  );
  assert(burst.changes.some((c) => c.label === 'Direct hit' && Number(c.after) < Number(c.before)));
  assert(burst.changes.some((c) => c.label === 'Kick' && c.after === '-20%'));
});

test('conversion comparisons do not label beam or shell secondary output as round damage', () => {
  for (const id of ['cutting-torch', 'shellshock', 'mass-driver']) {
    const result = inspectUpgrade([], mod(id), 'shotgun');
    assert(result.changes.some((c) => c.label === 'Fire'));
    assert(!result.changes.some((c) => c.label === 'Direct hit' || c.label === 'Shots / s'));
  }
  const lens = inspectUpgrade(['cutting-torch', 'charge-lens'], mod('rapid'), 'pistol');
  assert(
    lens.changes.some(
      (c) => c.label === 'Full charge' && Number.parseFloat(c.after) < Number.parseFloat(c.before),
    ),
  );
  assert(!lens.changes.some((c) => /damage|hit|DPS/i.test(c.label)));
  assert.equal(lens.changes.find((c) => c.label === 'Full charge')!.before, '0.66s');
  const conditional = inspectUpgrade([], mod('execute'), 'pistol');
  assert.equal(
    conditional.changes.length,
    0,
    'Executioner only activates below the health threshold',
  );
});

test('hints only describe owned combinations and reforge previews account for the lost upgrade', () => {
  assert.equal(inspectUpgrade([], mod('scatter'), 'pistol').connections.length, 0);
  assert.match(
    inspectUpgrade(['capacitor'], mod('scatter'), 'pistol').connections[0],
    /Capacitor.*every pellet/,
  );
  assert.match(
    inspectUpgrade(['crossfire'], mod('convergence'), 'pistol').connections[0],
    /Crossfire.*bend inward/,
  );
  const swap = inspectUpgrade(['magnum', 'light'], mod('rapid'), 'pistol', 80, 'magnum');
  assert.deepEqual(swap.afterMods, ['light', 'rapid']);
  assert.equal(swap.changes.find((c) => c.label === 'Direct hit')!.before, '42');
  assert.equal(swap.changes.find((c) => c.label === 'Direct hit')!.after, '17.3');
  assert.match(swap.connections[0], /Exchanges Heavy hitter for Hair trigger/);
  assert.match(swap.connections[1], /Give up: 75% more damage/);
  assert.match(
    inspectUpgrade(['grapnel'], mod('tether'), 'pistol').description,
    /Airborne wall hits/,
  );
  assert.deepEqual(inspectUpgrade(['magnum'], REPAIR_REWARD, 'pistol', 90).changes, [
    { label: 'Health', before: '90', after: '100' },
  ]);
});

test('real previews use the same firearm rules and native shot pattern', () => {
  for (const gun of STARTING_GUN_IDS) {
    const g = createUpgradeDemo(['scatter', 'magnum'], gun);
    assert(g.testRun && g.workshop.active);
    assert.deepEqual(g.gun, getGun(['scatter', 'magnum'], gun));
    g.aim = { x: 700, y: 720 };
    g.fire();
    assert.equal(g.shots.length, g.gun.pellets * g.gun.lanes);
    assert(g.shots.every((s) => s.friendly && s.damage === g.gun.damage));
    assert(g.player.velocity.x < 0, 'The real shot applies recoil');
    destroyUpgradeDemo(g);
    assert.equal(Matter.Composite.allBodies(g.engine.world).length, 0);
  }
});

for (const [name, mods] of Object.entries({
  beam: ['cutting-torch', 'scatter', 'burst'],
  lens: ['cutting-torch', 'charge-lens'],
  stored: ['suspension', 'crosshatch', 'convoy'],
  explosive: ['shellshock', 'fuse', 'aftershock'],
  rail: ['deadeye', 'capacitor', 'rail-spike'],
  balls: ['mass-driver', 'ricochet'],
  portals: ['fold', 'rewire'],
}))
  test(`isolated ${name} preview fires and cleans up without recording progress`, () => {
    const g = createUpgradeDemo(mods, 'pistol'),
      writes: unknown[] = [],
      sounds: string[] = [];
    g.onCheckpoint = (s) => writes.push(s);
    g.onSound = (s) => sounds.push(s);
    let effects = false;
    for (let step = 0; step < 420; step++) {
      g.tick(1 / 60, upgradeDemoInput(g, step));
      effects ||= g.shots.length > 0 || g.torch.active || g.torch.emitting;
      assert(g.shots.length <= 3000);
      assert(Number.isFinite(g.player.position.x) && Number.isFinite(g.player.position.y));
    }
    assert(g.shotCount > 0 && effects, name);
    if (name === 'stored') assert(sounds.includes('shot'));
    if (name === 'portals') assert(g.portals.linked, 'Portal inputs place a real pair');
    g.save();
    assert.deepEqual(writes, []);
    destroyUpgradeDemo(g);
    assert.equal(Matter.Composite.allBodies(g.engine.world).length, 0);
  });

test('inspecting and running previews cannot advance the real pending reward or its random stream', () => {
  const g = new Game();
  g.start('inspection-isolation');
  g.mods = ['capacitor'];
  g.gun = getGun(g.mods);
  g.setMode('upgrade');
  g.offers = [mod('scatter'), mod('rapid'), mod('magnum')];
  const original = {
    hp: g.hp,
    time: g.time,
    mods: [...g.mods],
    offers: [...g.offers],
    bodies: Matter.Composite.allBodies(g.engine.world).length,
  };
  const other = new Game();
  other.start('inspection-isolation');
  for (const offer of g.offers) {
    const inspection = inspectUpgrade(g.mods, offer, g.startingGun, g.hp);
    const demo = createUpgradeDemo(inspection.afterMods, inspection.startingGun);
    for (let step = 0; step < 100; step++) demo.tick(1 / 60, upgradeDemoInput(demo, step));
    destroyUpgradeDemo(demo);
  }
  assert.deepEqual(
    {
      hp: g.hp,
      time: g.time,
      mods: g.mods,
      offers: g.offers,
      bodies: Matter.Composite.allBodies(g.engine.world).length,
    },
    original,
  );
  assert.equal(g.mode, 'upgrade');
  assert.equal(g.rng(), other.rng());
});

test('all isolated reward previews produce valid checkpoints and reject mixed or malformed URLs', () => {
  for (const build of Object.keys(UPGRADE_PREVIEW_PRESETS))
    for (const gun of STARTING_GUN_IDS) {
      const save = upgradePreviewTestFromUrl(
        new URL(`https://test/?test=upgrade-preview&build=${build}&gun=${gun}`),
      )!;
      assert(save && loadCheckpoint(save), JSON.stringify(save));
      const g = new Game();
      const writes: unknown[] = [];
      g.onCheckpoint = (s) => writes.push(s);
      g.startTest(save);
      assert.equal(g.mode, 'upgrade');
      assert.equal(g.startingGun, gun);
      g.save();
      assert.deepEqual(writes, []);
    }
  for (const query of [
    'build=constructor',
    'gun=laser',
    'gun=pistol&gun=shotgun',
    'v=2',
    'daily=1',
    'seed=foo',
  ])
    assert.equal(
      upgradePreviewTestFromUrl(new URL('https://test/?test=upgrade-preview&' + query)),
      null,
    );
});
