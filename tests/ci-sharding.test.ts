import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import {
  regularTestFiles,
  readMaxComboShard,
  selectMaxComboShard,
  MAX_COMBO_TEST,
} from '../scripts/test-sharding.mjs';

test('eight CI shards cover every maximal build exactly once with equal current workloads', () => {
  const builds = Array.from({ length: 9216 }, (_, id) => ({ id }));
  const selected = Array.from({ length: 8 }, (_, index) =>
    selectMaxComboShard(
      builds,
      readMaxComboShard({ RF_MAX_COMBO_SHARD: String(index + 1), RF_MAX_COMBO_SHARDS: '8' }),
    ),
  );
  assert(selected.every((group) => group.length === 1152));
  assert.equal(selected.flat().length, builds.length);
  assert.equal(new Set(selected.flat()).size, builds.length);
  assert.deepEqual(
    selected
      .flat()
      .map((build) => build.id)
      .sort((a, b) => a - b),
    builds.map((build) => build.id),
  );
  // Future additions need not be divisible by eight.
  const uneven = Array.from({ length: 19 }, (_, id) => id);
  const groups = Array.from({ length: 8 }, (_, i) =>
    selectMaxComboShard(uneven, { shard: i + 1, total: 8 }),
  );
  assert.deepEqual(
    groups.flat().sort((a, b) => a - b),
    uneven,
  );
  assert(
    Math.max(...groups.map((group) => group.length)) -
      Math.min(...groups.map((group) => group.length)) <=
      1,
  );
});

test('local runs cover every build and bad CI shard configuration fails instead of passing an empty slice', () => {
  const builds = ['first', 'middle', 'last'];
  assert.deepEqual(selectMaxComboShard(builds, readMaxComboShard({})), builds);
  for (const [shard, total] of [
    ['0', '8'],
    ['9', '8'],
    ['1', '0'],
    ['-1', '8'],
    ['1.5', '8'],
    ['01', '8'],
    ['1', 'Infinity'],
    ['9007199254740993', '9007199254740993'],
    ['1', undefined],
    [undefined, '8'],
    ['', '8'],
    ['1', ''],
  ])
    assert.throws(() =>
      readMaxComboShard({ RF_MAX_COMBO_SHARD: shard, RF_MAX_COMBO_SHARDS: total }),
    );
  assert.throws(() => selectMaxComboShard([], { shard: 1, total: 1 }));
  assert.throws(() => selectMaxComboShard(builds, { shard: 4, total: 4 }));
  assert.throws(() => selectMaxComboShard(builds, { shard: 0, total: 3 }));
  assert.throws(() => selectMaxComboShard(builds, { shard: 4, total: 3 }));
});

test('the regular CI suite includes every current and newly added test except the separately gated maximum-build fixture', () => {
  const all = readdirSync(new URL('../tests/', import.meta.url));
  const regular = regularTestFiles(all);
  assert.deepEqual(
    [...regular, MAX_COMBO_TEST].sort(),
    all.filter((file) => file.endsWith('.test.ts')).sort(),
  );
  assert(regularTestFiles([...all, 'future-feature.test.ts']).includes('future-feature.test.ts'));
  assert.throws(() => regularTestFiles(['ordinary.test.ts']));
  assert.throws(() => regularTestFiles([MAX_COMBO_TEST]));
});
