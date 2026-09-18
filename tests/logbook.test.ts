import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { MODS, type Checkpoint } from '../src/rules.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { AREAS } from '../src/areas.ts';
import { dailyForDate } from '../src/daily.ts';
import { loadEncounters, testCheckpoint } from '../src/practice.ts';
import { snapshotRun } from '../src/run-history.ts';
import { UPGRADE_LORE } from '../src/lore-upgrades.ts';
import { MACHINE_LORE, PLACE_LORE, RECORDS, TOOL_LORE } from '../src/lore-factory.ts';
import {
  LOGBOOK_TOTALS,
  loadLogbook,
  mergeLogbook,
  migrateLogbook,
  recordLogbook,
  logbookEntries,
  logbookMatches,
  logbookLink,
  logbookPreviewEntries,
} from '../src/logbook.ts';
import { escapeLogbook, logbookArticle } from '../src/logbook-menu.ts';

test('every upgrade, enemy and area has a complete, distinct authored record', () => {
  assert.deepEqual(Object.keys(UPGRADE_LORE).sort(), MODS.map((mod) => mod.id).sort());
  assert.deepEqual(Object.keys(MACHINE_LORE).sort(), Object.keys(ENEMY_STATS).sort());
  assert.deepEqual(Object.keys(PLACE_LORE).sort(), Object.keys(AREAS).sort());
  const lore = [
    TOOL_LORE,
    ...Object.values(UPGRADE_LORE),
    ...Object.values(MACHINE_LORE),
    ...Object.values(PLACE_LORE),
    ...RECORDS.map((record) => record.lore),
  ];
  assert.equal(new Set(lore.map((entry) => entry[2])).size, lore.length);
  for (const [source, author, text] of lore) {
    assert.ok(source.length > 8 && author.length > 8);
    assert.ok(text.trim().split(/\s+/).length >= 30, source);
    assert.ok(text.includes('\n\n'), source);
    assert.doesNotMatch(text, /lorem ipsum|TODO|placeholder|Risk of Rain|N-Gon/i);
  }
  assert.equal(
    Object.values(LOGBOOK_TOTALS).reduce((a, b) => a + b, 0),
    lore.length,
  );
});

test('new players see only their service tool and handover, including search and HTML', () => {
  const entries = logbookEntries([], loadLogbook(null));
  assert.deepEqual(
    entries.map((entry) => entry.id),
    ['tool', 'record:handover'],
  );
  for (const section of ['equipment', 'machines', 'places', 'records'] as const)
    assert.deepEqual(logbookMatches(entries, section, 'Interceptor'), []);
  const html = entries.map((entry) => logbookArticle(entry, () => '<svg></svg>')).join('');
  assert.doesNotMatch(html, /Interceptor|Reclaimer|Rooftops|Continuity order|Departure record/);
  assert.deepEqual(
    logbookMatches(entries, 'equipment', 'SERVICE  standard').map((entry) => entry.id),
    ['tool'],
  );
});

test('collecting a parent does not leak branch names, descriptions or lore', () => {
  const entries = logbookEntries(['cutting-torch', 'fold', '<script>'], loadLogbook(null));
  assert.ok(entries.some((entry) => entry.id === 'mod:cutting-torch'));
  const html = entries.map((entry) => logbookArticle(entry, () => '<svg></svg>')).join('');
  assert.doesNotMatch(html, /Charge Lens|Pulse Chamber|Resonator|Limiter bypass|<script>/);
  assert.deepEqual(logbookMatches(entries, 'equipment', 'charge'), []);
  const recovered = logbookEntries(['cutting-torch', 'charge-lens'], loadLogbook(null));
  assert.equal(
    recovered.find((entry) => entry.id === 'mod:charge-lens')!.lore,
    UPGRADE_LORE['charge-lens'],
  );
});

test('stored progress rejects unknown fields and IDs and merges without losing other-tab discoveries', () => {
  assert.deepEqual(
    loadLogbook({ version: 7, areas: ['rooftops'], escaped: true }),
    loadLogbook(null),
  );
  const a = loadLogbook({
    version: 1,
    enemies: ['runner', 'runner', 'made-up', null],
    areas: ['docks', '<img>'],
    escaped: 'true',
  });
  assert.deepEqual(a, { version: 1, enemies: ['runner'], areas: ['docks'], escaped: false });
  const b = loadLogbook({ version: 1, enemies: ['shooter'], areas: ['cooling'], escaped: true });
  const merged = mergeLogbook(a, b);
  assert.deepEqual(new Set(merged.enemies), new Set(['runner', 'shooter']));
  assert.deepEqual(merged.areas, ['docks', 'cooling']);
  assert.equal(merged.escaped, true);
  assert.deepEqual(mergeLogbook(merged, a), merged);
});

test('existing checkpoints and run recaps restore reached areas without inventing enemy victories', () => {
  const checkpoint: Checkpoint = {
    version: 6,
    seed: 'book-migrate',
    stage: 9,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
  };
  const progress = migrateLogbook(null, checkpoint, [], []);
  assert.deepEqual(progress.areas, ['docks', 'furnace', 'cooling']);
  assert.deepEqual(progress.enemies, []);
  const g = new Game();
  g.start('book-finished');
  g.stage = 19;
  g.setMode('won');
  const recap = snapshotRun(g, 'book-win', 10)!;
  const migrated = migrateLogbook(progress, null, [recap], []);
  assert.deepEqual(migrated.areas, Object.keys(AREAS));
  assert.equal(migrated.escaped, true);
  assert.deepEqual(
    migrated.enemies,
    [],
    'reaching a room does not prove which boss variant was defeated',
  );
});

test('earned boss victories migrate to machine records and preserve victory-only discovery', () => {
  const victories = loadEncounters([{ kind: 'loader', seed: 'LOADER-SHIFT-5' }]);
  assert.equal(victories.length, 1);
  const progress = migrateLogbook(null, null, [], victories);
  assert.deepEqual(progress.enemies, ['loader']);
  assert.deepEqual(progress.areas, ['docks']);
  assert.ok(logbookEntries([], progress).some((entry) => entry.id === 'enemy:loader'));
  assert.ok(!logbookEntries([], progress).some((entry) => entry.id === 'enemy:crane'));
});

test('real and Daily kills recover machines once; unfinished arrivals, allies and dead-state cleanup do not', () => {
  for (const seed of ['book-kills', dailyForDate('2026-09-18')!.seed]) {
    const g = new Game();
    let progress = loadLogbook(null),
      calls = 0;
    g.onEnemyDefeated = (kind) => {
      calls++;
      progress = recordLogbook(progress, g, kind);
    };
    g.start(seed);
    const enemy = g.spawnEnemy('runner', 650, 700);
    enemy.spawn = 0;
    g.hitEnemy(enemy, 1);
    assert.equal(calls, 0);
    g.hitEnemy(enemy, 10000);
    g.hitEnemy(enemy, 10000);
    assert.equal(calls, 1);
    assert.deepEqual(progress.enemies, ['runner']);
    const arrival = g.spawnEnemy('shooter', 800, 700);
    arrival.spawn = 1;
    g.hitEnemy(arrival, 10000);
    const ally = g.spawnEnemy('shooter', 850, 700);
    ally.spawn = 0;
    ally.allied = true;
    g.hitEnemy(ally, 10000);
    g.setMode('dead');
    const cleanup = g.spawnEnemy('charger', 800, 700);
    cleanup.spawn = 0;
    g.hitEnemy(cleanup, 10000);
    assert.equal(calls, 1);
  }
});

test('test presets, Workshop, and Practice do not grant machine, location or ending records', () => {
  const g = new Game();
  const before = loadLogbook(null);
  let calls = 0;
  g.onEnemyDefeated = () => calls++;
  const starts = [
    () => g.startTest(testCheckpoint('book-test', 19)),
    () => g.startWorkshop([], []),
    () => assert.ok(g.startPractice({ kind: 'loader', seed: 'LOADER-SHIFT-5' })),
  ];
  for (const start of starts) {
    start();
    const e = g.spawnEnemy('runner', 600, 700);
    e.spawn = 0;
    g.hitEnemy(e, 10000);
    assert.equal(recordLogbook(before, g, 'runner'), before);
    g.setMode('won');
    assert.equal(recordLogbook(before, g), before);
  }
  assert.equal(calls, 0);
});

test('area documents unlock as their area is reached; departure requires escape', () => {
  const g = new Game();
  g.start('book-route');
  let progress = recordLogbook(loadLogbook(null), g);
  assert.deepEqual(progress.areas, ['docks']);
  g.stage = 8;
  g.loadRoom();
  progress = recordLogbook(progress, g);
  assert.ok(logbookEntries([], progress).some((entry) => entry.id === 'record:breakroom'));
  assert.ok(!logbookEntries([], progress).some((entry) => entry.id === 'record:continuity'));
  g.stage = 13;
  g.loadRoom();
  progress = recordLogbook(progress, g);
  assert.ok(logbookEntries([], progress).some((entry) => entry.id === 'record:continuity'));
  g.setMode('dead');
  progress = recordLogbook(progress, g);
  assert.ok(!progress.escaped);
  g.setMode('won');
  progress = recordLogbook(progress, g);
  assert.ok(logbookEntries([], progress).some((entry) => entry.id === 'record:departure'));
});

test('preview links are strict, return fresh data and expose only a small early-game sample', () => {
  assert.equal(logbookLink(new URL('https://test/?test=logbook&v=2.87.0')), 'preview');
  assert.equal(logbookLink(new URL('https://test/?logbook=1&v=2.87.0')), 'collection');
  for (const query of [
    'test=logbook&daily=1',
    'test=logbook&test=logbook',
    'logbook=1&test=logbook',
    'logbook=1&seed=a',
    'logbook=1&logbook=1',
  ])
    assert.equal(logbookLink(new URL('https://test/?' + query)), null);
  const preview = logbookPreviewEntries();
  assert.ok(preview.length > 5 && preview.length < 15);
  assert.ok(
    !preview.some((entry) => entry.id === 'enemy:interceptor' || entry.id === 'area:rooftops'),
  );
  preview.pop();
  assert.equal(logbookPreviewEntries().length, preview.length + 1);
  assert.equal(logbookEntries([], loadLogbook(null)).length, 2);
});

test('record rendering escapes names, descriptions, signatures and recovered prose', () => {
  const base = logbookEntries([], loadLogbook(null))[0];
  const html = logbookArticle(
    {
      ...base,
      name: '<img src=x onerror=x>',
      description: '<script>x</script>',
      lore: ['<img>', '<script>', '<svg onload=x>\n\nA & B'],
    },
    () => '',
  );
  assert.doesNotMatch(html, /<script>|<img|<svg onload/);
  assert.match(html, /&lt;img/);
  assert.match(html, /A &amp; B/);
  assert.equal(escapeLogbook('"<>&\''), '&quot;&lt;&gt;&amp;&#39;');
});
