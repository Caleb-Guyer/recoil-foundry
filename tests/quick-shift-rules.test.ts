import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUICK_SHIFT_DRAFT_STAGES,
  QUICK_SHIFT_MAX_MODS,
  QUICK_SHIFT_RECORD_LIMIT,
  QUICK_SHIFT_RECORDS_KEY,
  quickShiftCode,
  quickShiftFromSeed,
  validQuickShiftChallenge,
  quickShiftFromUrl,
  quickShiftLink,
  quickShiftRuntimeSeed,
  planQuickShift,
  quickShiftOffers,
  quickShiftLegalMods,
  validQuickShiftBuild,
  validQuickShiftRecord,
  validQuickShiftRecords,
  loadQuickShiftRecords,
  recordQuickShift,
  quickShiftBest,
  quickShiftRecordKey,
  type QuickShiftRecord,
} from '../src/quick-shift-rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { LONGEVITY_IDS } from '../src/longevity.ts';
import { availableMods, draftFitReason, seeded } from '../src/rules.ts';

const challenge = quickShiftFromSeed('RF-Q1-QUICK531')!;
function draft(seed = challenge.seed, gun = 'pistol' as const) {
  const c = quickShiftFromSeed(seed)!;
  const mods: string[] = [];
  for (let completed = 0; completed < 5; completed++)
    for (let pick = 0; pick < (completed === 0 ? 3 : 2); pick++)
      mods.push(quickShiftOffers(c, mods, completed, gun, pick)[0]);
  return mods;
}
const completedBuild = draft();
const win = (patch: Partial<QuickShiftRecord> = {}): QuickShiftRecord => ({
  version: 1,
  rules: 1,
  seed: challenge.seed,
  gun: 'pistol',
  route: 'low',
  job: 'skip',
  jobWon: false,
  outcome: 'won',
  rooms: 5,
  timeMs: 123456,
  hits: 3,
  shots: 145,
  kills: 28,
  mods: [...completedBuild],
  ...patch,
});

test('Quick Shift has a separate bounded record namespace', () => {
  assert.equal(QUICK_SHIFT_RECORDS_KEY, 'rf-quick-shift-records-v1');
  assert.equal(QUICK_SHIFT_RECORD_LIMIT, 40);
  assert.equal(QUICK_SHIFT_MAX_MODS, 11);
});

test('editable short seeds normalize without accepting another ruleset or Unicode aliases', () => {
  assert.equal(quickShiftCode(' a1b2 '), 'A1B2');
  assert.equal(quickShiftCode('rf-q1-quick531'), 'QUICK531');
  assert.equal(quickShiftCode('0123456789AB'), '0123456789AB');
  for (const value of [
    '',
    ' ',
    'A B',
    'A\nB',
    'A-B',
    'RF-Q3-ABC',
    'RF-D91-ABC',
    'A'.repeat(13),
    'ß',
    'K',
  ])
    assert.equal(quickShiftCode(value), null, value);
  assert.equal(quickShiftCode(null as unknown as string), null);
});

test('stored challenges require canonical supported seed and matching identity', () => {
  assert.deepEqual(challenge, { rules: 1, code: 'QUICK531', seed: 'RF-Q1-QUICK531' });
  assert.equal(validQuickShiftChallenge(challenge), true);
  for (const seed of [
    'QUICK531',
    'rf-q1-QUICK531',
    'RF-Q3-QUICK531',
    ' RF-Q1-A',
    'RF-Q1-',
    'RF-Q1-A'.repeat(5),
  ])
    assert.equal(quickShiftFromSeed(seed), null);
  for (const bad of [
    null,
    {},
    [],
    { ...challenge, rules: 2 },
    { ...challenge, code: 'OTHER' },
    { ...challenge, test: true },
  ])
    assert.equal(validQuickShiftChallenge(bad), false);
  assert.equal(quickShiftRuntimeSeed(challenge), 'RF-C108-QQUICK531');
});

test('real share links erase inherited tests and lock seed version and selected tool', () => {
  const link = quickShiftLink(
    challenge,
    'https://example.test/game/?test=reclaimer&daily=2026-10-27#old',
    'shotgun',
  );
  assert.equal(link, 'https://example.test/game/?quick=QUICK531&qv=1&gun=shotgun');
  assert.deepEqual(quickShiftFromUrl(new URL(link)), { challenge, gun: 'shotgun' });
  assert.deepEqual(quickShiftFromUrl(new URL('https://example.test/?quick=ABC&qv=1')), {
    challenge: quickShiftFromSeed('RF-Q1-ABC'),
    gun: 'pistol',
  });
  assert.throws(() => quickShiftLink({ ...challenge, rules: 2 } as never, 'https://example.test/'));
});

test('share parser rejects duplicates, mixed modes and unsupported or ambiguous values', () => {
  const base = 'https://example.test/?quick=QUICK531&qv=1';
  for (const tail of [
    '&quick=QUICK531',
    '&qv=1',
    '&gun=pistol&gun=pistol',
    '&test=quick-shift',
    '&daily=2026-10-27',
    '&workshop=1',
    '&seed=X',
    '&dv=91',
    '&v=1',
    '&foo=1',
    '#test',
    '&gun=unknown',
    '&gun=__proto__',
  ])
    assert.equal(quickShiftFromUrl(new URL(base + tail)), null, tail);
  for (const query of [
    'quick=A',
    'qv=1',
    'quick=a&qv=1',
    'quick=A&qv=3',
    'quick=RF-Q1-A&qv=1',
    'quick=A+B&qv=1',
  ])
    assert.equal(quickShiftFromUrl(new URL('https://example.test/?' + query)), null, query);
});

test('version-one room plan is pinned and does not share mutable arrays or random state', () => {
  const expected = {
    patrol: 'switchyard',
    tactical: ['scrap-bridge', 'inspection-lane'],
    variants: [0, 0, 2, 0],
    mirrored: false,
    boss: 'kiln',
    job: 'clean',
  };
  assert.deepEqual(planQuickShift(challenge), expected);
  const first = planQuickShift(challenge);
  first.tactical.reverse();
  first.variants[0] = 2;
  for (let i = 0; i < 50; i++) seeded('unrelated:' + i)();
  assert.deepEqual(planQuickShift({ ...challenge }), expected);
});

test('short seeds rotate actual patrols, distinct tactical rooms, early bosses, jobs and variants', () => {
  const patrols = new Set(),
    bosses = new Set(),
    jobs = new Set(),
    mirrors = new Set(),
    tactical = new Set();
  for (let i = 0; i < 100; i++) {
    const plan = planQuickShift(quickShiftFromSeed('RF-Q1-ROTATE' + i)!);
    assert.notEqual(plan.tactical[0], plan.tactical[1]);
    assert.equal(plan.variants.length, 4);
    assert(plan.variants.every((variant) => [0, 1, 2].includes(variant)));
    patrols.add(plan.patrol);
    bosses.add(plan.boss);
    jobs.add(plan.job);
    mirrors.add(plan.mirrored);
    plan.tactical.forEach((id) => tactical.add(id));
  }
  assert.equal(patrols.size, 2);
  assert.equal(bosses.size, 4);
  assert.equal(jobs.size, 2);
  assert.equal(mirrors.size, 2);
  assert.equal(tactical.size, 4);
});

test('all six tools receive deterministic useful opening choices from the same standard pool', () => {
  const identities = new Set<string>();
  for (const gun of STARTING_GUN_IDS) {
    const offers = quickShiftOffers(challenge, [], 0, gun);
    assert.equal(offers.length, 3);
    assert.equal(new Set(offers).size, 3);
    assert(
      offers.some((id) => draftFitReason(id, [], gun)),
      gun,
    );
    assert.deepEqual(offers, quickShiftOffers({ ...challenge }, [], 0, gun));
    identities.add(offers.join(','));
  }
  assert(identities.size > 1, 'native tool fit changes at least one opening draft');
});

test('each native draft pick preserves prerequisites and pool gates throughout eleven acquisitions', () => {
  for (const gun of STARTING_GUN_IDS)
    for (let i = 0; i < 12; i++) {
      const c = quickShiftFromSeed('RF-Q1-DRAFT' + i)!;
      const mods: string[] = [];
      for (let completed = 0; completed < 5; completed++)
        for (let pick = 0; pick < (completed === 0 ? 3 : 2); pick++) {
          const before = [...mods];
          const choices = quickShiftOffers(c, mods, completed, gun, pick);
          const legal = quickShiftLegalMods(c, mods, completed, gun);
          assert.equal(choices.length, 3);
          assert.equal(new Set(choices).size, 3);
          for (const id of choices) {
            assert(!mods.includes(id));
            assert(!LONGEVITY_IDS.some((locked) => locked === id));
            assert(availableMods(mods).some((m) => m.id === id));
            assert(legal.some((m) => m.id === id));
          }
          assert.deepEqual(mods, before);
          mods.push(choices[(i + pick) % choices.length]);
          assert(validQuickShiftBuild(mods));
        }
      assert.equal(mods.length, 11);
      assert.deepEqual(quickShiftOffers(c, mods, 5, gun), []);
    }
});

test('draft gates accelerate only after the initial three fittings and preserve real morph/fusion requirements', () => {
  assert.deepEqual(QUICK_SHIFT_DRAFT_STAGES, [0, 4, 6, 8, 11]);
  assert(!quickShiftLegalMods(challenge, [], 0).some((m) => m.id === 'polarity-rounds'));
  assert.equal(validQuickShiftBuild(['piston-lance']), false);
  assert.equal(validQuickShiftBuild(['scatter', 'rapid', 'magnum', 'piston-lance']), false);
  assert.equal(
    validQuickShiftBuild([
      'scatter',
      'rapid',
      'magnum',
      'polarity-rounds',
      'momentum-battery',
      'cable-saw',
    ]),
    true,
  );
  assert.equal(validQuickShiftBuild(['suspension', 'countershot', 'catch-chamber']), false);
  assert.equal(
    validQuickShiftBuild([
      'suspension',
      'countershot',
      'magnum',
      'airshot',
      'kick',
      'scatter',
      'rapid',
      'catch-chamber',
    ]),
    true,
  );
  assert.equal(
    validQuickShiftBuild([
      'magnum',
      'airshot',
      'kick',
      'scatter',
      'rapid',
      'leech',
      'ricochet',
      'catch-chamber',
    ]),
    false,
  );
});

test('invalid, licensed, duplicated, conflicting and out-of-order builds cannot become a replay pool', () => {
  for (const value of [
    null,
    {},
    ['unknown'],
    ['rapid', 'rapid'],
    ['redline', 'kick'],
    ['cutting-torch', 'recall'],
    ['cable-saw', 'piston-lance'],
    [null],
    Array(12).fill('rapid'),
  ])
    assert.equal(validQuickShiftBuild(value), false);
  for (const id of LONGEVITY_IDS) assert.equal(validQuickShiftBuild([id]), false, id);
  assert.equal(validQuickShiftBuild([]), true);
  assert.equal(validQuickShiftBuild(completedBuild), true);
});

test('offer locks reject wrong draft count, pick index, rules, gun and malformed inputs', () => {
  const mods = completedBuild.slice(0, 3);
  for (const completed of [-1, 5, Infinity, 0.5])
    assert.deepEqual(quickShiftOffers(challenge, mods, completed), []);
  assert.deepEqual(quickShiftOffers(challenge, [], 1), []);
  assert.deepEqual(quickShiftOffers(challenge, mods, 1, 'pistol', 2), []);
  assert.deepEqual(quickShiftOffers(challenge, [], 0, 'pistol', 3), []);
  assert.deepEqual(quickShiftOffers(challenge, [], 0, 'constructor' as never), []);
  assert.deepEqual(quickShiftOffers({ ...challenge, code: 'WRONG' }, [], 0), []);
  assert.deepEqual(quickShiftOffers(challenge, ['redline'], 0), []);
  assert.deepEqual(quickShiftOffers(challenge, completedBuild, 4), []);
});

test('result validation requires supported identity, safe bounded counts and real completed-room outcome', () => {
  assert(validQuickShiftRecord(win()));
  assert(
    validQuickShiftRecord(
      win({ outcome: 'dead', rooms: 1, mods: completedBuild.slice(0, 5), timeMs: 0 }),
    ),
  );
  assert(validQuickShiftRecord(win({ job: 'accept', jobWon: true })));
  for (const patch of [
    { version: 2 },
    { rules: 2 },
    { seed: 'RF-Q2-ABC' },
    { gun: 'constructor' },
    { route: 'risk' },
    { job: 'claimed' },
    { jobWon: true },
    { outcome: 'dead', rooms: 5 },
    { rooms: 4 },
    { timeMs: 0 },
    { timeMs: -1 },
    { timeMs: Infinity },
    { timeMs: 0.5 },
    { timeMs: 86400001 },
    { mods: [] },
    { outcome: 'dead', rooms: 0, mods: completedBuild },
    { shots: 1000001 },
    { hits: -1 },
    { kills: NaN },
    { mods: ['unknown'] },
    { mods: ['piston-lance'] },
  ])
    assert.equal(validQuickShiftRecord({ ...win(), ...patch }), false, JSON.stringify(patch));
  assert.equal(validQuickShiftRecord({ ...win(), campaign: true }), false);
});

test('records and bests do not share saved arrays or mutate input', () => {
  const raw = [win()];
  const loaded = loadQuickShiftRecords(raw);
  loaded[0].mods.length = 0;
  assert.equal(raw[0].mods.length, 11);
  const result = recordQuickShift(raw, win({ timeMs: 10000 }));
  result.records[0].mods.pop();
  assert.equal(raw[0].mods.length, 11);
  const best = quickShiftBest(raw, challenge.seed, 'pistol')!;
  best.mods.pop();
  assert.equal(raw[0].mods.length, 11);
});

test('bests are specific to seed, tool, route and job; failures never claim a clear', () => {
  const original = win();
  assert.equal(quickShiftBest([original], challenge.seed, 'shotgun'), null);
  assert.equal(quickShiftBest([original], challenge.seed, 'pistol', 'high'), null);
  assert.equal(quickShiftBest([original], challenge.seed, 'pistol', 'low', 'accept'), null);
  assert.equal(quickShiftBest([original], 'RF-Q1-OTHER', 'pistol'), null);
  assert.equal(quickShiftRecordKey(original), quickShiftRecordKey({ ...original, timeMs: 1 }));
  const failed = recordQuickShift(
    [original],
    win({ outcome: 'dead', rooms: 0, mods: completedBuild.slice(0, 3), timeMs: 500 }),
  );
  assert.equal(failed.newBest, false);
  assert.equal(failed.records.length, 2);
  assert.equal(failed.best!.timeMs, original.timeMs);
});

test('faster clears, then fewer hits and shots break ties; an equal replay is idempotent', () => {
  let raw = [win()];
  for (const patch of [
    { timeMs: 100000 },
    { timeMs: 100000, hits: 2 },
    { timeMs: 100000, hits: 2, shots: 140 },
  ]) {
    const update = recordQuickShift(raw, win(patch));
    assert.equal(update.newBest, true);
    assert.equal(update.records.length, 1);
    raw = update.records;
  }
  const equal = recordQuickShift(raw, structuredClone(raw[0]));
  assert.equal(equal.newBest, false);
  assert.deepEqual(equal.records, raw);
  assert.equal(recordQuickShift(raw, win()).newBest, false);
  assert.throws(() => recordQuickShift(raw, win({ shots: -1 })));
});

test('loader deduplicates best wins/latest failures, filters damaged entries and bounds history', () => {
  const slower = win(),
    faster = win({ timeMs: 1000 });
  const failure = win({ outcome: 'dead', rooms: 0, mods: completedBuild.slice(0, 3), timeMs: 50 });
  const loaded = loadQuickShiftRecords([
    slower,
    null,
    { ...win(), route: 'wrong' },
    faster,
    failure,
    { ...failure, timeMs: 100 },
  ]);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].timeMs, 1000);
  assert.equal(loaded[1].timeMs, 50);
  assert.equal(validQuickShiftRecords(loaded), true);
  assert.equal(validQuickShiftRecords([slower, faster]), false);
  assert.equal(validQuickShiftRecords({}), false);
  const many = Array.from({ length: 70 }, (_, i) => win({ seed: 'RF-Q1-RECORD' + i }));
  assert.equal(loadQuickShiftRecords(many).length, 40);
  assert.equal(validQuickShiftRecords(many), false);
  const newest = win({ seed: 'RF-Q1-NEWEST' });
  const next = recordQuickShift(loadQuickShiftRecords(many), newest);
  assert.equal(next.records.length, 40);
  assert.equal(next.records[0].seed, newest.seed);
});
