import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from '../src/game.ts';
import { MODS } from '../src/rules.ts';
import { getLevel } from '../src/levels.ts';
import { PRACTICE_BOSSES, practiceCheckpoint, type Encounter } from '../src/practice.ts';
import {
  PRACTICE_RULESET,
  PRACTICE_RECORD_LIMIT,
  CHALLENGE_CODE_LIMIT,
  snapshotPracticeWin,
  recordPracticeWin,
  practiceBuildKey,
  loadPracticeRecords,
  validPracticeRecords,
  challengeCode,
  parseChallengeCode,
  challengeFromRecord,
  challengeAccess,
  practiceTime,
  type PracticeWin,
  type PracticeChallenge,
} from '../src/practice-records.ts';
import { challengePreviewHtml } from '../src/practice-records-menu.ts';
const all = MODS.map((m) => m.id);
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 500 },
};
function encounter(kind: Encounter['kind'] = 'loader', offset = 0): Encounter {
  for (let i = offset; i < offset + 200; i++) {
    const seed = 'record-' + i;
    if (
      kind === 'switchboard' ||
      getLevel(seed, PRACTICE_BOSSES[kind].stage).spawns[0]?.kind === kind
    )
      return { kind, seed };
  }
  throw Error('Missing fixture');
}
const win = (changes: Partial<PracticeWin> = {}): PracticeWin => ({
  rules: PRACTICE_RULESET,
  ...encounter(),
  mods: ['magnum'],
  timeMs: 20000,
  hits: 3,
  finishedAt: 100,
  ...changes,
});
const challenge = (): PracticeChallenge => challengeFromRecord(recordPracticeWin([], win()).record);
function finish(g: Game) {
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 999999);
  for (let i = 0; i < 40 && g.mode === 'playing'; i++) g.tick(1 / 60, idle);
  assert.equal(g.mode, 'won');
}

test('practice hits count accepted positive damage, survive healing, and reset with each attempt', () => {
  const g = new Game();
  g.startPractice(encounter());
  g.damagePlayer(10);
  assert.equal(g.practiceHits, 1);
  g.damagePlayer(10);
  assert.equal(g.practiceHits, 1, 'grace immunity is not another hit');
  g.time += 1;
  g.damagePlayer(0);
  assert.equal(g.practiceHits, 1);
  g.setMode('paused');
  const elapsed = g.elapsed;
  for (let i = 0; i < 100; i++) g.tick(1 / 60, idle);
  g.damagePlayer(20);
  assert.equal(g.elapsed, elapsed);
  assert.equal(g.practiceHits, 1);
  g.setMode('playing');
  g.time += 1;
  g.hp = 100;
  g.damagePlayer(10);
  assert.equal(g.practiceHits, 2);
  g.startPractice(encounter());
  assert.equal(g.practiceHits, 0);
  assert.equal(g.elapsed, 0);
  assert.equal(g.hp, 100);
  g.start('campaign');
  g.damagePlayer(10);
  assert.equal(g.practiceHits, 0, 'campaign combat is unchanged');
});

test('only a completed eligible practice victory produces a record with its exact gun', () => {
  const g = new Game(),
    mods = ['fold', 'rewire', 'light'];
  g.startPractice(encounter(), mods, all);
  assert.equal(snapshotPracticeWin(g, true), null);
  g.elapsed = 12.345;
  finish(g);
  const saved = snapshotPracticeWin(g, true, 123)!;
  assert(saved);
  assert.deepEqual(saved.mods, mods);
  assert.equal(saved.timeMs, 12360);
  assert.equal(saved.hits, 0);
  assert.equal(saved.finishedAt, 123);
  assert.equal(snapshotPracticeWin(g, false), null, 'URL tests cannot record');
  saved.mods.pop();
  assert.equal(g.mods.length, 3);
  g.mods = ['magnum'];
  assert.equal(snapshotPracticeWin(g, true), null, 'changed guns cannot steal this identity');
  g.startPractice(encounter());
  g.die();
  assert.equal(snapshotPracticeWin(g, true), null);
  g.startPractice(encounter());
  g.setMode('won');
  assert.equal(snapshotPracticeWin(g, true), null, 'a forced mode change alone is not a victory');
  g.startWorkshop(all, []);
  assert.equal(snapshotPracticeWin(g, true), null);
});

test('preset and custom fights for every boss create replayable identities without progression awards', () => {
  for (const kind of Object.keys(PRACTICE_BOSSES) as Encounter['kind'][]) {
    const g = new Game(),
      e = encounter(kind),
      writes: unknown[] = [],
      awards: string[] = [];
    g.onCheckpoint = (s) => writes.push(s);
    g.onBossDefeated = (k) => awards.push(k);
    g.onEnemyDefeated = (k) => awards.push(k);
    g.onCommendation = (k) => awards.push(k);
    g.startPractice(e);
    g.elapsed = 10;
    finish(g);
    const saved = snapshotPracticeWin(g, true)!;
    assert(saved, kind);
    const c = challengeFromRecord(recordPracticeWin([], saved).record);
    assert(
      challengeAccess(c, [encounter(kind, 201)], all).allowed,
      'earned boss, different friend arena',
    );
    const replay = parseChallengeCode(challengeCode(c));
    const second = new Game();
    second.startPractice(replay, replay.mods, all);
    assert.deepEqual(second.level, g.level, kind);
    assert.deepEqual(second.gun, g.gun, kind);
    assert.deepEqual(second.mods, g.mods, kind);
    assert.deepEqual(writes, []);
    assert.deepEqual(awards, []);
  }
});

test('fastest and cleanest wins are independent, stable on ties, and preserve the winning build', () => {
  const first = recordPracticeWin([], win());
  assert(first.first && first.newFastest && first.newCleanest);
  assert.notEqual(first.record.fastest, first.record.cleanest);
  const clean = recordPracticeWin(first.records, win({ timeMs: 25000, hits: 0, finishedAt: 200 }));
  assert(!clean.newFastest && clean.newCleanest);
  assert.equal(clean.record.fastest.timeMs, 20000);
  assert.equal(clean.record.cleanest.timeMs, 25000);
  const fast = recordPracticeWin(clean.records, win({ timeMs: 18000, hits: 5, finishedAt: 300 }));
  assert(fast.newFastest && !fast.newCleanest);
  assert.equal(fast.record.cleanest.hits, 0);
  const tie = recordPracticeWin(fast.records, win({ timeMs: 18000, hits: 5, finishedAt: 400 }));
  assert(!tie.newFastest && !tie.newCleanest);
  assert.equal(tie.record.fastest.finishedAt, 300);
  const cleanerTie = recordPracticeWin(
    tie.records,
    win({ timeMs: 18000, hits: 2, finishedAt: 500 }),
  );
  assert(cleanerTie.newFastest && !cleanerTie.newCleanest);
  assert.equal(first.record.fastest.hits, 3, 'prior records are detached');
  assert.equal(validPracticeRecords(cleanerTie.records), true);
});

test('records separate every arena and gun order, and retain archived balance versions', () => {
  let records = recordPracticeWin([], win()).records;
  for (const change of [
    { ...encounter('loader', 100) },
    { mods: ['kick'] },
    { mods: ['magnum', 'kick'] },
    { mods: ['kick', 'magnum'] },
  ])
    records = recordPracticeWin(records, win(change)).records;
  assert.equal(records.length, 5);
  const archived = {
    ...structuredClone(records[0]),
    rules: PRACTICE_RULESET + 1,
    mods: ['retired-upgrade'],
  };
  assert(validPracticeRecords([...records, archived]));
  assert.equal(loadPracticeRecords([...records, archived]).length, 6);
  const c = challengeFromRecord(archived);
  assert.equal(
    challengeAccess(parseChallengeCode(challengeCode(c)), [encounter()], all).current,
    false,
  );
  const old = practiceBuildKey(archived),
    current = practiceBuildKey({ ...archived, rules: PRACTICE_RULESET });
  assert.notEqual(old, current);
  assert.throws(() => recordPracticeWin([], win({ rules: PRACTICE_RULESET + 1 })));
});

test('record bounds and malformed data cannot corrupt the profile or grow without limit', () => {
  const valid = recordPracticeWin([], win()).record;
  for (const value of [
    null,
    {},
    [{}],
    [{ ...valid, mods: ['rewire'] }],
    [{ ...valid, fastest: { ...valid.fastest, timeMs: NaN } }],
    [{ ...valid, cleanest: { ...valid.cleanest, hits: 6 } }],
    [{ ...valid, seed: 'bad\nseed' }],
    [{ ...valid, extra: true }],
    [valid, valid],
    Array(PRACTICE_RECORD_LIMIT + 1).fill(valid),
  ])
    assert(!validPracticeRecords(value));
  let records = loadPracticeRecords([]);
  for (let i = 0; i < PRACTICE_RECORD_LIMIT + 2; i++) {
    records = recordPracticeWin(
      records,
      win({ kind: 'switchboard', seed: 'bounded-' + i, finishedAt: i }),
    ).records;
  }
  assert.equal(records.length, PRACTICE_RECORD_LIMIT);
  assert(!records.some((r) => r.seed === 'bounded-0'));
  assert.equal(records[0].seed, 'bounded-201');
});

test('challenge codes round-trip exact target, Unicode seeds and empty guns', () => {
  for (const c of [
    challenge(),
    { ...challenge(), mods: [] },
    { ...challenge(), kind: 'switchboard' as const, seed: '工場-🙂' },
  ]) {
    const decoded = parseChallengeCode(' \n' + challengeCode(c) + '\n');
    assert.deepEqual(decoded, c);
    assert.notEqual(decoded.mods, c.mods);
  }
  assert.equal(practiceTime(59990), '0:59.99');
  assert.equal(practiceTime(60000), '1:00.00');
});

test('challenge imports enforce boss discovery, every upgrade, prerequisites and the boss budget', () => {
  const c = challenge();
  assert(!challengeAccess(c, [], all).allowed);
  assert(!challengeAccess(c, [encounter()], []).allowed);
  assert(challengeAccess(c, [encounter('loader', 80)], ['magnum']).allowed);
  for (const mods of [
    ['rewire'],
    ['magnum', 'magnum'],
    ['cutting-torch', 'mass-driver'],
    ['magnum', 'kick', 'light', 'leech'],
  ])
    assert.throws(() => challengeCode({ ...c, mods }));
  const hidden = challengePreviewHtml(c, [], all);
  assert(!hidden.includes('Loader') && !hidden.includes('Heavy hitter'));
  const unknown = challengePreviewHtml(c, [encounter()], []);
  assert(unknown.includes('Undiscovered upgrade'));
  assert(!unknown.includes('Heavy hitter'));
});

test('malformed and future-format codes fail without echoing spoiler content', () => {
  const raw = (value: unknown) =>
    'RFC1.' + Buffer.from(JSON.stringify(value)).toString('base64url');
  for (const code of [
    '',
    'RF1.W10',
    'RFC2.W10',
    'RFC1.!!!',
    'RFC1.' + 'a'.repeat(CHALLENGE_CODE_LIMIT),
    challengeCode(challenge()) + '=',
    raw([1, 'SECRET-BOSS', 'secret', [], 1000, 0]),
    raw([1, 'loader', encounter().seed, ['SECRET-UPGRADE'], 1000, 0]),
    raw([1, 'loader', encounter().seed, [], 0, 0]),
    raw([1, 'loader', encounter().seed, [], 1000, -1]),
    raw({}),
  ])
    assert.throws(
      () => parseChallengeCode(code),
      (e) => !String(e).includes('SECRET'),
    );
});
