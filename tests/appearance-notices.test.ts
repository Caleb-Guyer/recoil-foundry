import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPEARANCE_SEEN_KEY,
  APPEARANCE_ITEMS_SEEN_KEY,
  loadSeenAppearances,
  loadSeenAppearanceItems,
  unseenAppearances,
  unseenAppearanceItems,
  acknowledgeAppearanceItem,
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

test('cosmetics awarded together keep independent notices until each is viewed', () => {
  const earned = ['hot-work', 'cable-cut'] as const;
  assert.deepEqual(unseenAppearanceItems(earned, []), [
    'gun:copperline',
    'gun:kiln',
    'outfit:forgehand',
  ]);
  const seen = acknowledgeAppearanceItem([], earned, 'gun:kiln');
  assert.deepEqual(unseenAppearanceItems(earned, seen), ['gun:copperline', 'outfit:forgehand']);
  assert.deepEqual(
    unseenAppearanceItems(earned, acknowledgeAppearanceItem(seen, earned, 'outfit:forgehand')),
    ['gun:copperline'],
  );
  assert.deepEqual(acknowledgeAppearanceItem(seen, earned, 'gun:kiln'), seen);
  assert.deepEqual(
    loadSeenAppearanceItems(
      [
        'gun:kiln',
        'gun:copperline',
        'outfit:sentinel',
        'unknown',
        'gun:standard',
        'outfit:standard',
      ],
      ['hot-work'],
    ),
    ['gun:kiln'],
  );
});

test('legacy section notices stay acknowledged while later cosmetics receive item badges', () => {
  assert.deepEqual(unseenAppearanceItems(['hot-work', 'cable-cut'], [], ['hot-work']), [
    'gun:copperline',
  ]);
  assert.deepEqual(
    unseenAppearanceItems(['hot-work', 'cable-cut'], ['gun:copperline'], ['hot-work']),
    [],
  );
  assert.deepEqual(
    unseenAppearanceItems(
      ['hot-work', 'cable-cut', 'fuse-pulled'],
      ['gun:copperline'],
      ['hot-work'],
    ),
    ['gun:fusekeeper'],
  );
  assert.deepEqual(unseenAppearanceItems(['hot-work'], [], ['cable-cut']), [
    'gun:kiln',
    'outfit:forgehand',
  ]);
});

test('partial cosmetic notices persist through reload, backup restoration and Undo without changing equipment', async () => {
  const source = setup();
  await source.store.write(COMMENDATIONS_KEY, ['hot-work', 'cable-cut']);
  await source.store.write(APPEARANCE_ITEMS_SEEN_KEY, ['gun:kiln']);
  const reloaded = new ProgressStore(() => source.storage);
  assert.deepEqual(
    unseenAppearanceItems(['hot-work', 'cable-cut'], reloaded.read(APPEARANCE_ITEMS_SEEN_KEY)),
    ['gun:copperline', 'outfit:forgehand'],
  );
  assert.deepEqual(reloaded.read(COSMETICS_KEY), { gun: 'standard', outfit: 'standard' });
  assert.deepEqual(reloaded.read(COMMENDATIONS_KEY), ['cable-cut', 'hot-work']);
  const target = setup();
  assert(await target.store.restore(parseProgressBackup(reloaded.backup('4.11.1'))));
  assert.deepEqual(target.store.read(APPEARANCE_ITEMS_SEEN_KEY), ['gun:kiln']);
  assert.deepEqual(
    unseenAppearanceItems(['hot-work', 'cable-cut'], target.store.read(APPEARANCE_ITEMS_SEEN_KEY)),
    ['gun:copperline', 'outfit:forgehand'],
  );
  assert(await target.store.undo());
  assert.deepEqual(target.store.read(APPEARANCE_ITEMS_SEEN_KEY), []);
  assert.deepEqual(target.store.read(COMMENDATIONS_KEY), []);
});

test('pre-item profiles migrate without resetting existing section acknowledgements', async () => {
  const { store, storage } = setup();
  await store.write(COMMENDATIONS_KEY, ['hot-work', 'cable-cut']);
  await store.write(APPEARANCE_SEEN_KEY, ['hot-work']);
  const oldBackup = JSON.parse(store.backup('4.11.0'));
  delete oldBackup.values[APPEARANCE_ITEMS_SEEN_KEY];
  const values = parseProgressBackup(JSON.stringify(oldBackup)).values;
  assert.deepEqual(values[APPEARANCE_ITEMS_SEEN_KEY], []);
  assert.deepEqual(
    unseenAppearanceItems(
      ['hot-work', 'cable-cut'],
      values[APPEARANCE_ITEMS_SEEN_KEY],
      values[APPEARANCE_SEEN_KEY],
    ),
    ['gun:copperline'],
  );
  const oldProfile = JSON.parse(storage.getItem(PROGRESS_KEY)!);
  delete oldProfile.values[APPEARANCE_ITEMS_SEEN_KEY];
  storage.setItem(PROGRESS_KEY, JSON.stringify(oldProfile));
  const reloaded = new ProgressStore(() => storage);
  assert.equal(reloaded.state, 'saved');
  assert.deepEqual(reloaded.read(APPEARANCE_SEEN_KEY), ['hot-work']);
  assert.deepEqual(reloaded.read(APPEARANCE_ITEMS_SEEN_KEY), []);
});

test('malformed or unearned item notices cannot suppress a future cosmetic unlock', async () => {
  const { store } = setup();
  await store.write(COMMENDATIONS_KEY, ['hot-work']);
  for (const raw of [
    null,
    {},
    ['unknown'],
    ['gun:copperline'],
    ['gun:kiln', 'gun:kiln'],
    ['gun:standard'],
    ['outfit:standard'],
  ]) {
    const values = store.snapshot();
    values[APPEARANCE_ITEMS_SEEN_KEY] = raw;
    assert.equal(validateProgress(values), null);
  }
  assert.deepEqual(acknowledgeAppearanceItem([], ['hot-work'], 'gun:copperline'), []);
  assert.deepEqual(unseenAppearanceItems(['hot-work', 'cable-cut'], []), [
    'gun:copperline',
    'gun:kiln',
    'outfit:forgehand',
  ]);
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
