import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, EXTRACTION_DURATION } from '../src/game.ts';
import { uprisingRemasterTestFromUrl } from '../src/uprising-remaster-test.ts';
import {
  newJobReward,
  chooseUprisingReward,
  type UprisingRewardChoice,
} from '../src/uprising-rewards.ts';
import { newUprising, type UprisingRouteId } from '../src/uprising-model.ts';
import {
  availableMods,
  getGun,
  loadCheckpoint,
  seeded,
  rewardMods,
  type Checkpoint,
} from '../src/rules.ts';
import { testCheckpoint } from '../src/practice.ts';
import { LONGEVITY_IDS } from '../src/longevity.ts';

function clean(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function paymentFixture(hp = 64) {
  const source = uprisingRemasterTestFromUrl(
    new URL('https://test/?test=uprising-remaster&route=rewards&v=1'),
  )!;
  assert(source);
  const cp = structuredClone(source.checkpoint);
  cp.hp = hp;
  assert(loadCheckpoint(cp), 'fixture must be a legal saved run');
  const g = new Game();
  g.start(cp.seed, cp);
  assert.equal(g.mode, 'upgrade');
  assert(g.uprising.pendingPayment);
  return g;
}
function save(g: Game) {
  const cp = loadCheckpoint(JSON.parse(JSON.stringify(g.checkpointSnapshot())));
  assert(cp, 'native payment snapshot must load');
  return cp;
}
function resume(g: Game) {
  const cp = save(g),
    restored = new Game();
  restored.start(cp.seed, cp);
  return restored;
}
function allHistory(seed: string, mods: readonly string[]) {
  const choices: UprisingRouteId[] = ['rail-escape', 'core-defense', 'crew-relief', 'roof-escape'];
  const run = newUprising();
  run.version = 3;
  run.choices = choices;
  run.outcomes = choices.map((route, i) => {
    const baseMods = mods.slice(0, [5, 9, 13, 17][i]);
    const context = {
      seed,
      route,
      mods: baseMods,
      startingGun: 'pistol' as const,
      hp: 80,
      unlocks: [...LONGEVITY_IDS],
    };
    const reward = newJobReward(seed, route, baseMods, 'pistol', context.unlocks);
    return {
      route,
      result: 'success' as const,
      reward: chooseUprisingReward(reward, 'reroll', context)!.reward,
    };
  });
  return run;
}

test('pending native job payments block hold, reroll and ordinary upgrade acceptance across Continue', () => {
  const g = paymentFixture(),
    base = [...g.mods],
    stage = g.stage,
    hp = g.hp,
    offers = g.offers.map((m) => m.id);
  assert.equal(g.canReroll, false);
  assert.equal(g.canHoldReward, false);
  assert.equal(g.rerollReward(), false);
  assert.equal(g.holdReward(offers[0]), false);
  g.chooseMod(offers[0]);
  assert.deepEqual(g.mods, base);
  assert.equal(g.stage, stage);
  assert.equal(g.hp, hp);
  const h = resume(g);
  assert(h.uprising.pendingPayment);
  assert.equal(h.mode, 'upgrade');
  assert.deepEqual(
    h.offers.map((m) => m.id),
    offers,
  );
  assert.equal(h.canReroll, false);
  assert.equal(h.canHoldReward, false);
  assert(h.uprising.claimPayment('repair'));
  assert.equal(h.hp, hp + 20);
  assert.equal(h.uprising.pendingPayment, null);
  assert.equal(h.uprising.outcome?.reward?.selected, 'repair');
  assert.equal(h.uprising.claimPayment('repair'), false);
  assert.equal(h.uprising.claimPayment('reroll'), false);
  assert.deepEqual(h.mods, base);
  save(h);
  clean(g);
  clean(h);
});

for (const choice of ['repair', 'reroll', 'refit'] as const)
  test(`${choice} payment is exactly once, survives native resume, and leaves the ordinary room upgrade intact`, () => {
    const g = paymentFixture(),
      base = [...g.mods],
      startingGun = g.startingGun,
      stage = g.stage;
    assert(g.uprising.claimPayment(choice));
    assert.equal(g.uprising.pendingPayment, null);
    assert.equal(g.uprising.outcome?.reward?.selected, choice);
    assert.equal(g.mods.length, base.length);
    assert.equal(g.startingGun, startingGun);
    assert.equal(g.mode, 'upgrade');
    assert.equal(g.uprising.claimPayment(choice), false);
    assert.equal(g.offers.length, 3);
    assert.equal(g.rewardTaken, false);
    assert.equal(g.rewardRerolled, false);
    assert.deepEqual(g.gun, getGun(g.mods, g.startingGun));
    const h = resume(g);
    assert.equal(h.uprising.pendingPayment, null);
    assert.equal(h.uprising.outcome?.reward?.selected, choice);
    assert.deepEqual(h.mods, g.mods);
    assert.equal(h.hp, g.hp);
    assert.equal(h.uprising.claimPayment(choice), false);
    const offered = h.offers[0].id;
    h.chooseMod(offered);
    assert.equal(h.stage, stage + 1);
    assert.equal(h.mods.length, base.length + 1);
    assert(h.mods.includes(offered));
    assert.equal(h.uprising.run?.outcomes[0].reward?.selected, choice);
    save(h);
    clean(g);
    clean(h);
  });

for (const holdIndex of [0, 1, 2])
  test(`a paid reroll credit preserves held slot ${holdIndex + 1}, costs no health and stays spent across Continue`, () => {
    const g = paymentFixture(1);
    assert(!g.hunts.freeReroll && !g.areaEvents.freeReroll);
    assert(g.uprising.claimPayment('reroll'));
    assert(g.uprising.freeReroll);
    assert(g.canReroll);
    assert(g.canHoldReward);
    const hp = g.hp,
      held = g.offers[holdIndex].id;
    assert(g.holdReward(held));
    assert.equal(g.heldReward, held);
    assert(g.rerollReward());
    assert.equal(g.hp, hp);
    assert.equal(g.offers[holdIndex].id, held);
    assert.equal(g.heldReward, null);
    assert.equal(g.rewardRerolled, true);
    assert.equal(g.uprising.freeReroll, false);
    assert.equal(g.uprising.outcome?.reward?.rerollSpent, true);
    const h = resume(g);
    assert.equal(h.hp, hp);
    assert.equal(h.uprising.freeReroll, false);
    assert.equal(h.uprising.outcome?.reward?.rerollSpent, true);
    assert.equal(h.canReroll, false);
    assert.equal(h.rerollReward(), false);
    assert.equal(h.uprising.claimPayment('reroll'), false);
    assert.equal(h.hp, hp);
    clean(g);
    clean(h);
  });

test('a real refit clears old projectile resources and regenerates legal native ordinary offers', () => {
  const g = paymentFixture(),
    before = g.uprising.pendingPayment!,
    swap = before.offer!;
  assert(swap);
  const source = [...g.mods],
    expected = [...source.filter((id) => id !== swap.from), swap.to];
  g.addShot({
    pos: { x: 300, y: 300 },
    vel: { x: 4, y: 0 },
    damage: 4,
    life: 5,
    friendly: true,
    radius: 5,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  g.burstRemaining = 4;
  g.fireBuffer = 1;
  g.jumpBuffer = 1;
  g.muzzle = 0.3;
  g.stasis.held = true;
  assert(g.uprising.claimPayment('refit'));
  assert.deepEqual(g.mods, expected);
  assert.equal(g.shots.length, 0);
  assert.equal(g.burstRemaining, 0);
  assert.equal(g.fireBuffer, 0);
  assert.equal(g.jumpBuffer, 0);
  assert.equal(g.muzzle, 0);
  assert.equal(g.stasis.held, false);
  assert(
    g.offers.every((offer) => availableMods(g.mods, true).some((legal) => legal.id === offer.id)),
  );
  assert.equal(new Set(g.offers.map((m) => m.id)).size, g.offers.length);
  assert(!g.offers.some((m) => g.mods.includes(m.id)));
  assert.equal(g.startingGun, 'pistol');
  save(g);
  clean(g);
});

test('pending payment checkpoints reject changed snapshots, future-room rewards and receipts inserted into legacy runs', () => {
  const g = paymentFixture(),
    cp = save(g),
    offer = cp.uprising!.outcomes[0].reward!.offer!;
  assert(offer);
  const altered = { ...cp, mods: [...cp.mods.filter((id) => id !== offer.from), offer.to] };
  assert.equal(loadCheckpoint(altered), null);
  const unlockDrift = structuredClone(cp);
  unlockDrift.unlocks = [LONGEVITY_IDS[0]];
  assert.equal(
    loadCheckpoint(unlockDrift),
    null,
    'pending snapshot must bind the current unlock pool',
  );
  const reordered = structuredClone(cp);
  reordered.unlocks = LONGEVITY_IDS.slice(0, 2).reverse();
  const outcome = reordered.uprising!.outcomes[0];
  outcome.reward = newJobReward(cp.seed, outcome.route, cp.mods, 'pistol', reordered.unlocks);
  assert.equal(loadCheckpoint(reordered), null, 'pending unlocks must match native normalization');
  const rerolled = structuredClone(cp);
  rerolled.reward!.rerolled = true;
  assert.equal(loadCheckpoint(rerolled), null, 'ordinary reroll cannot precede a pending payment');
  const held = structuredClone(cp);
  held.reward!.held = held.reward!.offers[0];
  assert.equal(
    loadCheckpoint(held),
    null,
    'held ordinary choices cannot precede a pending payment',
  );
  const later = structuredClone(cp);
  later.stage++;
  later.mods.push(availableMods(later.mods)[0].id);
  later.reward = undefined;
  assert.equal(loadCheckpoint(later), null);
  const old = structuredClone(cp);
  old.uprising!.version = 2;
  assert.equal(loadCheckpoint(old), null);
  const failed = structuredClone(cp);
  failed.uprising!.outcomes[0].result = 'failed';
  assert.equal(loadCheckpoint(failed), null);
  clean(g);
});

test('first-lap credits remain valid through actual New Game+ entry and one native New Game+ reroll', () => {
  const seed = 'RF-C105-PAYMENT-NG-HISTORY',
    cp = testCheckpoint(seed, 19);
  cp.version = 6;
  cp.startingGun = 'pistol';
  cp.unlocks = [...LONGEVITY_IDS];
  cp.finaleFirstClear = 0;
  cp.uprising = allHistory(seed, cp.mods);
  assert(loadCheckpoint(cp));
  const g = new Game();
  g.start(seed, cp);
  assert(g.uprising.freeReroll);
  g.finaleFirstClear = false;
  g.clear = true;
  for (const e of g.enemies) Matter.Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.startEscape();
  assert(g.escape);
  assert(g.canOvertime);
  g.escape.phase = 'extracting';
  g.escape.destination = 'overtime';
  g.escape.depart = EXTRACTION_DURATION;
  assert(g.startOvertime());
  assert(g.overtime);
  assert(g.uprising.freeReroll);
  assert.equal(g.uprising.active, false);
  save(g);
  const h = resume(g);
  assert(h.overtime);
  assert(h.uprising.freeReroll);
  assert.equal(h.uprising.run?.outcomes.length, 4);
  // Clear only the native room roster to enter its ordinary reward UI. Payment
  // and resource integration are tested here, not a combat victory claim.
  for (const e of h.enemies) Matter.Composite.remove(h.engine.world, e.body);
  h.enemies = [];
  h.waves.clear();
  h.clear = true;
  h.openReward();
  assert.equal(h.mode, 'upgrade');
  assert(h.canReroll);
  const hp = h.hp;
  assert(h.rerollReward());
  assert.equal(h.hp, hp);
  assert.equal(h.uprising.run?.outcomes[0].reward?.rerollSpent, true);
  assert.equal(h.uprising.run?.outcomes[1].reward?.rerollSpent, undefined);
  save(h);
  clean(g);
  clean(h);
});

test('historical successful jobs without payment receipts never acquire a fresh reward on Continue', () => {
  const g = paymentFixture(),
    cp = save(g);
  delete cp.uprising!.outcomes[0].reward;
  assert(loadCheckpoint(cp));
  const h = new Game();
  h.start(cp.seed, cp);
  assert.equal(h.uprising.pendingPayment, null);
  assert.equal(h.uprising.freeReroll, false);
  assert.equal(h.uprising.claimPayment('repair'), false);
  assert.equal(h.hp, cp.hp);
  save(h);
  clean(g);
  clean(h);
});

test('changing game mode cannot claim or duplicate a pending payment', () => {
  for (const mode of ['playing', 'paused', 'dead', 'title'] as const) {
    const g = paymentFixture(),
      hp = g.hp;
    g.setMode(mode);
    assert.equal(g.uprising.claimPayment('repair'), false);
    assert.equal(g.uprising.claimPayment('reroll'), false);
    assert.equal(g.hp, hp);
    clean(g);
  }
});

for (const version of [1, 2, 3] as const)
  test(`native v${version} mission resolution preserves its payment policy and pre-exit Continue`, () => {
    const seed = `RF-C105-PAYMENT-V${version}`,
      cp = testCheckpoint(seed, version === 1 ? 1 : 5);
    cp.version = 6;
    cp.hp = 64;
    cp.startingGun = 'pistol';
    cp.uprising = newUprising(null, ['rail-heist']);
    cp.uprising.version = version;
    cp.uprising.choices = ['rail-heist'];
    assert(loadCheckpoint(cp));
    const g = new Game();
    g.start(seed, cp);
    assert(g.uprising.waiting);
    assert.equal(g.mode, 'playing');
    g.uprising.resolve(true);
    assert.equal(g.hp, version === 3 ? 64 : 72);
    assert.equal(g.uprising.run?.outcomes.length, 1);
    assert.equal(!!g.uprising.pendingPayment, version === 3);
    g.uprising.resolve(false);
    g.uprising.resolve(true);
    assert.equal(g.uprising.run?.outcomes.length, 1);
    assert.equal(g.hp, version === 3 ? 64 : 72);
    assert.equal(g.uprising.claimPayment('repair'), false);
    const saved = save(g);
    assert.equal(
      saved.reward,
      undefined,
      'completion can save before the room exit opens an upgrade',
    );
    const h = resume(g);
    assert.equal(h.mode, 'playing');
    assert.equal(h.hp, g.hp);
    assert.equal(h.uprising.waiting, false);
    assert.equal(!!h.uprising.pendingPayment, version === 3);
    assert.equal(h.uprising.claimPayment('repair'), false);
    assert.equal(h.uprising.run?.outcomes.length, 1);
    clean(g);
    clean(h);
  });
