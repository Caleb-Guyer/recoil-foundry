import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEED_LOCK_SCENES,
  seedLockTestFromUrl,
  seedLockCheckpoint,
  seedLockRange,
  runSeedLockComparison,
  type SeedLockScene,
} from '../src/seed-lock-test.ts';
import { loadCheckpoint } from '../src/rules.ts';

const fixture = (scene: SeedLockScene) =>
  seedLockTestFromUrl(new URL('https://test/?test=seed-lock&scene=' + scene + '&v=1'))!;

test('Seed Lock links select five explicit private inspection scenes and valid sample saves', () => {
  for (const scene of SEED_LOCK_SCENES) {
    const f = fixture(scene);
    assert.equal(f.scene, scene);
    assert(f.title.length > 0 && f.hint.length > 0);
  }
  for (const seed of [
    'RF-C108-LOCK-SAVE',
    'RF-C110-LOCK-SAVE',
    'RF-C111-LOCK-SAMPLE',
    'RF-D91-2026-10-29',
    'RF-D92-2026-10-29',
  ]) {
    const save = seedLockCheckpoint(seed);
    assert.equal(save.version, 6);
    assert.equal(save.seed, seed);
    assert.deepEqual(loadCheckpoint(JSON.parse(JSON.stringify(save))), save);
  }
  const a = seedLockRange(),
    b = seedLockRange();
  assert.deepEqual(a, b);
  a.solids[0].x = -999;
  assert.notDeepEqual(a, b, 'Private range reconstruction must not share mutable room arrays.');
});

test('Seed Lock links reject duplicates, unsupported versions, mixed modes, unknown fields and fragments', () => {
  for (const query of [
    'test=seed-lock&v=1&v=1',
    'test=seed-lock&test=seed-lock&v=1',
    'test=seed-lock&scene=heavy&scene=heavy&v=1',
    'test=seed-lock&scene=noise&v=1',
    'test=seed-lock&scene=heavy&v=2',
    'test=seed-lock&scene=heavy',
    'test=seed-lock&scene=heavy&v=1&daily=2026-10-29',
    'test=seed-lock&scene=heavy&v=1&gun=pistol',
    'test=overseers&scene=heavy&v=1',
    'test=seed-lock&v=1#untrusted',
  ])
    assert.equal(seedLockTestFromUrl(new URL('https://test/?' + query)), null, query);
});

test('heavy effects comparison measures real native discharges, wall-impact fragments and unchanged next combat randomness', () => {
  let visiblyHeavyFrames = 0;
  const a = runSeedLockComparison(fixture('heavy'), {
    render(g, frame) {
      if (frame.side === 'variant') {
        assert.equal(
          g.particles.length,
          220,
          'The measured heavy workload must actually fill the native pool.',
        );
        assert(
          g.particles.some((p) => Math.hypot(p.vel.x, p.vel.y) > 2),
          'Native sparks need visible velocity strokes.',
        );
        visiblyHeavyFrames++;
      }
    },
  });
  assert(visiblyHeavyFrames > 0);
  const b = runSeedLockComparison(fixture('heavy'));
  assert(a.passed && b.passed);
  assert.deepEqual(
    a.pairs.map(({ renderedFrames: _, ...pair }) => pair),
    b.pairs.map(({ renderedFrames: _, ...pair }) => pair),
    'A repeated measured sample must reconstruct the same native trace.',
  );
  const pair = a.pairs[0];
  assert.equal(pair.samples, 180);
  assert.equal(pair.baselineShots, 4);
  assert.equal(pair.baselineFragments, 12);
  assert.equal(pair.variantFragments, pair.baselineFragments);
  assert.equal(pair.baselineNextRandom, pair.variantNextRandom);
  assert.equal(pair.checkpointWrites, 0);
  assert.equal(pair.firstMismatch, null);
});

test('Reduced Effects inspection requests actual reduced render passes and repeated normal draws without changing native samples', () => {
  let ordinary = 0,
    reduced = 0;
  const result = runSeedLockComparison(fixture('reduced'), {
    render(g, frame) {
      assert.equal(g.testRun?.seed, 'RF-C111-LOCK-SAMPLE');
      assert.equal(g.mode, 'playing');
      if (frame.reduced) reduced++;
      else ordinary++;
    },
  });
  assert(result.passed);
  assert.equal(reduced, ordinary * 3);
  assert(reduced > 0);
  assert.equal(result.pairs[0].renderedFrames, ordinary + reduced);
});

test('Pause inspection freezes sixty paused ticks and resumes the identical released-input sequence', () => {
  let pausedViews = 0;
  const result = runSeedLockComparison(fixture('pause'), {
    render(g, frame) {
      if (frame.paused) {
        pausedViews++;
        assert.equal(g.mode, 'paused');
      }
    },
  });
  assert(result.passed);
  assert.equal(result.pairs[0].pausedTicks, 60);
  assert.equal(result.pairs[0].pauseFrozen, true);
  assert.equal(pausedViews, 5);
  assert.equal(result.pairs[0].baselineNextRandom, result.pairs[0].variantNextRandom);
  assert.equal(result.pairs[0].checkpointWrites, 0);
});

test('legacy Campaign and archived Daily reconstruction keep their old identities while current Daily uses Seed Lock', () => {
  const old = runSeedLockComparison(fixture('legacy'));
  assert(old.passed);
  assert.deepEqual(
    old.pairs.map((p) => p.seed),
    ['RF-C108-LOCK-SAVE', 'RF-C110-LOCK-SAVE'],
  );
  assert(
    old.pairs.every(
      (p) =>
        !p.locked &&
        p.checkpointVersion === 6 &&
        p.serializedCheckpointPreserved &&
        p.checkpointWrites === 0,
    ),
  );
  const daily = runSeedLockComparison(fixture('daily'));
  assert(daily.passed);
  assert.deepEqual(
    daily.pairs.map((p) => p.seed),
    ['RF-D91-2026-10-29', 'RF-D92-2026-10-29'],
  );
  assert.deepEqual(
    daily.pairs.map((p) => p.locked),
    [false, true],
  );
  assert(daily.pairs.every((p) => p.baselineFragments > 0 && p.checkpointWrites === 0));
});

test('the inspection fails when an observer changes actual gameplay rather than hiding the divergence behind a fingerprint', () => {
  let changed = false;
  const result = runSeedLockComparison(fixture('heavy'), {
    render(g, frame) {
      if (!changed && frame.side === 'variant' && frame.frame === 60) {
        g.hp -= 1;
        changed = true;
      }
    },
  });
  assert(changed);
  assert.equal(result.passed, false);
  assert.equal(result.pairs[0].matched, false);
  assert.equal(result.pairs[0].firstMismatch, 62);
  assert.notEqual(result.pairs[0].baselineFingerprint, result.pairs[0].variantFingerprint);
});
