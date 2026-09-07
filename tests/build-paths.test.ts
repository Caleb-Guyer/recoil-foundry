import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import {
  MODS,
  availableMods,
  buildPath,
  validBuild,
  modPathLabel,
  loadCheckpoint,
  getGun,
} from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';

test('only the two entry upgrades appear before committing, and existing upgrades stay shared', () => {
  const initial = availableMods([]).map((m) => m.id);
  assert(initial.includes('crossfire') && initial.includes('deadeye'));
  assert(!initial.includes('bloom') && !initial.includes('execute'));
  for (const [root, follow, opposing] of [
    ['crossfire', 'bloom', 'deadeye'],
    ['deadeye', 'execute', 'crossfire'],
  ]) {
    const available: string[] = availableMods([root]).map((m) => m.id);
    assert(available.includes(follow));
    assert(!available.includes(opposing));
    assert(!available.includes(root));
    for (const shared of MODS.slice(0, 14)) assert(available.includes(shared.id));
  }
});

test('path cards state the lock before selection and follow-ups display the chosen path', () => {
  assert.equal(modPathLabel('crossfire'), 'Bullet hell · Locks Precision');
  assert.equal(modPathLabel('deadeye'), 'Precision · Locks Bullet hell');
  assert.equal(modPathLabel('bloom'), 'Bullet hell');
  assert.equal(modPathLabel('execute'), 'Precision');
  assert.equal(modPathLabel('kick'), '');
});

test('checkpoints preserve commitments and reject incompatible or out-of-order paths', () => {
  const save = {
    version: 3,
    seed: 'path-save',
    stage: 4,
    hp: 75,
    mods: ['crossfire', 'scatter', 'bloom', 'kick'],
    kills: 10,
    elapsed: 40,
  };
  for (const mods of [
    save.mods,
    ['deadeye', 'magnum', 'execute', 'backblast'],
    ['scatter', 'magnum', 'burst', 'pierce'],
  ]) {
    const restored = loadCheckpoint(JSON.parse(JSON.stringify({ ...save, mods })))!;
    assert(restored);
    const game = new Game();
    game.start(restored.seed, restored);
    assert.deepEqual(game.gun, getGun(mods));
    assert.equal(buildPath(game.mods), buildPath(mods));
  }
  for (const mods of [
    ['crossfire', 'deadeye'],
    ['deadeye', 'crossfire'],
    ['bloom'],
    ['execute'],
    ['execute', 'deadeye'],
    ['bloom', 'crossfire'],
  ])
    assert.equal(loadCheckpoint({ ...save, mods }), null, mods.join(','));
});

test('stale or injected opposing offers cannot spend a reward or change a committed build', () => {
  const g = new Game();
  g.start('path-guard');
  g.mods = ['crossfire'];
  g.gun = getGun(g.mods);
  g.openReward();
  g.offers = [MODS.find((m) => m.id === 'deadeye')!];
  g.hp = 50;
  const before = { stage: g.stage, body: g.player, gun: g.gun };
  g.chooseMod('deadeye');
  assert.equal(g.mode, 'upgrade');
  assert.equal(g.hp, 50);
  assert.equal(g.stage, before.stage);
  assert.equal(g.gun, before.gun);
  assert.equal(g.player, before.body);
  assert.deepEqual(g.mods, ['crossfire']);
});

test('random and forced daily rewards stay legal and plentiful throughout complete builds', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 120; i++) {
    const daily = i % 2 === 0;
    const seed = daily
      ? dailyForDate(
          `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
        )!.seed
      : 'path-' + i;
    const g = new Game();
    g.start(seed);
    for (let stage = 0; stage < 8; stage++) {
      g.openReward();
      assert.equal(g.offers.length, daily ? 1 : 3);
      assert(g.offers.every((mod) => availableMods(g.mods).some((m) => m.id === mod.id)));
      const offers = [...g.offers];
      for (let noise = 0; noise < 50; noise++) g.rng();
      g.openReward();
      assert.deepEqual(g.offers, offers);
      const choice =
        g.offers.find((m) => ['bloom', 'execute', 'crossfire', 'deadeye'].includes(m.id)) ??
        g.offers[(i + stage) % g.offers.length];
      seen.add(choice.id);
      g.chooseMod(choice.id);
      assert(validBuild(g.mods));
      assert.equal(g.mods.length, stage + 1);
    }
    assert(availableMods(g.mods).length >= 3);
  }
  for (const id of ['crossfire', 'bloom', 'deadeye', 'execute']) assert(seen.has(id));
});

test('retry clears commitment and a resumed run reproduces its next path-aware offers', () => {
  const g = new Game();
  g.start('path-retry');
  const save = {
    version: 3 as const,
    seed: g.seed,
    stage: 2,
    hp: 80,
    mods: ['crossfire', 'backblast'],
    kills: 5,
    elapsed: 20,
  };
  g.start(save.seed, save);
  g.openReward();
  const restored = new Game();
  restored.start(save.seed, loadCheckpoint(save)!);
  restored.openReward();
  assert.deepEqual(g.offers, restored.offers);
  g.start(g.seed);
  assert.equal(buildPath(g.mods), undefined);
  assert(availableMods(g.mods).some((m) => m.id === 'deadeye'));
});
