import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seeded,
  sample,
  getStats,
  eligibleTechs,
  TECHS,
  enemyTypes,
  segmentBox,
  validateCheckpoint,
  pointerButtons,
} from '../src/rules.ts';
test('overlapping mouse buttons follow current button state and fully release', () => {
  assert.deepEqual([1, 3, 2, 0].map(pointerButtons), [
    { fire: true, field: false },
    { fire: true, field: true },
    { fire: false, field: true },
    { fire: false, field: false },
  ]);
  assert.deepEqual(pointerButtons(4), { fire: false, field: false });
});
test('a seed reproduces each room and encounter stream independently', () => {
  const a = seeded('run:room:3'),
    b = seeded('run:room:3'),
    noise = seeded('run:cosmetics');
  assert.deepEqual(
    Array.from({ length: 200 }, () => {
      noise();
      return a();
    }),
    Array.from({ length: 200 }, () => b()),
  );
  assert.notDeepEqual(enemyTypes(4, seeded('a')), enemyTypes(4, seeded('b')));
});
test('reward selection is unique and respects equipment prerequisites', () => {
  const eligible = eligibleTechs(['dense'], ['coil'], 'repulsor');
  assert(!eligible.some((t) => ['dense', 'piercing', 'cluster', 'conductive'].includes(t.id)));
  const offered = sample(eligible, 3, seeded('offers'));
  assert.equal(new Set(offered.map((t) => t.id)).size, 3);
  assert(
    eligibleTechs([], ['coil', 'lance', 'mortar'], 'tractor').some((t) => t.id === 'conductive'),
  );
});
test('all 120 technology pairs produce finite bounded stats, independent of acquisition order', () => {
  for (let i = 0; i < TECHS.length; i++)
    for (let j = i + 1; j < TECHS.length; j++) {
      const a = getStats([TECHS[i].id, TECHS[j].id]),
        b = getStats([TECHS[j].id, TECHS[i].id]);
      assert.deepEqual(a, b);
      for (const v of Object.values(a))
        if (typeof v === 'number') assert(Number.isFinite(v) && v >= 0);
    }
  assert.deepEqual(getStats(['dense', 'dense']), getStats(['dense']));
});
test('swept collision finds a thin wall even when a projectile crosses it in one tick', () => {
  const hit = segmentBox({ x: 0, y: 10 }, { x: 100, y: 10 }, { x: 49, y: 0 }, { x: 51, y: 20 });
  assert(hit);
  assert.equal(hit.t, 0.49);
  assert.deepEqual(hit.normal, { x: -1, y: 0 });
  assert.equal(
    segmentBox({ x: 0, y: 30 }, { x: 100, y: 30 }, { x: 49, y: 0 }, { x: 51, y: 20 }),
    null,
  );
});
test('checkpoint validation rejects malformed, unknown, duplicated and terminal state', () => {
  const valid = {
    version: 1,
    seed: 'TEST',
    stage: 2,
    hp: 100,
    energy: 80,
    techs: ['dense'],
    weapons: ['coil', 'scatter'],
    weapon: 'coil',
    field: 'repulsor',
    kills: 10,
    elapsed: 90,
  };
  assert(validateCheckpoint(valid));
  for (const bad of [
    null,
    {},
    { ...valid, stage: 6 },
    { ...valid, hp: 0 },
    { ...valid, techs: ['made-up'] },
    { ...valid, techs: ['dense', 'dense'] },
    { ...valid, weapon: 'mortar' },
    { ...valid, energy: Infinity },
    { ...valid, weapons: ['__proto__'] },
    { ...valid, seed: 'x'.repeat(100) },
  ])
    assert.equal(validateCheckpoint(bad), false);
});
