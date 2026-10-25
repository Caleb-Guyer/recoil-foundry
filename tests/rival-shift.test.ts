import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { rivalShiftTestFromUrl } from '../src/rival-shift-test.ts';
import { rivalShiftFans, rivalShiftBelts } from '../src/rival-shift-layout.ts';
import { RIVAL_SHIFT_BOSSES, type RivalShiftBoss } from '../src/rival-shift-rules.ts';
import { getLevel } from '../src/levels.ts';
import { getOvertimeLevel, overtimeSeed } from '../src/overtime.ts';
import { newCampaignSeed } from '../src/run-seed.ts';
import { enemyHealth } from '../src/enemies.ts';
import { overtimeHealth } from '../src/overtime.ts';
import { testCheckpoint } from '../src/practice.ts';
import { loadEncounters } from '../src/practice.ts';
import { incomingEdgeCues } from '../src/combat-readability.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1500, y: 300 },
};
const bosses = ['turbine', 'boss'] as const;
const urlBoss = (boss: RivalShiftBoss) => (boss === 'boss' ? 'interceptor' : boss);
function fixture(boss: RivalShiftBoss, phase = 1, mirror = false, ng = false) {
  const source = rivalShiftTestFromUrl(
    new URL(
      `https://test/?test=rival-shift&boss=${urlBoss(boss)}&phase=${phase}&mirror=${mirror ? 1 : 0}&ng=${ng ? 1 : 0}&v=1`,
    ),
  )!;
  assert(source);
  const g = new Game();
  g.startTest(source.checkpoint);
  return { g, e: g.bossRemaster.enemy!, source };
}
function clean(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function tick(g: Game, frames = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < frames; i++) g.tick(1 / 60, { ...idle, ...input });
}
function until(g: Game, done: () => boolean, frames = 1500) {
  for (let i = 0; i < frames && !done(); i++) tick(g);
  assert(done(), `${g.bossRemaster.rig?.state} stalled`);
}
function nativeSeed(prefix: string, boss: RivalShiftBoss, ng = false) {
  for (let i = 0; i < 256; i++) {
    const seed = prefix + i;
    const level = ng
      ? getOvertimeLevel(seed, RIVAL_SHIFT_BOSSES[boss].stage, 5)
      : getLevel(seed, RIVAL_SHIFT_BOSSES[boss].stage);
    if (level.spawns[0]?.kind === boss) return seed;
  }
  throw Error('missing native boss');
}

test('C104 Campaign and earned New Game+ keep the new identity while earlier seed hashes remain exact', () => {
  const current = newCampaignSeed(undefined, () => 12345);
  assert(current.startsWith('RF-C104-'));
  assert(overtimeSeed(current).startsWith('RF-C104-OT-'));
  assert.equal(overtimeSeed('RF-C103-HISTORY'), 'RF-C103-OT-eeyyd0');
  assert.equal(overtimeSeed('RF-C102-HISTORY'), 'RF-C99-OT-1q4q92p');
});

test('all twenty native Rival Shift fixtures retain native health, supports, gun damage and complete phase identity', () => {
  for (const boss of bosses)
    for (const ng of [false, true])
      for (const phase of ng ? [2, 3] : [1, 2, 3])
        for (const mirror of [false, true]) {
          const { g, e, source } = fixture(boss, phase, mirror, ng);
          assert(e);
          assert.equal(g.level.bossRemaster, boss);
          assert.equal(e.kind, boss);
          assert.equal(
            e.maxHp,
            ng ? overtimeHealth(boss, source.stage) : enemyHealth(boss, source.stage),
          );
          assert.equal(e.hp, e.maxHp * (ng && phase === 2 ? 1 : [1, 0.6, 0.25][phase - 1]));
          assert.equal(g.bossRemaster.rig?.phase, phase - 1);
          assert.equal(g.level.mirrored, mirror);
          assert.equal(g.hp, 100);
          assert.deepEqual(g.mods, source.checkpoint.mods);
          const native = ng ? getOvertimeLevel(g.seed, g.stage, 5) : getLevel(g.seed, g.stage);
          assert.deepEqual(
            g.level.spawns.slice(1).map((s) => s.kind),
            native.spawns.slice(1).map((s) => s.kind),
          );
          if (ng) assert.equal(g.level.spawns.length, 4);
          clean(g);
        }
});

test('normal Continue and earned Practice never inherit URL-only phase health', () => {
  for (const boss of bosses)
    for (const ng of [false, true]) {
      const { g: preview, source } = fixture(boss, ng ? 2 : 3, false, ng);
      clean(preview);
      const g = new Game();
      g.start(source.checkpoint.seed, source.checkpoint);
      const e = g.bossRemaster.enemy!;
      assert(e);
      assert.equal(e.hp, e.maxHp);
      assert.equal(g.bossRemaster.rig?.phase, ng ? 1 : 0);
      clean(g);
      let record: ReturnType<typeof loadEncounters>[number] | undefined;
      const run = new Game();
      run.start(source.checkpoint.seed, source.checkpoint);
      run.onBossDefeated = (kind) => {
        record = loadEncounters([{ kind, seed: run.layoutSeed }])[0];
      };
      tick(run, 100);
      run.hitEnemy(run.bossRemaster.enemy!, 1e8);
      assert(record);
      clean(run);
      const practice = new Game();
      assert(practice.startPractice(record));
      assert.equal(practice.level.bossRemaster, boss);
      assert.equal(practice.bossRemaster.enemy?.hp, practice.bossRemaster.enemy?.maxHp);
      clean(practice);
    }
});

test('historical Campaign, Daily and NG+ encounters retain native layouts and older attack dispatch', () => {
  for (const prefix of ['RF-C103-HISTORY-', 'RF-C102-HISTORY-', 'RF-D90-HISTORY-'])
    for (const boss of bosses) {
      const seed = nativeSeed(prefix, boss),
        stage = RIVAL_SHIFT_BOSSES[boss].stage,
        native = getLevel(seed, stage),
        g = new Game();
      g.startTest({ ...testCheckpoint(seed, stage), version: 6 });
      assert.equal(g.level.id, native.id);
      assert.deepEqual(g.level.solids, native.solids);
      assert.equal(g.bossRemaster.rig, null);
      clean(g);
    }
  for (const boss of bosses) {
    const seed = nativeSeed('RF-C103-OT-HISTORY-', boss, true),
      stage = RIVAL_SHIFT_BOSSES[boss].stage,
      native = getOvertimeLevel(seed, stage, 5),
      g = new Game();
    const { g: preview, source } = fixture(boss, 2, false, true);
    clean(preview);
    const cp = { ...source.checkpoint, seed };
    g.startTest(cp);
    assert.equal(g.level.id, native.id);
    assert.deepEqual(g.level.solids, native.solids);
    assert.equal(g.bossRemaster.rig, null);
    clean(g);
  }
});

test('startups remain playable without premature shots, progress writes or offscreen warnings', () => {
  for (const boss of bosses)
    for (const ng of [false, true]) {
      const { g } = fixture(boss, ng ? 2 : 1, false, ng);
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.onBossDefeated = () => writes++;
      g.onEnemyDefeated = () => writes++;
      const x = g.player.position.x;
      tick(g, 36, { right: true });
      assert(g.player.position.x > x + 20);
      assert.equal(g.bossRemaster.visual?.stage, 'startup');
      assert.equal(g.shots.length, 0);
      assert.equal(writes, 0);
      assert.deepEqual(
        incomingEdgeCues(
          g.shots,
          g.player.position,
          { x: 0, y: 0, w: 700, h: 740 },
          g.time,
          g.solidBodies,
          28,
          g.enemies,
          () => true,
          g.bossRemaster,
        ),
        [],
      );
      clean(g);
    }
});

test('phase breaks clear only the owning machine rounds, reset fan warnings and stop changing belts', () => {
  for (const boss of bosses)
    for (const mirror of [false, true]) {
      const { g, e } = fixture(boss, 1, mirror);
      until(g, () => g.bossRemaster.visual?.stage === 'combat');
      const round = (friendly: boolean, own: boolean) =>
        g.addShot({
          pos: { x: 1000, y: 100 },
          vel: { x: 0, y: 0 },
          damage: 1,
          life: 20,
          friendly,
          radius: 5,
          bounces: 0,
          pierce: 0,
          fragment: false,
          split: false,
          damageCause: { type: 'shot', enemy: own ? boss : 'shooter' },
        })!;
      const own = round(false, true),
        friend = round(true, true),
        support = round(false, false);
      e.hp = e.maxHp * 0.6;
      tick(g);
      assert.equal(g.bossRemaster.rig?.state, 'transition');
      assert(!g.shots.includes(own));
      assert(g.shots.includes(friend));
      assert(g.shots.includes(support));
      if (boss === 'turbine') assert.equal(g.crosswind.items.length, 0);
      else assert(g.conveyors.items.every((b) => b.speed === 0));
      until(g, () => g.bossRemaster.rig?.state !== 'transition');
      if (boss === 'turbine') {
        assert.deepEqual(g.level.fans, rivalShiftFans(1, mirror));
        assert.equal(g.crosswind.items[0].phase, 'rest');
        assert(g.crosswind.items[0].timer > 2.4);
      } else assert.deepEqual(g.conveyors.items, rivalShiftBelts(1, mirror));
      const time = g.time,
        rigRemaining = g.bossRemaster.rig!.remaining,
        fanTimers = g.crosswind.items.map((f) => f.timer);
      g.setMode('paused');
      tick(g, 90);
      assert.equal(g.time, time);
      assert.equal(g.bossRemaster.rig!.remaining, rigRemaining);
      assert.deepEqual(
        g.crosswind.items.map((f) => f.timer),
        fanTimers,
      );
      clean(g);
    }
});

test('destroying either rival cancels hazards, freezes its wreck while paused and completes native room clear', () => {
  for (const boss of bosses) {
    const { g, e } = fixture(boss);
    until(g, () => g.bossRemaster.visual?.stage === 'combat');
    g.hitEnemy(e, 1e8);
    assert.equal(g.bossRemaster.visual?.stage, 'destroyed');
    assert(g.bossRemaster.waiting);
    assert(!g.clear);
    assert.equal(g.crosswind.items.length, 0);
    assert(g.conveyors.items.every((b) => b.speed === 0));
    const wreck = structuredClone(g.bossRemaster.visual);
    g.setMode('paused');
    tick(g, 90);
    assert.deepEqual(g.bossRemaster.visual, wreck);
    g.setMode('playing');
    tick(g, 100);
    assert(g.clear);
    assert.equal(g.bossRemaster.waiting, false);
    assert.equal(g.bossRemaster.visual, null);
    clean(g);
  }
});
