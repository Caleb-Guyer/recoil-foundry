import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { testCheckpoint } from '../src/practice.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import { ProgressStore, parseProgressBackup, validateProgress } from '../src/progress.ts';
import { WEAPON_UNLOCKS_KEY } from '../src/weapon-unlocks.ts';
import { RUN_REWARDS_KEY, addRunRewards } from '../src/run-rewards.ts';
import {
  FINALE_PROGRESS_KEY,
  loadFinaleProgress,
  validFinaleProgress,
  resolveFinaleFirstClear,
  shouldShowNgPlusNotice,
  ngPlusNoticePreviewFromUrl,
  type FinishedFinale,
} from '../src/finale-progression.ts';

const seed = 'RF-C97-FIRST-CLEAR';
const finalCheckpoint = (): Checkpoint => ({ ...testCheckpoint(seed, 19), version: 6 });
const firstWin: FinishedFinale = {
  seed,
  firstClear: true,
  won: true,
  overtime: false,
  daily: false,
  shutdown: false,
  isolated: false,
};
class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

test('first-clear classification is captured at run start and remains stable on Continue', () => {
  assert.equal(resolveFinaleFirstClear(seed, undefined, true), true);
  assert.equal(resolveFinaleFirstClear(seed, undefined, false), false);
  const save = finalCheckpoint();
  assert.equal(
    resolveFinaleFirstClear(seed, { ...save, finaleFirstClear: 1 }, false),
    true,
    'A profile clear earned after starting the run does not change its ending',
  );
  assert.equal(
    resolveFinaleFirstClear(seed, { ...save, finaleFirstClear: 0 }, true),
    false,
    'A repeat-run Continue does not turn into a first clear after a profile restore',
  );
  assert.equal(
    resolveFinaleFirstClear(seed, save, false),
    true,
    'An unclassified new-revision checkpoint safely takes the first-clear ending',
  );
  assert.equal(
    resolveFinaleFirstClear(
      seed,
      {
        ...save,
        finaleFirstClear: 0,
        overtime: { baseMods: save.mods.length, repairs: 0 },
      },
      true,
    ),
    false,
  );
  assert.equal(resolveFinaleFirstClear('RF-C96-ARCHIVE', undefined, true), false);
  assert.equal(resolveFinaleFirstClear(dailyForDate('2026-10-23')!.seed, undefined, true), false);
});

test('both ending classifications survive strict checkpoints; invalid cross-mode flags are rejected', () => {
  const save = finalCheckpoint();
  for (const flag of [0, 1] as const) {
    const restored = loadCheckpoint(
      JSON.parse(JSON.stringify({ ...save, finaleFirstClear: flag })),
    );
    assert(restored);
    assert.equal(restored.finaleFirstClear, flag);
  }
  assert(loadCheckpoint(save), 'Existing checkpoints without the field keep loading');
  for (const flag of [null, true, false, 2, -1, '0', '1'])
    assert.equal(loadCheckpoint({ ...save, finaleFirstClear: flag }), null);
  for (const oldSeed of ['RF-C96-ARCHIVE', 'legacy', dailyForDate('2026-10-23')!.seed])
    assert.equal(loadCheckpoint({ ...save, seed: oldSeed, finaleFirstClear: 0 }), null);
  assert.equal(loadCheckpoint({ ...save, version: 5, finaleFirstClear: 1 }), null);
  assert.equal(
    loadCheckpoint({
      ...save,
      finaleFirstClear: 1,
      overtime: { baseMods: save.mods.length, repairs: 0 },
    }),
    null,
  );
});

test('first-clear departure has no Overtime entrance; a saved repeat run retains its entrance', () => {
  for (const flag of [0, 1] as const) {
    const g = new Game();
    g.start(seed, { ...finalCheckpoint(), finaleFirstClear: flag });
    let saved: Checkpoint | null = null;
    g.onCheckpoint = (value) => (saved = value);
    g.save();
    assert(saved);
    const cp = loadCheckpoint(saved);
    assert(cp);
    assert.equal(cp.finaleFirstClear, flag);
    const resumed = new Game();
    resumed.start(seed, cp);
    resumed.clear = true;
    resumed.enemies = [];
    resumed.waves.clear();
    resumed.startEscape();
    assert(resumed.escape);
    assert.equal(resumed.finaleFirstClear, flag === 1);
    assert.equal(resumed.canOvertime, flag === 0);
    assert.equal(
      !!resumed.overtimeLift,
      flag === 0,
      'The first-clear escape must omit the actual lift as well as its interaction',
    );
  }
});

test('only a genuine first Campaign victory offers the once-only unlock popup', () => {
  assert(shouldShowNgPlusNotice(firstWin, null));
  assert(!shouldShowNgPlusNotice(firstWin, { version: 1, ngPlusNoticeSeen: true }));
  for (const change of [
    { firstClear: false },
    { won: false },
    { overtime: true },
    { daily: true },
    { shutdown: true },
    { isolated: true },
    { seed: 'RF-C96-ARCHIVE' },
    { seed: dailyForDate('2026-10-23')!.seed },
  ])
    assert(!shouldShowNgPlusNotice({ ...firstWin, ...change }, null), JSON.stringify(change));
});

test('Overtime resumes as the final destruction route and isolated previews cannot write checkpoints', () => {
  const save = finalCheckpoint();
  const overtime = loadCheckpoint({
    ...save,
    stage: 0,
    finaleFirstClear: 0,
    overtime: { baseMods: save.mods.length, repairs: 0, remix: 5 },
  });
  assert(overtime);
  const resumed = new Game();
  resumed.start(seed, overtime);
  assert(resumed.overtime);
  assert.equal(resumed.finaleFirstClear, false);
  const preview = new Game();
  let writes = 0;
  preview.onCheckpoint = () => writes++;
  preview.startTest({ ...save, finaleFirstClear: 1 });
  preview.save();
  assert.equal(preview.finaleFirstClear, true);
  assert.equal(writes, 0, 'A first-clear cinematic preview never replaces the real run');
});

test('unlock popup receipt survives reload and backup without granting duplicate rewards', async () => {
  const disk = new MemoryStorage();
  const store = new ProgressStore(() => disk);
  const rewards = addRunRewards(null, seed, ['gun:shotgun']);
  await store.write(RUN_REWARDS_KEY, rewards);
  await store.write(WEAPON_UNLOCKS_KEY, {
    version: 1,
    started: true,
    cleared: true,
    overtime: false,
  });
  const weapons = store.read(WEAPON_UNLOCKS_KEY);
  await store.write(FINALE_PROGRESS_KEY, { version: 1, ngPlusNoticeSeen: true });
  const reloaded = new ProgressStore(() => disk);
  assert(!shouldShowNgPlusNotice(firstWin, reloaded.read(FINALE_PROGRESS_KEY)));
  assert.deepEqual(reloaded.read(RUN_REWARDS_KEY), rewards);
  assert.deepEqual(reloaded.read(WEAPON_UNLOCKS_KEY), weapons);
  const backup = parseProgressBackup(reloaded.backup('5.14.0'));
  // One storage instance is required for an atomic restore and its subsequent reload.
  const targetDisk = new MemoryStorage();
  const target = new ProgressStore(() => targetDisk);
  assert(await target.restore(backup));
  assert.deepEqual(target.read(FINALE_PROGRESS_KEY), { version: 1, ngPlusNoticeSeen: true });
  assert.deepEqual(target.read(RUN_REWARDS_KEY), rewards);
  assert.deepEqual(target.read(WEAPON_UNLOCKS_KEY), weapons);
});

test('older backups gain a clean receipt and malformed receipt data never replaces progress', () => {
  const store = new ProgressStore(() => new MemoryStorage());
  const backup = JSON.parse(store.backup('5.13.0'));
  delete backup.values[FINALE_PROGRESS_KEY];
  const migrated = parseProgressBackup(JSON.stringify(backup));
  assert.deepEqual(migrated.values[FINALE_PROGRESS_KEY], { version: 1, ngPlusNoticeSeen: false });
  for (const raw of [
    null,
    [],
    true,
    { version: 1 },
    { version: 2, ngPlusNoticeSeen: true },
    { version: 1, ngPlusNoticeSeen: 1 },
    { version: 1, ngPlusNoticeSeen: true, reward: 'shotgun' },
  ]) {
    assert(!validFinaleProgress(raw));
    assert.equal(validateProgress({ ...migrated.values, [FINALE_PROGRESS_KEY]: raw }), null);
  }
  assert.deepEqual(loadFinaleProgress(null), { version: 1, ngPlusNoticeSeen: false });
});

test('unlock-popup preview is explicit and rejects duplicate or unrelated parameters', () => {
  const url = (query: string) => new URL(query, 'https://test.invalid/');
  assert(ngPlusNoticePreviewFromUrl(url('?test=ngplus-unlocked')));
  assert(ngPlusNoticePreviewFromUrl(url('?test=ngplus-unlocked&v=5.14.0')));
  for (const query of [
    '',
    '?test=presentation',
    '?test=ngplus-unlocked&seed=RF-C97-TEST',
    '?test=ngplus-unlocked&test=ngplus-unlocked',
    '?test=ngplus-unlocked&v=1&v=2',
  ])
    assert(!ngPlusNoticePreviewFromUrl(url(query)), query);
});
