import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableMods,
  buildFollowup,
  loadCheckpoint,
  progressionDraft,
  rewardMods,
  seeded,
} from '../src/rules.ts';
import { LONGEVITY_IDS } from '../src/longevity.ts';
import { Game } from '../src/game.ts';
import { dailyForDate, SUPPORTED_DAILY_RULESETS } from '../src/daily.ts';
import { progressionTestFromUrl } from '../src/progression-test.ts';

const mods = ['scatter', 'rapid', 'magnum', 'cutting-torch'];
const old = { stage: 8, seed: 'RF-C89-draft', unlocks: LONGEVITY_IDS };
const fresh = { ...old, seed: 'RF-C90-draft' };
test('new Campaigns periodically develop a real owned part while retaining two open draws', () => {
  for (const stage of [5, 8, 11, 14, 17])
    for (let i = 0; i < 128; i++) {
      const before = rewardMods(mods, 3, seeded('draft-' + stage + '-' + i), { ...old, stage });
      const after = rewardMods(mods, 3, seeded('draft-' + stage + '-' + i), { ...fresh, stage });
      assert.equal(after.length, 3);
      assert.equal(new Set(after.map((m) => m.id)).size, 3);
      assert(after.some((m) => buildFollowup(m.id, mods)));
      assert.deepEqual(after.slice(0, 2), before.slice(0, 2));
      assert(after.every((m) => availableMods(mods).includes(m)));
    }
});
test('other rooms, one-card Daily, Overtime and full-pool requests retain their ordinary selection', () => {
  for (const stage of [0, 1, 2, 3, 4, 6, 7, 9, 10, 12, 13, 15, 16, 18, 19])
    for (let i = 0; i < 20; i++)
      assert.deepEqual(
        rewardMods(mods, 3, seeded('open-' + i), { ...fresh, stage }),
        rewardMods(mods, 3, seeded('open-' + i), { ...old, stage }),
      );
  for (const count of [1, 2, 200])
    assert.deepEqual(
      rewardMods(mods, count, seeded('counts'), fresh),
      rewardMods(mods, count, seeded('counts'), old),
    );
  assert.deepEqual(
    rewardMods(mods, 3, seeded('ot'), { ...fresh, overtime: true }),
    rewardMods(mods, 3, seeded('ot'), { ...old, overtime: true }),
  );
  assert(!progressionDraft({ stage: 8, seed: dailyForDate('2026-10-08')!.seed }));
  assert(SUPPORTED_DAILY_RULESETS.includes(89));
});
test('follow-ups obey actual prerequisites, earned unlocks, reroll exclusions and salvage ownership', () => {
  assert(buildFollowup('prism-array', mods));
  assert(!buildFollowup('prism-array', []));
  assert(!buildFollowup('rail-spike', ['deadeye']));
  assert(buildFollowup('rail-spike', ['deadeye', 'capacitor']));
  assert(!buildFollowup('magnum', mods));
  for (let i = 0; i < 128; i++) {
    const first = rewardMods(mods, 3, seeded('locked-' + i), { ...fresh, unlocks: [] });
    assert(first.every((m) => !LONGEVITY_IDS.includes(m.id as never)));
    const reroll = rewardMods(
      mods,
      3,
      seeded('reroll-' + i),
      fresh,
      first.map((m) => m.id),
    );
    assert(reroll.every((m) => !first.some((old) => old.id === m.id)));
    assert(reroll.some((m) => buildFollowup(m.id, mods)));
    const salvage = rewardMods(mods, 3, seeded('salvage-' + i), { ...fresh, salvage: 'cinder' });
    assert.equal(salvage[0].id, 'cinder');
    assert(salvage.some((m) => buildFollowup(m.id, mods)));
  }
  assert.equal(rewardMods([], 3, seeded('empty'), fresh).length, 3);
  const allExcluded = availableMods(mods).map((m) => m.id);
  assert.deepEqual(rewardMods(mods, 3, seeded('none'), fresh, allExcluded), []);
});
test('revision 89, unversioned Campaigns and old Daily retain their exact published draft outputs', () => {
  for (const [seed, expected] of [
    ['RF-C89-DRAFT-KEEP', ['reclamation', 'backblast', 'collimator']],
    ['older-run', ['thermal-runaway', 'leech', 'tether']],
    ['RF-D89-2026-10-07', ['leech']],
  ] as const)
    assert.deepEqual(
      rewardMods(mods, seed.startsWith('RF-D') ? 1 : 3, seeded(seed + ':reward:8'), {
        stage: 8,
        seed,
        unlocks: LONGEVITY_IDS,
      }).map((m) => m.id),
      expected,
    );
});
test('real pending drafts survive Continue and paid rerolls keep their eligibility and exclusions', () => {
  const g = new Game();
  const save = {
    version: 6,
    seed: 'RF-C90-pending',
    stage: 5,
    hp: 100,
    mods: [...mods],
    kills: 12,
    elapsed: 90,
    unlocks: [...LONGEVITY_IDS],
  };
  assert(loadCheckpoint(save));
  g.start(save.seed, save);
  g.openReward();
  assert(g.offers.some((m) => buildFollowup(m.id, g.mods)));
  let checkpoint: unknown;
  g.onCheckpoint = (s) => (checkpoint = s);
  g.save();
  const loaded = loadCheckpoint(checkpoint)!;
  assert(loaded);
  const continued = new Game();
  continued.start(loaded.seed, loaded);
  assert.deepEqual(continued.offers, g.offers);
  const excluded = g.offers.map((m) => m.id),
    hp = g.hp;
  assert(continued.rerollReward());
  assert(continued.hp < hp);
  assert(continued.offers.every((m) => !excluded.includes(m.id)));
  const eligible = rewardMods(
    mods,
    200,
    seeded('eligible'),
    { ...fresh, stage: continued.stage },
    excluded,
  );
  if (eligible.some((m) => buildFollowup(m.id, mods)))
    assert(continued.offers.some((m) => buildFollowup(m.id, mods)));
});
test('public progression previews load a real pending draft, reroll and retry without saving progress', () => {
  for (const build of ['beam', 'precision', 'volley']) {
    const save = progressionTestFromUrl(
      new URL('https://test/?test=progression&build=' + build + '&v=1'),
    )!;
    assert(save && loadCheckpoint(save));
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.startTest(save);
    assert.equal(g.mode, 'upgrade');
    assert(g.offers.some((m) => buildFollowup(m.id, g.mods)));
    assert.equal(g.offers.length, 3);
    const first = g.offers.map((m) => m.id);
    g.save();
    assert(g.rerollReward());
    assert(g.offers.every((m) => !first.includes(m.id)));
    g.startTest(save);
    assert.deepEqual(
      g.offers.map((m) => m.id),
      first,
    );
    assert(!g.commendations.eligible);
    assert.equal(writes, 0);
  }
  for (const query of [
    'test=progression&build=unknown',
    'test=progression&seed=x',
    'test=progression&build=beam&build=volley',
    'test=progression&v=2',
  ])
    assert.equal(progressionTestFromUrl(new URL('https://test/?' + query)), null);
});
