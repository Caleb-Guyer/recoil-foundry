import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { planFactory, type FactoryVersion } from '../src/factory.ts';
import { loadCheckpoint } from '../src/rules.ts';
import { snapshotRun, loadRunHistory } from '../src/run-history.ts';
import { playRoom } from './room-pilot.ts';

const idle = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 400 },
};
function battle(seed: string, stage: number, version: FactoryVersion = 2) {
  const g = new Game();
  g.start(seed, {
    version: 6,
    seed,
    stage,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
    factory: planFactory(seed, version),
  });
  return g;
}

test('reported seed and other opening conflicts place complete red-heavy rosters safely', () => {
  const seeds = ['NRW1FY', ...Array.from({ length: 50 }, (_, i) => 'faction-balance-' + i)].filter(
    (seed) => planFactory(seed).condition === 'conflict',
  );
  for (const seed of seeds) {
    for (const [stage, reds, blues] of [
      [1, 6, 3],
      [5, 10, 5],
    ]) {
      const g = battle(seed, stage);
      assert.equal(g.enemies.length, reds, seed + ':' + stage);
      assert.equal(g.factions.allies.length, blues, seed + ':' + stage);
      assert.equal(g.waves.pending, false);
      assert(g.enemies.every((e) => e.body.position.x > g.worldWidth / 2));
      assert(g.factions.allies.every((e) => e.body.position.x < g.worldWidth / 2));
    }
  }
});

test('version one checkpoints and replay starts preserve their original faction balance', () => {
  const g = battle('NRW1FY', 1, 1);
  assert.equal(g.enemies.length, 3);
  assert.equal(g.factions.allies.length, 3);
  let saved: unknown;
  g.onCheckpoint = (s) => {
    saved = s;
  };
  g.save();
  const checkpoint = loadCheckpoint(saved)!;
  assert(checkpoint);
  const resumed = new Game();
  resumed.start(checkpoint.seed, checkpoint);
  assert.equal(resumed.enemies.length, 3);
  resumed.start('NRW1FY', undefined, null, null, false, 0, 1);
  assert.equal(resumed.factory?.version, 1);
  resumed.stage = 1;
  resumed.loadRoom();
  assert.equal(resumed.enemies.length, 3);
  const furnace = battle('NRW1FY', 5, 1);
  assert.equal(furnace.enemies.length, 6);
  assert.equal(furnace.factions.allies.length, 5);
});

test('later faction reinforcements warn before entry, block early rewards and respect the active cap', () => {
  const seed = Array.from({ length: 100 }, (_, i) => 'faction-late-' + i).find((s) =>
    planFactory(s).encounters.some((e) => e.stage === 12 && e.kind === 'turf'),
  )!;
  const g = battle(seed, 12);
  assert.equal(g.areaEvents.active, 'turf');
  assert.equal(g.waves.doors.length, 6);
  assert(g.waves.doors.every((d) => d.state === 'sealed'));
  for (const e of [...g.enemies]) {
    e.spawn = 0;
    g.hitEnemy(e, 99999);
  }
  g.areaEvents.update(1 / 60);
  assert.equal(g.areaEvents.cacheReady, false);
  assert.equal(g.areaEvents.departingAt, null);
  g.hitStop = 0;
  g.waves.update(1 / 60);
  assert(g.waves.doors.every((d) => d.state === 'warning'));
  g.waves.update(0.5);
  assert.equal(g.enemies.length, 0, 'the full door tell precedes a spawn');
  for (let frame = 0; frame < 180 && g.mode === 'playing'; frame++) {
    g.tick(1 / 60, idle);
    assert(g.combatEnemyCount <= 14);
  }
  assert(g.waves.doors.some((d) => d.state === 'open' || d.state === 'spent'));
  assert(!g.areaEvents.cacheReady || !g.enemies.length);
  const legacy = battle(seed, 12, 1);
  assert.equal(legacy.waves.doors.length, 0);
});

test('new conflict openings require intervention and remain clearable with the starting gun', (t) => {
  const inactive = battle('NRW1FY', 1);
  for (let frame = 0; frame < 60 * 60 && inactive.mode === 'playing' && !inactive.clear; frame++)
    inactive.tick(1 / 60, idle);
  assert.equal(
    inactive.clear,
    false,
    'allies cannot finish the reported opening for an idle player',
  );
  for (const stage of [1, 5]) {
    const g = battle('NRW1FY', stage);
    const result = playRoom(g, 100);
    assert(g.clear && g.hp > 0, JSON.stringify({ stage, ...result }));
    t.diagnostic(JSON.stringify({ seed: g.seed, stage, hp: g.hp, elapsed: g.time }));
  }
});

test('recaps retain balance revision and accept old records without one', () => {
  const g = battle('NRW1FY', 1);
  g.setMode('dead');
  const record = snapshotRun(g, 'faction-revision', 1000)!;
  assert.equal(record.factoryVersion, 2);
  assert.deepEqual(loadRunHistory([record]), [record]);
  const old = { ...record };
  delete old.factoryVersion;
  assert.equal(loadRunHistory([old]).length, 1);
  assert.equal(loadRunHistory([{ ...record, factoryVersion: 3 }]).length, 1);
  assert.equal(loadRunHistory([{ ...record, factoryVersion: 4 }]).length, 1);
  assert.equal(loadRunHistory([{ ...record, factoryVersion: 5 }]).length, 0);
  assert.equal(loadRunHistory([{ ...record, factory: undefined }]).length, 0);
});
