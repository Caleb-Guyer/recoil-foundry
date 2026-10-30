import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint } from '../src/rules.ts';
import {
  loadArchive,
  validArchive,
  encounterArchive,
  readArchiveEntry,
  archiveUnread,
  mergeArchive,
  migrateArchive,
  enemyArchiveIds,
} from '../src/archive.ts';
import { loadLogbook, logbookEntries, logbookPreviewEntries } from '../src/logbook.ts';
import { logbookCatalog, catalogMatches } from '../src/logbook-catalog.ts';
import { logbookArticle } from '../src/logbook-menu.ts';
import { archiveMark } from '../src/archive-art.ts';
import {
  archiveCheckpoint,
  prepareArchiveEnemy,
  drawArchiveCourierSource,
} from '../src/archive-images.ts';
import {
  COURIER_ARCHIVE_ID,
  COURIER_GUIDE,
  COURIER_LORE,
  courierLogbookEntry,
} from '../src/courier-record.ts';
import { COURIER_DOOR_TIME } from '../src/courier.ts';
import { modMark } from '../src/upgrade-icons.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1200, y: 500 },
};
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

test('the Courier has an independent archive identity and older Runner sightings do not invent cargo encounters', () => {
  const book = loadLogbook({
    version: 1,
    enemies: ['runner', 'courier'],
    areas: ['docks'],
    escaped: false,
  });
  assert.deepEqual(book.enemies, ['runner']);
  const old = { version: 1, encountered: ['tool', 'enemy:runner'], read: ['enemy:runner'] };
  assert.deepEqual(loadArchive(old), old);
  assert(!migrateArchive(old, [], book, []).encountered.includes(COURIER_ARCHIVE_ID));
  assert(!migrateArchive(null, [], book, []).encountered.includes(COURIER_ARCHIVE_ID));
  const discovered = encounterArchive(old, [COURIER_ARCHIVE_ID]);
  assert(validArchive(discovered));
  assert(archiveUnread(discovered, COURIER_ARCHIVE_ID));
  const opened = readArchiveEntry(discovered, COURIER_ARCHIVE_ID);
  assert(!archiveUnread(opened, COURIER_ARCHIVE_ID));
  assert(opened.read.includes('enemy:runner'));
  assert.deepEqual(loadArchive(JSON.parse(JSON.stringify(opened))), opened);
  assert.deepEqual(mergeArchive(old, opened), opened);
  assert.deepEqual(
    loadArchive({ version: 1, encountered: ['enemy:courier', 'encounter:invented'], read: [] })
      .encountered,
    [],
  );
});

test('the catalog conceals Courier behavior until encountered and reveals its dedicated guide without a Runner victory', () => {
  const empty = loadLogbook(null);
  const unseen = logbookCatalog([], empty, [], null).find((e) => e.id === COURIER_ARCHIVE_ID)!;
  assert(unseen);
  assert.equal(unseen.section, 'machines');
  assert.equal(unseen.state, 'unseen');
  assert.equal(catalogMatches([unseen], 'machines', 'Scrap Courier').length, 0);
  assert.doesNotMatch(
    logbookArticle(unseen, modMark),
    /Scrap Courier|three uninterrupted|Dispatch manifest/,
  );
  const archive = encounterArchive(null, [COURIER_ARCHIVE_ID]);
  const entries = logbookCatalog([], empty, [], archive);
  const known = entries.find((e) => e.id === COURIER_ARCHIVE_ID)!;
  assert.equal(known.name, 'Scrap Courier');
  assert.equal(known.state, 'known');
  assert.equal(known.label, 'Optional cargo encounter');
  assert.equal(known.description, COURIER_GUIDE);
  assert.equal(known.unread, true);
  assert.equal(entries.find((e) => e.id === 'enemy:runner')!.state, 'unseen');
  assert.deepEqual(empty.enemies, []);
  const article = logbookArticle(known, modMark);
  assert(article.includes('data-archive-image="encounter:courier"'));
  assert.doesNotMatch(article, /data-archive-image="enemy:runner"/);
  assert.deepEqual(
    catalogMatches(entries, 'machines', 'scrap courier', 'known').map((e) => e.id),
    [COURIER_ARCHIVE_ID],
  );
});

test('Courier records explain actual door, cargo collection and bonus reward rules', () => {
  assert.equal(COURIER_DOOR_TIME, 3);
  assert.match(COURIER_GUIDE, /three uninterrupted seconds.*hatch.*pushing it away resets/);
  assert.match(COURIER_GUIDE, /dropped case with a clear line/);
  assert.match(COURIER_GUIDE, /one bonus upgrade before the ordinary room reward/);
  assert.match(COURIER_GUIDE, /cannot be rerolled.*does not heal or advance/);
  assert.match(COURIER_GUIDE, /never blocks the room exit/);
  assert.equal(COURIER_LORE.length, 3);
  assert(COURIER_LORE[2].includes('\n\n'));
  const entry = courierLogbookEntry();
  assert.equal(entry.id, COURIER_ARCHIVE_ID);
  assert.equal(entry.section, 'machines');
  assert(!entry.id.startsWith('enemy:'));
  assert(archiveMark(entry.id));
});

test('live materialized Courier sightings use only the cargo token, excluding unfinished arrivals, dead carriers and allies', () => {
  const g = new Game();
  try {
    const save = archiveCheckpoint(COURIER_ARCHIVE_ID);
    g.startTest(save);
    const e = g.courier.enemy!;
    assert(e?.courier);
    assert.deepEqual(enemyArchiveIds(e), []);
    e.spawn = 0;
    assert.deepEqual(enemyArchiveIds(e), [COURIER_ARCHIVE_ID]);
    e.elite = 'shielded';
    assert.deepEqual(enemyArchiveIds(e), [COURIER_ARCHIVE_ID]);
    e.allied = true;
    assert.deepEqual(enemyArchiveIds(e), []);
    e.allied = false;
    e.hp = 0;
    assert.deepEqual(enemyArchiveIds(e), []);
  } finally {
    dispose(g);
  }
});

test('a real Courier arrival is reported once while private inspections keep archive progress unchanged', () => {
  for (const privateTest of [false, true]) {
    const g = new Game();
    let seen = loadArchive(null),
      calls = 0;
    g.onEnemyEncountered = (e) => {
      if (!e.courier) return;
      calls++;
      if (!g.practice && !g.testRun && !g.workshop.active && g.mode === 'playing')
        seen = encounterArchive(seen, enemyArchiveIds(e));
    };
    try {
      const save = archiveCheckpoint(COURIER_ARCHIVE_ID);
      if (privateTest) g.startTest(save);
      else {
        // The native ordinary stage-five room accepts Courier plans; the
        // stage-four photograph is intentionally an isolated inspection.
        save.stage = 5;
        save.courier = { stage: 5, status: 'pending' };
        assert(loadCheckpoint(save));
        g.start(save.seed, save);
      }
      assert(g.courier.enemy);
      for (let frame = 0; frame < 100; frame++) g.tick(1 / 60, idle);
      assert.equal(calls, 1);
      assert.equal(seen.encountered.includes(COURIER_ARCHIVE_ID), !privateTest);
      assert(!seen.encountered.includes('enemy:runner'));
    } finally {
      dispose(g);
    }
  }
});

test('Courier photographs reconstruct their real optional encounter and pure previews do not grant discoveries or rewards', () => {
  const before = loadArchive(null);
  const preview = logbookPreviewEntries();
  const entry = preview.find((e) => e.id === COURIER_ARCHIVE_ID)!;
  assert.equal(entry.name, 'Scrap Courier');
  assert.equal(entry.section, 'machines');
  (entry.lore as string[])[0] = 'changed local preview';
  assert.notEqual(
    logbookPreviewEntries().find((e) => e.id === COURIER_ARCHIVE_ID)!.lore[0],
    entry.lore[0],
  );
  assert.deepEqual(loadArchive(null), before);
  assert(!logbookEntries([], loadLogbook(null)).some((e) => e.id === COURIER_ARCHIVE_ID));
  const save = archiveCheckpoint(COURIER_ARCHIVE_ID);
  assert(loadCheckpoint(save));
  assert.equal(save.version, 6);
  assert.equal(save.courier?.status, 'pending');
  assert(save.seed.startsWith('COURIER-'));
  const g = new Game();
  let writes = 0,
    rewards = 0;
  g.onCheckpoint = () => writes++;
  g.onCommendation = () => rewards++;
  try {
    g.startTest(save);
    const native = g.courier.enemy;
    const photographed = prepareArchiveEnemy(g, COURIER_ARCHIVE_ID);
    assert.equal(photographed, native);
    assert.equal(photographed.courier, true);
    assert.equal(photographed.spawn, 0);
    assert.equal(g.level.id, 'dispatch-lane');
    assert.equal(g.courier.cargo, null);
    assert.equal(g.courier.state?.status, 'pending');
    assert.equal(g.kills, 0);
    assert.equal(writes, 0);
    assert.equal(rewards, 0);
  } finally {
    dispose(g);
  }
});

test('Courier portrait source paints native geometry at useful resolution without clipping or changing the encounter', () => {
  const g = new Game();
  try {
    g.startTest(archiveCheckpoint(COURIER_ARCHIVE_ID));
    const e = prepareArchiveEnemy(g, COURIER_ARCHIVE_ID);
    const before = JSON.stringify({
      player: g.player.position,
      courier: e.body.position,
      hp: e.hp,
      pending: g.courier.state,
      kills: g.kills,
    });
    let matrix = [1, 0, 0, 1, 0, 0],
      width = 1;
    const stack: { matrix: number[]; width: number }[] = [];
    const painted: { x: number; y: number }[] = [];
    const point = (x: number, y: number, radius = 0) => {
      const scale = Math.max(Math.hypot(matrix[0], matrix[1]), Math.hypot(matrix[2], matrix[3]));
      const px = matrix[0] * x + matrix[2] * y + matrix[4],
        py = matrix[1] * x + matrix[3] * y + matrix[5];
      const margin = (radius + width / 2) * scale;
      painted.push({ x: px - margin, y: py - margin }, { x: px + margin, y: py + margin });
    };
    const values: Record<string, unknown> = { globalAlpha: 1, lineWidth: width };
    const context = new Proxy({} as CanvasRenderingContext2D, {
      get(_target, key) {
        if (key in values) return values[String(key)];
        if (key === 'createLinearGradient' || key === 'createRadialGradient')
          return () => ({ addColorStop() {} });
        return (...args: number[]) => {
          for (const n of args) assert(Number.isFinite(n));
          if (key === 'save') stack.push({ matrix: [...matrix], width });
          else if (key === 'restore') {
            const saved = stack.pop()!;
            assert(saved);
            matrix = saved.matrix;
            width = saved.width;
          } else if (key === 'translate') {
            matrix[4] += matrix[0] * args[0] + matrix[2] * args[1];
            matrix[5] += matrix[1] * args[0] + matrix[3] * args[1];
          } else if (key === 'scale') {
            matrix[0] *= args[0];
            matrix[1] *= args[0];
            matrix[2] *= args[1];
            matrix[3] *= args[1];
          } else if (key === 'rotate') {
            const [a, b, c, d] = matrix,
              co = Math.cos(args[0]),
              si = Math.sin(args[0]);
            matrix[0] = a * co + c * si;
            matrix[1] = b * co + d * si;
            matrix[2] = c * co - a * si;
            matrix[3] = d * co - b * si;
          } else if (key === 'arc') point(args[0], args[1], args[2]);
          else if (key === 'moveTo' || key === 'lineTo') point(args[0], args[1]);
          else if (key === 'fillRect' || key === 'strokeRect' || key === 'rect') {
            point(args[0], args[1]);
            point(args[0] + args[2], args[1]);
            point(args[0], args[1] + args[3]);
            point(args[0] + args[2], args[1] + args[3]);
          } else
            assert(
              !['fillText', 'strokeText', 'drawImage', 'clearRect'].includes(String(key)),
              'Source must remain native chassis geometry without captions or image resampling.',
            );
        };
      },
      set(_target, key, value) {
        values[String(key)] = value;
        if (key === 'lineWidth') width = Number(value);
        return true;
      },
    });
    drawArchiveCourierSource(context, g, e);
    assert(painted.length > 100);
    const xs = painted.map((p) => p.x),
      ys = painted.map((p) => p.y);
    assert(
      Math.max(...xs) - Math.min(...xs) > 120,
      'The native chassis needs enough source pixels to retain fine details.',
    );
    assert(
      Math.min(...xs) > 20 && Math.max(...xs) < 492,
      'Whole chassis, wheels and captive cargo must fit the source horizontally.',
    );
    assert(
      Math.min(...ys) > 20 && Math.max(...ys) < 492,
      'Whole chassis, wheels and captive cargo must fit the source vertically.',
    );
    assert.equal(stack.length, 0);
    assert.deepEqual(matrix, [1, 0, 0, 1, 0, 0]);
    assert.equal(
      JSON.stringify({
        player: g.player.position,
        courier: e.body.position,
        hp: e.hp,
        pending: g.courier.state,
        kills: g.kills,
      }),
      before,
    );
  } finally {
    dispose(g);
  }
});
