import { Game } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
// These original tests share one catalog generation with the Workshop simulations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODS,
  availableMods,
  getGun,
  validBuild,
  loadCheckpoint,
  rewardMods,
  seeded,
  isFusion,
  buildPath,
} from '../src/rules.ts';
import { BRANCH_MODS, BRANCH_PARENTS } from '../src/upgrade-branches.ts';
import {
  maxCombos,
  withParents,
  branchTestFromUrl,
  BRANCH_TEST_BUILDS,
  type MaxCombo,
} from '../src/branch-builds.ts';
import { NEW_PATH_MODS, NEW_PATH_PARENTS } from '../src/new-paths.ts';
import { isSubversion } from '../src/subversion-rules.ts';
import { WORKSHOP_MODS } from '../src/workshop-upgrades.ts';
import { workshopBuild } from '../src/workshop-build.ts';
import { reforgeOffers } from '../src/reforge-rules.ts';
import { readMaxComboShard, selectMaxComboShard } from '../scripts/test-sharding.mjs';
const shard = readMaxComboShard();
const ids = ['resonator', 'flywheel', 'storm-cell'];
function nextBuild(mods: string[], swap: { from: string; to: string }) {
  return [...mods.filter((id) => id !== swap.from), swap.to];
}
function selectedRuleCombos(all: readonly MaxCombo[]) {
  const selected = selectMaxComboShard(all, shard);
  console.log(
    'Catalog/Reforge shard ' +
      shard.shard +
      '/' +
      shard.total +
      ': checking ' +
      selected.length +
      ' of ' +
      all.length +
      ' builds.',
  );
  return selected;
}

test('every maximal combination is unique, legal, complete, saveable and addressed by its stable choices', () => {
  const combos = maxCombos();
  assert.equal(combos.length, 9216);
  assert.equal(new Set(combos.map((c) => c.code)).size, combos.length);
  assert.equal(new Set(combos.map((c) => [...c.mods].sort().join(','))).size, combos.length);
  for (const combo of selectedRuleCombos(combos)) {
    assert(validBuild(combo.mods), combo.code);
    assert.equal(availableMods(combo.mods, true).length, 0);
    const save = branchTestFromUrl(new URL('https://test/?test=branches&combo=' + combo.code))!;
    assert.deepEqual(save.mods, combo.mods);
    assert(loadCheckpoint(save));
  }
  for (const mod of BRANCH_MODS) assert(combos.some((c) => c.mods.includes(mod.id)));
});

test('pre-Melt-through maximal links retain exactly their previous upgrades', () => {
  for (const path of ['precision', 'bullet-hell', 'demolition', 'cryogenic', 'stasis']) {
    const c = maxCombos().find((c) => c.path === path && c.choices.includes('clean-cut'))!;
    const oldCode = c.code
      .split('.')
      .filter((id) => id !== 'clean-cut')
      .join('.');
    const save = branchTestFromUrl(new URL('https://test/?test=branches&combo=' + oldCode))!;
    assert(save);
    assert.deepEqual(
      save.mods,
      c.mods.filter((id) => !['melt-through', 'clean-cut'].includes(id)),
    );
    assert(loadCheckpoint(save));
  }
});

test('new fusions have complete reachable parents, one-fusion gating and safe saved/test/Workshop builds', () => {
  for (const id of ids) {
    const build = withParents([], [id])!;
    assert(validBuild(build));
    for (const other of ids) if (other !== id) assert.equal(withParents(build, [other]), null);
    assert(!availableMods(build, true).some((m) => isFusion(m.id)));
    assert(
      !rewardMods(build.slice(0, -1), 100, seeded('early'), { stage: 6 }).some((m) => m.id === id),
    );
    assert(
      rewardMods(build.slice(0, -1), 100, seeded('late'), { stage: 7 }).some((m) => m.id === id),
    );
    assert(maxCombos().some((c) => c.mods.includes(id)));
    assert.equal(
      workshopBuild(
        build.filter((m) => m !== build.at(-2)),
        build,
      ).includes(id),
      false,
    );
  }
  for (const key of ['resonator', 'flywheel', 'storm']) {
    const save = branchTestFromUrl(new URL(`https://test/?test=branches&build=${key}`))!;
    assert(loadCheckpoint(save));
    assert.equal(save.mods.filter(isFusion).length, 1);
  }
});

test('all thirteen upgrades have legal reachable prerequisites, mutually exclusive forks and save support', () => {
  assert.equal(NEW_PATH_MODS.length, 13);
  assert.equal(MODS.length, 141);
  for (const mod of NEW_PATH_MODS) {
    const build = withParents([], [mod.id])!;
    assert(build && validBuild(build), mod.id);
    assert(
      maxCombos().some((c) => c.mods.includes(mod.id)),
      mod.id,
    );
    if (NEW_PATH_PARENTS[mod.id]) assert(!availableMods([]).some((m) => m.id === mod.id));
    assert(
      loadCheckpoint({
        version: 6,
        seed: 'NEW-PATHS',
        stage: 0,
        hp: 100,
        mods: build,
        kills: 0,
        elapsed: 0,
      }),
    );
  }
  for (const roots of [
    ['coolant-rounds', 'suspension'],
    ['coolant-rounds', 'deadeye'],
    ['suspension', 'shellshock'],
    ['suspension', 'crossfire'],
  ]) {
    assert.equal(withParents([], roots), null);
    assert.equal(withParents([], roots.reverse()), null);
  }
  for (const pair of [
    ['deep-freeze', 'cold-snap'],
    ['crosshatch', 'tripline'],
  ]) {
    assert.equal(withParents([], pair), null);
    assert.equal(withParents([], pair.reverse()), null);
  }
  assert.equal(getGun(['coolant-rounds']).damage, getGun([]).damage * 0.8);
  for (const root of ['coolant-rounds', 'suspension']) {
    let mods = [root];
    for (let stage = 1; stage < 20; stage++) {
      const offers = rewardMods(mods, 1, seeded('paths-' + stage), { stage });
      assert.equal(offers.length, 1);
      mods.push(offers[0].id);
      assert(validBuild(mods));
    }
  }
});

test('all swaps preserve path, full dependencies, legal ordering, and compatibility for every maximal build', () => {
  for (const combo of selectedRuleCombos(maxCombos())) {
    const swaps = reforgeOffers(combo.mods, 'reforge-max-' + combo.code, 11);
    assert(swaps.length > 0 && swaps.length <= 3, combo.code);
    assert.equal(new Set(swaps.map((s) => s.to)).size, swaps.length);
    for (const swap of swaps) {
      const next = nextBuild(combo.mods, swap);
      assert(validBuild(next), `${combo.code}/${swap.from}/${swap.to}`);
      assert.equal(next.length, combo.mods.length);
      assert.equal(buildPath(next), buildPath(combo.mods));
      for (const id of next)
        for (const parent of BRANCH_PARENTS[id] ?? []) assert(next.includes(parent));
    }
  }
});

test('old maximal-combo URLs retain their exact pre-Subversion upgrades', () => {
  for (const combo of maxCombos()
    .filter((c) => c.choices.includes('standing-orders'))
    .slice(0, 24)) {
    const oldCode = combo.code
      .split('.')
      .filter((p) => !isSubversion(p))
      .join('.');
    const save = branchTestFromUrl(new URL('https://test/?test=branches&combo=' + oldCode));
    assert.deepEqual(
      save?.mods,
      combo.mods.filter((m) => !isSubversion(m)),
    );
  }
});

test('all five additions are legal, reachable, saved, represented in max builds and have isolated presets', () => {
  assert.equal(MODS.length, 141);
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

test('branch links build real mirrored rooms and bosses without touching saves, unlocks or discoveries', () => {
  for (const key of Object.keys(BRANCH_TEST_BUILDS))
    for (const room of ['room', 'boss'])
      for (const mirror of ['0', '1']) {
        const save = branchTestFromUrl(
          new URL(`https://test/?test=branches&build=${key}&room=${room}&mirror=${mirror}`),
        )!;
        assert(save);
        assert(loadCheckpoint(save));
        assert.equal(getLevel(save.seed, save.stage).mirrored, mirror === '1');
        const g = new Game();
        let writes = 0,
          victories = 0;
        g.onCheckpoint = () => writes++;
        g.onBossDefeated = () => victories++;
        g.startTest(save);
        assert.deepEqual(g.mods, save.mods);
        assert.equal(g.hp, 100);
        g.startTest(g.testRun!);
        assert.deepEqual(g.mods, save.mods);
        assert.equal(writes, 0);
        assert.equal(victories, 0);
      }
  for (const query of [
    'build=nope',
    'build=constructor',
    'build=__proto__',
    'build=charge&combo=bad',
    'combo=bad',
    'max=2',
    'room=unknown',
    'mirror=2',
    'build=pulse&build=charge',
    'workshop=1',
    'daily=2026-09-13',
  ])
    assert.equal(branchTestFromUrl(new URL('https://test/?test=branches&' + query)), null);
});
