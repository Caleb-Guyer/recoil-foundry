import test from 'node:test';
import assert from 'node:assert/strict';
import { seeded, sample, getGun, MODS, segmentBox, loadCheckpoint } from '../src/rules.ts';
test('seeded layouts and rewards reproduce without sharing random state', () => {
  const a = seeded('room'),
    b = seeded('room'),
    other = seeded('noise');
  assert.deepEqual(
    Array.from({ length: 100 }, () => {
      other();
      return a();
    }),
    Array.from({ length: 100 }, () => b()),
  );
  assert.notDeepEqual(sample(MODS, 3, seeded('A')), sample(MODS, 3, seeded('B')));
});
test('every pair of gun mods combines independently of order and cannot stack twice', () => {
  for (const a of MODS)
    for (const b of MODS) {
      const first = getGun([a.id, b.id]),
        second = getGun([b.id, a.id]);
      for (const k of Object.keys(first) as (keyof typeof first)[]) {
        if (typeof first[k] === 'number') {
          assert(Number.isFinite(first[k]));
          assert(Math.abs((first[k] as number) - (second[k] as number)) < 1e-9);
        } else assert.equal(first[k], second[k]);
      }
    }
  assert.deepEqual(getGun(['magnum', 'magnum']), getGun(['magnum']));
});
test('a swept round detects thin cover and misses outside its bounds', () => {
  const h = segmentBox({ x: 0, y: 10 }, { x: 100, y: 10 }, { x: 49, y: 0 }, { x: 51, y: 20 });
  assert(h);
  assert.equal(h.t, 0.49);
  assert.deepEqual(h.normal, { x: -1, y: 0 });
  assert.equal(
    segmentBox({ x: 0, y: 30 }, { x: 100, y: 30 }, { x: 49, y: 0 }, { x: 51, y: 20 }),
    null,
  );
});
test('only valid current single-gun checkpoints resume', () => {
  const valid = {
    version: 5,
    seed: 'run',
    stage: 3,
    hp: 72,
    mods: ['magnum', 'rapid'],
    kills: 12,
    elapsed: 30,
  };
  assert.equal(loadCheckpoint(valid), valid);
  for (const bad of [
    null,
    {},
    { ...valid, version: 2 },
    { ...valid, hp: 0 },
    { ...valid, stage: 20 },
    { ...valid, mods: ['unknown'] },
    { ...valid, mods: ['rapid', 'rapid'] },
    { ...valid, elapsed: Infinity },
    { ...valid, kills: -1 },
    { ...valid, seed: 'x'.repeat(41) },
  ])
    assert.equal(loadCheckpoint(bad), null);
});
