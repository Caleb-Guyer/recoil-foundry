import { COURIER_ARCHIVE_ID } from '../src/courier-record-id.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { LazyResource, ViewLifetime } from '../src/lazy-resource.ts';
import { BoundedCache } from '../src/bounded-cache.ts';
import { recoveredLogbookTokens, unreadCatalogCount } from '../src/logbook-notices.ts';
import { logbookEntries, loadLogbook } from '../src/logbook.ts';
import { logbookCatalog } from '../src/logbook-catalog.ts';
import {
  archiveToken,
  loadArchive,
  encounterArchive,
  acknowledgeArchiveEntry,
} from '../src/archive.ts';
import { MODS, seeded } from '../src/rules.ts';
import { COMMENDATIONS } from '../src/commendations.ts';
import { unlockGoals } from '../src/longevity.ts';
import { loadWeaponUnlocks } from '../src/weapon-unlocks.ts';

test('concurrent menu opens share a download, failure is retryable, and cached opens reuse it', async () => {
  let calls = 0;
  const resource = new LazyResource(async () => {
    if (++calls === 1) throw new Error('offline');
    return { ready: true };
  });
  const first = resource.load();
  assert.equal(resource.load(), first);
  await assert.rejects(first, /offline/);
  assert.equal(resource.value, undefined);
  const value = await resource.load();
  assert.equal(await resource.load(), value);
  assert.equal(calls, 2);
});

test('late menu/view loads cannot reactivate a closed or replaced dialog', async () => {
  const lifetime = new ViewLifetime();
  const closed = lifetime.ticket();
  lifetime.invalidate();
  const replaced = lifetime.ticket();
  lifetime.invalidate();
  assert.equal(closed(), false);
  assert.equal(replaced(), false);
  assert.equal(lifetime.ticket()(), true);
});

test('picture caches release old backing canvases and retain recently viewed pictures', () => {
  const released: number[] = [];
  const cache = new BoundedCache<string, number>(3, (value) => released.push(value));
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  assert.equal(cache.get('a'), 1);
  cache.set('d', 4);
  assert.equal(cache.get('b'), undefined);
  assert.deepEqual(released, [2]);
  cache.set('a', 5);
  assert.deepEqual(released, [2, 1]);
  for (let i = 0; i < 1000; i++) cache.set(String(i), i);
  assert.equal(cache.size, 3);
  assert.equal(released.length, 1002);
});

test('lightweight discovery tokens and title badges match full catalogs through unlock/read transitions', () => {
  const random = seeded('loading-notice-parity');
  const allMods = MODS.map((m) => m.id);
  const allEarned = COMMENDATIONS.map((c) => c.id);
  for (let i = 0; i < 300; i++) {
    const book = loadLogbook({
      version: 1,
      enemies: ['runner', 'shooter', 'loader', 'boss'].filter(() => random() > 0.5),
      areas: ['docks', 'cooling', 'rooftops'].filter(() => random() > 0.5),
      escaped: random() > 0.5,
      annex: random() > 0.5,
      stories: ['manifest', 'audit', 'research'],
      disconnects: [3, 7, 15],
      shutdown: random() > 0.5,
    });
    const known = allMods.filter(() => random() > 0.65);
    const earned = allEarned.filter(() => random() > 0.8);
    const weapons = loadWeaponUnlocks({
      version: 1,
      started: random() > 0.5,
      cleared: random() > 0.7,
      overtime: random() > 0.9,
    });
    const goals = unlockGoals(book, earned, ['loader'], { arcBoss: random() > 0.5 });
    const catalog = logbookCatalog(known, book, earned, null, goals, null, weapons);
    const tokens = catalog.map(archiveToken).filter(() => random() > 0.3);
    const archive = loadArchive({
      version: 1,
      encountered: tokens,
      read: tokens.filter(() => random() > 0.7),
    });
    assert.deepEqual(
      recoveredLogbookTokens(known, book, earned, archive.encountered),
      logbookEntries(known, book, earned, archive.encountered).map(archiveToken),
    );
    assert.equal(
      unreadCatalogCount(known, earned, archive, goals, weapons),
      logbookCatalog(known, book, earned, archive, goals, null, weapons).filter((e) => e.unread)
        .length,
      'Badge parity sample ' + i,
    );
  }
});

test('Courier discovery and reading preserve lightweight title badge parity without inventing Runner victories', () => {
  const book = loadLogbook({ version: 1, enemies: ['runner'], areas: ['docks'], escaped: false });
  const weapons = loadWeaponUnlocks(null);
  let archive = loadArchive({
    version: 1,
    encountered: ['tool', 'enemy:runner'],
    read: ['tool', 'enemy:runner'],
  });
  const check = (courierKnown: boolean, courierUnread: boolean) => {
    const catalog = logbookCatalog([], book, [], archive, [], null, weapons);
    const courier = catalog.find((entry) => entry.id === COURIER_ARCHIVE_ID)!;
    assert.equal(courier.state === 'known', courierKnown);
    assert.equal(courier.unread, courierUnread);
    const lightweight = recoveredLogbookTokens([], book, [], archive.encountered);
    assert.deepEqual(
      lightweight,
      logbookEntries([], book, [], archive.encountered).map(archiveToken),
    );
    assert.equal(
      lightweight.filter((token) => token === COURIER_ARCHIVE_ID).length,
      Number(courierKnown),
    );
    assert.equal(
      unreadCatalogCount([], [], archive, [], weapons),
      catalog.filter((entry) => entry.unread).length,
    );
    assert(archive.read.includes('enemy:runner'));
    return courier;
  };
  check(false, false);
  archive = encounterArchive(archive, [COURIER_ARCHIVE_ID, COURIER_ARCHIVE_ID]);
  const discovered = check(true, true);
  assert.equal(unreadCatalogCount([], [], archive, [], weapons), 1);
  archive = acknowledgeArchiveEntry(archive, discovered);
  check(true, false);
  assert.equal(unreadCatalogCount([], [], archive, [], weapons), 0);
  archive = encounterArchive(archive, ['mod:fold']);
  check(true, false);
  assert.equal(
    unreadCatalogCount([], [], archive, [], weapons),
    1,
    'Reading the Courier must not suppress a later fitting discovery.',
  );
  assert.deepEqual(loadArchive(JSON.parse(JSON.stringify(archive))), archive);
});
