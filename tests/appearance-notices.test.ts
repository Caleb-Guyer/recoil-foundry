import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPEARANCE_SEEN_KEY,
  loadSeenAppearances,
  unseenAppearances,
} from '../src/appearance-notices.ts';
import { COMMENDATIONS_KEY } from '../src/commendations.ts';
import { COSMETICS_KEY } from '../src/cosmetics.ts';
import {
  ProgressStore,
  PROGRESS_KEY,
  parseProgressBackup,
  validateProgress,
} from '../src/progress.ts';

function setup() {
  const items = new Map<string, string>();
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
  return { storage, store: new ProgressStore(() => storage) };
}

test('only earned appearance rewards need a badge; acknowledging them does not hide later unlocks', () => {
  assert.deepEqual(unseenAppearances([], null), []);
  assert.deepEqual(unseenAppearances(['hot-work'], null), ['hot-work']);
  const seen = loadSeenAppearances(['hot-work'], ['hot-work']);
  assert.deepEqual(unseenAppearances(['hot-work'], seen), []);
  assert.deepEqual(unseenAppearances(['bank-job', 'hot-work'], seen), ['bank-job']);
  assert.deepEqual(
    unseenAppearances(['hot-work'], []),
    ['hot-work'],
    'unlocking two styles needs one notice',
  );
});

test('invalid or unearned acknowledgements cannot suppress a future appearance reward', () => {
  assert.deepEqual(loadSeenAppearances({ seen: ['bank-job'] }, ['bank-job']), []);
  assert.deepEqual(loadSeenAppearances(['bank-job', 'unknown', 'bank-job'], ['bank-job']), [
    'bank-job',
  ]);
  const seen = loadSeenAppearances(['bank-job', 'hot-work'], ['hot-work']);
  assert.deepEqual(seen, ['hot-work']);
  assert.deepEqual(unseenAppearances(['bank-job', 'hot-work'], seen), ['bank-job']);
});

test('unread appearances survive reload; viewing persists without changing equipment or earned rewards', async () => {
  const { store, storage } = setup();
  await store.write(COMMENDATIONS_KEY, ['bank-job']);
  const reload = new ProgressStore(() => storage);
  assert.deepEqual(unseenAppearances(['bank-job'], reload.read(APPEARANCE_SEEN_KEY)), ['bank-job']);
  await reload.write(APPEARANCE_SEEN_KEY, loadSeenAppearances(['bank-job'], ['bank-job']));
  const viewed = new ProgressStore(() => storage);
  assert.deepEqual(unseenAppearances(['bank-job'], viewed.read(APPEARANCE_SEEN_KEY)), []);
  assert.deepEqual(viewed.read(COMMENDATIONS_KEY), ['bank-job']);
  assert.deepEqual(viewed.read(COSMETICS_KEY), { gun: 'standard', outfit: 'standard' });
  await viewed.write(COMMENDATIONS_KEY, ['bank-job', 'air-traffic']);
  const later = new ProgressStore(() => storage);
  assert.deepEqual(
    unseenAppearances(['bank-job', 'air-traffic'], later.read(APPEARANCE_SEEN_KEY)),
    ['air-traffic'],
  );
});

test('appearance acknowledgements round-trip in atomic progress backups and undo', async () => {
  const source = setup();
  await source.store.write(COMMENDATIONS_KEY, ['bank-job', 'air-traffic']);
  await source.store.write(APPEARANCE_SEEN_KEY, ['bank-job']);
  const backup = parseProgressBackup(source.store.backup('3.17.0'));
  const target = setup();
  assert(await target.store.restore(backup));
  const restored = new ProgressStore(() => target.storage);
  assert.deepEqual(
    unseenAppearances(['bank-job', 'air-traffic'], restored.read(APPEARANCE_SEEN_KEY)),
    ['air-traffic'],
  );
  assert(await restored.undo());
  assert.deepEqual(restored.read(APPEARANCE_SEEN_KEY), []);
  assert.deepEqual(restored.read(COMMENDATIONS_KEY), []);
});

test('older profiles and backups retain earned appearances and migrate to unacknowledged notices', async () => {
  const { store, storage } = setup();
  await store.write(COMMENDATIONS_KEY, ['bank-job']);
  const oldBackup = JSON.parse(store.backup('3.17.0'));
  delete oldBackup.values[APPEARANCE_SEEN_KEY];
  const migrated = parseProgressBackup(JSON.stringify(oldBackup));
  assert.deepEqual(unseenAppearances(['bank-job'], migrated.values[APPEARANCE_SEEN_KEY]), [
    'bank-job',
  ]);
  const oldProfile = JSON.parse(storage.getItem(PROGRESS_KEY)!);
  delete oldProfile.values[APPEARANCE_SEEN_KEY];
  storage.setItem(PROGRESS_KEY, JSON.stringify(oldProfile));
  const reloaded = new ProgressStore(() => storage);
  assert.equal(reloaded.state, 'saved');
  assert.deepEqual(reloaded.read(COMMENDATIONS_KEY), ['bank-job']);
  assert.deepEqual(reloaded.read(APPEARANCE_SEEN_KEY), []);
});

test('malformed acknowledgements fail backup validation instead of granting or suppressing unlocks', async () => {
  const { store } = setup();
  await store.write(COMMENDATIONS_KEY, ['bank-job']);
  for (const raw of [null, {}, ['unknown'], ['air-traffic'], ['bank-job', 'bank-job']]) {
    const values = store.snapshot();
    values[APPEARANCE_SEEN_KEY] = raw;
    assert.equal(validateProgress(values), null);
  }
});
