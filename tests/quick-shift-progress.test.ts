import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import {
  ProgressStore,
  PROGRESS_KEY,
  CHECKPOINT_KEY,
  parseProgressBackup,
  progressSummary,
  validateProgress,
  type ProgressBackup,
  type ProgressValues,
} from '../src/progress.ts';
import {
  QUICK_SHIFT_CONTINUE_KEY,
  loadQuickShiftContinue,
  validQuickShiftContinue,
} from '../src/quick-shift.ts';
import {
  QUICK_SHIFT_RECORDS_KEY,
  quickShiftFromSeed,
  recordQuickShift,
} from '../src/quick-shift-rules.ts';
import {
  WEAPON_UNLOCKS_KEY,
  loadWeaponUnlocks,
  unlockedStartingGuns,
} from '../src/weapon-unlocks.ts';
import { DISCOVERIES_KEY } from '../src/workshop-build.ts';

class MemoryStorage {
  values = new Map<string, string>();
  writes = 0;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.writes++;
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}
function setup(disk = new MemoryStorage()) {
  let revision = 0;
  return {
    disk,
    store: new ProgressStore(
      () => disk,
      async (action) => action(),
      () => 'test-' + ++revision,
    ),
  };
}
async function campaignProfile() {
  const { disk, store } = setup();
  const game = new Game();
  game.onCheckpoint = (value) => {
    void store.write(CHECKPOINT_KEY, value);
  };
  game.start('RF-C108-QPROGRESS');
  await store.settled();
  // Normal profile migration recognizes the real Campaign checkpoint as started.
  const loaded = setup(disk).store;
  assert.deepEqual(unlockedStartingGuns(loadWeaponUnlocks(loaded.read(WEAPON_UNLOCKS_KEY))), [
    'pistol',
  ]);
  assert.deepEqual(loaded.read(DISCOVERIES_KEY), []);
  return { disk, store: loaded, game };
}
async function saveQuick(store: ProgressStore, game: Game) {
  const snapshot = game.quickShift.snapshot();
  assert(snapshot && validQuickShiftContinue(snapshot));
  assert(await store.write(QUICK_SHIFT_CONTINUE_KEY, snapshot));
  assert(validateProgress(store.snapshot()));
  return snapshot;
}
function assertOtherProgress(
  actual: ProgressValues,
  expected: ProgressValues,
  except: readonly string[],
) {
  for (const key of Object.keys(expected) as (keyof ProgressValues)[])
    if (!except.includes(key))
      assert.deepEqual(actual[key], expected[key], 'Unexpected mutation of ' + key);
}
function quick(game: Game, code = 'SAVE') {
  assert(game.quickShift.begin(quickShiftFromSeed('RF-Q1-' + code)!, 'pistol', false));
  assert.equal(game.quickShift.state!.preview, false);
  return game;
}
function draft(game: Game) {
  while (game.quickShift.state!.phase === 'draft')
    assert(game.quickShift.chooseMod(game.quickShift.state!.offers[0]));
  assert.equal(game.quickShift.state!.phase, 'fight');
}

test('native Quick Shift writes its own Continue, preserves Campaign and resumes the exact next draft after one pick', async () => {
  const { disk, store, game } = await campaignProfile();
  const before = store.snapshot();
  const ordinaryEvents: string[] = [];
  game.onCheckpoint = (value) => {
    ordinaryEvents.push('checkpoint');
    void store.write(CHECKPOINT_KEY, value);
  };
  game.onCampaignClear = () => ordinaryEvents.push('Campaign clear');
  game.onBossDefeated = () => ordinaryEvents.push('boss discovery');
  game.onEnemyDefeated = () => ordinaryEvents.push('enemy discovery');
  game.onEnemyEncountered = () => ordinaryEvents.push('enemy encounter');
  game.onCommendation = () => ordinaryEvents.push('commendation');
  game.onMilestone = () => ordinaryEvents.push('milestone');
  quick(game);
  const first = await saveQuick(store, game);
  assert.equal(first.state.mods.length, 0);
  const chosen = game.quickShift.state!.offers[0];
  assert(game.quickShift.chooseMod(chosen));
  const nextOffers = [...game.quickShift.state!.offers];
  const nextState = structuredClone(game.quickShift.state);
  const saved = await saveQuick(store, game);
  game.save();
  await store.settled();
  assert.deepEqual(ordinaryEvents, []);
  assert.equal(saved.state.mods.length, 1);
  assert.equal(saved.state.mods[0], chosen);
  assert.equal(saved.state.draftRemaining, 2);
  assertOtherProgress(store.snapshot(), before, [QUICK_SHIFT_CONTINUE_KEY]);
  const refreshed = setup(disk).store;
  assert.deepEqual(refreshed.read(CHECKPOINT_KEY), before[CHECKPOINT_KEY]);
  assertOtherProgress(refreshed.snapshot(), before, [QUICK_SHIFT_CONTINUE_KEY]);
  const resumed = new Game();
  assert(resumed.quickShift.resume(refreshed.read(QUICK_SHIFT_CONTINUE_KEY)));
  assert.deepEqual(resumed.quickShift.state, nextState);
  assert.deepEqual(resumed.quickShift.state!.offers, nextOffers);
  assert.deepEqual(resumed.mods, [chosen]);
  assert.equal(resumed.mode, 'upgrade');
  assert.equal(progressSummary(refreshed.snapshot()).quickRun, 1);
});

test('native Quick failure records and a separate live Continue survive one atomic backup restore and undo', async () => {
  const source = await campaignProfile();
  const beforeQuick = source.store.snapshot();
  const failed = quick(new Game(), 'FAILED');
  draft(failed);
  failed.hurtAt = -10;
  failed.damagePlayer(1000);
  assert.equal(failed.quickShift.result!.outcome, 'dead');
  assert.equal(failed.quickShift.result!.rooms, 0);
  const outcome = recordQuickShift(
    source.store.read(QUICK_SHIFT_RECORDS_KEY),
    failed.quickShift.result!,
  );
  assert(await source.store.write(QUICK_SHIFT_RECORDS_KEY, outcome.records));
  const live = quick(new Game(), 'BACKUP');
  assert(live.quickShift.chooseMod(live.quickShift.state!.offers[0]));
  const expectedContinue = await saveQuick(source.store, live);
  const expectedOffers = [...live.quickShift.state!.offers];
  assertOtherProgress(source.store.snapshot(), beforeQuick, [
    QUICK_SHIFT_CONTINUE_KEY,
    QUICK_SHIFT_RECORDS_KEY,
  ]);
  const backup = parseProgressBackup(source.store.backup('5.31.0'));
  const target = setup();
  const targetBefore = target.store.snapshot();
  const writesBefore = target.disk.writes;
  assert(await target.store.restore(backup));
  assert.equal(
    target.disk.writes - writesBefore,
    1,
    'backup restore must commit all values in one storage write',
  );
  const restored = setup(target.disk).store;
  assert.deepEqual(restored.snapshot(), backup.values);
  assert.deepEqual(restored.read(QUICK_SHIFT_CONTINUE_KEY), expectedContinue);
  assert.deepEqual(restored.read(QUICK_SHIFT_RECORDS_KEY), outcome.records);
  assert.deepEqual(restored.read(CHECKPOINT_KEY), source.store.read(CHECKPOINT_KEY));
  assert.deepEqual(unlockedStartingGuns(loadWeaponUnlocks(restored.read(WEAPON_UNLOCKS_KEY))), [
    'pistol',
  ]);
  const resumed = new Game();
  assert(resumed.quickShift.resume(restored.read(QUICK_SHIFT_CONTINUE_KEY)));
  assert.deepEqual(resumed.quickShift.state!.offers, expectedOffers);
  assert.deepEqual(resumed.quickShift.state!.mods, expectedContinue.state.mods);
  assert(await target.store.undo());
  assert.deepEqual(target.store.snapshot(), targetBefore);
  assert.equal(target.store.read(QUICK_SHIFT_CONTINUE_KEY), null);
  assert.deepEqual(target.store.read(QUICK_SHIFT_RECORDS_KEY), []);
});

test('pre-Quick backups and stored profiles migrate missing new keys without losing existing progress', async () => {
  const { disk, store } = await campaignProfile();
  const expected = store.snapshot();
  const legacyBackup = JSON.parse(store.backup('5.30.0'));
  delete legacyBackup.values[QUICK_SHIFT_CONTINUE_KEY];
  delete legacyBackup.values[QUICK_SHIFT_RECORDS_KEY];
  const migrated = parseProgressBackup(JSON.stringify(legacyBackup));
  assert.equal(migrated.values[QUICK_SHIFT_CONTINUE_KEY], null);
  assert.deepEqual(migrated.values[QUICK_SHIFT_RECORDS_KEY], []);
  assert.deepEqual(migrated.values, expected);
  const target = setup();
  assert(await target.store.restore(migrated));
  assert.deepEqual(target.store.snapshot(), expected);
  const oldStored = JSON.parse(disk.getItem(PROGRESS_KEY)!);
  delete oldStored.values[QUICK_SHIFT_CONTINUE_KEY];
  delete oldStored.values[QUICK_SHIFT_RECORDS_KEY];
  disk.setItem(PROGRESS_KEY, JSON.stringify(oldStored));
  const rawBefore = disk.getItem(PROGRESS_KEY);
  const reloaded = setup(disk).store;
  assert.equal(reloaded.state, 'saved');
  assert.deepEqual(reloaded.snapshot(), expected);
  assert.equal(
    disk.getItem(PROGRESS_KEY),
    rawBefore,
    'migration should not overwrite the stored profile merely by reading it',
  );
  const forwardBackup = parseProgressBackup(reloaded.backup('5.31.0'));
  assert(Object.hasOwn(forwardBackup.values, QUICK_SHIFT_CONTINUE_KEY));
  assert(Object.hasOwn(forwardBackup.values, QUICK_SHIFT_RECORDS_KEY));
});

test('malformed Quick Continue or records reject a whole backup without applying its otherwise valid Campaign changes', async () => {
  const source = await campaignProfile();
  await saveQuick(source.store, quick(new Game(), 'REJECT'));
  const valid = parseProgressBackup(source.store.backup('5.31.0'));
  const target = await campaignProfile();
  const before = target.store.snapshot();
  const beforeRaw = target.disk.getItem(PROGRESS_KEY);
  const beforeWrites = target.disk.writes;
  const mutations: ((raw: any) => void)[] = [
    (raw) => {
      raw.values[QUICK_SHIFT_CONTINUE_KEY].state.challenge.code = 'WRONG';
    },
    (raw) => {
      raw.values[QUICK_SHIFT_CONTINUE_KEY].state.preview = true;
    },
    (raw) => {
      raw.values[QUICK_SHIFT_CONTINUE_KEY].state.offers = ['magnum'];
    },
    (raw) => {
      raw.values[QUICK_SHIFT_CONTINUE_KEY].state.draftRemaining = 0;
    },
    (raw) => {
      raw.values[QUICK_SHIFT_CONTINUE_KEY].checkpoint.seed = 'RF-C108-OTHER';
    },
    (raw) => {
      raw.values[QUICK_SHIFT_CONTINUE_KEY].checkpoint.rematchRoom = { solids: [] };
    },
    (raw) => {
      raw.values[QUICK_SHIFT_RECORDS_KEY] = [{ version: 1, rules: 1, outcome: 'won', rooms: 4 }];
    },
    (raw) => {
      raw.values[QUICK_SHIFT_RECORDS_KEY] = null;
    },
  ];
  for (const mutate of mutations) {
    const raw = structuredClone(valid);
    // These ordinary progress edits would be legal on their own. A malformed
    // Quick wrapper must reject the transaction before any one key is written.
    (raw.values[CHECKPOINT_KEY] as any).hp = 37;
    raw.values[DISCOVERIES_KEY] = ['magnum'];
    mutate(raw);
    assert.equal(validateProgress(raw.values), null);
    assert.throws(() => parseProgressBackup(JSON.stringify(raw)), /invalid progress/);
    assert.equal(await target.store.restore(raw as ProgressBackup), false);
    assert.deepEqual(target.store.snapshot(), before);
    assert.equal(target.disk.getItem(PROGRESS_KEY), beforeRaw);
    assert.equal(target.disk.writes, beforeWrites);
  }
});

test('isolated Quick previews cannot supply a Continue that replaces a real saved attempt', async () => {
  const { disk, store } = await campaignProfile();
  const live = quick(new Game(), 'REAL');
  await saveQuick(store, live);
  const before = store.snapshot();
  const rawBefore = disk.getItem(PROGRESS_KEY);
  const preview = new Game();
  assert(preview.quickShift.begin(quickShiftFromSeed('RF-Q1-PREVIEW')!, 'pistol', true));
  assert.equal(preview.quickShift.snapshot(), null);
  assert.equal(loadQuickShiftContinue(preview.quickShift.snapshot()), null);
  assert.deepEqual(store.snapshot(), before);
  assert.equal(disk.getItem(PROGRESS_KEY), rawBefore);
});
