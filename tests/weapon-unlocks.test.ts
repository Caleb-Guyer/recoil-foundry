import { logbookCatalog } from '../src/logbook-catalog.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadWeaponUnlocks,
  migrateWeaponUnlocks,
  unlockedStartingGuns,
  availableStartingGun,
  validWeaponUnlocks,
  WEAPON_UNLOCKS_KEY,
} from '../src/weapon-unlocks.ts';
import { ProgressStore, CHECKPOINT_KEY, validateProgress } from '../src/progress.ts';
import { loadLogbook } from '../src/logbook.ts';
import { testCheckpoint } from '../src/practice.ts';
import {
  addRunRewards,
  loadRunRewards,
  validRunRewards,
  commendationRewards,
  RUN_REWARDS_KEY,
} from '../src/run-rewards.ts';
import { rewardCards } from '../src/reward-cards.ts';
import { Game } from '../src/game.ts';
import { archiveCheckpoint, ARCHIVE_STAGES, prepareArchiveEnemy } from '../src/archive-images.ts';
import { ENEMY_NAMES } from '../src/damage-cause.ts';
import { Renderer } from '../src/render.ts';

test('fresh players have no gun picker milestone and only the pistol; the two completion milestones are separate', () => {
  const fresh = migrateWeaponUnlocks(null, null, [], loadLogbook(null), []);
  assert.equal(fresh.started, false);
  assert.deepEqual(unlockedStartingGuns(fresh), ['pistol']);
  assert.equal(availableStartingGun('shotgun', fresh), 'pistol');
  const played = loadWeaponUnlocks({ version: 1, started: true });
  assert.equal(played.started, true);
  assert.deepEqual(unlockedStartingGuns(played), ['pistol']);
  assert.deepEqual(unlockedStartingGuns(loadWeaponUnlocks({ version: 1, cleared: true })), [
    'pistol',
    'shotgun',
  ]);
  assert.deepEqual(unlockedStartingGuns(loadWeaponUnlocks({ version: 1, overtime: true })), [
    'pistol',
    'shotgun',
    'nailgun',
  ]);
});

test('existing victories migrate without granting the nailgun for merely entering Overtime', () => {
  const save = { ...testCheckpoint('LEGACY', 0), overtime: { baseMods: 0, repairs: 0 } };
  const entered = migrateWeaponUnlocks(null, save, [], loadLogbook(null), []);
  assert.deepEqual(unlockedStartingGuns(entered), ['pistol', 'shotgun']);
  const completed = migrateWeaponUnlocks(null, null, [], loadLogbook(null), ['after-hours']);
  assert.deepEqual(unlockedStartingGuns(completed), ['pistol', 'shotgun', 'nailgun']);
  assert.deepEqual(
    unlockedStartingGuns(migrateWeaponUnlocks(null, null, [], loadLogbook(null), [], true)),
    ['pistol', 'shotgun'],
  );
  assert.equal(
    validWeaponUnlocks({ version: 1, started: false, cleared: false, overtime: 'true' }),
    false,
  );
  assert.equal(
    validWeaponUnlocks({ version: 1, started: false, cleared: true, overtime: false }),
    false,
  );
});

test('reward cards identify each actual appearance, deduplicate repeated awards, and keep only this run’s rewards', () => {
  assert.deepEqual(commendationRewards('hot-work'), [
    'appearance:gun:kiln',
    'appearance:outfit:forgehand',
  ]);
  const earned = addRunRewards(null, 'RUN-A', ['gun:shotgun', ...commendationRewards('hot-work')]);
  assert.deepEqual(addRunRewards(earned, 'RUN-A', ['gun:shotgun']), earned);
  const html = rewardCards(earned.ids);
  assert.match(html, /data-reward-image="gun:shotgun"/);
  assert.match(html, /data-reward-image="appearance:outfit:forgehand"/);
  assert.match(html, /data-reward-image="appearance:gun:kiln"/);
  assert.equal(rewardCards([]), '');
  assert.deepEqual(addRunRewards(earned, 'RUN-B', []).ids, []);
  assert.equal(validRunRewards({ version: 1, seed: 'RUN-A', ids: ['not-a-reward'] }), false);
  assert.equal(
    validRunRewards({ version: 1, seed: 'RUN-A', ids: ['gun:shotgun', 'gun:shotgun'] }),
    false,
  );
});

test('progress preserves unlocks and pending reward cards, and migrates pre-update backups', async () => {
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
  const store = new ProgressStore(() => disk);
  await store.write(WEAPON_UNLOCKS_KEY, loadWeaponUnlocks({ version: 1, cleared: true }));
  await store.write(RUN_REWARDS_KEY, addRunRewards(null, 'RUN-A', ['gun:shotgun']));
  const reloaded = new ProgressStore(() => disk);
  assert.equal(loadWeaponUnlocks(reloaded.read(WEAPON_UNLOCKS_KEY)).cleared, true);
  assert.deepEqual(loadRunRewards(reloaded.read(RUN_REWARDS_KEY))!.ids, ['gun:shotgun']);
  const old = structuredClone(reloaded.values) as Record<string, unknown>;
  delete old[WEAPON_UNLOCKS_KEY];
  delete old[RUN_REWARDS_KEY];
  old[CHECKPOINT_KEY] = testCheckpoint('OLD', 2);
  const migrated = validateProgress(old)!;
  assert(migrated);
  assert.equal(loadWeaponUnlocks(migrated[WEAPON_UNLOCKS_KEY]).started, true);
  assert.equal(loadWeaponUnlocks(migrated[WEAPON_UNLOCKS_KEY]).cleared, false);
});

test('every site photograph loads the corresponding real campaign district', () => {
  for (const id of Object.keys(ARCHIVE_STAGES)) {
    const g = new Game();
    g.startTest(archiveCheckpoint(id));
    if (id.startsWith('area:')) assert.equal(g.level.area, id.slice(5), id);
    if (id === 'region:annex') assert.equal(g.annex.active, true);
    if (id === 'region:shutdown') assert.equal(g.shutdown.chamber, true);
    if (id.startsWith('region:') && ['railworks', 'core'].includes(id.slice(7)))
      assert.equal(g.level.uprising, id.slice(7), id);
    assert.equal(g.commendations.eligible, false);
  }
});

test('all machine photographs can use the production enemy renderer, including variants', () => {
  let commands = 0;
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get: (_t, prop) =>
      prop === 'measureText'
        ? () => ({ width: 1 })
        : () => {
            commands++;
          },
    set: () => true,
  });
  for (const id of [
    ...Object.keys(ENEMY_NAMES),
    'elite:shielded',
    'elite:twin',
    'elite:volatile',
    'mutation:splitter',
    'mutation:gunner',
    'mutation:blinker',
  ]) {
    const g = new Game();
    prepareArchiveEnemy(g, id.includes(':') ? id : 'enemy:' + id);
    commands = 0;
    const renderer = Object.create(Renderer.prototype) as Renderer;
    renderer.ctx = c;
    renderer.game = g;
    renderer.reduced = true;
    assert.doesNotThrow(() => renderer.drawEnemies(), id);
    assert(commands > 0, id + ' must draw actual artwork');
  }
});

test('the Logbook keeps extra tools hidden until the first attempt, then shows their separate locks and images', () => {
  const book = loadLogbook(null);
  assert.equal(
    logbookCatalog([], book, [], null, [], null, loadWeaponUnlocks(null)).filter((e) => e.weapon)
      .length,
    0,
  );
  const locked = logbookCatalog(
    [],
    book,
    [],
    null,
    [],
    null,
    loadWeaponUnlocks({ version: 1, started: true }),
  ).filter((e) => e.weapon);
  assert.deepEqual(
    locked.map((e) => e.state),
    ['locked', 'locked', 'locked', 'locked', 'locked'],
  );
  const won = logbookCatalog(
    [],
    book,
    [],
    null,
    [],
    null,
    loadWeaponUnlocks({ version: 1, cleared: true }),
  ).filter((e) => e.weapon);
  assert.deepEqual(
    won.map((e) => e.state),
    ['known', 'locked', 'locked', 'locked', 'locked'],
  );
});
