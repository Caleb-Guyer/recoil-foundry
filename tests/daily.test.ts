import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_RULESET,
  dailyForDate,
  todayDaily,
  dailyFromSeed,
  dailyFromUrl,
  dailyLink,
  loadDailyBests,
  recordDailyWin,
  formatDailyTime,
} from '../src/daily.ts';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { loadCheckpoint, STAGES } from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';

const challenge = dailyForDate('2026-09-06')!;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 680 },
};

test('daily dates require a real, strictly formatted calendar date', () => {
  for (const date of ['2000-02-29', '2024-02-29', '2026-09-06', '2099-12-31']) {
    assert.deepEqual(dailyForDate(date), { date, seed: `RF-D${DAILY_RULESET}-${date}` });
  }
  for (const date of [
    '1900-02-29',
    '2100-02-29',
    '2026-02-29',
    '2024-02-30',
    '2026-04-31',
    '2026-00-01',
    '2026-13-01',
    '2026-01-00',
    '2026-9-06',
    '2026-09-6',
    '26-09-06',
    ' 2026-09-06',
    '2026-09-06 ',
    '2026-09-06T00:00:00Z',
    '',
  ]) {
    assert.equal(dailyForDate(date), null, date);
  }
});

test('today rolls over at UTC midnight regardless of the input timezone', () => {
  const cases = [
    ['2026-09-05T23:59:59.999Z', '2026-09-05'],
    ['2026-09-06T00:00:00.000Z', '2026-09-06'],
    ['2026-09-05T23:30:00-07:00', '2026-09-06'],
    ['2026-09-06T00:30:00+14:00', '2026-09-05'],
    ['2026-12-31T23:59:59.999Z', '2026-12-31'],
    ['2027-01-01T00:00:00.000Z', '2027-01-01'],
  ];
  for (const [instant, date] of cases) {
    assert.deepEqual(todayDaily(new Date(instant)), dailyForDate(date));
  }
});

test('only canonical seeds for the current daily ruleset recover daily identity', () => {
  assert.deepEqual(dailyFromSeed(challenge.seed), challenge);
  for (const seed of [
    'ordinary-run',
    '2026-09-06',
    `RF-D${DAILY_RULESET + 1}-2026-09-06`,
    `RF-D${DAILY_RULESET}-2026-02-29`,
    challenge.seed.toLowerCase(),
    challenge.seed + '-extra',
    ' ' + challenge.seed,
  ]) {
    assert.equal(dailyFromSeed(seed), null, seed);
  }
});

test('challenge URLs allow past and future dates but reject ambiguous or stale versions', () => {
  const base = 'https://caleb-guyer.github.io/recoil-foundry/';
  for (const date of ['2000-02-29', '2026-09-06', '2099-12-31']) {
    assert.deepEqual(
      dailyFromUrl(new URL(`${base}?daily=${date}&dv=${DAILY_RULESET}&seed=ignored`)),
      dailyForDate(date),
    );
  }
  for (const query of [
    '',
    '?daily=2026-09-06',
    `?dv=${DAILY_RULESET}`,
    `?daily=2026-02-29&dv=${DAILY_RULESET}`,
    '?daily=2026-09-06&dv=0',
    `?daily=2026-09-06&dv=${DAILY_RULESET + 1}`,
    `?daily=2026-09-06&dv=0${DAILY_RULESET}`,
    `?daily=2026-09-06&daily=2026-09-06&dv=${DAILY_RULESET}`,
    `?daily=2026-09-06&dv=${DAILY_RULESET}&dv=${DAILY_RULESET}`,
    `?daily=2026-09-06%20&dv=${DAILY_RULESET}`,
  ]) {
    assert.equal(dailyFromUrl(new URL(base + query)), null, query);
  }
});

test('share links preserve the hosting path and remove unrelated parameters and hashes', () => {
  const base = 'https://example.com:8443/recoil-foundry/?seed=old&daily=bad&dv=99&utm=x#settings';
  const result = dailyLink(challenge, base);
  assert.equal(
    result,
    `https://example.com:8443/recoil-foundry/?daily=2026-09-06&dv=${DAILY_RULESET}`,
  );
  assert.deepEqual(dailyFromUrl(new URL(result)), challenge);
  assert.equal(dailyLink(challenge, result), result);
});

test('stored bests retain only positive safe integer times under canonical daily seeds', () => {
  for (const raw of [null, undefined, false, 1200, '1200', [], [challenge.seed, 1200]]) {
    assert.deepEqual(loadDailyBests(raw), {});
  }
  const invalidTimes = [0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '100'];
  const raw: Record<string, unknown> = { [challenge.seed]: 12345, ordinary: 50 };
  invalidTimes.forEach((time, i) => {
    raw[dailyForDate(`2026-10-${String(i + 1).padStart(2, '0')}`)!.seed] = time;
  });
  raw[`RF-D${DAILY_RULESET + 1}-2026-09-06`] = 300;
  raw[`RF-D${DAILY_RULESET}-2026-02-29`] = 300;
  Object.freeze(raw);
  assert.deepEqual(loadDailyBests(raw), { [challenge.seed]: 12345 });
  assert.equal(raw.ordinary, 50);
});

test('wins store hundredths, keep the faster result, and do not mutate other records', () => {
  const other = dailyForDate('2026-09-05')!;
  const original = Object.freeze({ [other.seed]: 9500 });
  const first = recordDailyWin(original, challenge, 120.126)!;
  assert.equal(first.best, 12013);
  assert.equal(first.newBest, true);
  assert.deepEqual(first.bests, { [other.seed]: 9500, [challenge.seed]: 12013 });
  assert.deepEqual(original, { [other.seed]: 9500 });

  const slower = recordDailyWin(first.bests, challenge, 125)!;
  const equalDisplayedTime = recordDailyWin(first.bests, challenge, 120.134)!;
  for (const result of [slower, equalDisplayedTime]) {
    assert.equal(result.best, 12013);
    assert.equal(result.newBest, false);
  }
  const faster = recordDailyWin(first.bests, challenge, 119.999)!;
  assert.equal(faster.best, 12000);
  assert.equal(faster.newBest, true);
  assert.equal(faster.bests[other.seed], 9500);
  assert.equal(first.bests[challenge.seed], 12013);
});

test('invalid elapsed times or obsolete daily seeds cannot create a record', () => {
  for (const elapsed of [0, -1, 0.004, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.equal(recordDailyWin({}, challenge, elapsed), null, String(elapsed));
  }
  assert.equal(
    recordDailyWin(
      {},
      { date: challenge.date, seed: `RF-D${DAILY_RULESET + 1}-${challenge.date}` },
      60,
    ),
    null,
  );
  assert.equal(recordDailyWin(null, challenge, 0.01)!.best, 1);
});

test('record retention bounds storage while preserving an older challenge just replayed', () => {
  const records: Record<string, number> = {};
  const dates: string[] = [];
  const start = Date.parse('2024-01-01T00:00:00Z');
  for (let i = 0; i < 400; i++) {
    const day = todayDaily(new Date(start + i * 86400000));
    dates.push(day.seed);
    records[day.seed] = 20000 + i;
  }
  const old = dailyForDate('2000-02-29')!;
  const result = recordDailyWin(records, old, 90)!;
  assert.equal(Object.keys(result.bests).length, 365);
  assert.equal(result.bests[old.seed], 9000);
  assert.equal(result.bests[dates[399]], records[dates[399]]);
  assert.equal(result.bests[dates[36]], records[dates[36]]);
  assert.equal(result.bests[dates[35]], undefined);
  assert.equal(Object.keys(records).length, 400);
});

test('daily time formatting carries seconds and minutes without losing hundredths', () => {
  for (const [time, expected] of [
    [0, '0:00.00'],
    [1, '0:00.01'],
    [99, '0:00.99'],
    [100, '0:01.00'],
    [5999, '0:59.99'],
    [6000, '1:00.00'],
    [6101, '1:01.01'],
    [360000, '60:00.00'],
  ] as const) {
    assert.equal(formatDailyTime(time), expected);
  }
});

function propSnapshot(game: Game) {
  return game.props.items.map(({ kind, body }) => ({
    kind,
    x: body.position.x,
    y: body.position.y,
  }));
}

test('identical daily choices reproduce all nine rooms, props, and upgrade offers after resuming', () => {
  const first = new Game();
  let second = new Game();
  first.start(challenge.seed);
  second.start(dailyFromUrl(new URL(dailyLink(challenge, 'https://example.com/game/')))!.seed);
  const rooms: string[] = [];
  const bosses: number[] = [];
  for (let stage = 0; stage < STAGES; stage++) {
    assert.equal(first.stage, stage);
    assert.equal(second.stage, stage);
    assert.deepEqual(second.level, first.level);
    assert.deepEqual(propSnapshot(second), propSnapshot(first));
    assert.deepEqual(second.mods, first.mods);
    rooms.push(first.level.id);
    if (first.level.boss) bosses.push(stage);
    if (stage === STAGES - 1) break;

    // Combat consumes the room RNG; reward identity must not depend on that history.
    for (let i = 0; i < 17 + stage; i++) first.rng();
    first.openReward();
    second.openReward();
    assert.deepEqual(second.offers, first.offers);
    assert.equal(first.offers.length, 3);
    const chosen = first.offers[stage % 3].id;
    first.chooseMod(chosen);
    second.chooseMod(chosen);

    if (stage === 3) {
      const saves: Checkpoint[] = [];
      second.onCheckpoint = (save) => {
        if (save) saves.push(save);
      };
      second.save();
      const restored = loadCheckpoint(JSON.parse(JSON.stringify(saves[0])))!;
      assert(restored);
      second = new Game();
      second.start(restored.seed, restored);
    }
  }
  assert.equal(new Set(rooms).size, 9);
  assert.deepEqual(bosses, [2, 5, 8]);
  assert.equal(first.mods.length, 8);
});

test('v3 checkpoints preserve daily identity and accumulated elapsed time across continue and retry', () => {
  const save: Checkpoint = {
    version: 3,
    seed: challenge.seed,
    stage: 5,
    hp: 67,
    mods: ['magnum', 'rapid', 'airshot', 'burst', 'landing'],
    kills: 20,
    elapsed: 125.5,
  };
  const restored = loadCheckpoint(JSON.parse(JSON.stringify(save)))!;
  assert.deepEqual(restored, save);
  for (const broken of [
    { ...save, version: 2 },
    { ...save, stage: 9 },
    { ...save, elapsed: -1 },
    { ...save, elapsed: Infinity },
    { ...save, mods: ['removed-upgrade'] },
  ]) {
    assert.equal(loadCheckpoint(broken), null);
  }

  const game = new Game();
  const checkpoints: Checkpoint[] = [];
  game.onCheckpoint = (checkpoint) => {
    if (checkpoint) checkpoints.push(checkpoint);
  };
  game.start(restored.seed, restored);
  assert.deepEqual(dailyFromSeed(game.seed), challenge);
  assert.equal(game.level.area, 'furnace');
  assert.equal(game.elapsed, 125.5);
  assert.equal(game.time, 0);
  assert.equal(game.hp, 67);
  for (let i = 0; i < 30; i++) game.tick(1 / 60, idle);
  assert(Math.abs(game.elapsed - 126) < 1e-8);
  assert(Math.abs(game.time - 0.5) < 1e-8);
  game.setMode('paused');
  for (let i = 0; i < 60; i++) game.tick(1 / 60, idle);
  assert(Math.abs(game.elapsed - 126) < 1e-8);
  game.save();
  assert(Math.abs(checkpoints.at(-1)!.elapsed - 126) < 1e-8);
  assert.equal(recordDailyWin({}, challenge, game.elapsed)!.best, 12600);

  // Retrying uses the original seed even if the current UTC daily has changed.
  assert.notDeepEqual(todayDaily(new Date('2026-09-07T00:00:00Z')), challenge);
  game.start(game.seed);
  assert.deepEqual(dailyFromSeed(game.seed), challenge);
  assert.equal(game.elapsed, 0);
  assert.equal(game.stage, 0);
  assert.equal(game.hp, 100);
  assert.deepEqual(game.mods, []);
});
