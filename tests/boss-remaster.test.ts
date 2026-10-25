import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { testCheckpoint } from '../src/practice.ts';
import { loadCheckpoint } from '../src/rules.ts';
import { remixEncounter } from '../src/boss-remix-rules.ts';
import { newUprising } from '../src/uprising-model.ts';
import { bossRemasterTestFromUrl, type BossRemasterTestBoss } from '../src/boss-remaster-test.ts';
import { remasterMagnets, remasterPools } from '../src/boss-remaster-layout.ts';

const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1500, y: 270 },
};
function parsed(boss: BossRemasterTestBoss, phase = 1, mirror = false) {
  const fixture = bossRemasterTestFromUrl(
    new URL(
      `https://test/?test=boss-remaster&boss=${boss}&phase=${phase}&mirror=${mirror ? 1 : 0}&v=1`,
    ),
  );
  assert(fixture);
  return fixture;
}
function fixture(boss: BossRemasterTestBoss, phase = 1, mirror = false) {
  const g = new Game();
  g.startTest(parsed(boss, phase, mirror).checkpoint);
  const e = g.enemies.find((enemy) => enemy.kind === boss)!;
  assert(e);
  return { g, e };
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
  assert(done(), `scene failed to advance: ${g.mode}, ${g.time}, ${g.bossRemaster.rig?.state}`);
}
function nativeSeed(prefix: string, boss: BossRemasterTestBoss) {
  const stage = boss === 'condenser' ? 11 : 15;
  for (let i = 0; i < 256; i++) {
    const seed = prefix + i;
    if (getLevel(seed, stage).spawns.some((spawn) => spawn.kind === boss)) return seed;
  }
  throw new Error('Missing native old encounter');
}
function round(g: Game, enemy: Enemy, friendly: boolean, own = true) {
  return g.addShot({
    pos: { x: 1000, y: 100 },
    vel: { x: 0, y: 0 },
    damage: 1,
    life: 10,
    radius: 5,
    friendly,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
    damageCause: { type: 'shot', enemy: own ? enemy.kind : 'shooter' },
  })!;
}

test('ordinary C102 Campaigns use the remastered encounter even with automatic boss remixes enabled', () => {
  for (const boss of ['condenser', 'sorter'] as const)
    for (const mirror of [false, true]) {
      const g = new Game();
      // A phase-three link's exact seed is also a valid player seed. Only an
      // explicit testRun may lower boss health to the requested fixture phase.
      const cp = { ...parsed(boss, 3, mirror).checkpoint, bossRemixes: 1 as const };
      assert(loadCheckpoint(cp));
      g.start(cp.seed, cp);
      assert.equal(g.testRun, null);
      assert(g.bossRemixes);
      assert.equal(g.level.id, 'boss-remaster-' + boss);
      assert.equal(g.level.bossRemaster, boss);
      assert.equal(g.level.bossRemix, undefined);
      assert.equal(g.level.mirrored, mirror);
      const enemy = g.enemies.find((e) => e.kind === boss)!;
      assert(g.bossRemaster.owns(enemy));
      assert.equal(enemy.hp, enemy.maxHp, 'ordinary Continue does not inject test phase health');
      assert.equal(g.bossRemaster.rig?.phase, 0);
      dispose(g);
    }
});

test('all twelve isolated links load actual arenas and keep ordinary movement during the visual startup', () => {
  for (const boss of ['condenser', 'sorter'] as const)
    for (const phase of [1, 2, 3])
      for (const mirror of [false, true]) {
        const { g, e } = fixture(boss, phase, mirror);
        let writes = 0;
        g.onCheckpoint = () => writes++;
        g.onCommendation = () => writes++;
        g.onCampaignClear = () => writes++;
        g.onEnemyDefeated = () => writes++;
        g.onBossDefeated = () => writes++;
        assert.equal(g.mode, 'playing');
        assert.equal(g.level.id, 'boss-remaster-' + boss);
        assert.equal(g.level.bossRemaster, boss);
        assert.equal(g.level.mirrored, mirror);
        assert.equal(e.hp, e.maxHp * [1, 0.6, 0.25][phase - 1]);
        assert.equal(g.bossRemaster.rig?.phase, phase - 1);
        assert.equal(g.bossRemaster.visual?.stage, 'startup');
        assert.deepEqual(g.bossRemaster.visual?.warnings, []);
        if (boss === 'sorter') assert(g.conveyors.items.every((belt) => belt.speed === 0));
        const from = g.player.position.x;
        tick(g, 36, { right: true });
        assert(g.player.position.x > from + 60, 'startup leaves native movement usable');
        assert.equal(g.bossRemaster.visual?.stage, 'startup');
        assert.equal(g.hp, 100);
        assert.equal(g.shots.length, 0);
        assert.equal(writes, 0);
        dispose(g);
      }
});

test('C101, pinned Dailies and earned legacy or remix Practice records keep their recorded encounters', () => {
  for (const boss of ['condenser', 'sorter'] as const) {
    const stage = boss === 'condenser' ? 11 : 15;
    for (const prefix of ['RF-C101-HISTORY-', 'RF-D101-20261024-']) {
      const seed = nativeSeed(prefix, boss);
      const native = getLevel(seed, stage);
      const g = new Game();
      g.startTest({ ...testCheckpoint(seed, stage), version: 6 });
      assert(g.enemies.some((enemy) => enemy.kind === boss));
      assert.equal(g.level.id, native.id);
      assert.equal(g.level.bossRemaster, undefined);
      assert.equal(g.bossRemaster.rig, null);
      assert.equal(g.bossRemaster.visual, null);
      assert.deepEqual(g.level.solids, native.solids);
      dispose(g);
    }
    const oldSeed = nativeSeed('RF-C101-EARNED-', boss);
    const practice = new Game();
    assert(practice.startPractice({ kind: boss, seed: oldSeed }));
    assert.equal(practice.practice?.seed, oldSeed);
    assert.equal(practice.level.bossRemaster, undefined);
    assert.equal(practice.bossRemaster.rig, null);
    assert(practice.enemies.some((enemy) => enemy.kind === boss));
    dispose(practice);
  }
  for (const id of [
    'condenser-cold-circuit',
    'condenser-purge-chamber',
    'sorter-beltline',
    'sorter-magnetic-return',
  ] as const) {
    const g = new Game();
    assert(g.startPractice(remixEncounter(id)));
    assert.equal(g.level.bossRemix, id);
    assert.equal(g.level.bossRemaster, undefined);
    assert.equal(g.bossRemaster.rig, null);
    assert.equal(g.bossRemaster.visual, null);
    dispose(g);
  }
});

test('phase changes cancel only the owning boss rounds, preserve friendly shots and apply arena changes after the break', () => {
  for (const boss of ['condenser', 'sorter'] as const)
    for (const mirror of [false, true]) {
      const { g, e } = fixture(boss, 1, mirror);
      tick(g, 100);
      assert.equal(g.bossRemaster.visual?.stage, 'combat');
      const friendly = round(g, e, true);
      const unrelated = round(g, e, false, false);
      const own = round(g, e, false);
      const geometry = structuredClone(g.level.solids);
      const originalPools = structuredClone(g.level.coolant);
      e.hp = e.maxHp * 0.6;
      tick(g);
      assert.equal(g.bossRemaster.rig?.phase, 1);
      assert.equal(g.bossRemaster.visual?.stage, 'transition');
      assert.deepEqual(g.bossRemaster.visual?.warnings, []);
      assert(!g.shots.includes(own));
      assert(g.shots.includes(friendly));
      assert(g.shots.includes(unrelated));
      if (boss === 'condenser') assert.deepEqual(g.level.coolant, originalPools);
      else assert(g.conveyors.items.every((belt) => belt.speed === 0));
      until(g, () => g.bossRemaster.rig?.state !== 'transition');
      assert.deepEqual(g.level.solids, geometry, 'phase breaks never replace physical support');
      if (boss === 'condenser') assert.deepEqual(g.level.coolant, remasterPools(1, mirror));
      else {
        assert(g.conveyors.items.some((belt) => belt.speed !== 0));
        assert.equal(Math.sign(g.conveyors.items[0].speed), mirror ? 1 : -1);
      }
      dispose(g);
    }
});

test('pausing freezes startup, phase-break and destruction clocks without clearing the encounter', () => {
  for (const boss of ['condenser', 'sorter'] as const) {
    const { g, e } = fixture(boss);
    for (const stage of ['startup', 'transition', 'destroyed'] as const) {
      if (stage === 'transition') {
        tick(g, 100);
        e.hp = e.maxHp * 0.6;
        tick(g);
      } else if (stage === 'destroyed') {
        until(g, () => g.bossRemaster.rig?.state !== 'transition');
        g.hitEnemy(e, 1e9);
      }
      assert.equal(g.bossRemaster.visual?.stage, stage);
      const visual = structuredClone(g.bossRemaster.visual);
      const time = g.time;
      const remaining = g.bossRemaster.rig?.remaining;
      g.setMode('paused');
      tick(g, 120);
      assert.equal(g.time, time);
      assert.equal(g.bossRemaster.rig?.remaining, remaining);
      assert.deepEqual(g.bossRemaster.visual, visual);
      assert(!g.clear);
      g.setMode('playing');
    }
    dispose(g);
  }
});

test('native boss defeat preserves the destruction beat, then clears once without test progress writes', () => {
  for (const boss of ['condenser', 'sorter'] as const) {
    const { g, e } = fixture(boss, 3);
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onCommendation = () => writes++;
    g.onBossDefeated = () => writes++;
    g.onEnemyDefeated = () => writes++;
    g.onCampaignClear = () => writes++;
    tick(g, 100);
    const friendly = round(g, e, true);
    const own = round(g, e, false);
    const center = { ...e.body.position };
    g.hitEnemy(e, 1e9);
    const defeatedAt = g.time;
    assert(!g.enemies.includes(e));
    assert(g.bossRemaster.waiting);
    assert.equal(g.bossRemaster.visual?.stage, 'destroyed');
    assert.deepEqual(g.bossRemaster.visual?.center, center);
    assert.deepEqual(g.bossRemaster.visual?.warnings, []);
    assert(!g.shots.includes(own));
    assert(g.shots.includes(friendly));
    assert(!g.clear);
    tick(g, 30);
    assert(!g.clear);
    until(g, () => g.clear);
    assert(g.time - defeatedAt >= 1.2);
    assert(!g.bossRemaster.waiting);
    assert.equal(g.bossRemaster.visual, null);
    const clearedAt = g.clearAt;
    tick(g, 15);
    assert.equal(g.clearAt, clearedAt);
    assert.equal(writes, 0);
    dispose(g);
  }
});

test('successful core sabotage keeps environmental coolant disabled through both phase changes', () => {
  for (const mirror of [false, true]) {
    const source = parsed('condenser', 1, mirror).checkpoint;
    const uprising = newUprising();
    uprising.choices = ['rail-escape', 'core-sabotage'];
    uprising.outcomes = uprising.choices.map((route) => ({ route, result: 'success' }));
    const cp = { ...source, uprising };
    assert(loadCheckpoint(cp));
    const g = new Game();
    g.start(cp.seed, cp);
    assert(g.uprising.active);
    assert.equal(g.level.bossRemaster, 'condenser');
    assert.deepEqual(g.level.coolant, []);
    const e = g.bossRemaster.enemy!;
    tick(g, 100);
    for (const hp of [0.6, 0.25]) {
      e.hp = e.maxHp * hp;
      tick(g);
      assert.equal(g.bossRemaster.visual?.stage, 'transition');
      until(g, () => g.bossRemaster.rig?.state !== 'transition');
      assert.deepEqual(g.level.coolant, [], 'phase machinery respects the completed job');
    }
    dispose(g);
  }
});

test('Sorter phase handoff lets an existing magnet release its crate before a newly warned field begins', () => {
  for (const mirror of [false, true]) {
    const { g, e } = fixture('sorter', 1, mirror);
    until(g, () => !!g.magnets.items[0]?.held);
    until(g, () => g.bossRemaster.visual?.stage === 'combat');
    const oldMagnet = g.magnets.items[0];
    const held = oldMagnet.held!;
    assert(g.props.items.includes(held));
    e.hp = e.maxHp * 0.6;
    tick(g);
    assert.equal(g.bossRemaster.rig?.phase, 1);
    until(g, () => g.bossRemaster.rig?.state !== 'transition');
    assert.equal(
      g.magnets.items[0],
      oldMagnet,
      'a live lift is never replaced during a phase break',
    );
    assert.equal(g.magnets.items[0].held, held);
    until(g, () => g.magnets.items[0] !== oldMagnet);
    assert.equal(oldMagnet.held, null, 'the native lift/drop cycle released its own crate');
    assert(g.props.items.includes(held), 'the native prop/body is retained');
    assert.deepEqual(g.level.magnets, remasterMagnets(1, mirror));
    assert.equal(g.magnets.items[0].held, null);
    assert.equal(g.magnets.items[0].phase, 'rest');
    const began = g.magnets.startedAt;
    tick(g);
    assert.equal(g.magnets.items[0].phase, 'warn');
    while (g.time - began < 0.9) {
      assert.equal(g.magnets.items[0].phase, 'warn');
      tick(g);
    }
    assert.equal(
      g.magnets.items[0].phase,
      'warn',
      'the new magnet keeps its entire one-second warning',
    );
    dispose(g);
  }
});
