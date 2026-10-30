import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint, validBuild } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import {
  OVERSEER_UNITS,
  OVERSEER_SCENES,
  overseersTestFromUrl,
  overseersTestRoom,
  prepareOverseersTest,
} from '../src/overseers-test.ts';
import { welderPracticeLevel } from '../src/welder-layout.ts';
import { switchboardLevel } from '../src/switchboard-layout.ts';
import { AUDITOR_VISIT } from '../src/auditor.ts';
const parse = (q: string) => overseersTestFromUrl(new URL('https://test/?test=overseers&v=1&' + q));
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 700 },
};
function course(q: string) {
  const f = parse(q)!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, overseersTestRoom(f));
  assert(prepareOverseersTest(g, f));
  return { g, f };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function step(g: Game, frames: number, input = idle) {
  for (let i = 0; i < frames && g.mode === 'playing'; i++) g.tick(1 / 60, input);
}
function arrive(g: Game) {
  for (let i = 0; i < 320 && !g.auditor.enemy && g.mode === 'playing'; i++) g.tick(1 / 60, idle);
  assert(g.auditor.enemy, 'Auditor must arrive through its normal warned door');
  step(g, 45);
  return g.auditor.enemy!;
}
test('sixteen overseer courses reconstruct 96 legal isolated starting-tool checkpoints', () => {
  const seeds = new Set<string>();
  for (const unit of OVERSEER_UNITS)
    for (const scene of OVERSEER_SCENES)
      for (const gun of STARTING_GUN_IDS) {
        const f = parse(`unit=${unit}&scene=${scene}&gun=${gun}`);
        if (scene === 'recall' && unit !== 'auditor') {
          assert.equal(f, null);
          continue;
        }
        assert(f);
        assert(loadCheckpoint(f.checkpoint), unit + '/' + scene + '/' + gun);
        assert(validBuild(f.checkpoint.mods));
        assert(f.checkpoint.seed.length <= 40);
        seeds.add(f.checkpoint.seed);
        assert.deepEqual(overseersTestRoom(f), overseersTestRoom(f));
      }
  assert.equal(seeds.size, 96);
});
test('every inspection retains native arena geometry, a private player entry and native boss identity', () => {
  for (const unit of OVERSEER_UNITS)
    for (const scene of OVERSEER_SCENES) {
      if (scene === 'recall' && unit !== 'auditor') continue;
      const { g, f } = course(`unit=${unit}&scene=${scene}`);
      assert.equal(g.hp, 100);
      assert.equal(g.kills, 0);
      assert.equal(g.elapsed, 0);
      assert.equal(g.player.position.x, 140);
      assert.equal(g.waves.pending, false);
      assert.equal(g.machineBreakdown.wrecks.length, 0);
      if (unit === 'auditor') {
        assert.equal(g.level.id, 'audit-yard');
        assert.equal(g.level.boss, false);
        assert(g.auditor.scheduled);
        assert.equal(g.enemies.length, 0);
      } else {
        const native =
          unit === 'welder'
            ? welderPracticeLevel('WELDER-51')
            : switchboardLevel(f.checkpoint.seed, false);
        assert.deepEqual(g.level.solids, native.solids);
        assert.deepEqual(g.level.hazards, native.hazards);
        assert(g.level.boss);
        assert.equal(g.enemies.length, 1);
        assert.equal(g.enemies[0].kind, unit);
      }
      if (unit === 'switchboard') assert.equal(g.level.id, 'annex-switchboard');
      dispose(g);
    }
});
test('Auditor courses use normal warned arrival and final visits retain their actual full health', () => {
  const { g } = course('unit=auditor&scene=animations');
  assert.equal(g.auditor.enemy, null);
  step(g, 100);
  assert.equal(g.auditor.enemy, null);
  const e = arrive(g);
  assert.equal(e.hp, 1800);
  assert.equal(g.auditor.state?.visits, 3);
  assert.equal(e.phase, 2);
  assert(g.enemies.includes(e));
  assert(e.auditor);
  dispose(g);
});
test('the first-visit recall course retreats without kills, wreckage, rewards or profile writes', () => {
  const { g } = course('unit=auditor&scene=recall');
  const e = arrive(g);
  let awards = 0,
    writes = 0;
  g.onCheckpoint = () => writes++;
  g.onEnemyDefeated = () => awards++;
  g.onCommendation = () => awards++;
  assert.equal(g.auditor.state?.visits, 1);
  // Drive the native visit clock to the recall boundary without changing its rules.
  g.auditor.age = AUDITOR_VISIT - 1 / 60;
  g.auditor.update(1 / 60);
  assert(g.auditor.recall > 0);
  assert.equal(e.state, 'return');
  g.setMode('paused');
  const time = g.time,
    recall = g.auditor.recall;
  for (let i = 0; i < 60; i++) g.tick(1 / 60, idle);
  assert.equal(g.time, time);
  assert.equal(g.auditor.recall, recall);
  g.setMode('playing');
  step(g, 100);
  assert.equal(g.auditor.enemy, null);
  assert(!g.enemies.includes(e));
  assert.equal(g.auditor.state?.status, 'hunting');
  assert(g.auditor.state?.retreated);
  assert.equal(g.kills, 0);
  assert.equal(g.machineBreakdown.wrecks.length, 0);
  assert.equal(awards, 0);
  assert.equal(writes, 0);
  dispose(g);
});
test('private overseer inputs, pause, native defeat and restart leave saved progress untouched', () => {
  for (const unit of OVERSEER_UNITS) {
    const { g, f } = course(`unit=${unit}&scene=shutdowns`);
    let writes = 0,
      awards = 0;
    g.onCheckpoint = () => writes++;
    g.onEnemyDefeated = () => awards++;
    g.onCampaignClear = () => awards++;
    g.onCommendation = () => awards++;
    if (unit === 'auditor') arrive(g);
    step(g, 24, { ...idle, right: true, fire: true });
    assert(g.shotCount > 0);
    g.setMode('paused');
    const t = g.time;
    for (let i = 0; i < 20; i++) g.tick(1 / 60, idle);
    assert.equal(g.time, t);
    g.setMode('playing');
    const e = g.enemies.find((e) => e.kind === unit)!;
    assert(e);
    e.spawn = 0;
    g.hitEnemy(e, 100000);
    assert(e.hp <= 0);
    assert.equal(g.kills, 1);
    assert(g.machineBreakdown.wrecks.some((w) => w.visual.id === e.id));
    g.startTest(f.checkpoint, overseersTestRoom(f));
    assert(prepareOverseersTest(g, f));
    assert.equal(g.kills, 0);
    assert.equal(g.machineBreakdown.wrecks.length, 0);
    assert.equal(writes, 0);
    assert.equal(awards, 0);
    dispose(g);
  }
});
test('unknown or mixed overseer links fail closed and cannot prepare an unrelated run', () => {
  for (const q of [
    'unit=caller',
    'scene=friendly',
    'unit=welder&scene=recall',
    'unit=switchboard&scene=recall',
    'gun=nope',
    'unit=welder&unit=auditor',
    'scene=animations&scene=reactions',
    'seed=SAVE',
    'daily=2026-10-29',
    'test=auditor',
    'mirror=1',
    'v=2',
    'unit=welder#x',
  ])
    assert.equal(parse(q), null, q);
  assert.equal(overseersTestFromUrl(new URL('https://test/?test=overseers')), null);
  const g = new Game();
  assert.equal(prepareOverseersTest(g, parse('unit=welder')), false);
  dispose(g);
  const c = course('unit=welder');
  assert.equal(prepareOverseersTest(c.g, parse('unit=auditor')), false);
  dispose(c.g);
});
