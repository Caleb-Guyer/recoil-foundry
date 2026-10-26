import { shiftOfferAllowed, isShiftMod } from '../src/shift-catalog.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import {
  availableMods,
  getGun,
  isSalvage,
  loadCheckpoint,
  REROLL_COST,
  type Checkpoint,
} from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import { LONGEVITY_IDS } from '../src/longevity.ts';
import { testCheckpoint } from '../src/practice.ts';
import { betterDraftsTestFromUrl, BETTER_DRAFTS_DECLINED } from '../src/better-drafts-test.ts';

const ids = (g: Game) => g.offers.map((offer) => offer.id);
function clear(g: Game) {
  for (const enemy of g.enemies) Matter.Composite.remove(g.engine.world, enemy.body);
  g.enemies = [];
  g.waves.clear();
  g.clear = true;
}
function begin(stage = 0, seed = 'RF-C100-INTEGRATION', open = true) {
  const g = new Game();
  const checkpoint = {
    ...testCheckpoint(seed, stage),
    version: 6 as const,
    unlocks: [...LONGEVITY_IDS],
  };
  g.start(seed, checkpoint);
  g.hp = 64;
  clear(g);
  if (open) g.openReward();
  return g;
}
function saveOf(g: Game) {
  let snapshot: Checkpoint | null = null;
  g.onCheckpoint = (value) => {
    snapshot = value;
  };
  g.save();
  const saved = loadCheckpoint(JSON.parse(JSON.stringify(snapshot)));
  assert(saved, 'the actual Game checkpoint must round-trip through validation');
  return saved;
}

test('a live draft toggles and switches a single held card without buying or accepting anything', () => {
  const g = begin();
  const offered = ids(g);
  const hp = g.hp;
  let changes = 0;
  g.onChange = () => changes++;
  assert(g.canHoldReward);
  assert.equal(g.heldReward, null);
  assert(g.holdReward(offered[0]));
  assert.equal(g.heldReward, offered[0]);
  assert(g.holdReward(offered[1]));
  assert.equal(g.heldReward, offered[1]);
  assert(g.holdReward(offered[1]));
  assert.equal(g.heldReward, null);
  assert(!g.holdReward('missing'));
  assert.deepEqual(ids(g), offered);
  assert.equal(g.hp, hp);
  assert.equal(g.mods.length, 0);
  assert.equal(g.mode, 'upgrade');
  assert.equal(changes, 3);
  for (const mode of ['playing', 'paused', 'title', 'dead', 'won'] as const) {
    g.setMode(mode);
    assert(!g.holdReward(offered[0]));
  }
});

test('held rerolls keep the original slot, replace both other cards and charge exactly once', () => {
  for (const slot of [0, 1, 2]) {
    const g = begin();
    const original = ids(g);
    const held = original[slot];
    assert(g.holdReward(held));
    assert(g.canReroll);
    assert(g.rerollReward());
    assert.equal(g.hp, 64 - REROLL_COST);
    assert.equal(g.offers[slot].id, held);
    assert.equal(g.offers.length, 3);
    assert.equal(new Set(ids(g)).size, 3);
    assert(g.offers.every((offer, i) => i === slot || !original.includes(offer.id)));
    assert.equal(g.heldReward, null);
    assert(!g.canHoldReward);
    assert(!g.holdReward(held));
    const replacement = ids(g);
    for (let i = 0; i < 3; i++) assert(!g.rerollReward());
    assert.deepEqual(ids(g), replacement);
    assert.equal(g.hp, 52);
    g.chooseMod(held);
    assert.equal(g.stage, 1);
    assert.deepEqual(g.mods, [held]);
    assert.equal(g.hp, 64, 'only the usual room-clear healing follows the single charge');
  }
});

test('holding respects the health boundary and existing hunt/event reroll credits', () => {
  for (const hp of [0, 1, 12, 12.01]) {
    const g = begin();
    g.hp = hp;
    const held = g.offers[1].id;
    assert.equal(g.holdReward(held), hp > REROLL_COST);
    assert.equal(g.rerollReward(), hp > REROLL_COST);
    assert.equal(g.hp, hp > REROLL_COST ? hp - REROLL_COST : hp);
  }
  for (const source of ['hunt', 'event', 'both'] as const) {
    const g = begin();
    g.hp = 1;
    if (source !== 'event') {
      g.hunts.rules = 1;
      g.hunts.state = { kind: 'cableweaver', stage: 8, phase: 'finished', reward: 'reroll' };
    }
    if (source !== 'hunt')
      g.areaEvents.state = {
        kind: 'turf',
        area: 0,
        relays: [],
        caches: [0],
        commander: false,
        rerolls: 1,
      };
    const held = g.offers[2].id;
    assert(g.canHoldReward);
    assert(g.holdReward(held));
    assert(g.rerollReward());
    assert.equal(g.offers[2].id, held);
    assert.equal(g.hp, 1);
    assert(!g.rerollReward(), 'a second credit cannot bypass once per reward');
    if (source !== 'event') assert(g.hunts.state!.rerollSpent);
    if (source === 'event') assert.equal(g.areaEvents.state!.rerolls, 0);
    if (source === 'both')
      assert.equal(g.areaEvents.state!.rerolls, 1, 'hunt credit is spent first');
  }
});

test('an exhausted pool cannot spend health or trap a held selection', () => {
  const g = begin(18, 'RF-C100-EXHAUSTION', false);
  g.overtime = { baseMods: 19, repairs: 0 };
  let guard = 0;
  const archivedPool = () =>
    availableMods(g.mods).filter((m) => shiftOfferAllowed(m.id, g.seed, 20));
  while (archivedPool().length > 3) {
    assert(guard++ < 200);
    g.mods.push(archivedPool()[0].id);
  }
  assert(g.mods.every((id) => !isShiftMod(id)));
  g.gun = getGun(g.mods, g.startingGun);
  g.openReward();
  assert.equal(g.offers.length, 3);
  const original = ids(g),
    hp = g.hp;
  assert(g.canHoldReward);
  assert(g.holdReward(original[0]));
  assert(!g.canReroll);
  assert(!g.rerollReward());
  assert.equal(g.hp, hp);
  assert.deepEqual(ids(g), original);
  assert(g.holdReward(original[0]), 'unholding remains possible when there are no replacements');
  assert.equal(g.heldReward, null);
});

test('Continue restores held pending offers and declined history, then resumes the same replacement draw', () => {
  const preset = betterDraftsTestFromUrl(
    new URL('https://game.test/?test=drafts&scene=declined&v=1'),
  )!;
  const g = new Game();
  g.start(preset.checkpoint.seed, preset.checkpoint);
  assert.deepEqual(g.recentDeclined, [...BETTER_DRAFTS_DECLINED]);
  assert(g.holdReward(g.offers[1].id));
  const saved = saveOf(g);
  assert.equal(saved.reward?.held, g.heldReward);
  assert.deepEqual(saved.draftHistory, g.draftHistory);
  const continued = new Game();
  continued.start(saved.seed, saved);
  assert.equal(continued.mode, 'upgrade');
  assert.deepEqual(ids(continued), ids(g));
  assert.equal(continued.heldReward, g.heldReward);
  assert.deepEqual(continued.recentDeclined, g.recentDeclined);
  assert(g.rerollReward());
  assert(continued.rerollReward());
  assert.equal(continued.hp, g.hp);
  assert.deepEqual(ids(continued), ids(g));
  assert.deepEqual(continued.draftHistory, g.draftHistory);
  const rerolledSave = saveOf(continued);
  const reloaded = new Game();
  reloaded.start(rerolledSave.seed, rerolledSave);
  assert.equal(reloaded.heldReward, null);
  assert(reloaded.rewardRerolled);
  assert(!reloaded.rerollReward());
  assert.deepEqual(reloaded.recentDeclined, continued.recentDeclined);
});

test('declines record only swapped and unchosen cards and expire when the next zone starts', () => {
  const g = begin();
  const original = ids(g),
    held = original[1];
  assert(g.holdReward(held));
  assert(g.rerollReward());
  assert.deepEqual(new Set(g.recentDeclined), new Set(original.filter((id) => id !== held)));
  const replacements = ids(g);
  g.chooseMod('missing');
  assert.deepEqual(new Set(g.recentDeclined), new Set(original.filter((id) => id !== held)));
  g.chooseMod(held);
  assert(!g.recentDeclined.includes(held));
  assert.deepEqual(
    new Set(g.recentDeclined),
    new Set([...original, ...replacements].filter((id) => id !== held)),
  );
  assert.equal(g.heldReward, null);
  assert(saveOf(g).draftHistory);

  const boundary = begin(2, 'RF-C100-ZONE-BOUNDARY');
  const declined = ids(boundary).slice(1);
  boundary.chooseMod(boundary.offers[0].id);
  assert.equal(boundary.stage, 3);
  assert.deepEqual(new Set(boundary.recentDeclined), new Set(declined));
  clear(boundary);
  boundary.openReward();
  assert(boundary.holdReward(boundary.offers[0].id));
  boundary.chooseMod(boundary.offers[0].id);
  assert.equal(boundary.stage, 4);
  assert.equal(boundary.heldReward, null);
  assert.deepEqual(boundary.recentDeclined, []);
  assert.equal(boundary.draftHistory, undefined);
  assert.equal(saveOf(boundary).draftHistory, undefined);
});

test('special rewards reject holding and earned salvage can never be pinned', () => {
  for (const flag of ['courierReward', 'welderReward', 'auditorReward'] as const) {
    const g = begin();
    g[flag] = true;
    const before = ids(g),
      hp = g.hp;
    assert(!g.canHoldReward);
    assert(!g.holdReward(before[0]));
    assert(!g.rerollReward());
    assert.deepEqual(ids(g), before);
    assert.equal(g.hp, hp);
  }
  const boss = begin(3, 'RF-C100-SALVAGE', false);
  boss.earnedSalvage = 'ramjet';
  boss.openReward();
  const salvage = boss.offers.find((offer) => isSalvage(offer.id));
  assert(salvage);
  assert(!boss.holdReward(salvage.id));
  const ordinary = boss.offers.find((offer) => !isSalvage(offer.id));
  assert(ordinary);
  assert(boss.holdReward(ordinary.id), 'ordinary choices alongside salvage can still be held');
});

test('legacy Campaign and pinned Daily choices retain their existing reroll behavior', () => {
  for (const seed of ['RF-C99-LEGACY-DRAFT', 'RF-C90-LEGACY-DRAFT', 'unversioned-draft']) {
    const g = begin(0, seed);
    const original = ids(g);
    assert(!g.canHoldReward);
    assert(!g.holdReward(original[0]));
    assert(g.rerollReward());
    assert(g.offers.every((offer) => !original.includes(offer.id)));
    assert.equal(g.hp, 52);
    assert.equal(g.draftHistory, undefined);
    assert.equal(saveOf(g).draftHistory, undefined);
  }
  const seed = dailyForDate('2026-09-13')!.seed;
  const daily = begin(0, seed);
  const original = ids(daily);
  assert.equal(original.length, 1);
  assert(!daily.canHoldReward);
  assert(!daily.holdReward(original[0]));
  assert(!daily.rerollReward());
  assert.deepEqual(ids(daily), original);
  assert.equal(daily.hp, 64);
  assert.equal(saveOf(daily).draftHistory, undefined);
});
