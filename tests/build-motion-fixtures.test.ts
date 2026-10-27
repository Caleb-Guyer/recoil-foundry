import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { MODS, validBuild } from '../src/rules.ts';
import {
  BUILD_MOTION_SCENES,
  buildMotionTestFromUrl,
  prepareBuildMotionTest,
} from '../src/build-motion-test.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';

test('all Build in Motion fixture and tool combinations are legal and private', () => {
  for (const scene of BUILD_MOTION_SCENES)
    for (const gun of STARTING_GUN_IDS) {
      const f = buildMotionTestFromUrl(
        new URL(`https://example.com/?test=build-motion&scene=${scene}&gun=${gun}&v=1`),
      );
      assert(f);
      assert(validBuild(f.mods));
      assert(f.hint.includes('preserves Continue'));
      const g = new Game();
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.startWorkshop(
        MODS.map((m) => m.id),
        f.mods,
        f.gun,
        f.range,
      );
      prepareBuildMotionTest(g, f);
      assert(g.workshop.active);
      assert.equal(g.startingGun, gun);
      assert.deepEqual(g.mods, f.mods);
      assert.equal(writes, 0);
      assert.equal(g.commendations.eligible, false);
    }
});
test('native highlights demonstration records real discharges, remote fire and a banked jump', () => {
  const f = buildMotionTestFromUrl(
    new URL('https://example.com/?test=build-motion&scene=highlights&v=1'),
  )!;
  const g = new Game();
  g.startWorkshop(
    MODS.map((m) => m.id),
    f.mods,
    f.gun,
    f.range,
  );
  prepareBuildMotionTest(g, f);
  const r = g.combatReport.snapshot();
  assert((r.activations?.['piston-lance'] ?? 0) > 0);
  assert((r.activations?.['offset-nozzle'] ?? 0) > 0);
  assert.equal(r.activations?.['momentum-battery'], 1);
  assert.equal(g.mode, 'playing');
});
test('malformed or mixed motion fixture links cannot create permissive tests', () => {
  for (const q of [
    'test=build-motion&v=2',
    'test=build-motion&v=1&scene=nope',
    'test=build-motion&v=1&gun=unearned',
    'test=build-motion&v=1&scene=practice&scene=readiness',
    'test=build-motion&v=1&build=reported',
    'test=build-motion&v=1&v=1',
  ])
    assert.equal(buildMotionTestFromUrl(new URL('https://example.com/?' + q)), null);
});
