import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { bossRemixTestFromUrl } from '../src/boss-remix-test.ts';
import {
  BOSS_REMIXES,
  BOSS_REMIXES_KEY,
  REMIX_IDS,
  bossRemixFor,
  loadBossRemixes,
  validBossRemixes,
  recordBossRemix,
  remixEncounter,
  remixEncounters,
  type BossRemixId,
} from '../src/boss-remix-rules.ts';
import { REMIX_LAYOUTS } from '../src/boss-remix-layout.ts';
import { remixMenuHtml } from '../src/boss-remix-menu.ts';
import { archiveCheckpoint } from '../src/archive-images.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { snapshotRun, loadRunHistory } from '../src/run-history.ts';
import { dailyForDate } from '../src/daily.ts';
import {
  practiceCheckpoint,
  testCheckpoint,
  canPractice,
  loadEncounters,
} from '../src/practice.ts';
import { enemyHealth } from '../src/enemies.ts';
import { coolingAngles } from '../src/cooling.ts';
import {
  recordPracticeWin,
  snapshotPracticeWin,
  loadPracticeRecords,
  challengeCode,
  parseChallengeCode,
  challengeAccess,
  challengeFromRecord,
} from '../src/practice-records.ts';
import {
  ProgressStore,
  CHECKPOINT_KEY,
  validateProgress,
  parseProgressBackup,
} from '../src/progress.ts';
import { fixture, target, Body } from './branches-fixture.ts';
import { playRoom } from './room-pilot.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
const idle = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 300 },
};
function saveFor(id: BossRemixId, gun = 'pistol') {
  const info = BOSS_REMIXES[id],
    variant = REMIX_IDS.filter((k) => BOSS_REMIXES[k].boss === info.boss).indexOf(id) + 1;
  return bossRemixTestFromUrl(
    new URL(`https://test/?test=boss-remix&boss=${info.boss}&variant=${variant}&gun=${gun}`),
  )!;
}
function enabled(seed: string) {
  const g = new Game();
  g.start(seed, undefined, null, null, false, 0, false, [], null, 'pistol', 1, false, false, true);
  return g;
}
test('first Campaigns keep original fights; enabled seeds introduce all six deterministic remixes', () => {
  const seen = new Set<BossRemixId>();
  for (let n = 0; n < 60; n++) {
    const seed = 'REMIX-RUN-' + n,
      original = new Game();
    original.start(seed);
    const g = enabled(seed);
    for (const stage of [0, 3, 7, 11, 15, 19]) {
      original.stage = g.stage = stage;
      original.loadRoom();
      g.loadRoom();
      assert.equal(original.level.bossRemix, undefined);
      const id = g.level.bossRemix;
      if (stage === 0 || stage > 11) {
        assert.equal(id, undefined);
        continue;
      }
      if (!id) {
        assert(['crane', 'kiln', 'turbine'].includes(g.enemies[0].kind));
        continue;
      }
      seen.add(id);
      assert.equal(BOSS_REMIXES[id].stage, stage);
      assert.equal(g.enemies.length, 1);
      assert.equal(g.enemies[0].kind, BOSS_REMIXES[id].boss);
      assert.equal(g.enemies[0].maxHp, enemyHealth(g.enemies[0].kind, stage));
      assert.equal(bossRemixFor(seed, g.enemies[0].kind), id);
      const snapshot = structuredClone(g.level);
      g.loadRoom();
      assert.deepEqual(g.level, snapshot);
    }
  }
  assert.deepEqual([...seen].sort(), REMIX_IDS.filter((id) => BOSS_REMIXES[id].stage <= 11).sort());
});
test('Continue and run history preserve the revision, while legacy saves and isolated modes retain their fights', () => {
  const seed = 'REMIX-RUN-0',
    save: Checkpoint = { ...testCheckpoint(seed, 3), version: 6, encounters: 1, bossRemixes: 1 };
  assert(loadCheckpoint(save));
  const g = new Game();
  g.start(seed, save);
  let recorded: Checkpoint | undefined;
  g.onCheckpoint = (s) => {
    if (s) recorded = s;
  };
  g.save();
  assert.equal(recorded!.bossRemixes, 1);
  const continued = new Game();
  continued.start(seed, recorded);
  assert.deepEqual(continued.level, g.level);
  const old = { ...recorded! };
  delete old.bossRemixes;
  continued.start(seed, old);
  assert.equal(continued.bossRemixes, false);
  assert.equal(continued.level.bossRemix, undefined);
  g.setMode('dead');
  const recap = snapshotRun(g, 'remix-recap')!;
  assert.equal(loadRunHistory([recap])[0].bossRemixes, 1);
  assert.deepEqual(loadRunHistory([{ ...recap, bossRemixes: 2 }]), []);
  const daily = enabled(dailyForDate('2026-10-04')!.seed);
  assert.equal(daily.bossRemixes, false);
  continued.startWorkshop([]);
  assert.equal(continued.bossRemixes, false);
  continued.startPractice({ kind: 'condenser', seed });
  assert.equal(continued.level.bossRemix, undefined);
  const overtime = { ...save, overtime: { baseMods: save.mods.length, repairs: 0 } };
  continued.start(seed, overtime);
  assert.equal(continued.level.bossRemix, undefined);
});
test('preview and checkpoint validation reject mixed modes, duplicates, foreign variants and revisions', () => {
  for (const id of REMIX_IDS) assert(loadCheckpoint(saveFor(id)));
  for (const q of [
    'boss=crane',
    'variant=3',
    'gun=laser',
    'v=2',
    'boss=loader&boss=press',
    'variant=1&variant=2',
    'daily=1',
    'seed=x',
    'mirror=1',
    'unknown=x',
  ])
    assert.equal(bossRemixTestFromUrl(new URL('https://test/?test=boss-remix&' + q)), null, q);
  const save = saveFor('loader-crossdock');
  for (const bad of [
    { bossRemix: 'bad' },
    { stage: 7 },
    { version: 5 },
    { bossRemixes: 1 },
    { overtime: { baseMods: 3, repairs: 0 } },
    { seed: dailyForDate('2026-10-04')!.seed },
    { region: 'annex' },
    { security: { level: 1, rules: 1 } },
  ])
    assert.equal(loadCheckpoint({ ...save, ...bad }), null, JSON.stringify(bad));
  assert.equal(loadCheckpoint({ ...testCheckpoint('new', 3), version: 6, bossRemixes: 1 }), null);
  assert.deepEqual(
    loadEncounters([{ ...remixEncounter('loader-crossdock'), remix: 'press-split-die' }]),
    [],
  );
  assert.equal(
    practiceCheckpoint({ ...remixEncounter('loader-crossdock'), seed: 'foreign' }),
    null,
  );
});
test('only actual eligible Campaign encounters discover a variant; unseen and locked Practice cards stay hidden', () => {
  let g: Game | undefined;
  for (let n = 0; n < 20; n++) {
    const next = enabled('REMIX-RUN-' + n);
    next.stage = 3;
    next.loadRoom();
    if (next.level.bossRemix) {
      g = next;
      break;
    }
  }
  assert(g);
  const id = g.level.bossRemix!;
  g.enemies[0].spawn = 0;
  const blank = loadBossRemixes(null);
  assert.deepEqual(recordBossRemix(blank, g, false), blank);
  const found = recordBossRemix(blank, g, true);
  assert.deepEqual(found.seen, [id]);
  assert.deepEqual(blank.seen, []);
  assert.deepEqual(recordBossRemix(found, g, true), found);
  assert.deepEqual(remixEncounters(found, false), []);
  assert.equal(remixEncounters(found, true)[0].remix, id);
  for (const mode of ['title', 'paused', 'dead', 'won'] as const) {
    g.mode = mode;
    assert.deepEqual(recordBossRemix(blank, g, true), blank);
  }
  g.mode = 'playing';
  g.testRun = saveFor(id);
  assert.deepEqual(recordBossRemix(blank, g, true), blank);
  g.testRun = null;
  g.practice = remixEncounter(id);
  assert.deepEqual(recordBossRemix(blank, g, true), blank);
  g.practice = null;
  g.enemies[0].spawn = 0.5;
  assert.deepEqual(recordBossRemix(blank, g, true), blank);
  for (const unseen of REMIX_IDS) assert(!remixMenuHtml(blank).includes(BOSS_REMIXES[unseen].name));
  assert(remixMenuHtml(found).includes('data-archive-image="remix:' + id + '"'));
  assert(
    !canPractice(remixEncounter(id), [
      { kind: BOSS_REMIXES[id].boss, seed: remixEncounter(id).seed },
    ]),
  );
});
class MemoryStorage {
  items = new Map<string, string>();
  getItem(k: string) {
    return this.items.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.items.set(k, v);
  }
  removeItem(k: string) {
    this.items.delete(k);
  }
}
test('profile backups, migration, restore and Undo preserve discoveries alongside Continue', async () => {
  const disk = new MemoryStorage(),
    source = new ProgressStore(() => disk);
  const profile = { version: 1, seen: [...REMIX_IDS] };
  assert(validBossRemixes(profile));
  await source.write(BOSS_REMIXES_KEY, profile);
  await source.write(CHECKPOINT_KEY, {
    ...testCheckpoint('REMIX-RUN-0', 3),
    version: 6,
    encounters: 1,
    bossRemixes: 1,
  });
  const backup = parseProgressBackup(source.backup('4.10.0'));
  assert.deepEqual(backup.values[BOSS_REMIXES_KEY], profile);
  const old = structuredClone(backup.values) as Record<string, unknown>;
  delete old[BOSS_REMIXES_KEY];
  assert.deepEqual(validateProgress(old)![BOSS_REMIXES_KEY], loadBossRemixes(null));
  for (const malformed of [
    { version: 2, seen: [] },
    { version: 1, seen: ['bad'] },
    { version: 1, seen: [REMIX_IDS[0], REMIX_IDS[0]] },
    { ...profile, extra: true },
  ])
    assert.equal(validateProgress({ ...backup.values, [BOSS_REMIXES_KEY]: malformed }), null);
  const otherDisk = new MemoryStorage(),
    other = new ProgressStore(() => otherDisk);
  assert(await other.restore(backup));
  assert.deepEqual(other.read(BOSS_REMIXES_KEY), profile);
  assert.equal((other.read(CHECKPOINT_KEY) as Checkpoint).bossRemixes, 1);
  assert(await other.undo());
  assert.deepEqual(other.read(BOSS_REMIXES_KEY), loadBossRemixes(null));
});
for (const id of REMIX_IDS)
  test(`${id} uses actual arena geometry with clear hulls, reachable valves and native photos`, () => {
    const g = new Game();
    g.startTest(saveFor(id));
    assert.equal(g.level.bossRemix, id);
    const e = g.enemies[0];
    assert.equal(e.kind, BOSS_REMIXES[id].boss);
    const overlap = (a: typeof e.body, b: typeof e.body) =>
      a.bounds.min.x < b.bounds.max.x - 0.5 &&
      a.bounds.max.x > b.bounds.min.x + 0.5 &&
      a.bounds.min.y < b.bounds.max.y - 0.5 &&
      a.bounds.max.y > b.bounds.min.y + 0.5;
    assert(!g.terrain.some((b) => overlap(e.body, b)));
    for (const p of g.props.items)
      assert(!g.terrain.some((b) => overlap(p.body, b)), p.kind + JSON.stringify(p.body.position));
    for (const v of g.pressure.items)
      assert(
        !g.level.solids.some(
          (b) =>
            v.valve.x + 14 > b.x &&
            v.valve.x - 14 < b.x + b.w &&
            v.valve.y + 14 > b.y &&
            v.valve.y - 14 < b.y + b.h,
        ),
      );
    if (id.startsWith('loader-'))
      assert.equal(g.loaderArena.supports.length, id === 'loader-crossdock' ? 3 : 2);
    const photo = archiveCheckpoint('remix:' + id),
      art = new Game();
    art.startTest(photo);
    assert.equal(art.level.bossRemix, id);
    assert.deepEqual(art.level.solids, g.level.solids);
    assert.deepEqual(g.level.solids, REMIX_LAYOUTS[id].solids);
    const practice = new Game();
    assert(practice.startPractice(remixEncounter(id)));
    assert.equal(practice.practice!.remix, id);
    assert.deepEqual(practice.level.solids, g.level.solids);
  });
for (const [id, count] of [
  ['loader-crossdock', 1],
  ['loader-switchyard', 2],
  ['press-split-die', 1],
  ['press-stamping-line', 2],
] as const)
  test(`${id} reserves a complete warning and exposed recovery for its scheduled fan`, () => {
    const g = fixture([]),
      e = target(g, 600, 260, BOSS_REMIXES[id].boss);
    g.level.bossRemix = id;
    g.stage = BOSS_REMIXES[id].stage;
    e.state = 'idle';
    e.timer = 0;
    e.attacks = count;
    g.updateEnemy(e, 1 / 60);
    assert.equal(e.state, 'windup');
    assert.equal(e.attack, 'flak');
    assert(e.timer >= 0.85);
    assert.equal(g.shots.length, 0);
    e.timer = 0.37;
    const locked = { ...e.aim };
    Body.setPosition(g.player, { x: 200, y: 600 });
    g.updateEnemy(e, 1 / 60);
    assert.deepEqual(e.aim, locked);
    assert.equal(g.shots.length, 0);
    e.timer = 0;
    g.updateEnemy(e, 1 / 60);
    assert.equal(e.state, 'recover');
    assert(e.timer >= 1);
    assert(g.shots.length >= 3);
    assert.equal(e.attacks, count + 1);
  });
test('Cold Circuit has two aimed cycles then a single purge, with locked gaps and an exposed opening', () => {
  const g = fixture([]),
    e = target(g, 800, 300, 'condenser');
  g.stage = 11;
  g.level.bossRemix = 'condenser-cold-circuit';
  for (const [count, attack] of [
    [0, 'aimed'],
    [1, 'aimed'],
    [2, 'ring'],
  ] as const) {
    e.state = 'idle';
    e.timer = 0;
    e.attacks = count;
    g.updateEnemy(e, 1 / 60);
    assert.equal(e.attack, attack);
    assert.equal(e.state, 'windup');
    assert(e.timer >= 0.95);
    const before = g.shots.length;
    e.timer = 0;
    g.updateEnemy(e, 1 / 60);
    assert.equal(e.state, 'recover');
    assert.equal(e.attacks, count + 1);
    assert.equal(g.shots.length - before, attack === 'ring' ? 12 : 3);
    assert(e.timer >= 1.2);
  }
});
test('Purge Chamber shows and fires the same eight-ray purge, warns again, then shifts the wide gaps', () => {
  const g = fixture([]),
    e = target(g, 800, 300, 'condenser');
  g.stage = 11;
  g.level.bossRemix = 'condenser-purge-chamber';
  e.timer = 0;
  g.updateEnemy(e, 1 / 60);
  assert.equal(e.attack, 'ring');
  const first = coolingAngles(e, g.level.bossRemix);
  assert.equal(first.length, 8);
  e.timer = 0;
  g.updateEnemy(e, 1 / 60);
  assert.equal(g.shots.length, 8);
  assert.equal(e.state, 'followup');
  assert(e.timer >= 0.95);
  const second = coolingAngles(e, g.level.bossRemix);
  assert.notDeepEqual(first, second);
  for (const [i, s] of g.shots.entries())
    assert(
      Math.abs(
        Math.atan2(
          Math.sin(Math.atan2(s.vel.y, s.vel.x) - first[i]),
          Math.cos(Math.atan2(s.vel.y, s.vel.x) - first[i]),
        ),
      ) < 1e-8,
    );
  e.timer = 0.4;
  g.updateEnemy(e, 1 / 60);
  assert.equal(g.shots.length, 8);
  e.timer = 0;
  g.updateEnemy(e, 1 / 60);
  assert.equal(g.shots.length, 16);
  assert.equal(e.state, 'recover');
  assert(e.timer >= 1.2);
});
for (const kind of ['press', 'condenser'] as const)
  test(`a manually fired remix steam lane opens ${kind} armor without cancelling its attack`, () => {
    const g = fixture([]),
      e = target(g, 600, 300, kind);
    g.level.bossRemix = kind === 'press' ? 'press-split-die' : 'condenser-cold-circuit';
    e.state = 'windup';
    e.timer = 0.7;
    const v = g.pressure.spawn({
      x: 600,
      y: 738,
      dir: { x: 0, y: -1 },
      valve: { x: 536, y: 714 },
      width: 80,
      length: 620,
      offset: 0,
      overpressure: true,
    });
    v.phase = 'ready';
    assert(g.pressure.trigger(v));
    g.time += 1.16;
    g.pressure.beforeStep(1.16);
    assert(g.pressure.opening(e));
    assert.equal(e.state, 'windup');
    assert.equal(e.timer, 0.7);
    const hp = e.hp;
    g.hitEnemy(e, 100, undefined, false, false, false);
    assert.equal(hp - e.hp, kind === 'press' ? 125 : 130);
    g.time += 1.7;
    assert(!g.pressure.opening(e));
    v.phase = 'ready';
    g.pressure.trigger(v);
    g.time += 1.16;
    g.pressure.beforeStep(1.16);
    assert(!g.pressure.opening(e), 'Opening cooldown is shared across valves');
  });
test('remix Practice records and challenge codes stay separate from standard fights and unknown variants', () => {
  const id = 'loader-crossdock',
    g = new Game();
  g.startPractice(remixEncounter(id));
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 999999);
  g.hitStop = 0;
  for (let i = 0; i < 60 && g.mode !== 'won'; i++) g.tick(1 / 60, idle);
  assert.equal(g.mode, 'won');
  const win = snapshotPracticeWin(g, true)!;
  assert(win);
  assert.equal(win.remix, id);
  delete g.level.bossRemix;
  assert.equal(snapshotPracticeWin(g, true), null);
  g.level.bossRemix = id;
  const outcome = recordPracticeWin([], win),
    record = outcome.record;
  assert.equal(loadPracticeRecords(outcome.records)[0].remix, id);
  const challenge = challengeFromRecord(record);
  assert.deepEqual(parseChallengeCode(challengeCode(challenge)), challenge);
  assert(!challengeAccess(challenge, [{ kind: 'loader', seed: challenge.seed }], g.mods).allowed);
  assert(challengeAccess(challenge, [remixEncounter(id)], g.mods).allowed);
  assert(!challengeAccess(challenge, [remixEncounter('loader-switchyard')], g.mods).allowed);
  assert.deepEqual(loadPracticeRecords([{ ...record, remix: 'press-split-die' }]), []);
  const preview = new Game();
  preview.startTest(saveFor(id));
  assert.equal(snapshotPracticeWin(preview, true), null);
});
for (const id of REMIX_IDS)
  for (const gun of BOSS_REMIXES[id].stage >= 15
    ? STARTING_GUN_IDS
    : ['pistol', 'shotgun', 'nailgun'])
    test(`${gun} clears ${id} with ordinary inputs and no profile rewards`, () => {
      const g = new Game();
      let writes = 0,
        awards = 0;
      g.onCheckpoint = () => writes++;
      g.onCommendation = () => awards++;
      g.startTest(saveFor(id, gun));
      assert.equal(g.startingGun, gun);
      assert.equal(g.level.bossRemix, id);
      const result = playRoom(g, 180);
      assert(result.clear && result.hp > 0, JSON.stringify({ id, gun, ...result }));
      assert.equal(writes, 0);
      assert.equal(awards, 0);
    });
