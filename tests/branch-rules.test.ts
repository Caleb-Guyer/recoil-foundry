import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODS,
  availableMods,
  validBuild,
  loadCheckpoint,
  rewardMods,
  seeded,
  modDescription,
  type Checkpoint,
} from '../src/rules.ts';
import { BRANCH_MODS, BRANCH_GROUPS, BRANCH_PARENTS } from '../src/upgrade-branches.ts';
import { withParents, branchTestFromUrl } from '../src/branch-builds.ts';

import { Game } from '../src/game.ts';
import {
  loadRunHistory,
  snapshotRun,
  canReplayRun,
  canPracticeRunBuild,
} from '../src/run-history.ts';
import { workshopBuild, discoverBuild } from '../src/workshop-build.ts';
import { dailyForDate } from '../src/daily.ts';

test('all branch choices require their complete parents, respect both orders and enter at stage seven', () => {
  assert.equal(BRANCH_MODS.length, 14);
  assert.equal(MODS.length, 141);
  for (const mod of BRANCH_MODS) {
    const parents = withParents([], BRANCH_PARENTS[mod.id])!;
    assert(validBuild([...parents, mod.id]));
    assert(!availableMods([]).some((m) => m.id === mod.id));
    for (const parent of BRANCH_PARENTS[mod.id])
      assert(
        !availableMods(
          parents.filter((id) => id !== parent),
          true,
        ).some((m) => m.id === mod.id),
      );
    assert(!rewardMods(parents, 200, seeded('early'), { stage: 6 }).some((m) => m.id === mod.id));
    assert(rewardMods(parents, 200, seeded('late'), { stage: 7 }).some((m) => m.id === mod.id));
    assert(
      rewardMods(parents, 200, seeded('overtime'), { stage: 0, overtime: true }).some(
        (m) => m.id === mod.id,
      ),
    );
  }
  for (const members of Object.values(BRANCH_GROUPS))
    for (const a of members)
      for (const b of members) {
        if (a === b) continue;
        const build = withParents([], [a])!;
        assert.equal(withParents(build, [b]), null, `${a} + ${b}`);
      }
  const withoutBurst = withParents([], ['cutting-torch'])!;
  assert(!availableMods(withoutBurst).some((m) => m.id === 'pulse-chamber'));
});

test('Daily remains one deterministic legal pick and branch parents survive Workshop edits', () => {
  const known = MODS.map((m) => m.id);
  for (let n = 1; n <= 60; n++) {
    const daily = dailyForDate(`2026-09-${String(((n - 1) % 28) + 1).padStart(2, '0')}`)!;
    let mods: string[] = [];
    for (let stage = 0; stage < 19; stage++) {
      const context = { stage };
      const first = rewardMods(mods, 1, seeded(daily.seed + ':' + n + ':' + stage), context);
      assert.equal(first.length, 1);
      assert.deepEqual(
        first,
        rewardMods(mods, 1, seeded(daily.seed + ':' + n + ':' + stage), context),
      );
      mods.push(first[0].id);
      assert(validBuild(mods));
    }
  }
  const pulse = withParents([], ['pulse-chamber', 'thermal-runaway', 'light'])!;
  assert.deepEqual(
    workshopBuild(
      pulse.filter((id) => id !== 'burst'),
      known,
    ),
    ['cutting-torch', 'thermal-runaway', 'light'],
  );
  assert.deepEqual(
    discoverBuild([], pulse),
    MODS.filter((m) => pulse.includes(m.id)).map((m) => m.id),
  );
  assert(
    !workshopBuild(['cutting-torch', 'charge-lens', 'prism-array'], known).includes('prism-array'),
  );
});

test('old Rail and Vector runs retain their owned build while new offers reject the combination', () => {
  const mods = [
    'deadeye',
    'capacitor',
    'rail-spike',
    'vector',
    'afterburner',
    'light',
    'leech',
    'kick',
  ];
  assert(!validBuild(mods));
  const old = { version: 5, seed: 'legacy-rail', stage: 8, mods, hp: 80, kills: 0, elapsed: 10 };
  const loaded = loadCheckpoint(old)!;
  assert(loaded);
  assert.equal(loaded.version, 6);
  assert.deepEqual(loaded.legacyMods, mods);
  const g = new Game();
  let save: Checkpoint | null = null;
  g.onCheckpoint = (value) => (save = value);
  g.start(loaded.seed, loaded);
  assert.deepEqual(g.mods, mods);
  assert(loadCheckpoint(save));
  g.openReward();
  assert(g.offers.length);
  g.chooseMod(g.offers[0].id);
  assert(loadCheckpoint(save));
  assert(discoverBuild([], g.mods, g.legacyMods).includes('afterburner'));
  g.setMode('dead');
  const recap = snapshotRun(g, 'legacy-finished')!;
  assert(recap);
  assert.deepEqual(recap.mods, g.mods);
  assert(!canReplayRun(recap));
  assert(
    !canPracticeRunBuild(
      recap,
      MODS.map((m) => m.id),
    ),
  );
  const historical = loadRunHistory([{ ...recap, mods, ruleset: 60, legacyMods: undefined }]);
  assert.equal(historical.length, 1);
  assert.deepEqual(historical[0].mods, mods);
  assert.equal(loadCheckpoint({ ...old, version: 6 }), null);
  assert.equal(
    loadCheckpoint({ ...old, version: 6, legacyMods: [...mods, 'pulse-chamber'] }),
    null,
  );
  assert.equal(loadCheckpoint({ ...old, version: 6, legacyMods: [...mods].reverse() }), null);
  assert.equal(loadCheckpoint({ ...old, legacyMods: mods }), null);
});

test('an old pending Rail/Vector offer can be accepted exactly once and resaved under the new rules', () => {
  const mods = ['deadeye', 'capacitor', 'rail-spike', 'light', 'leech', 'kick', 'scatter', 'rapid'];
  const loaded = loadCheckpoint({
    version: 5,
    seed: 'old-offer',
    stage: 8,
    mods,
    hp: 80,
    kills: 0,
    elapsed: 2,
    reward: { offers: ['vector'], rerolled: false },
  })!;
  assert(loaded?.legacyOffers);
  const g = new Game();
  let save: Checkpoint | null = null;
  g.onCheckpoint = (value) => (save = value);
  g.start(loaded.seed, loaded);
  g.chooseMod('vector');
  assert(g.mods.includes('vector'));
  assert(!g.legacyOffers);
  assert(g.legacyMods);
  assert(loadCheckpoint(save));
  g.openReward();
  assert(!g.offers.some((m) => m.id === 'vector'));
});

test('contextual cards describe charged, merged, trap and beam adaptations', () => {
  const copy = (id: string, mods: string[]) => modDescription(MODS.find((m) => m.id === id)!, mods);
  assert.match(copy('thermal-runaway', ['cutting-torch', 'charge-lens']), /charging/);
  assert.match(copy('burst', ['cutting-torch', 'charge-lens']), /three/);
  assert.match(copy('scatter', ['rail-spike']), /merge/);
  assert.match(copy('relay-gate', ['cutting-torch']), /range/);
  assert.match(copy('fuse', ['tripwire']), /Wires/);
  assert.match(copy('breach', []), /two small bullets/);
});

test('damaged legacy reward metadata is rejected without throwing during startup', () => {
  for (const mods of [null, undefined, 2, {}, 'rail-spike']) {
    assert.equal(
      loadCheckpoint({ version: 6, mods, legacyOffers: [], reward: { offers: [] } }),
      null,
    );
  }
});
