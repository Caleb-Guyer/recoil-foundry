import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UPRISING_REPAIR,
  newJobReward,
  uprisingRefitOffer,
  validUprisingReward,
  validUprisingRewardShape,
  currentBuildMatchesReward,
  chooseUprisingReward,
  uprisingRerollCredits,
  spendUprisingReroll,
  uprisingRewardBuild,
  type UprisingReward,
  type UprisingRewardContext,
} from '../src/uprising-rewards.ts';
import { uprisingRewardMarkup } from '../src/uprising-reward-menu.ts';
import { UPRISING_ROUTES, uprisingRoute, type UprisingRouteId } from '../src/uprising-model.ts';
import {
  MODS,
  MOD_REQUIRES,
  FUSION_REQUIRES,
  availableMods,
  buildPath,
  isFusion,
  getGun,
  validSavedBuild,
} from '../src/rules.ts';
import { BRANCH_PARENTS, BRANCH_STAGE, isBranch } from '../src/upgrade-branches.ts';
import { LONGEVITY_IDS, draftUnlocked } from '../src/longevity.ts';
import { STARTING_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
import { testCheckpoint } from '../src/practice.ts';
import { withParents } from '../src/branch-builds.ts';
import { legalSwaps } from '../src/reforge-rules.ts';
import { inspectUpgrade } from '../src/upgrade-inspection.ts';
import { createUpgradeDemo, destroyUpgradeDemo, upgradeDemoInput } from '../src/upgrade-demo.ts';

const seed = 'RF-C105-PAYMENT-TEST';
function source(
  route: UprisingRouteId = 'rail-heist',
  startingGun: StartingGun = 'pistol',
  hp = 64,
): UprisingRewardContext {
  return {
    seed,
    route,
    mods: testCheckpoint(seed, uprisingRoute(route).fork + 1).mods,
    startingGun,
    hp,
    unlocks: [],
  };
}
function pending(context = source()) {
  return newJobReward(
    context.seed,
    context.route,
    context.mods,
    context.startingGun,
    context.unlocks,
    context.legacyMods,
  );
}
const identity = { seed, route: 'rail-heist' as const };
const protectedFire = [
  'cutting-torch',
  'shellshock',
  'mass-driver',
  'fold',
  'recall',
  'vector',
  'grindshot',
  'suspension',
  'tripwire',
  'crossfire',
];

test('all eleven jobs and six guns prepare deterministic independent legal payments without gameplay RNG', () => {
  const original = Math.random;
  try {
    Math.random = () => {
      throw Error('Job payment consumed global RNG');
    };
    for (const route of UPRISING_ROUTES)
      for (const gun of STARTING_GUN_IDS) {
        const context = source(route.id, gun),
          before = structuredClone(context),
          reward = pending(context);
        assert(validUprisingRewardShape(reward));
        assert(validUprisingReward(reward, context));
        assert.equal(reward.stage, route.fork + 1);
        assert.equal(reward.startingGun, gun);
        assert.deepEqual(pending(context), reward);
        assert.deepEqual(context, before);
        reward.baseMods.push('invalid');
        assert.notDeepEqual(pending(context), reward);
      }
  } finally {
    Math.random = original;
  }
});

test('every upgrade family keeps prerequisite parents, path, earned fusions and fire mechanism', () => {
  const core = ['magnum', 'rapid', 'light', 'airshot', 'kick', 'scatter', 'pierce', 'leech'];
  let checked = 0,
    offered = 0;
  for (const mod of MODS) {
    const mods = withParents(core, [mod.id]);
    assert(mods, mod.id);
    const context = { ...source('roof-relief'), mods, unlocks: [...LONGEVITY_IDS] };
    const reward = pending(context),
      swap = reward.offer;
    assert(validUprisingReward(reward, context));
    checked++;
    if (!swap) continue;
    offered++;
    const next = uprisingRewardBuild(mods, swap),
      parents = new Set(
        mods.flatMap((id) => [
          ...(MOD_REQUIRES[id] ? [MOD_REQUIRES[id]] : []),
          ...(BRANCH_PARENTS[id] ?? []),
          ...(FUSION_REQUIRES[id] ?? []),
        ]),
      );
    assert(validSavedBuild(next), mod.id);
    assert.equal(next.length, mods.length);
    assert.equal(buildPath(next), buildPath(mods));
    assert(!parents.has(swap.from));
    assert(!isFusion(swap.from) && !isFusion(swap.to));
    for (const id of [...protectedFire, ...mods.filter(isFusion)])
      assert.equal(next.includes(id), mods.includes(id), mod.id + ' changed ' + id);
  }
  assert.equal(checked, MODS.length);
  assert(offered > MODS.length * 0.8, 'constraints still allow useful refits');
});

test('refits obey current-stage branches and earned unlocks instead of inventing advanced fittings', () => {
  for (const route of UPRISING_ROUTES)
    for (const gun of STARTING_GUN_IDS) {
      const context = source(route.id, gun),
        reward = pending(context);
      if (!reward.offer) continue;
      assert(draftUnlocked(reward.offer.to, context.unlocks, context.seed));
      if (reward.stage < BRANCH_STAGE) assert(!isBranch(reward.offer.to));
      assert(
        legalSwaps(context.mods, reward.stage, undefined, [], seed).some(
          (s) => s.from === reward.offer!.from && s.to === reward.offer!.to,
        ),
      );
    }
  const empty = { ...source(), mods: [] };
  assert.equal(pending(empty).offer, undefined);
  assert.equal(
    uprisingRefitOffer('RF-C104-HISTORY', 'rail-heist', source().mods, 'pistol'),
    undefined,
  );
});

test('each payment is one immutable choice and repairs use actual capped native health', () => {
  for (const hp of [1, 64, 96, 99.5]) {
    const context = source('rail-heist', 'pistol', hp),
      reward = pending(context),
      before = structuredClone({ reward, context });
    const payment = chooseUprisingReward(reward, 'repair', context);
    assert(payment);
    assert.equal(payment.hp, Math.min(100, hp + UPRISING_REPAIR));
    assert.deepEqual(payment.mods, context.mods);
    assert.equal(payment.reward.selected, 'repair');
    assert.deepEqual({ reward, context }, before);
    for (const choice of ['repair', 'reroll', 'refit'] as const)
      assert.equal(
        chooseUprisingReward(payment.reward, choice, {
          ...context,
          hp: payment.hp,
          mods: payment.mods,
        }),
        null,
      );
  }
  assert.equal(
    chooseUprisingReward(
      pending(source('rail-heist', 'pistol', 100)),
      'repair',
      source('rail-heist', 'pistol', 100),
    ),
    null,
  );
  const context = source('rail-heist', 'pistol', 100);
  assert(chooseUprisingReward(pending(context), 'reroll', context));
});

test('refit preserves the chosen gun and applies exactly the native before-after inspected build', () => {
  for (const gun of STARTING_GUN_IDS) {
    const context = source('scrap-raid', gun),
      reward = pending(context);
    assert(reward.offer);
    const payment = chooseUprisingReward(reward, 'refit', context);
    assert(payment);
    const mod = MODS.find((m) => m.id === reward.offer!.to)!;
    const preview = inspectUpgrade(
      context.mods,
      mod,
      gun,
      context.hp,
      reward.offer.from,
      context.seed,
    );
    assert.deepEqual(payment.mods, preview.afterMods);
    assert.deepEqual(getGun(payment.mods, gun), getGun(preview.afterMods, preview.startingGun));
    assert.equal(payment.hp, context.hp);
    assert.equal(payment.mods.length, context.mods.length);
    assert(currentBuildMatchesReward(payment.reward, payment.mods, gun));
    assert(!currentBuildMatchesReward(payment.reward, context.mods, gun));
  }
});

test('pending, chosen and spent receipts survive serialization without granting a second choice', () => {
  const context = source(),
    reward = pending(context);
  assert(validUprisingReward(JSON.parse(JSON.stringify(reward)), context));
  for (const choice of ['repair', 'reroll', 'refit'] as const) {
    if (choice === 'refit' && !reward.offer) continue;
    const result = chooseUprisingReward(reward, choice, context);
    assert(result);
    const saved = JSON.parse(JSON.stringify(result.reward));
    assert(validUprisingReward(saved, context));
    assert(currentBuildMatchesReward(saved, result.mods, context.startingGun));
    assert.equal(
      chooseUprisingReward(saved, choice, { ...context, mods: result.mods, hp: result.hp }),
      null,
    );
    if (choice === 'reroll') {
      assert(spendUprisingReroll([{ reward: saved }]));
      assert(validUprisingReward(saved, context));
      assert.equal(spendUprisingReroll([{ reward: saved }]), false);
    }
  }
});

test('a payment cannot apply to a dead player, changed build, gun, unlock snapshot or previous campaign', () => {
  const context = source(),
    reward = pending(context);
  for (const hp of [NaN, Infinity, -1, 0, 101])
    assert.equal(chooseUprisingReward(reward, 'reroll', { ...context, hp }), null);
  const extra = availableMods(context.mods)[0].id;
  for (const change of [
    { mods: [...context.mods, extra] },
    { startingGun: 'shotgun' as const },
    { unlocks: [LONGEVITY_IDS[0]] },
    { seed: 'RF-C104-HISTORY' },
    { route: 'core-defense' as const },
  ])
    assert.equal(chooseUprisingReward(reward, 'reroll', { ...context, ...change }), null);
  assert.equal(chooseUprisingReward(reward, 'made-up' as never, context), null);
});

test('malformed, unknown, mismatched-stage and forged deterministic offer records are rejected', () => {
  const context = source(),
    reward = pending(context);
  const invalid: unknown[] = [
    null,
    {},
    [],
    { ...reward, version: 2 },
    { ...reward, stage: 4 },
    { ...reward, stage: '5' },
    { ...reward, extra: true },
    { ...reward, baseMods: ['missing'] },
    { ...reward, baseMods: [...reward.baseMods, reward.baseMods[0]] },
    { ...reward, startingGun: 'missing' },
    { ...reward, unlocks: ['magnum'] },
    { ...reward, selected: 'missing' },
    { ...reward, rerollSpent: true },
    { ...reward, selected: 'repair', rerollSpent: true },
    { ...reward, selected: 'reroll', rerollSpent: false },
    { ...reward, offer: { from: 'missing', to: 'rapid' } },
    { ...reward, offer: { from: reward.baseMods[0], to: reward.baseMods[0] } },
    { ...reward, offer: { ...reward.offer, extra: true } },
    { ...reward, offer: undefined, selected: 'refit' },
  ];
  for (const raw of invalid) {
    assert.equal(validUprisingRewardShape(raw), false, JSON.stringify(raw));
    assert.equal(validUprisingReward(raw, context), false);
  }
  assert.equal(validUprisingReward(reward, { ...context, route: 'core-defense' }), false);
  const alternate = legalSwaps(context.mods, reward.stage, undefined, [], seed).find(
    (offer) =>
      JSON.stringify(offer) !== JSON.stringify(reward.offer) &&
      validUprisingRewardShape({ ...reward, offer }),
  );
  assert(alternate);
  assert.equal(
    validUprisingReward({ ...reward, offer: alternate }, context),
    false,
    'a legal but unoffered swap is not a valid receipt',
  );
  assert.throws(() => newJobReward('RF-C104-HISTORY', 'rail-heist', context.mods), /Invalid/);
});

test('legacy fitting prefixes cannot be removed or silently normalized by job refits', () => {
  const legacyMods = ['magnum', 'rapid'],
    mods = [...legacyMods, 'light', 'airshot', 'kick'];
  const context = { ...source(), mods, legacyMods },
    reward = pending(context);
  assert(validUprisingReward(reward, context));
  if (reward.offer) {
    assert(!legacyMods.includes(reward.offer.from));
    const result = chooseUprisingReward(reward, 'refit', context)!;
    assert(result);
    assert.deepEqual(result.mods.slice(0, 2), legacyMods);
    assert(currentBuildMatchesReward(result.reward, result.mods, 'pistol', legacyMods));
  }
  assert(!currentBuildMatchesReward(reward, mods, 'pistol'));
});

test('stored credits spend oldest first, stay separate from other payments and cannot be replayed', () => {
  const routes = ['rail-escape', 'core-defense', 'crew-relief', 'roof-escape'] as const;
  const outcomes = routes.map((route) => {
    const context = source(route),
      payment = chooseUprisingReward(pending(context), 'reroll', context)!;
    return { reward: payment.reward };
  });
  assert.equal(uprisingRerollCredits(outcomes), 4);
  for (let count = 4; count > 0; count--) {
    assert(spendUprisingReroll(outcomes));
    assert.equal(uprisingRerollCredits(outcomes), count - 1);
    assert.equal(outcomes[4 - count].reward.rerollSpent, true);
  }
  assert.equal(spendUprisingReroll(outcomes), false);
  assert.equal(uprisingRerollCredits(outcomes), 0);
  for (let i = 0; i < routes.length; i++)
    assert(validUprisingReward(outcomes[i].reward, { seed, route: routes[i] }));
  const repair = chooseUprisingReward(pending(), 'repair', source())!;
  assert.equal(uprisingRerollCredits([{ reward: repair.reward }]), 0);
  assert.equal(spendUprisingReroll([{ reward: pending() }]), false);
});

test('historical payments remain valid after later upgrades while the current-payment build guard stays strict', () => {
  const context = source(),
    reward = pending(context),
    selected = chooseUprisingReward(reward, 'reroll', context)!.reward;
  const later = [...context.mods, availableMods(context.mods)[0].id];
  assert(validUprisingReward(selected, context));
  assert(!currentBuildMatchesReward(selected, later, 'pistol'));
  assert(currentBuildMatchesReward(selected, context.mods, 'pistol'));
});

test('compact payment markup makes the native tradeoff clear, escapes text and requires refit comparison', () => {
  const context = source(),
    reward = pending(context);
  assert(reward.offer);
  const markup = uprisingRewardMarkup({
    ...context,
    reward,
    title: 'Crew <saved>',
    consequence: 'Cover & support',
  });
  assert(markup.includes('Crew &lt;saved&gt;'));
  assert(markup.includes('Cover &amp; support'));
  assert.equal((markup.match(/data-job-reward="/g) ?? []).length, 3);
  assert(!markup.includes('<canvas'));
  assert(markup.includes('ordinary room upgrade'));
  assert(markup.includes('64 → 84 HP'));
  const refit = uprisingRewardMarkup({ ...context, reward }, 'refit');
  assert(refit.includes('data-job-reward-confirm disabled'));
  assert(refit.includes('upgrade-preview'));
  const noOffer = pending({ ...context, mods: [] });
  assert.equal(
    (
      uprisingRewardMarkup({ ...context, mods: [], reward: noOffer }).match(/data-job-reward="/g) ??
      []
    ).length,
    2,
  );
  const paid = chooseUprisingReward(reward, 'reroll', context)!.reward;
  assert(!uprisingRewardMarkup({ ...context, reward: paid }).includes('data-job-reward="'));
});

test('native preview simulations accept both complete builds without altering progress or the original reward', () => {
  const context = {
    ...source('scrap-raid'),
    mods: withParents(
      ['magnum', 'rapid', 'light', 'airshot', 'kick', 'scatter'],
      ['cutting-torch', 'prism-array'],
    )!,
  };
  assert(validSavedBuild(context.mods));
  const reward = pending(context);
  assert(reward.offer);
  const before = structuredClone(reward);
  const result = chooseUprisingReward(reward, 'refit', context)!;
  assert(result);
  for (const mods of [context.mods, result.mods]) {
    const g = createUpgradeDemo(mods, 'pistol', seed, reward.offer.to);
    for (let i = 0; i < 120; i++) g.tick(1 / 60, upgradeDemoInput(g, i));
    assert(Number.isFinite(g.hp));
    assert.deepEqual(g.mods, mods);
    destroyUpgradeDemo(g);
  }
  assert.deepEqual(reward, before);
});
