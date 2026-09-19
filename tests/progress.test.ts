import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import {
  ProgressStore,
  PROGRESS_KEY,
  CHECKPOINT_KEY,
  parseProgressBackup,
  validateProgress,
  BACKUP_LIMIT,
  mergeDailyRecords,
  type ProgressLock,
} from '../src/progress.ts';
import { Game } from '../src/game.ts';
import { loadCheckpoint } from '../src/rules.ts';
import { DISCOVERIES_KEY, WORKSHOP_BUILD_KEY, discoverBuild } from '../src/workshop-build.ts';
import { LOGBOOK_KEY, recordLogbook } from '../src/logbook.ts';
import { COMMENDATIONS_KEY } from '../src/commendations.ts';
import { COSMETICS_KEY } from '../src/cosmetics.ts';
import { RUN_HISTORY_KEY, snapshotRun } from '../src/run-history.ts';
import { DAILY_BESTS_KEY, dailyForDate } from '../src/daily.ts';
import {
  VICTORIES_KEY,
  testCheckpoint,
  testEncounterFromUrl,
  rerollTestFromUrl,
  exitTestFromUrl,
  upgradeTestFromUrl,
  overtimeTestFromUrl,
} from '../src/practice.ts';
import { retrySeed } from '../src/run-seed.ts';

class MemoryStorage {
  items = new Map<string, string>();
  fail = false;
  writes = 0;
  removeItem(key: string) {
    if (this.fail) throw new Error('Storage blocked');
    this.items.delete(key);
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.fail) throw new Error('Quota exceeded');
    this.writes++;
    this.items.set(key, value);
  }
}
function setup() {
  const disk = new MemoryStorage();
  return { disk, store: new ProgressStore(() => disk) };
}
function wire(g: Game, store: ProgressStore) {
  g.onCheckpoint = (s) => {
    if (g.practice || g.testRun || g.workshop.active) return;
    if (s)
      void store.write(
        DISCOVERIES_KEY,
        discoverBuild(store.read(DISCOVERIES_KEY) as string[], s.mods, s.legacyMods),
      );
    void store.write(CHECKPOINT_KEY, s);
  };
}
async function populated(store: ProgressStore) {
  const save = testCheckpoint('backup-run', 2);
  await store.write(DISCOVERIES_KEY, [...save.mods, 'fold']);
  await store.write(CHECKPOINT_KEY, save);
  await store.write(COMMENDATIONS_KEY, ['clean-work', 'heavy-equipment']);
  await store.write(COSMETICS_KEY, { gun: 'inspector', outfit: 'rigger' });
  await store.write(LOGBOOK_KEY, {
    version: 1,
    enemies: ['boss'],
    areas: ['docks'],
    escaped: true,
  });
  await store.write(VICTORIES_KEY, [{ kind: 'boss', seed: 'earned' }]);
  await store.write(DAILY_BESTS_KEY, { 'RF-D78-2026-09-19': 9876, 'RF-D77-2026-09-18': 12345 });
  await store.write(WORKSHOP_BUILD_KEY, ['magnum', 'fold']);
  const g = new Game();
  g.start('archive');
  g.hp = 0;
  g.setMode('dead');
  await store.write(RUN_HISTORY_KEY, [snapshotRun(g, 'finished-run', 123456)!]);
}

test('complete backup round-trips every progress category into a fresh browser', async () => {
  const { store } = setup();
  await populated(store);
  const backup = parseProgressBackup(store.backup('2.94.0'));
  const other = setup();
  assert(await other.store.restore(backup));
  assert.equal(other.disk.writes, 1, 'the entire import is one atomic write');
  const loaded = new ProgressStore(() => other.disk);
  assert.deepEqual(loaded.snapshot(), backup.values);
  assert.deepEqual(loaded.read(COSMETICS_KEY), { gun: 'inspector', outfit: 'rigger' });
  assert.equal((loaded.read(DAILY_BESTS_KEY) as any)['RF-D77-2026-09-18'], 12345);
  const cp = loadCheckpoint(loaded.read(CHECKPOINT_KEY))!;
  const g = new Game();
  g.start(cp.seed, cp);
  assert.equal(g.stage, 2);
  assert.deepEqual(g.mods, cp.mods);
});

test('saving Daily records preserves archived rulesets without undoing the current record limit', () => {
  const records: Record<string, number> = { 'RF-D78-2026-09-19': 1234 };
  const old: Record<string, number> = { 'RF-D78-2026-09-18': 1000, 'RF-D77-2026-09-18': 2000 };
  const merged = mergeDailyRecords(old, records);
  assert.equal(merged['RF-D77-2026-09-18'], 2000);
  assert.equal(merged['RF-D78-2026-09-18'], undefined);
  for (let i = 0; i < 2100; i++)
    old[`RF-D77-${new Date(Date.UTC(2020, 0, i + 1)).toISOString().slice(0, 10)}`] = 1000 + i;
  const bounded = mergeDailyRecords(old, records);
  assert.equal(Object.keys(bounded).length, 2000);
  assert.equal(bounded['RF-D78-2026-09-19'], 1234);
});

test('malformed, partial, future and invalid-field imports leave memory and storage untouched', async () => {
  const { disk, store } = setup();
  await populated(store);
  const before = disk.getItem(PROGRESS_KEY),
    memory = store.snapshot();
  const good = JSON.parse(store.backup('2.94.0'));
  const variants = [
    '{',
    JSON.stringify({ ...good, version: 99 }),
    JSON.stringify({ ...good, values: {} }),
    JSON.stringify({
      ...good,
      values: { ...good.values, [CHECKPOINT_KEY]: { ...good.values[CHECKPOINT_KEY], hp: -1 } },
    }),
    JSON.stringify({ ...good, values: { ...good.values, [DISCOVERIES_KEY]: ['missing-upgrade'] } }),
    JSON.stringify({
      ...good,
      values: {
        ...good.values,
        [LOGBOOK_KEY]: { version: 1, enemies: ['invented'], areas: [], escaped: false },
      },
    }),
    JSON.stringify({
      ...good,
      values: { ...good.values, [COSMETICS_KEY]: { gun: 'mirror', outfit: 'standard' } },
    }),
    JSON.stringify({
      ...good,
      values: { ...good.values, [VICTORIES_KEY]: [{ kind: 'invented', seed: 'x' }] },
    }),
    JSON.stringify({ ...good, values: { ...good.values, [RUN_HISTORY_KEY]: [{ version: 1 }] } }),
    JSON.stringify({
      ...good,
      values: { ...good.values, [DAILY_BESTS_KEY]: { 'RF-D78-2026-02-31': 20 } },
    }),
    JSON.stringify({ ...good, values: { ...good.values, [WORKSHOP_BUILD_KEY]: ['rewire'] } }),
    JSON.stringify(good).replace('"values":{', '"values":{"__proto__":{"polluted":true},'),
    ' '.repeat(BACKUP_LIMIT + 1),
  ];
  for (const raw of variants) {
    assert.throws(() => parseProgressBackup(raw));
    assert.equal(disk.getItem(PROGRESS_KEY), before);
    assert.deepEqual(store.snapshot(), memory);
  }
  assert.equal(
    await store.restore({ ...good, values: { ...good.values, [CHECKPOINT_KEY]: false } }),
    false,
  );
  assert.equal(({} as any).polluted, undefined);
});

test('failed restore preserves the whole previous profile; successful restore supports persistent undo', async () => {
  const { store, disk } = setup();
  await populated(store);
  const before = new ProgressStore(() => disk).snapshot();
  const rawBefore = disk.getItem(PROGRESS_KEY);
  const empty = setup().store;
  const backup = parseProgressBackup(empty.backup('2.94.0'));
  disk.fail = true;
  assert.equal(await store.restore(backup), false);
  assert.equal(disk.getItem(PROGRESS_KEY), rawBefore);
  assert.deepEqual(new ProgressStore(() => disk).snapshot(), before);
  assert.equal(store.state, 'unavailable');
  disk.fail = false;
  assert(await store.restore(backup));
  const reloaded = new ProgressStore(() => disk);
  assert(reloaded.canUndo);
  assert(await reloaded.undo());
  assert.deepEqual(new ProgressStore(() => disk).snapshot(), before);
  assert.equal(new ProgressStore(() => disk).canUndo, false);
});

test('quota failures keep current progress exportable, visibly fail, and can retry without losing the old save', async () => {
  const { disk, store } = setup();
  await store.write(CHECKPOINT_KEY, testCheckpoint('older', 0));
  const old = disk.getItem(PROGRESS_KEY);
  disk.fail = true;
  const states: string[] = [];
  store.onChange = () => states.push(store.state);
  assert.equal(await store.write(CHECKPOINT_KEY, testCheckpoint('newer', 0)), false);
  assert.equal(disk.getItem(PROGRESS_KEY), old);
  assert(store.dirty);
  assert(states.includes('unavailable'));
  assert.equal(
    (parseProgressBackup(store.backup('2.94.0')).values[CHECKPOINT_KEY] as any).seed,
    'newer',
  );
  disk.fail = false;
  assert(await store.retry());
  assert.equal(store.state, 'saved');
  assert(!store.dirty);
  assert.equal((new ProgressStore(() => disk).read(CHECKPOINT_KEY) as any).seed, 'newer');
});

test('blocked storage still allows a run and local backup without pretending to save', async () => {
  const store = new ProgressStore(() => {
    throw new Error('SecurityError');
  });
  assert.equal(store.state, 'unavailable');
  const g = new Game();
  wire(g, store);
  g.start('private-browser');
  await store.settled();
  assert.equal(store.state, 'unavailable');
  assert(store.dirty);
  assert.equal(
    (parseProgressBackup(store.backup('2.94.0')).values[CHECKPOINT_KEY] as any).seed,
    g.seed,
  );
});

test('an interrupted legacy read cannot overwrite unread progress after access returns', async () => {
  const disk = new MemoryStorage();
  disk.setItem(CHECKPOINT_KEY, JSON.stringify(testCheckpoint('keep-legacy', 0)));
  disk.setItem(DISCOVERIES_KEY, '["magnum"]');
  let denied = true;
  const store = new ProgressStore(() => ({
    getItem: (key) => {
      if (denied && key === DISCOVERIES_KEY) throw new Error('SecurityError');
      return disk.getItem(key);
    },
    setItem: (key, value) => disk.setItem(key, value),
    removeItem: (key) => disk.removeItem(key),
  }));
  denied = false;
  assert.equal(await store.write(CHECKPOINT_KEY, testCheckpoint('new-local-run', 0)), false);
  assert.equal(store.state, 'unavailable');
  assert.equal(disk.getItem(PROGRESS_KEY), null);
  assert.equal((new ProgressStore(() => disk).read(CHECKPOINT_KEY) as any).seed, 'keep-legacy');
});

test('valid backups recover unreadable profiles and undo preserves the exact original data', async () => {
  const backup = parseProgressBackup(setup().store.backup('2.94.0'));
  for (const key of [PROGRESS_KEY, CHECKPOINT_KEY]) {
    const disk = new MemoryStorage();
    disk.setItem(key, '{broken-original');
    const store = new ProgressStore(() => disk);
    assert.equal(store.state, 'unreadable');
    assert(store.canRestore);
    disk.fail = true;
    assert.equal(await store.restore(backup), false);
    assert.equal(await store.write(DISCOVERIES_KEY, ['magnum']), false);
    disk.fail = false;
    assert(await store.restore(backup));
    const reopened = new ProgressStore(() => disk);
    assert(reopened.canUndo);
    assert(await reopened.undo());
    assert.equal(disk.getItem(key), '{broken-original');
    assert.equal(new ProgressStore(() => disk).state, 'unreadable');
  }
});

test('two tabs serialize writes; a stale tab cannot overwrite or import over newer progress', async () => {
  const disk = new MemoryStorage();
  let tail: Promise<unknown> = Promise.resolve();
  const lock: ProgressLock = (action) => {
    const result = tail.then(action);
    tail = result;
    return result;
  };
  const a = new ProgressStore(() => disk, lock),
    b = new ProgressStore(() => disk, lock);
  const results = await Promise.all([
    a.write(CHECKPOINT_KEY, testCheckpoint('tab-a', 0)),
    b.write(CHECKPOINT_KEY, testCheckpoint('tab-b', 0)),
  ]);
  assert.deepEqual(results, [true, false]);
  assert.equal(b.state, 'conflict');
  const before = disk.getItem(PROGRESS_KEY);
  assert.equal(await b.restore(parseProgressBackup(b.backup('2.94.0'))), false);
  assert.equal(disk.getItem(PROGRESS_KEY), before);
  assert.equal(
    (parseProgressBackup(b.backup('2.94.0')).values[CHECKPOINT_KEY] as any).seed,
    'tab-b',
  );
  const c = new ProgressStore(() => disk, lock);
  await a.write(DISCOVERIES_KEY, ['magnum']);
  c.checkExternal();
  assert.equal(c.state, 'conflict');
});

test('a pending restore cannot be replaced by another restore or an old local write', async () => {
  const disk = new MemoryStorage();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const store = new ProgressStore(
    () => disk,
    async (action) => {
      await gate;
      return action();
    },
  );
  const source = setup().store;
  await source.write(CHECKPOINT_KEY, testCheckpoint('import-wins', 0));
  const restoring = store.restore(parseProgressBackup(source.backup('2.94.0')));
  assert(store.restoring);
  assert.equal(await store.write(CHECKPOINT_KEY, testCheckpoint('stale-click', 0)), false);
  assert.equal(await store.restore(parseProgressBackup(setup().store.backup('2.94.0'))), false);
  release();
  assert(await restoring);
  assert.equal(store.restoring, false);
  assert.equal((new ProgressStore(() => disk).read(CHECKPOINT_KEY) as any).seed, 'import-wins');
});

test('older checkpoint keys migrate in memory without removing originals or resurrecting a dead run', async () => {
  for (const version of [3, 4, 5, 6]) {
    const disk = new MemoryStorage();
    const old = { ...testCheckpoint('legacy-' + version, 2), version };
    const key = version <= 4 ? 'rf-checkpoint-v' + version : CHECKPOINT_KEY;
    disk.setItem(key, JSON.stringify(old));
    const store = new ProgressStore(() => disk);
    assert.deepEqual(store.read(CHECKPOINT_KEY), loadCheckpoint(old));
    assert.equal(
      disk.getItem(PROGRESS_KEY),
      null,
      'reading/migrating never mutates the old profile',
    );
    await store.write(CHECKPOINT_KEY, null);
    const reopened = new ProgressStore(() => disk);
    assert.equal(reopened.read(CHECKPOINT_KEY), null);
    assert.equal(disk.getItem(key), JSON.stringify(old));
  }
});

test('corrupt or newer stored profiles are preserved, not silently overwritten', async () => {
  for (const raw of ['{', '', JSON.stringify({ version: 99, values: {} })]) {
    const disk = new MemoryStorage();
    disk.setItem(PROGRESS_KEY, raw);
    const store = new ProgressStore(() => disk);
    assert.equal(store.state, 'unreadable');
    assert.equal(await store.write(CHECKPOINT_KEY, testCheckpoint('new', 0)), false);
    assert.equal(disk.getItem(PROGRESS_KEY), raw);
  }
  const disk = new MemoryStorage();
  disk.setItem(CHECKPOINT_KEY, '{');
  disk.setItem(DISCOVERIES_KEY, '["magnum"]');
  const store = new ProgressStore(() => disk);
  assert.equal(store.state, 'unreadable');
  assert.deepEqual(store.read(DISCOVERIES_KEY), ['magnum']);
  assert.equal(await store.write(CHECKPOINT_KEY, null), false);
});

test('refresh/tab closure during reward selection preserves cards, paid reroll, health, seed and discoveries', async () => {
  const { store, disk } = setup();
  const g = new Game();
  wire(g, store);
  g.start('reward-backup');
  for (const enemy of g.enemies) Matter.Composite.remove(g.engine.world, enemy.body);
  g.enemies = [];
  g.waves.clear();
  g.clear = true;
  g.hp = 64;
  g.kills = 5;
  g.elapsed = 27;
  g.openReward();
  assert(g.rerollReward());
  await store.settled();
  const cards = g.offers.map((m) => m.id);
  const reloaded = new ProgressStore(() => disk),
    cp = loadCheckpoint(reloaded.read(CHECKPOINT_KEY))!;
  const resumed = new Game();
  wire(resumed, reloaded);
  resumed.start(cp.seed, cp);
  assert.equal(resumed.mode, 'upgrade');
  assert.equal(resumed.hp, 52);
  assert.equal(resumed.elapsed, 27);
  assert.equal(resumed.canReroll, false);
  assert.deepEqual(
    resumed.offers.map((m) => m.id),
    cards,
  );
  resumed.chooseMod(cards[0]);
  await reloaded.settled();
  const after = new ProgressStore(() => disk),
    next = loadCheckpoint(after.read(CHECKPOINT_KEY))!;
  assert.equal(next.stage, 1);
  assert(next.mods.includes(cards[0]));
  assert((after.read(DISCOVERIES_KEY) as string[]).includes(cards[0]));
  assert(validateProgress(after.snapshot()));
});

test('death clears the saved run but keeps discoveries; random retries change seeds and Daily retries do not', async () => {
  const { store, disk } = setup();
  const g = new Game();
  wire(g, store);
  g.start('original', testCheckpoint('original', 1));
  g.invuln = 0;
  g.damagePlayer(1000);
  await store.settled();
  assert.equal(g.mode, 'dead');
  assert.equal(new ProgressStore(() => disk).read(CHECKPOINT_KEY), null);
  assert((store.read(DISCOVERIES_KEY) as string[]).includes('magnum'));
  const values = [parseInt('original', 36), 42];
  assert.notEqual(
    retrySeed('ORIGINAL', () => values.shift()!),
    'ORIGINAL',
  );
  const daily = dailyForDate('2026-09-19')!;
  assert.equal(
    retrySeed(daily.seed, () => {
      throw new Error('Daily must retain its seed');
    }),
    daily.seed,
  );
});

test('Practice, Workshop, warm-up and representative test links cannot write checkpoints or grant progress', async () => {
  const { store, disk } = setup();
  await populated(store);
  const before = disk.getItem(PROGRESS_KEY);
  const starts: Array<(g: Game) => void> = [
    (g) => g.startWorkshop([], []),
    (g) => g.startPractice(testEncounterFromUrl(new URL('https://game.test/?test=loader'))!),
    ...[
      rerollTestFromUrl(new URL('https://game.test/?test=reroll')),
      exitTestFromUrl(new URL('https://game.test/?test=exits')),
      upgradeTestFromUrl(new URL('https://game.test/?test=upgrades')),
      overtimeTestFromUrl(new URL('https://game.test/?test=overtime')),
    ]
      .filter(Boolean)
      .map((cp) => (g: Game) => g.startTest(cp!)),
  ];
  for (const start of starts) {
    const g = new Game();
    let checkpoints = 0,
      victories = 0,
      awards = 0;
    g.onCheckpoint = () => checkpoints++;
    g.onBossDefeated = () => victories++;
    g.onCommendation = () => awards++;
    start(g);
    g.save();
    g.invuln = 0;
    g.damagePlayer(1000);
    assert.equal(checkpoints, 0);
    assert.equal(victories, 0);
    assert.equal(awards, 0);
    const book = store.read(LOGBOOK_KEY) as any;
    assert.deepEqual(recordLogbook(book, g, 'boss'), book);
    assert.equal(snapshotRun(g, 'isolated'), null);
  }
  assert.equal(disk.getItem(PROGRESS_KEY), before);
});
