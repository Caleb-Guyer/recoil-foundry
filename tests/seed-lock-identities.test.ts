import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { newCampaignSeed, newQuickShiftSeed, retrySeed } from '../src/run-seed.ts';
import { loadCheckpoint } from '../src/rules.ts';
import { dailyStartingGun } from '../src/starting-guns.ts';
import {
  DAILY_RULESET,
  SUPPORTED_DAILY_RULESETS,
  dailyForDate,
  dailyFromSeed,
  dailyFromUrl,
  dailyLink,
  loadDailyBests,
  recordDailyWin,
} from '../src/daily.ts';
import {
  quickShiftInput,
  quickShiftFromSeed,
  quickShiftFromUrl,
  quickShiftLink,
  quickShiftRuntimeSeed,
  quickShiftOffers,
  planQuickShift,
  quickShiftRecordKey,
  loadQuickShiftRecords,
  quickShiftBest,
  recordQuickShift,
  validQuickShiftRecord,
  type QuickShiftRecord,
} from '../src/quick-shift-rules.ts';
import { loadQuickShiftContinue, QUICK_SHIFT_CONTINUE_KEY } from '../src/quick-shift.ts';
import { canReplayRun, loadRunHistory, snapshotRun } from '../src/run-history.ts';

const base = 'https://example.test/game/';
function acquired(seed: string) {
  const challenge = quickShiftFromSeed(seed)!;
  const mods: string[] = [];
  for (let round = 0; round < 5; round++)
    for (let pick = 0; pick < (round === 0 ? 3 : 2); pick++)
      mods.push(quickShiftOffers(challenge, mods, round, 'pistol', pick)[0]);
  return mods;
}
function result(rules: 1 | 2): QuickShiftRecord {
  const seed = `RF-Q${rules}-SEEDLOCK`;
  return {
    version: 1,
    rules,
    seed,
    gun: 'pistol',
    route: 'low',
    job: 'skip',
    jobWon: false,
    outcome: 'won',
    rooms: 5,
    timeMs: rules === 1 ? 120000 : 110000,
    hits: 0,
    shots: 80,
    kills: 20,
    mods: acquired(seed),
  };
}

test('new runs own C111, Q2 and Daily 92 while retrying an archived Daily keeps its identity', () => {
  const values = [35, 36];
  assert.equal(
    newCampaignSeed('RF-C108-Z', () => values.shift()!),
    'RF-C111-10',
  );
  const quickValues = [35, 36];
  assert.equal(
    newQuickShiftSeed('RF-Q1-Z', () => quickValues.shift()!),
    'RF-Q2-10',
  );
  assert.equal(DAILY_RULESET, 92);
  assert.equal(dailyForDate('2026-10-30')!.seed, 'RF-D92-2026-10-30');
  assert.equal(
    retrySeed('RF-D91-2026-10-29', () => {
      throw new Error('An archived Daily must not be rerolled');
    }),
    'RF-D91-2026-10-29',
  );
});

test('all archived Daily links and version-six checkpoints keep their original seed and best', () => {
  assert.deepEqual(
    SUPPORTED_DAILY_RULESETS,
    Array.from({ length: 15 }, (_, i) => 78 + i),
  );
  for (const revision of SUPPORTED_DAILY_RULESETS) {
    const challenge = dailyForDate('2026-10-29', revision)!;
    const seed = `RF-D${revision}-2026-10-29`;
    assert.equal(challenge.seed, seed);
    assert.deepEqual(dailyFromSeed(seed), challenge);
    assert.deepEqual(dailyFromUrl(new URL(dailyLink(challenge, base + '?test=old#x'))), challenge);
    const cp = loadCheckpoint({
      version: 6,
      seed,
      stage: 0,
      startingGun: dailyStartingGun(seed),
      hp: 87,
      mods: [],
      kills: 0,
      elapsed: 12,
    });
    assert(cp);
    assert.equal(cp.version, 6);
    assert.equal(cp.seed, seed);
    assert.equal(cp.hp, 87);
    const bests = recordDailyWin({ [seed]: 9000 }, challenge, 100)!;
    assert.equal(bests.newBest, false);
    assert.equal(bests.bests[seed], 9000);
  }
  const old = dailyForDate('2026-10-29', 91)!;
  const current = dailyForDate('2026-10-29', 92)!;
  const update = recordDailyWin({ [old.seed]: 9000 }, current, 80)!;
  assert.deepEqual(loadDailyBests(update.bests), { [old.seed]: 9000, [current.seed]: 8000 });
});

test('full Q1 and Q2 seeds and share links preserve their rules; bare editable codes choose Q2', () => {
  for (const rules of [1, 2] as const) {
    const challenge = quickShiftFromSeed(`RF-Q${rules}-SEEDLOCK`)!;
    assert.deepEqual(quickShiftInput(` rf-q${rules}-seedlock `), challenge);
    assert.deepEqual(quickShiftFromUrl(new URL(quickShiftLink(challenge, base, 'shotgun'))), {
      challenge,
      gun: 'shotgun',
    });
    assert.equal(quickShiftRuntimeSeed(challenge), `RF-C${rules === 1 ? 108 : 111}-QSEEDLOCK`);
    assert.equal(
      quickShiftFromUrl(new URL(`${base}?quick=SEEDLOCK&qv=${rules}&qv=${rules}`)),
      null,
    );
  }
  assert.deepEqual(quickShiftInput('seedlock'), quickShiftFromSeed('RF-Q2-SEEDLOCK'));
  for (const value of ['RF-Q3-SEEDLOCK', 'RF-Q01-SEEDLOCK', 'ß', 'K'])
    assert.equal(quickShiftInput(value), null);
});

test('Q1 retains its pinned old room plan and complete native acquisition sequence', () => {
  const legacy = quickShiftFromSeed('RF-Q1-SEEDLOCK')!;
  assert.deepEqual(planQuickShift(legacy), {
    patrol: 'switchyard',
    tactical: ['upper-return', 'warm-exchange'],
    variants: [0, 1, 0, 0],
    mirrored: true,
    boss: 'crane',
    job: 'rush',
  });
  assert.deepEqual(acquired(legacy.seed), [
    'magnum',
    'burst',
    'pierce',
    'capacitor',
    'airshot',
    'reserve-cell',
    'kick',
    'redline',
    'rapid',
    'air-brake',
    'ricochet-harness',
  ]);
  const current = quickShiftFromSeed('RF-Q2-SEEDLOCK')!;
  assert.deepEqual(planQuickShift(current), planQuickShift({ ...current }));
  assert.notDeepEqual(planQuickShift(current), planQuickShift(legacy));
  assert.notDeepEqual(acquired(current.seed), acquired(legacy.seed));
});

test('both Quick revisions resume the exact accepted draft under the unchanged Continue format and key', () => {
  assert.equal(QUICK_SHIFT_CONTINUE_KEY, 'rf-quick-shift-continue-v1');
  for (const rules of [1, 2] as const) {
    const g = new Game();
    const challenge = quickShiftFromSeed(`RF-Q${rules}-SEEDLOCK`)!;
    assert(g.quickShift.begin(challenge, 'pistol'));
    assert(g.quickShift.chooseMod(g.quickShift.state!.offers[0]));
    const offers = [...g.quickShift.state!.offers];
    const saved = JSON.parse(JSON.stringify(g.quickShift.snapshot()));
    assert.equal(saved.version, 1);
    assert.equal(saved.rules, rules);
    assert.equal(saved.checkpoint.version, 6);
    assert.equal(saved.checkpoint.seed, quickShiftRuntimeSeed(challenge));
    const resumed = new Game();
    assert(resumed.quickShift.resume(saved));
    assert.deepEqual(resumed.quickShift.state!.challenge, challenge);
    assert.deepEqual(resumed.quickShift.state!.offers, offers);
    assert.deepEqual(resumed.quickShift.snapshot(), saved);
    saved.rules = rules === 1 ? 2 : 1;
    assert.equal(
      loadQuickShiftContinue(saved),
      null,
      'a forged wrapper must not migrate the challenge',
    );
  }
});

test('Q1 and Q2 records coexist and compete only within their exact versioned identity', () => {
  const legacy = result(1),
    current = result(2);
  assert(validQuickShiftRecord(legacy));
  assert(validQuickShiftRecord(current));
  assert.equal(validQuickShiftRecord({ ...legacy, rules: 2 }), false);
  assert.equal(validQuickShiftRecord({ ...current, rules: 1 }), false);
  assert.equal(validQuickShiftRecord({ ...legacy, rules: undefined, seed: 'unknown' }), false);
  assert.equal(
    validQuickShiftRecord({ ...legacy, rules: undefined, seed: 'RF-Q3-SEEDLOCK' }),
    false,
  );
  const update = recordQuickShift([legacy], current);
  assert.equal(update.records.length, 2);
  assert.equal(quickShiftBest(update.records, legacy.seed, 'pistol')!.timeMs, 120000);
  assert.equal(quickShiftBest(update.records, current.seed, 'pistol')!.timeMs, 110000);
  assert.notEqual(quickShiftRecordKey(legacy), quickShiftRecordKey(current));
  assert.equal(
    quickShiftRecordKey(legacy),
    JSON.stringify([1, legacy.seed, 'pistol', 'low', 'skip']),
  );
  assert.deepEqual(
    loadQuickShiftRecords(JSON.parse(JSON.stringify(update.records))),
    update.records,
  );
});

test('5.43 recaps remain replayable after the Daily bump and older excluded revisions remain excluded', () => {
  for (const seed of ['RF-C108-RECAP', 'RF-D91-2026-10-29']) {
    const g = new Game();
    g.start(seed);
    g.setMode('dead');
    const original = snapshotRun(g, 'seed-lock-recap', 1000)!;
    assert(original);
    const archived = { ...original, ruleset: 91 };
    const [loaded] = loadRunHistory([archived]);
    assert(loaded);
    assert.equal(loaded.seed, seed);
    assert(canReplayRun(loaded));
    assert(canReplayRun({ ...loaded, ruleset: 92 }));
    assert(canReplayRun({ ...loaded, ruleset: 88 }));
    assert(canReplayRun({ ...loaded, ruleset: 89 }));
    assert.equal(canReplayRun({ ...loaded, ruleset: 90 }), false);
    assert.equal(canReplayRun({ ...loaded, ruleset: 87 }), false);
  }
});

test('both Quick fight checkpoints resume natively and emit results with their own rules without Campaign writes', () => {
  const idle = {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: false,
    aim: { x: 1200, y: 700 },
  };
  for (const rules of [1, 2] as const) {
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    assert(g.quickShift.begin(quickShiftFromSeed(`RF-Q${rules}-SEEDLOCK`)!, 'pistol'));
    for (let pick = 0; pick < 3; pick++)
      assert(g.quickShift.chooseMod(g.quickShift.state!.offers[0]));
    assert.equal(g.mode, 'playing');
    for (let i = 0; i < 12; i++) g.tick(1 / 60, idle);
    g.setMode('paused');
    const saved = g.quickShift.snapshot()!;
    assert(saved);
    assert.equal(saved.rules, rules);
    assert.equal(saved.state.phase, 'fight');
    assert(saved.state.timeMs > 0);
    assert.equal(writes, 0);
    const resumed = new Game();
    resumed.onCheckpoint = () => writes++;
    assert(resumed.quickShift.resume(JSON.parse(JSON.stringify(saved))));
    assert.equal(resumed.mode, 'playing');
    assert.equal(resumed.seed, quickShiftRuntimeSeed(saved.state.challenge));
    assert.deepEqual(resumed.mods, saved.state.mods);
    assert.equal(resumed.quickShift.state!.challenge.rules, rules);
    resumed.hurtAt = -10;
    resumed.damagePlayer(1000);
    assert.equal(resumed.quickShift.result!.rules, rules);
    assert.equal(resumed.quickShift.result!.seed, saved.state.challenge.seed);
    assert(validQuickShiftRecord(resumed.quickShift.result));
    assert.equal(writes, 0);
  }
});
