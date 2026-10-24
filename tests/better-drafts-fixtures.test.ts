import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { getGun, loadCheckpoint, rewardMods, seeded } from '../src/rules.ts';
import {
  BETTER_DRAFTS_DECLINED,
  BETTER_DRAFTS_IDS,
  betterDraftsTestFromUrl,
} from '../src/better-drafts-test.ts';

const fixture = (scene: string) =>
  betterDraftsTestFromUrl(new URL('https://test/?test=drafts&scene=' + scene + '&v=1'));

test('Better Drafts public links build deterministic legal pending native rewards', () => {
  for (const scene of BETTER_DRAFTS_IDS) {
    const parsed = fixture(scene)!;
    assert(parsed);
    assert.equal(parsed.scene, scene);
    const { checkpoint: cp } = parsed;
    assert(cp.seed.length <= 40);
    assert(loadCheckpoint(JSON.parse(JSON.stringify(cp))), scene + ' checkpoint validates');
    assert.deepEqual(parsed, fixture(scene));
    assert.equal(cp.reward!.offers.length, 3);
    assert.equal(new Set(cp.reward!.offers).size, 3);
    assert.deepEqual(
      cp.reward!.offers,
      rewardMods(cp.mods, 3, seeded(cp.seed + ':rewards:' + cp.stage), {
        seed: cp.seed,
        stage: cp.stage,
        startingGun: cp.startingGun,
        unlocks: cp.unlocks,
        recentDeclined: cp.draftHistory?.declined ?? [],
      }).map((m) => m.id),
    );
  }
});

test('paired pistol and shotgun fixtures use the same seed with the actual native weapons', () => {
  const pistol = fixture('pistol')!.checkpoint,
    shotgun = fixture('shotgun')!.checkpoint;
  assert.equal(pistol.seed, shotgun.seed);
  assert.equal(pistol.stage, shotgun.stage);
  assert.deepEqual(pistol.mods, shotgun.mods);
  assert.deepEqual(pistol.unlocks, shotgun.unlocks);
  assert.equal(pistol.startingGun, 'pistol');
  assert.equal(shotgun.startingGun, 'shotgun');
  assert.notDeepEqual(pistol.reward!.offers, shotgun.reward!.offers);
  assert.equal(getGun(shotgun.mods, shotgun.startingGun).pellets, 5);
  assert.equal(getGun(pistol.mods, pistol.startingGun).pellets, 1);
});

test('declined preview retains current-zone history and draws from real alternatives', () => {
  const cp = fixture('declined')!.checkpoint;
  assert.deepEqual(cp.draftHistory, { zone: 0, declined: [...BETTER_DRAFTS_DECLINED] });
  assert(cp.reward!.offers.every((id) => !BETTER_DRAFTS_DECLINED.includes(id as never)));
});

test('the public held-card preview retains one native offer and replaces only its neighbors', () => {
  const cp = fixture('hold')!.checkpoint;
  const g = new Game();
  try {
    g.startTest(cp);
    const before = g.offers.map((m) => m.id);
    assert(g.canHoldReward);
    assert(g.holdReward(before[1]));
    assert.equal(g.heldReward, before[1]);
    const heldSnapshot = loadCheckpoint(g.checkpointSnapshot());
    assert(heldSnapshot);
    assert.equal(heldSnapshot.reward!.held, before[1]);
    assert(g.rerollReward());
    assert.equal(g.offers[1].id, before[1]);
    assert(g.offers.filter((_, i) => i !== 1).every((m) => !before.includes(m.id)));
    assert.equal(g.hp, 64);
    assert(!g.canHoldReward);
    assert(!g.rerollReward());
    assert(loadCheckpoint(g.checkpointSnapshot()));
  } finally {
    Matter.Composite.clear(g.engine.world, false);
    Matter.Engine.clear(g.engine);
  }
});

test('every Better Drafts test opens actual rewards and retries without profile writes', () => {
  for (const scene of BETTER_DRAFTS_IDS) {
    const cp = fixture(scene)!.checkpoint;
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onCommendation = () => writes++;
    g.onMilestone = () => writes++;
    g.onCampaignClear = () => writes++;
    try {
      g.startTest(cp);
      assert.equal(g.mode, 'upgrade');
      assert.equal(g.startingGun, cp.startingGun);
      assert.deepEqual(g.gun, getGun(cp.mods, cp.startingGun));
      assert.equal(g.enemies.length, 0);
      assert(!g.waves.pending);
      assert.deepEqual(
        g.offers.map((m) => m.id),
        cp.reward!.offers,
      );
      assert(g.canReroll);
      assert(g.rerollReward());
      assert.equal(g.hp, 64);
      assert.equal(g.rewardRerolled, true);
      assert(g.offers.every((m) => !cp.reward!.offers.includes(m.id)));
      g.startTest(cp);
      assert.equal(g.hp, 76);
      assert.equal(g.rewardRerolled, false);
      assert.deepEqual(
        g.offers.map((m) => m.id),
        cp.reward!.offers,
      );
      g.chooseMod(g.offers[0].id);
      g.save();
      assert.equal(writes, 0);
      assert(!g.commendations.eligible);
      assert.deepEqual(cp.reward!.offers, fixture(scene)!.checkpoint.reward!.offers);
    } finally {
      Matter.Composite.clear(g.engine.world, false);
      Matter.Engine.clear(g.engine);
    }
  }
});

test('Better Drafts parser rejects ambiguous, unsupported and unrelated parameters', () => {
  for (const query of [
    'test=drafts',
    'test=drafts&v=0',
    'test=drafts&v=2',
    'test=drafts&v=1&scene=unknown',
    'test=drafts&v=1&scene=',
    'test=drafts&v=1&scene=hold&scene=beam',
    'test=drafts&test=drafts&v=1',
    'test=drafts&v=1&v=1',
    'test=drafts&v=1&seed=override',
    'test=drafts&v=1&gun=shotgun',
    'test=damage&v=1',
  ])
    assert.equal(betterDraftsTestFromUrl(new URL('https://test/?' + query)), null, query);
  assert.equal(betterDraftsTestFromUrl(new URL('https://test/?test=drafts&v=1'))!.scene, 'pistol');
});
