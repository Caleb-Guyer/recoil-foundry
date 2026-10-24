import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODS,
  OPENING_POWER_MODS,
  OPENING_IDENTITY_MODS,
  DRAFT_DECLINE_LIMIT,
  availableMods,
  betterDraftCampaign,
  buildFollowup,
  draftFitReason,
  draftRole,
  loadCheckpoint,
  rewardMods,
  seeded,
  updateDraftDeclines,
  type Checkpoint,
  type RewardContext,
} from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { LONGEVITY_IDS } from '../src/longevity.ts';
import { dailyForDate, SUPPORTED_DAILY_RULESETS } from '../src/daily.ts';

const current: RewardContext = {
  stage: 8,
  seed: 'RF-C100-DRAFT-RULES',
  unlocks: LONGEVITY_IDS,
};
const ids = (cards: ReturnType<typeof rewardMods>) => cards.map((card) => card.id);

test('Better Drafts is a Campaign-only revision and historical draft streams consume identical randomness', () => {
  assert(betterDraftCampaign('RF-C100-NEW'));
  assert(betterDraftCampaign('RF-C101-FUTURE'));
  for (const seed of [
    'old-run',
    'RF-C99-OLD',
    'RF-D100-2026-10-24',
    ...SUPPORTED_DAILY_RULESETS.map((version) => dailyForDate('2026-10-24', version)!.seed),
  ]) {
    assert(!betterDraftCampaign(seed));
    for (const count of [1, 3, 200]) {
      const first = seeded('unchanged-' + seed),
        second = seeded('unchanged-' + seed);
      const base = { ...current, seed };
      assert.deepEqual(
        rewardMods(['magnum', 'cutting-torch'], count, first, base),
        rewardMods(['magnum', 'cutting-torch'], count, second, {
          ...base,
          startingGun: 'shotgun',
          recentDeclined: ['rapid', 'pierce', 'prism-array'],
          held: 'pierce',
          heldIndex: 1,
        }),
      );
      assert.equal(first(), second(), 'historical RNG position stays exact');
    }
  }
});

test('all six native tools receive a practical fit and varied legal alternatives', () => {
  for (const gun of STARTING_GUN_IDS) {
    for (let i = 0; i < 64; i++) {
      const cards = rewardMods([], 3, seeded('native-' + i), { ...current, startingGun: gun });
      assert.equal(cards.length, 3);
      assert.equal(new Set(ids(cards)).size, 3);
      assert(
        cards.some((card) => draftFitReason(card.id, [], gun)),
        gun,
      );
      assert(new Set(cards.map((card) => draftRole(card.id))).size >= 2);
      assert(cards.every((card) => availableMods([]).includes(card)));
    }
  }
  let different = 0;
  for (let i = 0; i < 100; i++) {
    const pistol = ids(
      rewardMods([], 3, seeded('paired-' + i), { ...current, startingGun: 'pistol' }),
    );
    const shotgun = ids(
      rewardMods([], 3, seeded('paired-' + i), { ...current, startingGun: 'shotgun' }),
    );
    if (pistol.join() !== shotgun.join()) different++;
  }
  assert(different > 40, 'the native tool changes actual choices across shared random streams');
});

test('opening gun strength and mechanic introductions remain available', () => {
  for (const gun of STARTING_GUN_IDS)
    for (const stage of [0, 1, 2])
      for (let i = 0; i < 32; i++) {
        const cards = rewardMods([], 3, seeded('opening-' + i), {
          ...current,
          stage,
          factory: true,
          startingGun: gun,
        });
        assert(cards.some((card) => OPENING_POWER_MODS.includes(card.id)));
        if (stage < 2) assert(cards.some((card) => OPENING_IDENTITY_MODS.includes(card.id)));
        assert(cards.some((card) => draftFitReason(card.id, [], gun)));
      }
});

test('decline memory is bounded, immutable and records the most recent valid unique cards', () => {
  const previous = ['magnum', 'rapid', 'pierce'];
  const next = updateDraftDeclines(previous, ['rapid', 'invalid', 'scatter', 'repair', 'magnum']);
  assert.deepEqual(previous, ['magnum', 'rapid', 'pierce']);
  assert.deepEqual(next, ['pierce', 'rapid', 'scatter', 'magnum']);
  const many = MODS.slice(0, 20).map((card) => card.id);
  assert.deepEqual(updateDraftDeclines([], many), many.slice(-DRAFT_DECLINE_LIMIT));
});

test('recently declined cards stay out of roomy later drafts and remain a bounded fallback', () => {
  const first = ids(rewardMods([], 3, seeded('decline-first'), current));
  for (let i = 0; i < 64; i++) {
    const next = rewardMods([], 3, seeded('decline-' + i), { ...current, recentDeclined: first });
    assert(next.every((card) => !first.includes(card.id)));
  }
  const legal = ids(rewardMods([], 200, seeded('pool'), current));
  const allowed = ['magnum', 'rapid', 'light'];
  const excluded = legal.filter((id) => !allowed.includes(id));
  const narrow = ids(
    rewardMods(
      [],
      3,
      seeded('narrow'),
      {
        ...current,
        recentDeclined: ['magnum', 'rapid'],
      },
      excluded,
    ),
  );
  assert.deepEqual(new Set(narrow), new Set(allowed));
  assert.equal(
    narrow[1],
    'light',
    'after the useful fit, consume fresh alternatives before declined fallback slots',
  );
  const one = ids(
    rewardMods(
      [],
      3,
      seeded('one'),
      current,
      legal.filter((id) => id !== 'rapid'),
    ),
  );
  assert.deepEqual(one, ['rapid']);
  assert.deepEqual(rewardMods([], 3, seeded('none'), current, legal), []);
});

test('a useful fit can revisit a declined card while the other two choices stay fresh', () => {
  const recentDeclined = ['magnum', 'rapid', 'airshot', 'kick', 'pierce', 'burst', 'capacitor'];
  for (let i = 0; i < 64; i++) {
    const cards = rewardMods([], 3, seeded('all-fits-declined-' + i), {
      ...current,
      startingGun: 'pistol',
      recentDeclined,
    });
    assert(cards.some((card) => draftFitReason(card.id, [], 'pistol')));
    assert.equal(cards.filter((card) => recentDeclined.includes(card.id)).length, 1);
  }
  for (let i = 0; i < 32; i++) {
    const cards = rewardMods([], 3, seeded('opening-power-declined-' + i), {
      ...current,
      stage: 0,
      factory: true,
      recentDeclined: OPENING_POWER_MODS,
    });
    assert(cards.some((card) => OPENING_POWER_MODS.includes(card.id)));
    assert.equal(cards.filter((card) => OPENING_POWER_MODS.includes(card.id)).length, 1);
  }
});

test('holding keeps one original ordinary card in its slot and replaces only the other two', () => {
  for (const gun of STARTING_GUN_IDS)
    for (let index = 0; index < 3; index++)
      for (let i = 0; i < 16; i++) {
        const context = { ...current, startingGun: gun };
        const original = rewardMods([], 3, seeded('held-first-' + i), context);
        const excluded = ids(original);
        const next = rewardMods(
          [],
          3,
          seeded('held-reroll-' + i),
          {
            ...context,
            held: original[index].id,
            heldIndex: index,
          },
          excluded,
        );
        assert.equal(next[index], original[index]);
        assert.equal(next.length, 3);
        assert.equal(new Set(ids(next)).size, 3);
        assert(
          next
            .filter((card) => card.id !== original[index].id)
            .every((card) => !excluded.includes(card.id)),
        );
        assert.deepEqual(
          next,
          rewardMods(
            [],
            3,
            seeded('held-reroll-' + i),
            {
              ...context,
              held: original[index].id,
              heldIndex: index,
            },
            excluded,
          ),
        );
      }
});

test('held inputs cannot bypass owned, excluded alternatives, prerequisites, unlocks or stage rules', () => {
  const locked = LONGEVITY_IDS.find((id) => !availableMods([]).some((card) => card.id === id))!;
  for (const held of ['magnum', 'prism-array', 'cinder', 'repair', locked, 'unknown']) {
    const cards = rewardMods(
      ['magnum'],
      3,
      seeded('held-invalid-' + held),
      {
        ...current,
        stage: 0,
        unlocks: [],
        held,
      },
      ['rapid'],
    );
    assert(!cards.some((card) => card.id === held), held);
    assert(!cards.some((card) => card.id === 'rapid'));
  }
});

test('developed mechanisms and branch, fusion, unlock and salvage rules remain legal', () => {
  const builds = [
    ['magnum', 'scatter', 'cutting-torch'],
    ['magnum', 'deadeye', 'capacitor'],
    ['magnum', 'shellshock', 'fuse'],
    ['rapid', 'crossfire', 'afterimage'],
    ['light', 'kick', 'double-jump'],
    ['rapid', 'suspension', 'crosshatch'],
  ];
  for (const mods of builds)
    for (const overtime of [false, true])
      for (let i = 0; i < 32; i++) {
        const context = { ...current, overtime };
        const cards = rewardMods(mods, 3, seeded('mechanism-' + i), context);
        const legal = rewardMods(mods, 200, seeded('legal'), context);
        assert(cards.every((card) => legal.includes(card)));
        assert(cards.some((card) => draftFitReason(card.id, mods)));
        assert.equal(new Set(ids(cards)).size, cards.length);
      }
  const salvage = rewardMods([], 3, seeded('salvage'), { ...current, stage: 7, salvage: 'cinder' });
  assert.equal(salvage[0].id, 'cinder');
  assert(
    !rewardMods(
      [],
      3,
      seeded('no-salvage-hold'),
      {
        ...current,
        stage: 7,
        held: 'cinder',
        salvage: 'cinder',
      },
      ids(salvage),
    ).some((card) => card.id === 'cinder'),
  );
  assert.equal(draftFitReason('prism-array', ['cutting-torch']), 'Develops Cutting Torch');
  assert(buildFollowup('prism-array', ['cutting-torch']));
});

test('full-pool and non-three-card queries retain the exact legacy selection and RNG stream', () => {
  for (const count of [0, 1, 2, 200]) {
    const first = seeded('count-' + count),
      second = seeded('count-' + count);
    assert.deepEqual(
      rewardMods([], count, first, { ...current, held: 'rapid', recentDeclined: ['magnum'] }),
      rewardMods([], count, second, { ...current, seed: 'RF-C99-DRAFT-RULES' }),
    );
    assert.equal(first(), second());
  }
});

const checkpoint = (): Checkpoint => ({
  version: 6,
  seed: current.seed!,
  stage: 0,
  hp: 100,
  mods: [],
  kills: 0,
  elapsed: 0,
  reward: { offers: ['magnum', 'rapid', 'light'], rerolled: false },
});
test('new history and pending holds survive validation without admitting malformed or legacy state', () => {
  const valid = checkpoint();
  valid.draftHistory = { zone: 0, declined: ['scatter', 'leech'] };
  valid.reward!.held = 'rapid';
  assert(loadCheckpoint(valid));
  const otherZone = structuredClone(valid);
  otherZone.draftHistory!.zone = 4;
  assert(loadCheckpoint(otherZone), 'a just-completed zone may be serialized before moving on');
  for (const patch of [
    { zone: -1, declined: [] },
    { zone: 5, declined: [] },
    { zone: 0.5, declined: [] },
    { zone: 0, declined: ['magnum', 'magnum'] },
    { zone: 0, declined: ['unknown'] },
    { zone: 0, declined: ['repair'] },
    { zone: 0, declined: MODS.slice(0, 10).map((card) => card.id) },
    { zone: 0, declined: null },
    null,
  ]) {
    const invalid = structuredClone(valid) as unknown as Record<string, unknown>;
    invalid.draftHistory = patch;
    assert.equal(loadCheckpoint(invalid), null);
  }
  for (const seed of [null, 3, {}, { toString: 3 }, ['RF-C100-FAKE']])
    assert.equal(loadCheckpoint({ ...valid, seed }), null);
  for (const seed of ['RF-C99-OLD', 'old-run', 'RF-D90-2026-10-24']) {
    assert.equal(loadCheckpoint({ ...valid, seed }), null);
  }
  for (const held of ['cinder', 'repair', 'unknown', 12]) {
    const invalid = structuredClone(valid);
    (invalid.reward as unknown as Record<string, unknown>).held = held;
    assert.equal(loadCheckpoint(invalid), null);
  }
  for (const change of [
    { rerolled: true },
    { courier: true },
    { auditor: true },
    { welder: true },
    { offers: ['rapid', 'light'] },
  ]) {
    const invalid = structuredClone(valid);
    Object.assign(invalid.reward!, change);
    assert.equal(loadCheckpoint(invalid), null);
  }
});
