import test from 'node:test';
import assert from 'node:assert/strict';
import { getLevel } from '../src/levels.ts';
import { loadCheckpoint } from '../src/rules.ts';
import {
  BOSS_REMASTER_TESTS,
  bossRemasterTestFromUrl,
  bossRemasterTestIdentity,
  type BossRemasterTestBoss,
} from '../src/boss-remaster-test.ts';

function fixture(boss: BossRemasterTestBoss, phase: number, mirror: boolean) {
  return bossRemasterTestFromUrl(
    new URL(
      `https://test/?test=boss-remaster&boss=${boss}&phase=${phase}&mirror=${mirror ? 1 : 0}&v=1`,
    ),
  );
}

test('all twelve boss remaster links use legal isolated checkpoints and canonical native encounters', () => {
  const seeds = new Set<string>();
  for (const boss of ['condenser', 'sorter'] as const)
    for (const phase of [1, 2, 3])
      for (const mirror of [false, true]) {
        const actual = fixture(boss, phase, mirror)!;
        assert(actual);
        const stage = BOSS_REMASTER_TESTS[boss].stage;
        assert.deepEqual(
          { boss: actual.boss, phase: actual.phase, mirror: actual.mirror, stage: actual.stage },
          { boss, phase: phase - 1, mirror, stage },
        );
        const checkpoint = actual.checkpoint;
        assert(checkpoint.seed.length < 40);
        assert(checkpoint.seed.startsWith('RF-C102-'));
        assert.equal(checkpoint.version, 6);
        assert.equal(checkpoint.stage, stage);
        assert.equal(checkpoint.startingGun, 'pistol');
        assert.equal(checkpoint.hp, 100);
        assert.equal(checkpoint.kills, 0);
        assert.equal(checkpoint.elapsed, 0);
        assert.equal(checkpoint.encounters, 1);
        assert.equal(checkpoint.bossRemixes, undefined);
        assert.equal(checkpoint.bossRemix, undefined);
        assert.equal(checkpoint.overtime, undefined);
        assert.equal(checkpoint.route, undefined);
        assert.equal(checkpoint.mods.length, 8);
        assert.equal(checkpoint.missedUpgrades, stage - checkpoint.mods.length);
        assert(loadCheckpoint(checkpoint), boss + ' phase ' + phase);
        const native = getLevel(checkpoint.seed, stage);
        assert(native.boss);
        assert(native.spawns.some((spawn) => spawn.kind === boss));
        assert.equal(native.mirrored, mirror);
        assert.deepEqual(bossRemasterTestIdentity(checkpoint.seed), {
          boss,
          phase: phase - 1,
          mirror,
          stage,
        });
        assert.deepEqual(fixture(boss, phase, mirror), actual);
        seeds.add(checkpoint.seed);
      }
  assert.equal(seeds.size, 12);
});

test('strict boss remaster URLs reject duplicates, unsupported values, versions and extra run state', () => {
  const prefix = 'https://test/?test=boss-remaster';
  for (const tail of [
    '',
    '&v=',
    '&v=0',
    '&v=2',
    '&v=01',
    '&v=1&v=1',
    '&v=1&test=boss-remaster',
    '&v=1&boss=',
    '&v=1&boss=loader',
    '&v=1&boss=Condenser',
    '&v=1&boss=__proto__',
    '&v=1&boss=constructor',
    '&v=1&boss=condenser&boss=sorter',
    '&v=1&phase=0',
    '&v=1&phase=4',
    '&v=1&phase=1.0',
    '&v=1&phase=01',
    '&v=1&phase=1&phase=2',
    '&v=1&mirror=true',
    '&v=1&mirror=2',
    '&v=1&mirror=',
    '&v=1&mirror=0&mirror=1',
    '&v=1&seed=RF-C102-anything',
    '&v=1&daily=x',
    '&v=1&gun=shotgun',
    '&v=1&variant=1',
    '&v=1&bossRemixes=1',
    '&v=1&mode=overtime',
    '&v=1&scene=room',
    '&v=1&route=high',
    '&v=1&phase=1%20',
    '&v=1&unexpected=',
  ])
    assert.equal(bossRemasterTestFromUrl(new URL(prefix + tail)), null, tail);
  assert(bossRemasterTestFromUrl(new URL(prefix + '&v=1')));
  assert.equal(bossRemasterTestFromUrl(new URL('https://test/?test=boss-remix&v=1')), null);
});

test('seed identities reject historical, malformed, padded and noncanonical lookalikes', () => {
  for (const seed of [
    'RF-C101-BOSS-C-1-N-1',
    'RF-C103-BOSS-C-1-N-1',
    'RF-D102-BOSS-C-1-N-1',
    'RF-C102-BOSS-X-1-N-0',
    'RF-C102-BOSS-C-0-N-0',
    'RF-C102-BOSS-C-4-N-0',
    'RF-C102-BOSS-C-1-X-0',
    'RF-C102-BOSS-C-1-N-256',
    'RF-C102-BOSS-C-1-N-999',
    'RF-C102-BOSS-C-1-N--1',
    'RF-C102-BOSS-C-1-N-000',
    'custom',
  ])
    assert.equal(bossRemasterTestIdentity(seed), null, seed);
  for (const boss of ['condenser', 'sorter'] as const)
    for (const phase of [1, 2, 3])
      for (const mirror of [false, true]) {
        const seed = fixture(boss, phase, mirror)!.checkpoint.seed;
        const changed = seed.replace(/-\d+$/, '-255');
        assert.notEqual(seed, changed);
        assert.equal(bossRemasterTestIdentity(changed), null, changed);
        assert.equal(bossRemasterTestIdentity(seed + '-extra'), null);
        assert.equal(bossRemasterTestIdentity(seed.replace(/-([0-9]+)$/, '-0$1')), null);
      }
});

test('mutating a returned fixture cannot affect future parses or canonical seed identities', () => {
  const first = fixture('sorter', 3, true)!;
  const original = structuredClone(first);
  first.boss = 'condenser';
  first.phase = 0;
  first.checkpoint.mods.length = 0;
  first.checkpoint.hp = 1;
  assert.deepEqual(fixture('sorter', 3, true), original);
  assert.deepEqual(bossRemasterTestIdentity(original.checkpoint.seed), {
    boss: 'sorter',
    phase: 2,
    mirror: true,
    stage: 15,
  });
});
