import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCHIVE_KEY,
  loadArchive,
  validArchive,
  mergeArchive,
  encounterArchive,
  readArchiveEntry,
  archiveUnread,
  migrateArchive,
  enemyArchiveIds,
} from '../src/archive.ts';
import { logbookCatalog, catalogMatches, VARIANT_RECORDS } from '../src/logbook-catalog.ts';
import { modMark } from '../src/upgrade-icons.ts';
import { archiveMark } from '../src/archive-art.ts';
import { logbookArticle } from '../src/logbook-menu.ts';
import { loadLogbook, LOGBOOK_KEY } from '../src/logbook.ts';
import { MODS } from '../src/rules.ts';
import { Game } from '../src/game.ts';
import { DISCOVERIES_KEY, loadDiscoveries } from '../src/workshop-build.ts';
import { COMMENDATIONS_KEY } from '../src/commendations.ts';
import { ProgressStore, validateProgress, parseProgressBackup } from '../src/progress.ts';

function storage() {
  const data = new Map<string, string>();
  const disk = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  return { disk, store: new ProgressStore(() => disk) };
}
const emptyBook = () => loadLogbook(null);

test('the collection contains every upgrade, enemy, variant and zone without exposing unrecovered names or lore', () => {
  const entries = logbookCatalog([], emptyBook(), [], loadArchive(null));
  assert.equal(entries.filter((e) => e.mod).length, MODS.length);
  assert.equal(entries.filter((e) => e.id.startsWith('enemy:')).length, 35);
  assert.equal(
    entries.filter((e) => e.id.startsWith('elite:') || e.id.startsWith('mutation:')).length,
    6,
  );
  assert.equal(entries.filter((e) => e.section === 'places').length, 12);
  const html = entries
    .filter((e) => e.state === 'unseen')
    .map((e) => logbookArticle(e, modMark))
    .join('');
  assert.doesNotMatch(
    html,
    /Repair Drone|Relay Unit|Interceptor|Charge Lens|Pulse Chamber|Transmission Annex|Continuity control|Rooftops|Railworks|Foundry Core/,
  );
  assert.equal(catalogMatches(entries, 'equipment', 'charge lens').length, 0);
  assert.equal(catalogMatches(entries, 'machines', 'interceptor').length, 0);
});

test('upgrade sightings reveal records without granting Workshop ownership', () => {
  const archive = encounterArchive(loadArchive(null), ['mod:arc-coil']);
  const entries = logbookCatalog([], emptyBook(), [], archive);
  const entry = entries.find((e) => e.id === 'mod:arc-coil')!;
  assert.equal(entry.state, 'known');
  assert.equal(entry.name, 'Arc Coil');
  assert(entry.description && entry.lore[2]);
  assert(entry.unread);
  assert.deepEqual(loadDiscoveries([]), []);
  assert.equal(catalogMatches(entries, 'equipment', 'arc coil', 'known').length, 1);
  assert.equal(catalogMatches(entries, 'equipment', 'arc coil', 'unseen').length, 0);
});

test('all upgrade and machine icons are complete and individually distinct', () => {
  const icons = MODS.map(modMark);
  assert.equal(new Set(icons).size, MODS.length);
  assert(icons.every((svg) => !svg.includes('undefined') && svg.includes('<path d="M')));
  const machineIcons = logbookCatalog([], emptyBook(), [], null)
    .filter((e) => e.section === 'machines')
    .map((e) => archiveMark(e.id));
  assert(machineIcons.every(Boolean));
  assert.equal(new Set(machineIcons).size, machineIcons.length);
});

test('opening one entry acknowledges only that discovery; future and unknown acknowledgements cannot suppress notices', () => {
  const seen = encounterArchive(null, ['mod:fold', 'mod:arc-coil']);
  const opened = readArchiveEntry(seen, 'mod:fold');
  assert(!archiveUnread(opened, 'mod:fold'));
  assert(archiveUnread(opened, 'mod:arc-coil'));
  assert.deepEqual(readArchiveEntry(opened, 'mod:rail-spike'), opened);
  const future = encounterArchive(opened, ['mod:rail-spike']);
  assert(archiveUnread(future, 'mod:rail-spike'));
  assert.deepEqual(readArchiveEntry(opened, 'evil'), opened);
});

test('earning an already-read challenge produces a fresh entry notification', () => {
  const baseline = migrateArchive(null, [], emptyBook(), []);
  assert(!archiveUnread(baseline, 'commendation:clean-work'));
  const earned = encounterArchive(baseline, ['commendation:clean-work:earned']);
  const entry = logbookCatalog([], emptyBook(), ['clean-work'], earned).find(
    (e) => e.id === 'commendation:clean-work',
  )!;
  assert.equal(entry.notification, 'commendation:clean-work:earned');
  assert(entry.unread && entry.earned);
});

test('archive merge keeps discoveries and acknowledgements from both snapshots', () => {
  const a = readArchiveEntry(encounterArchive(null, ['mod:fold']), 'mod:fold');
  const b = encounterArchive(null, ['mod:arc-coil']);
  const merged = mergeArchive(a, b);
  assert(!archiveUnread(merged, 'mod:fold'));
  assert(archiveUnread(merged, 'mod:arc-coil'));
  assert.deepEqual(mergeArchive(b, a), merged);
});

test('materialized enemy sightings are reported once per room and variants recover their own records', () => {
  const g = new Game();
  let archive = loadArchive(null),
    calls = 0;
  g.onEnemyEncountered = (e) => {
    calls++;
    archive = encounterArchive(archive, enemyArchiveIds(e));
  };
  g.start('archive-encounters');
  const enemy = g.enemies[0];
  enemy.elite = 'shielded';
  const idle = {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: false,
    aim: { x: 1000, y: 400 },
  };
  for (let i = 0; i < 50; i++) g.tick(1 / 60, idle);
  assert.equal(calls, 1);
  assert(archive.encountered.includes('enemy:' + enemy.kind));
  assert(archive.encountered.includes('elite:shielded'));
  const variant = logbookCatalog([], emptyBook(), [], archive).find(
    (e) => e.id === 'elite:shielded',
  )!;
  assert.equal(variant.name, 'Shielded Runner');
  assert(variant.description && variant.lore[2] && variant.unread);
  enemy.allied = true;
  assert.deepEqual(enemyArchiveIds(enemy), []);
  enemy.allied = false;
  enemy.spawn = 1;
  assert.deepEqual(enemyArchiveIds(enemy), []);
  enemy.spawn = 0;
  enemy.eventRole = 'relay';
  assert.deepEqual(enemyArchiveIds(enemy), []);
});

test('variant lore is authored, distinct and complete', () => {
  assert.equal(new Set(VARIANT_RECORDS.map((r) => r.lore[2])).size, VARIANT_RECORDS.length);
  for (const variant of VARIANT_RECORDS) {
    assert(variant.lore[0].length > 8 && variant.lore[1].length > 8);
    assert(variant.lore[2].split(/\s+/).length >= 30);
    assert(variant.lore[2].includes('\n\n'));
  }
});

test('family, discovery and unread filters do not expose a hidden upgrade name', () => {
  const archive = encounterArchive(null, ['mod:deadeye']);
  const entries = logbookCatalog([], emptyBook(), [], archive);
  assert.equal(catalogMatches(entries, 'equipment', '', 'known', 'precision').length, 1);
  assert.equal(catalogMatches(entries, 'equipment', '', 'unread').length, 1);
  assert(catalogMatches(entries, 'equipment', '', 'unseen', 'precision').length > 0);
  assert.equal(
    catalogMatches(entries, 'equipment', 'cutting torch', 'unseen', 'precision').length,
    0,
  );
});

test('old profiles migrate their known collection as read without losing existing progress', async () => {
  const { store } = storage();
  await store.write(DISCOVERIES_KEY, ['fold']);
  await store.write(LOGBOOK_KEY, {
    version: 1,
    enemies: ['runner'],
    areas: ['docks'],
    escaped: false,
  });
  await store.write(COMMENDATIONS_KEY, ['clean-work']);
  const legacy = store.snapshot();
  delete (legacy as Record<string, unknown>)[ARCHIVE_KEY];
  const migrated = validateProgress(legacy)!;
  assert(migrated);
  const archive = loadArchive(migrated[ARCHIVE_KEY]);
  assert(archive.read.includes('mod:fold'));
  assert(archive.read.includes('enemy:runner'));
  assert(archive.read.includes('commendation:clean-work:earned'));
  assert.deepEqual(migrated[DISCOVERIES_KEY], ['fold']);
  assert.deepEqual(migrated[COMMENDATIONS_KEY], ['clean-work']);
});

test('unread and opened entries survive reload, backup restore and undo', async () => {
  const source = storage();
  const archive = readArchiveEntry(
    encounterArchive(source.store.read(ARCHIVE_KEY), ['mod:fold', 'mod:arc-coil']),
    'mod:fold',
  );
  assert(await source.store.write(ARCHIVE_KEY, archive));
  const reload = new ProgressStore(() => source.disk);
  assert.deepEqual(reload.read(ARCHIVE_KEY), archive);
  const backup = parseProgressBackup(reload.backup('3.19.0'));
  const target = storage();
  const original = target.store.read(ARCHIVE_KEY);
  assert(await target.store.restore(backup));
  assert.deepEqual(target.store.read(ARCHIVE_KEY), archive);
  assert(archiveUnread(target.store.read(ARCHIVE_KEY), 'mod:arc-coil'));
  assert(await target.store.undo());
  assert.deepEqual(target.store.read(ARCHIVE_KEY), original);
  assert(!archiveUnread(target.store.read(ARCHIVE_KEY), 'mod:arc-coil'));
});

test('malformed archive imports cannot grant sightings or acknowledge future entries', () => {
  const { store } = storage();
  const base = store.snapshot();
  for (const bad of [
    { version: 2, encountered: [], read: [] },
    { version: 1, encountered: ['unknown'], read: [] },
    { version: 1, encountered: ['mod:fold', 'mod:fold'], read: [] },
    { version: 1, encountered: [], read: ['mod:fold'] },
    { version: 1, encountered: [], read: [], extra: true },
    { version: 1, encountered: 'mod:fold', read: [] },
  ]) {
    assert(!validArchive(bad));
    assert.equal(validateProgress({ ...base, [ARCHIVE_KEY]: bad }), null);
  }
});
