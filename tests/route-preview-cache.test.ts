import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { testCheckpoint } from '../src/practice.ts';
import { seeded, getGun, loadCheckpoint } from '../src/rules.ts';
import { newUprising } from '../src/uprising-model.ts';

const seed = 'RF-C101-PREVIEW-CACHE';
function sourceGame() {
  const run = newUprising();
  run.choices = ['rail-escape', 'core-sabotage'];
  run.outcomes = [{ route: 'rail-escape', result: 'success' }];
  const g = new Game();
  g.start(seed, {
    ...testCheckpoint(seed, 9),
    version: 6,
    encounters: 1,
    teamwork: 1,
    uprising: run,
    region: 'cooling',
    annexVersion: 6,
  });
  // A cleared patrol does not automatically complete a sabotage objective.
  for (const enemy of g.enemies) Matter.Composite.remove(g.engine.world, enemy.body);
  g.enemies = [];
  g.waves.clear();
  g.clear = true;
  return g;
}
const clean = (g: Game) => {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
};

test('a completed current-room job refreshes both native route previews before the player leaves', () => {
  const source = sourceGame();
  const low = source.createRoutePreview('low')!,
    high = source.createRoutePreview('high')!;
  assert(low && high);
  assert.equal(low.level.coolant?.length, 2);
  assert(high.level.fans?.length);
  const original = source.checkpointSnapshot();
  assert.equal(source.createRoutePreview('low'), low);
  assert.equal(source.createRoutePreview('high'), high);
  assert.deepEqual(source.checkpointSnapshot(), original);
  source.uprising.resolve(true);
  const afterJob = source.checkpointSnapshot();
  const refreshedLow = source.createRoutePreview('low')!,
    refreshedHigh = source.createRoutePreview('high')!;
  assert.notEqual(refreshedLow, low);
  assert.notEqual(refreshedHigh, high);
  assert.equal(refreshedLow.level.coolant?.length, 0);
  assert.equal(refreshedHigh.level.fans?.length, 0);
  const resumed = new Game();
  resumed.start(seed, afterJob);
  assert.deepEqual(refreshedLow.level, resumed.createRoutePreview('low')!.level);
  assert.deepEqual(refreshedHigh.level, resumed.createRoutePreview('high')!.level);
  assert.deepEqual(source.checkpointSnapshot(), afterJob);
  clean(source);
  clean(resumed);
});

test('live counters do not churn the two previews or consume the source random stream', () => {
  const g = sourceGame();
  let writes = 0;
  g.onCheckpoint = () => writes++;
  const rng = seeded('source-preview-cache');
  g.rng = seeded('source-preview-cache');
  const low = g.createRoutePreview('low'),
    high = g.createRoutePreview('high');
  assert(low && high);
  for (let i = 0; i < 30; i++) {
    g.hp = 30 + i;
    g.elapsed = i * 0.016;
    g.kills = i;
    assert.equal(g.createRoutePreview('low'), low);
    assert.equal(g.createRoutePreview('high'), high);
  }
  assert.equal(g.rng(), rng());
  assert.equal(writes, 0);
  g.mods = g.mods.filter((id) => id !== 'rapid');
  g.mods.push('burst');
  g.gun = getGun(g.mods, g.startingGun);
  assert(loadCheckpoint(g.checkpointSnapshot()), 'the refit keeps a legal same-size build');
  const refit = g.createRoutePreview('low');
  assert(refit);
  assert.notEqual(refit, low);
  assert.equal(g.rng(), rng());
  assert.equal(writes, 0);
  clean(g);
});
