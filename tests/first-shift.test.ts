import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { firstShiftTestFromUrl, firstShiftTestIdentity } from '../src/first-shift-test.ts';
import { FIRST_SHIFT_BOSSES, type FirstShiftBoss } from '../src/first-shift-rules.ts';
import { FIRST_SHIFT_ARENAS } from '../src/first-shift-layout.ts';
import { getLevel } from '../src/levels.ts';
import { getOvertimeLevel, overtimeSeed, overtimeHealth } from '../src/overtime.ts';
import { enemyHealth } from '../src/enemies.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import { loadEncounters, testCheckpoint } from '../src/practice.ts';
import { remixEncounter, BOSS_REMIXES } from '../src/boss-remix-rules.ts';
import { REMIX_LAYOUTS } from '../src/boss-remix-layout.ts';
import { dailyForDate } from '../src/daily.ts';
import { RoomRematch, rematchEntry, roomRematchSnapshot } from '../src/room-rematch.ts';

const BOSSES = Object.keys(FIRST_SHIFT_BOSSES) as FirstShiftBoss[];
const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1500, y: 300 },
};
function parsed(boss: FirstShiftBoss, phase = 1, mirror = false, ng = false) {
  const result = firstShiftTestFromUrl(
    new URL(
      `https://test/?test=first-shift&boss=${boss}&phase=${phase}&mirror=${mirror ? 1 : 0}&ng=${ng ? 1 : 0}&v=1`,
    ),
  );
  assert(result);
  return result;
}
function fixture(boss: FirstShiftBoss, phase = 1, mirror = false, ng = false) {
  const source = parsed(boss, phase, mirror, ng),
    g = new Game();
  g.startTest(source.checkpoint);
  const e = g.enemies.find((enemy) => enemy.kind === boss)!;
  assert(e);
  return { g, e, source };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function tick(g: Game, frames = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < frames; i++) g.tick(DT, { ...idle, ...input });
}
function until(g: Game, done: () => boolean, frames = 600) {
  for (let i = 0; i < frames && !done(); i++) tick(g);
  assert(done(), `scene stalled: ${g.mode}, ${g.time}, ${g.bossRemaster.rig?.state}`);
}
function progressWrites(g: Game) {
  const writes: string[] = [];
  g.onCheckpoint = () => writes.push('checkpoint');
  g.onBossDefeated = () => writes.push('boss');
  g.onEnemyDefeated = () => writes.push('enemy');
  g.onCommendation = () => writes.push('commendation');
  g.onCampaignClear = () => writes.push('campaign');
  g.onMilestone = () => writes.push('milestone');
  return writes;
}
function round(g: Game, e: Enemy, friendly: boolean, own = true) {
  return g.addShot({
    pos: { x: 1000, y: 100 },
    vel: { x: 0, y: 0 },
    damage: 1,
    life: 10,
    friendly,
    radius: 5,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
    damageCause: { type: 'shot', enemy: own ? e.kind : 'shooter' },
  })!;
}
function nativeSeed(prefix: string, boss: FirstShiftBoss, mirror: boolean, ng = false) {
  const stage = FIRST_SHIFT_BOSSES[boss].stage;
  for (let i = 0; i < 256; i++) {
    const seed = prefix + i;
    const level = ng ? getOvertimeLevel(seed, stage, 2) : getLevel(seed, stage);
    if (level.mirrored === mirror && level.spawns[0]?.kind === boss) return seed;
  }
  throw new Error('No native historical seed');
}

for (const ng of [false, true])
  test(`${ng ? 'New Game+' : 'normal'} First Shift links use every legal phase/mirror and the actual native encounter`, () => {
    const seeds = new Set<string>();
    for (const boss of BOSSES)
      for (const phase of ng ? [2, 3] : [1, 2, 3])
        for (const mirror of [false, true]) {
          const result = parsed(boss, phase, mirror, ng),
            cp = result.checkpoint;
          const identity = {
            boss,
            phase: phase - 1,
            mirror,
            ng,
            stage: FIRST_SHIFT_BOSSES[boss].stage,
          };
          assert.deepEqual(firstShiftTestIdentity(cp.seed), identity);
          assert(cp.seed.startsWith('RF-C103-') && cp.seed.length < 40);
          assert.equal(cp.version, 6);
          assert.equal(cp.stage, identity.stage);
          assert.equal(cp.hp, 100);
          assert.equal(cp.startingGun, 'pistol');
          assert.equal(cp.kills, 0);
          assert.equal(cp.elapsed, 0);
          assert.equal(cp.encounters, 1);
          assert.equal(cp.bossRemixes, undefined);
          assert.equal(cp.bossRemix, undefined);
          assert(loadCheckpoint(cp), `${boss}/${phase}/${mirror}/${ng} is a legal save`);
          if (ng) {
            assert.deepEqual(cp.overtime, { baseMods: 8, repairs: 0, remix: 2 });
            assert.equal(cp.missedUpgrades, 11);
            assert.equal(cp.mods.length, 8 + cp.stage);
          } else {
            assert.equal(cp.overtime, undefined);
            assert.equal(cp.mods.length, cp.stage);
          }
          const native = ng ? getOvertimeLevel(cp.seed, cp.stage, 2) : getLevel(cp.seed, cp.stage);
          assert.equal(native.spawns[0]?.kind, boss);
          assert.equal(native.mirrored, mirror);
          assert.deepEqual(parsed(boss, phase, mirror, ng), result);
          seeds.add(cp.seed);
          const { g, e } = fixture(boss, phase, mirror, ng);
          assert.equal(g.level.id, FIRST_SHIFT_ARENAS[boss].id);
          assert.equal(g.level.bossRemaster, boss);
          assert.equal(g.level.mirrored, mirror);
          assert.equal(!!g.overtime, ng);
          assert.equal(e.maxHp, ng ? overtimeHealth(boss, cp.stage) : enemyHealth(boss, cp.stage));
          assert.equal(e.hp, e.maxHp * (ng && phase === 2 ? 1 : [1, 0.6, 0.25][phase - 1]));
          assert.equal(g.bossRemaster.rig?.phase, phase - 1);
          assert.equal(g.hp, 100);
          assert.deepEqual(g.mods, cp.mods);
          assert.deepEqual(g.gun, getGun(cp.mods, 'pistol'));
          assert.deepEqual(
            g.level.spawns.slice(1).map((s) => s.kind),
            native.spawns.slice(1).map((s) => s.kind),
          );
          dispose(g);
        }
    assert.equal(seeds.size, ng ? 16 : 24);
  });

test('First Shift URL parser rejects ambiguous values, conflicting state and unsupported NG+ phase one', () => {
  const prefix = 'https://test/?test=first-shift';
  for (const tail of [
    '',
    '&v=',
    '&v=0',
    '&v=2',
    '&v=01',
    '&v=1&v=1',
    '&v=1&test=first-shift',
    '&v=1&boss=',
    '&v=1&boss=sorter',
    '&v=1&boss=Loader',
    '&v=1&boss=__proto__',
    '&v=1&boss=constructor',
    '&v=1&boss=loader&boss=crane',
    '&v=1&phase=0',
    '&v=1&phase=4',
    '&v=1&phase=1.0',
    '&v=1&phase=01',
    '&v=1&phase=2&phase=3',
    '&v=1&mirror=true',
    '&v=1&mirror=2',
    '&v=1&mirror=',
    '&v=1&mirror=0&mirror=1',
    '&v=1&ng=2',
    '&v=1&ng=true',
    '&v=1&ng=0&ng=1',
    '&v=1&ng=1&phase=1',
    '&v=1&seed=custom',
    '&v=1&daily=x',
    '&v=1&gun=shotgun',
    '&v=1&mode=overtime',
    '&v=1&bossRemixes=1',
    '&v=1&variant=1',
    '&v=1&route=high',
    '&v=1&phase=1%20',
    '&v=1&unknown=',
  ])
    assert.equal(firstShiftTestFromUrl(new URL(prefix + tail)), null, tail);
  const ordinary = firstShiftTestFromUrl(new URL(prefix + '&v=1'))!;
  const overtime = firstShiftTestFromUrl(new URL(prefix + '&ng=1&v=1'))!;
  assert.equal(ordinary.boss, 'loader');
  assert.equal(ordinary.phase, 0);
  assert.equal(ordinary.ng, false);
  assert.equal(overtime.phase, 1);
  assert.equal(overtime.ng, true);
  assert.equal(firstShiftTestFromUrl(new URL('https://test/?test=boss-remaster&v=1')), null);
});

test('only canonical bounded C103 fixture identities are recognized and returned checkpoints are independent', () => {
  for (const seed of [
    'custom',
    'RF-C102-FS-L-1-N-C-0',
    'RF-C104-FS-L-1-N-C-0',
    'RF-D103-FS-L-1-N-C-0',
    'RF-C103-FS-L-0-N-C-0',
    'RF-C103-FS-L-4-N-C-0',
    'RF-C103-FS-S-1-N-C-0',
    'RF-C103-FS-L-1-X-C-0',
    'RF-C103-FS-L-1-N-X-0',
    'RF-C103-FS-L-1-N-O-0',
    'RF-C103-FS-L-1-N-C-256',
    'RF-C103-FS-L-1-N-C-999',
    'RF-C103-FS-L-1-N-C--1',
    'RF-C103-FS-L-1-N-C-00',
  ])
    assert.equal(firstShiftTestIdentity(seed), null, seed);
  for (const boss of BOSSES)
    for (const ng of [false, true]) {
      const a = parsed(boss, 3, true, ng),
        original = structuredClone(a);
      assert.equal(firstShiftTestIdentity(a.checkpoint.seed.replace(/-\d+$/, '-255')), null);
      assert.equal(firstShiftTestIdentity(a.checkpoint.seed + '-extra'), null);
      assert.equal(firstShiftTestIdentity(a.checkpoint.seed.replace(/-([0-9]+)$/, '-0$1')), null);
      a.checkpoint.mods.length = 0;
      a.checkpoint.hp = 1;
      a.boss = 'loader';
      a.phase = 0;
      assert.deepEqual(parsed(boss, 3, true, ng), original);
    }
});

test('ordinary C103 and NG+ Campaigns reach the new arenas with remix rules and never inject fixture health', () => {
  for (const boss of BOSSES)
    for (const ng of [false, true])
      for (const mirror of [false, true]) {
        const cp = { ...parsed(boss, 3, mirror, ng).checkpoint, bossRemixes: 1 as const };
        assert(loadCheckpoint(cp));
        const g = new Game();
        g.start(cp.seed, cp);
        assert.equal(g.testRun, null);
        assert(g.bossRemixes);
        assert.equal(g.level.id, 'first-shift-' + boss);
        assert.equal(g.level.bossRemix, undefined);
        assert.equal(g.level.mirrored, mirror);
        const e = g.bossRemaster.enemy!;
        assert.equal(e.kind, boss);
        assert.equal(e.hp, e.maxHp, 'a normal Continue does not inherit URL-only low boss health');
        assert.equal(g.bossRemaster.rig?.phase, ng ? 1 : 0);
        assert.equal(g.hp, 100);
        assert.deepEqual(g.gun, getGun(cp.mods, 'pistol'));
        dispose(g);
      }
});

test('normal and NG+ startups leave real movement available and emit no premature attacks or progress writes', () => {
  for (const boss of BOSSES)
    for (const ng of [false, true])
      for (const mirror of [false, true]) {
        const { g } = fixture(boss, ng ? 2 : 1, mirror, ng);
        const writes = progressWrites(g),
          x = g.player.position.x;
        assert.equal(g.bossRemaster.visual?.stage, 'startup');
        assert.deepEqual(g.bossRemaster.visual?.warnings, []);
        tick(g, 36, { right: true });
        assert(g.player.position.x > x + 20, `${boss}/${ng} can move during its introduction`);
        assert.equal(g.bossRemaster.visual?.stage, 'startup');
        assert.equal(g.hp, 100);
        assert.equal(g.shots.length, 0);
        assert.deepEqual(writes, []);
        dispose(g);
      }
});

test('recorded C102 encounters, pinned Dailies and their earned Practice records remain native', () => {
  for (const boss of BOSSES)
    for (const mirror of [false, true]) {
      const stage = FIRST_SHIFT_BOSSES[boss].stage;
      const seed = nativeSeed('RF-C102-HISTORY-', boss, mirror);
      const native = getLevel(seed, stage);
      const g = new Game();
      const cp = { ...testCheckpoint(seed, stage), version: 6 as const };
      assert(loadCheckpoint(cp));
      g.startTest(cp);
      assert.equal(g.level.id, native.id);
      assert.deepEqual(g.level.solids, native.solids);
      assert.equal(g.level.bossRemaster, undefined);
      assert.equal(g.bossRemaster.rig, null);
      assert(g.enemies.some((e) => e.kind === boss));
      const record = loadEncounters([{ kind: boss, seed }])[0];
      assert(record);
      const practice = new Game();
      assert(practice.startPractice(record));
      assert.equal(practice.level.id, native.id);
      assert.equal(practice.level.mirrored, mirror);
      assert.equal(practice.level.bossRemaster, undefined);
      assert.equal(practice.bossRemaster.rig, null);
      dispose(g);
      dispose(practice);
    }
  const daily = dailyForDate('2026-10-24', 90)!;
  for (const stage of [3, 7]) {
    const native = getLevel(daily.seed, stage),
      g = new Game();
    const cp = { ...testCheckpoint(daily.seed, stage), version: 6 as const };
    assert(loadCheckpoint(cp));
    g.startTest(cp);
    assert.equal(g.level.id, native.id);
    assert.deepEqual(g.level.solids, native.solids);
    assert.equal(g.level.bossRemaster, undefined);
    assert.equal(g.bossRemaster.rig, null);
    dispose(g);
  }
});

test('historical NG+ seeds and rooms keep their previous identities while new earned NG+ records carry C103', () => {
  const history = {
    history: 'OT-1eqf4t4',
    'RF-C94-HISTORY': 'RF-C94-OT-ju4ayz',
    'RF-C95-HISTORY': 'RF-C95-OT-gp1xvi',
    'RF-C96-HISTORY': 'RF-C96-OT-1a7uv79',
    'RF-C97-HISTORY': 'RF-C97-OT-1jgcd9o',
    'RF-C98-HISTORY': 'RF-C98-OT-21r386',
    'RF-C99-HISTORY': 'RF-C99-OT-7icb9s',
    'RF-C102-HISTORY': 'RF-C99-OT-1q4q92p',
    'RF-C103-HISTORY': 'RF-C103-OT-eeyyd0',
  };
  for (const [seed, identity] of Object.entries(history))
    assert.equal(overtimeSeed(seed), identity);
  for (const boss of BOSSES)
    for (const mirror of [false, true]) {
      const seed = nativeSeed('RF-C102-OLD-OT-', boss, mirror, true);
      const cp = { ...parsed(boss, 2, mirror, true).checkpoint, seed };
      assert(loadCheckpoint(cp));
      const native = getOvertimeLevel(seed, cp.stage, 2),
        g = new Game();
      g.startTest(cp);
      assert.equal(g.layoutSeed, overtimeSeed(seed));
      assert(g.layoutSeed.startsWith('RF-C99-OT-'));
      assert.equal(g.level.id, native.id);
      assert.deepEqual(g.level.solids, native.solids);
      assert.equal(g.level.bossRemaster, undefined);
      assert.equal(g.bossRemaster.rig, null);
      dispose(g);
    }
});

test('exact earned remix Practice and forced C103 remix fixtures retain their authored arenas and legacy AI', () => {
  for (const id of [
    'loader-crossdock',
    'loader-switchyard',
    'press-split-die',
    'press-stamping-line',
  ] as const) {
    const practice = new Game();
    assert(practice.startPractice(remixEncounter(id)));
    assert.equal(practice.level.bossRemix, id);
    assert.deepEqual(practice.level.solids, REMIX_LAYOUTS[id].solids);
    assert.equal(practice.level.bossRemaster, undefined);
    assert.equal(practice.bossRemaster.rig, null);
    const boss = BOSS_REMIXES[id].boss;
    const cp = { ...parsed(boss, 1).checkpoint, bossRemix: id };
    assert(loadCheckpoint(cp));
    const forced = new Game();
    forced.startTest(cp);
    assert.equal(forced.level.bossRemix, id);
    assert.deepEqual(forced.level.solids, REMIX_LAYOUTS[id].solids);
    assert.equal(forced.level.bossRemaster, undefined);
    assert.equal(forced.bossRemaster.rig, null);
    dispose(practice);
    dispose(forced);
  }
});

test('normal and NG+ phase changes cancel only owning boss rounds and preserve the native physical arena', () => {
  for (const boss of BOSSES)
    for (const ng of [false, true])
      for (const mirror of [false, true]) {
        const { g, e } = fixture(boss, ng ? 2 : 1, mirror, ng);
        tick(g, 100);
        const friendly = round(g, e, true),
          unrelated = round(g, e, false, false),
          own = round(g, e, false);
        const geometry = structuredClone(g.level.solids);
        e.hp = e.maxHp * (ng ? 0.25 : 0.6);
        tick(g);
        assert.equal(g.bossRemaster.rig?.phase, ng ? 2 : 1);
        assert.equal(g.bossRemaster.visual?.stage, 'transition');
        assert.deepEqual(g.bossRemaster.visual?.warnings, []);
        assert(!g.shots.includes(own));
        assert(g.shots.includes(friendly));
        assert(g.shots.includes(unrelated));
        assert.deepEqual(g.level.solids, geometry);
        if (boss === 'crane')
          assert(Matter.Composite.allBodies(g.engine.world).includes(e.crane!.body));
        dispose(g);
      }
});

test('normal and NG+ native defeats show the destruction beat and provide legal rewards without external progress', () => {
  for (const boss of BOSSES)
    for (const ng of [false, true]) {
      const { g, e, source } = fixture(boss, 3, false, ng);
      const original = structuredClone(source.checkpoint),
        writes = progressWrites(g);
      tick(g, 100);
      const friendly = round(g, e, true),
        own = round(g, e, false);
      const center = { ...e.body.position };
      g.hitEnemy(e, 1e9);
      const at = g.time;
      assert(!g.enemies.includes(e));
      assert(g.bossRemaster.waiting);
      assert.equal(g.bossRemaster.visual?.stage, 'destroyed');
      assert.deepEqual(g.bossRemaster.visual?.center, center);
      assert.deepEqual(g.bossRemaster.visual?.warnings, []);
      assert(!g.shots.includes(own));
      assert(g.shots.includes(friendly));
      if (boss === 'crane')
        assert(!Matter.Composite.allBodies(g.engine.world).includes(e.crane!.body));
      tick(g, 30);
      assert(!g.clear);
      until(g, () => g.clear);
      assert(g.time - at >= 1.2);
      assert.equal(g.bossRemaster.visual, null);
      const clearedAt = g.clearAt;
      tick(g, 5);
      assert.equal(g.clearAt, clearedAt);
      assert.equal(g.hp, 100);
      assert.deepEqual(g.mods, original.mods);
      assert.deepEqual(g.gun, getGun(original.mods, 'pistol'));
      g.openReward();
      assert.equal(g.mode, 'upgrade');
      assert(g.offers.length > 0);
      g.chooseMod(g.offers[0].id);
      assert.equal(g.stage, original.stage + 1);
      assert.equal(g.mode, 'playing');
      assert.equal(g.mods.length, original.mods.length + 1);
      assert(loadCheckpoint(g.checkpointSnapshot()));
      assert.deepEqual(source.checkpoint, original, 'the restart fixture stays pristine');
      assert.deepEqual(writes, []);
      dispose(g);
    }
});

test('newly earned normal and NG+ victories reconstruct C103 Practice without mutating progress', () => {
  for (const boss of BOSSES)
    for (const ng of [false, true])
      for (const mirror of [false, true]) {
        const source = parsed(boss, ng ? 2 : 1, mirror, ng),
          g = new Game();
        g.start(source.checkpoint.seed, source.checkpoint);
        let records: ReturnType<typeof loadEncounters> = [];
        g.onBossDefeated = (kind) => {
          records = loadEncounters([{ kind, seed: g.layoutSeed }]);
        };
        tick(g, 100);
        g.hitEnemy(g.bossRemaster.enemy!, 1e9);
        assert.equal(records.length, 1);
        const record = records[0];
        assert.equal(record.kind, boss);
        assert.equal(record.seed, ng ? overtimeSeed(g.seed) : g.seed);
        assert(record.seed.startsWith(ng ? 'RF-C103-OT-' : 'RF-C103-'));
        assert.equal(getLevel(record.seed, FIRST_SHIFT_BOSSES[boss].stage).spawns[0].kind, boss);
        const practice = new Game(),
          writes = progressWrites(practice);
        assert(practice.startPractice(record));
        assert.equal(practice.level.id, 'first-shift-' + boss);
        assert.equal(practice.level.mirrored, mirror);
        assert.equal(practice.practice?.seed, record.seed);
        assert.equal(practice.bossRemaster.enemy?.hp, practice.bossRemaster.enemy?.maxHp);
        assert.equal(practice.bossRemaster.rig?.phase, 0);
        tick(practice, 100);
        practice.hitEnemy(practice.bossRemaster.enemy!, 1e9);
        until(practice, () => practice.clear);
        assert.deepEqual(writes, []);
        dispose(g);
        dispose(practice);
      }
});

test('private room rematches restore native new bosses, exact mirror, build and props without touching the source', () => {
  for (const boss of BOSSES)
    for (const mirror of [false, true]) {
      const { g } = fixture(boss, 2, mirror);
      const writes = progressWrites(g),
        entry = rematchEntry(g)!;
      assert(entry);
      const level = structuredClone(entry.level),
        mods = [...g.mods],
        gun = structuredClone(g.gun);
      const props = g.props.items.map((p) => ({
        kind: p.kind,
        hp: p.hp,
        position: { ...p.body.position },
      }));
      if (g.props.items[0]) g.props.remove(g.props.items[0]);
      g.die({ type: 'shot', enemy: boss });
      const snapshot = roomRematchSnapshot(g, entry)!;
      assert(snapshot);
      const rematch = new RoomRematch(snapshot),
        r = rematch.game;
      const privateWrites = progressWrites(r);
      assert.equal(r.mode, 'paused');
      assert.equal(r.hp, 100);
      assert.deepEqual(r.level, level);
      assert.equal(r.level.mirrored, mirror);
      assert.deepEqual(r.mods, mods);
      assert.deepEqual(r.gun, gun);
      assert.deepEqual(
        r.props.items.map((p) => ({ kind: p.kind, hp: p.hp, position: { ...p.body.position } })),
        props,
      );
      assert(r.bossRemaster.owns(r.enemies.find((e) => e.kind === boss)!));
      if (boss === 'loader') assert.equal(r.loaderArena.supports.length, 2);
      if (boss === 'crane') assert(r.bossRemaster.enemy!.crane);
      r.setMode('playing');
      tick(r, 36, { right: true });
      rematch.reset();
      assert.equal(r.mode, 'paused');
      assert.equal(r.hp, 100);
      assert.deepEqual(r.level, level);
      assert.deepEqual(entry.level, level);
      assert.deepEqual(writes, []);
      assert.deepEqual(privateWrites, []);
      rematch.dispose();
      dispose(g);
    }
});

test('normal and NG+ Loader arenas retain actual weak barriers and native delayed cargo failures in both mirrors', () => {
  for (const ng of [false, true])
    for (const mirror of [false, true]) {
      const { g, e } = fixture('loader', ng ? 2 : 1, mirror, ng);
      assert(g.loaderArena.active);
      assert.equal(g.loaderArena.supports.length, 2);
      assert.equal(g.level.setpiece!.weak.length, 2);
      assert.equal(g.level.setpiece!.cargo!.length, 2);
      for (const support of g.loaderArena.supports) {
        assert(g.destruction.pieces.includes(support.barrier));
        assert(g.cargo.items.includes(support.cargo));
        assert(g.props.items.includes(support.cargo));
        assert.equal(support.cargo.cargo!.tell, 1.35);
        assert.equal(support.cargo.hp, 150);
        assert.equal(support.state, 'braced');
      }
      tick(g, 100);
      e.hp = e.maxHp * 0.6;
      tick(g);
      const warning = g.loaderArena.supports.find((s) => s.state === 'warning');
      assert(warning, 'the actual native support begins a full release warning');
      const releasedAt = warning.releaseAt;
      assert(releasedAt - g.time > 0, 'cargo never falls immediately');
      while (g.time < releasedAt - 0.1) {
        assert(g.destruction.pieces.includes(warning.barrier));
        tick(g);
      }
      until(g, () => warning.state === 'spent');
      assert(g.time >= releasedAt);
      assert(!g.destruction.pieces.includes(warning.barrier));
      assert.notEqual(warning.cargo.cargo!.state, 'hanging');
      dispose(g);
    }
});
