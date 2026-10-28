import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint, validBuild } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import {
  machineBreakdownTestFromUrl,
  machineBreakdownTestRoom,
  prepareMachineBreakdownTest,
  BREAKDOWN_SCENES,
  BREAKDOWN_UNITS,
  BREAKDOWN_VARIANTS,
} from '../src/machine-breakdown-test.ts';
const fixture = (q: string) =>
  machineBreakdownTestFromUrl(new URL('https://test/?test=machine-breakdown&v=1&' + q));
const input: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 540 },
};
test('five Machine Breakdown scenes have valid native checkpoints and reproducible private rooms', () => {
  for (const scene of BREAKDOWN_SCENES)
    for (const unit of BREAKDOWN_UNITS)
      for (const variant of BREAKDOWN_VARIANTS)
        for (const gun of STARTING_GUN_IDS) {
          const f = fixture(`scene=${scene}&unit=${unit}&variant=${variant}&gun=${gun}`)!;
          if (variant === 'squad' && unit !== 'all') {
            assert.equal(f, null);
            continue;
          }
          assert(f);
          assert(loadCheckpoint(f.checkpoint));
          assert(validBuild(f.checkpoint.mods));
          assert(f.checkpoint.seed.length <= 40);
          const room = machineBreakdownTestRoom(f);
          assert.equal(room.boss, false);
          assert(room.spawns.length >= 2);
          assert(
            room.spawns.some((e) => e.x === 1870),
            'a native guard keeps early shutdowns observable',
          );
          assert.deepEqual(room, machineBreakdownTestRoom(f));
        }
});
test('elite, mutation and squad inspections instantiate real native identities', () => {
  for (const variant of ['mixed', 'shielded', 'twin', 'volatile', 'mutations', 'squad']) {
    const f = fixture(`scene=elites&variant=${variant}`)!;
    const g = new Game();
    g.startTest(f.checkpoint, machineBreakdownTestRoom(f));
    assert(prepareMachineBreakdownTest(g, f));
    const targets = ['runner', 'shooter', 'flyer'].map(
      (kind) => g.enemies.find((e) => e.kind === kind && e.body.position.x < 1500)!,
    );
    assert(targets.every(Boolean));
    if (variant === 'mixed')
      assert.deepEqual(
        targets.map((e) => e.elite),
        ['shielded', 'twin', 'volatile'],
      );
    else if (variant === 'mutations')
      assert.deepEqual(
        targets.map((e) => e.mutation?.kind),
        ['splitter', 'gunner', 'blinker'],
      );
    else if (variant === 'squad')
      assert.deepEqual(
        targets.slice(1).map((e) => [e.squad?.kind, e.squad?.role]),
        [
          ['flank', 'lead'],
          ['flank', 'support'],
        ],
      );
    else assert(targets.every((e) => e.elite === variant));
  }
});
test('inspection runs permit native movement and firing with no checkpoint, reward or profile callbacks', () => {
  for (const scene of BREAKDOWN_SCENES) {
    const f = fixture(`scene=${scene}`)!;
    const g = new Game();
    let writes = 0,
      awards = 0;
    g.onCheckpoint = () => writes++;
    g.onCommendation = () => awards++;
    g.onCampaignClear = () => awards++;
    g.onEnemyDefeated = () => awards++;
    g.startTest(f.checkpoint, machineBreakdownTestRoom(f));
    assert(prepareMachineBreakdownTest(g, f));
    const x = g.player.position.x;
    for (let i = 0; i < 80; i++) g.tick(1 / 60, { ...input, right: i < 40, fire: i > 40 });
    assert(g.player.position.x > x + 20);
    assert(g.shotCount > 0);
    assert.equal(g.mode, 'playing');
    g.setMode('paused');
    const t = g.time;
    for (let i = 0; i < 30; i++) g.tick(1 / 60, input);
    assert.equal(g.time, t);
    assert.equal(writes, 0);
    assert.equal(awards, 0);
  }
});
test('a first native shutdown does not finish the inspection while the real guard survives', () => {
  const f = fixture('scene=shutdowns&unit=runner')!;
  const g = new Game();
  g.startTest(f.checkpoint, machineBreakdownTestRoom(f));
  prepareMachineBreakdownTest(g, f);
  for (let i = 0; i < 50; i++) g.tick(1 / 60, input);
  const target = g.enemies.find((e) => e.kind === 'runner')!;
  g.hitEnemy(target, 10000);
  for (let i = 0; i < 60; i++) g.tick(1 / 60, input);
  assert.equal(g.mode, 'playing');
  assert(g.enemies.some((e) => e.kind === 'shooter'));
  assert.equal(g.kills, 1);
});
test('unsupported, duplicate, mixed-mode and malformed Machine Breakdown links fail closed', () => {
  for (const q of [
    'scene=nope',
    'scene=animations&unit=nope',
    'scene=reactions&variant=bad',
    'scene=elites&gun=nope',
    'scene=animations&scene=elites',
    'scene=animations&seed=SAVE',
    'scene=animations&daily=2026-10-27',
    'scene=animations&quick=ABC',
    'scene=animations&v=1',
    'scene=animations#other',
    'scene=elites&unit=runner&variant=squad',
  ])
    assert.equal(fixture(q), null, q);
  assert.equal(
    machineBreakdownTestFromUrl(
      new URL('https://test/?test=machine-breakdown&scene=animations&v=2'),
    ),
    null,
  );
  const g = new Game();
  assert.equal(prepareMachineBreakdownTest(g, fixture('scene=animations')), false);
});
