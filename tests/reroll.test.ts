import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import {
  availableMods,
  getGun,
  isFusion,
  isSalvage,
  loadCheckpoint,
  MODS,
  REROLL_COST,
  rewardMods,
  seeded,
  validBuild,
  type Checkpoint,
} from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import { overtimeTestFromUrl, rerollTestFromUrl, testCheckpoint } from '../src/practice.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 500, y: 400 },
};
function begin(seed = 'reroll-save', stage = 0) {
  const g = new Game();
  g.start(seed, testCheckpoint(seed, stage));
  g.hp = 64;
  clear(g);
  return g;
}
function clear(g: Game) {
  for (const e of g.enemies) Matter.Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.clear = true;
}
function saveOf(g: Game) {
  let snapshot: Checkpoint | null = null;
  g.onCheckpoint = (value) => {
    snapshot = value;
  };
  g.save();
  const save = loadCheckpoint(JSON.parse(JSON.stringify(snapshot)));
  assert(save, 'the actual reward checkpoint must round-trip through validation');
  return save;
}
const ids = (g: Game) => g.offers.map((m) => m.id);

test('reroll replaces every card, charges exactly once and preserves the single upgrade and room heal', () => {
  const g = begin();
  g.openReward();
  const original = ids(g);
  assert(g.canReroll);
  assert(g.rerollReward());
  assert.equal(g.hp, 52);
  assert.equal(g.mode, 'upgrade');
  assert.equal(g.mods.length, 0);
  assert.equal(g.offers.length, 3);
  assert(g.offers.every((m) => !original.includes(m.id)));
  const replacements = ids(g);
  for (let i = 0; i < 5; i++) assert(!g.rerollReward());
  g.openReward();
  assert.deepEqual(ids(g), replacements);
  assert.equal(g.hp, 52);
  g.chooseMod(original[0]);
  assert.equal(g.mode, 'upgrade');
  g.chooseMod(replacements[0]);
  g.chooseMod(replacements[1]);
  assert.deepEqual(g.mods, [replacements[0]]);
  assert.equal(g.hp, 64);
  assert.equal(g.stage, 1);
  assert.equal(g.mode, 'playing');
  assert(!g.rerollReward());
  clear(g);
  g.openReward();
  assert(g.canReroll, 'the next reward gets its own reroll');
});

test('reroll cannot kill the player or spend health outside a live reward', () => {
  for (const hp of [0, 1, 11.9, 12, 12.1, 13, 100]) {
    const g = begin();
    g.openReward();
    g.hp = hp;
    const original = ids(g);
    assert.equal(g.rerollReward(), hp > REROLL_COST);
    assert.equal(g.hp, hp > REROLL_COST ? hp - REROLL_COST : hp);
    if (hp <= REROLL_COST) assert.deepEqual(ids(g), original);
  }
  for (const mode of ['playing', 'paused', 'title', 'dead', 'won'] as const) {
    const g = begin();
    g.openReward();
    g.setMode(mode);
    assert(!g.rerollReward());
    assert.equal(g.hp, 64);
  }
  const g = begin();
  g.openReward();
  g.rewardTaken = true;
  assert(!g.rerollReward());
  g.rewardTaken = false;
  g.practice = { kind: 'loader', seed: 'practice' };
  assert(!g.rerollReward());
});

test('replacement draws preserve paths, prerequisites, transformations and fusion timing', () => {
  for (const mods of [
    [],
    ['crossfire'],
    ['deadeye'],
    ['shellshock'],
    ['deadeye', 'cutting-torch'],
    ['deadeye', 'capacitor'],
    ['crossfire', 'recall', 'orbit'],
    ['shellshock', 'fuse', 'implosion'],
  ]) {
    for (const stage of [0, 7, 18])
      for (let i = 0; i < 80; i++) {
        const context = { stage };
        const first = rewardMods(mods, 3, seeded('original' + i), context).map((m) => m.id);
        const replacement = rewardMods(mods, 3, seeded('replacement' + i), context, first);
        assert.equal(replacement.length, 3);
        assert.equal(new Set(replacement.map((m) => m.id)).size, 3);
        for (const m of replacement) {
          assert(!first.includes(m.id));
          assert(validBuild([...mods, m.id]));
          assert(!isSalvage(m.id));
          if (stage < 7) assert(!isFusion(m.id));
        }
      }
  }
});

test('reward and reroll draws are reproducible and do not consume the combat RNG', () => {
  const boards: string[][] = [];
  for (let run = 0; run < 2; run++) {
    const g = begin('reproducible-reroll', 6);
    const random = seeded('combat');
    g.rng = seeded('combat');
    g.openReward();
    for (let i = 0; i < 20; i++) assert(g.canReroll);
    g.rerollReward();
    boards.push(ids(g));
    assert.equal(g.rng(), random());
  }
  assert.deepEqual(boards[0], boards[1]);
});

test('Continue restores the pending cards, spent health and used reroll without replaying combat', () => {
  const g = begin();
  g.kills = 5;
  g.elapsed = 22.5;
  g.openReward();
  const before = saveOf(g);
  assert.equal(before.reward?.rerolled, false);
  const resumed = new Game();
  resumed.start(before.seed, before);
  assert.equal(resumed.mode, 'upgrade');
  assert(resumed.canReroll);
  assert.deepEqual(ids(resumed), ids(g));
  resumed.rerollReward();
  const after = saveOf(resumed);
  for (let repeat = 0; repeat < 3; repeat++) {
    const continued = new Game();
    continued.start(after.seed, after);
    assert.equal(continued.mode, 'upgrade');
    assert.equal(continued.hp, 52);
    assert.equal(continued.kills, 5);
    assert.equal(continued.elapsed, 22.5);
    assert.equal(continued.enemies.length, 0);
    assert(!continued.waves.pending);
    assert.deepEqual(ids(continued), ids(resumed));
    assert(!continued.rerollReward());
    continued.tick(1, idle);
    assert.equal(continued.elapsed, 22.5);
    assert.equal(continued.hp, 52);
    continued.chooseMod(continued.offers[0].id);
    assert.equal(continued.stage, 1);
    assert.equal(continued.hp, 64);
    const next = saveOf(continued);
    assert.equal(next.reward, undefined);
    const entrance = new Game();
    entrance.start(next.seed, next);
    assert.equal(entrance.mode, 'playing');
    assert.equal(entrance.mods.length, 1);
    assert.equal(entrance.hp, 64);
  }
});

test('pending route choices and both detour rewards survive reroll and Continue', () => {
  for (const route of ['low', 'high'] as const) {
    const g = begin('reroll-route', 1);
    g.openReward(false, route);
    g.rerollReward();
    const save = saveOf(g);
    const continued = new Game();
    continued.start(save.seed, save);
    continued.chooseMod(continued.offers[0].id);
    assert.equal(continued.route, route);
    assert.equal(continued.level.routeChoice, route);
    assert.equal(continued.hp, 64);
  }
  const g = begin('reroll-detour', 2);
  g.openReward(true);
  assert(g.rerollReward());
  let save = saveOf(g);
  const continued = new Game();
  continued.start(save.seed, save);
  continued.chooseMod(continued.offers[0].id);
  assert(continued.detour);
  assert.equal(continued.stage, 2);
  assert.equal(continued.hp, 64);
  clear(continued);
  continued.openReward();
  assert(continued.rerollReward());
  save = saveOf(continued);
  const returned = new Game();
  returned.start(save.seed, save);
  returned.chooseMod(returned.offers[0].id);
  assert.equal(returned.hp, 52, 'bonus upgrades still give no healing');
  assert.equal(returned.stage, 3);
  assert(!returned.detour);
  assert.deepEqual(returned.detours, [0]);
  assert.equal(returned.mods.length, 4);
  assert(saveOf(returned));
});

test('boss salvage survives Continue; reroll willingly exchanges it for three fresh ordinary upgrades', () => {
  for (const stage of [3, 7, 11, 15]) {
    const g = new Game();
    const initial = testCheckpoint('reroll-boss', stage);
    g.start(initial.seed, initial);
    for (const e of [...g.enemies]) {
      e.spawn = 0;
      g.hitEnemy(e, 99999);
    }
    g.openReward();
    const salvage = g.earnedSalvage!;
    assert(isSalvage(salvage));
    assert.equal(g.offers[0].id, salvage);
    const saved = saveOf(g);
    const accepted = new Game();
    accepted.start(saved.seed, saved);
    accepted.chooseMod(salvage);
    assert(accepted.mods.includes(salvage));
    const rerolled = new Game();
    rerolled.start(saved.seed, saved);
    assert(rerolled.rerollReward());
    assert(!rerolled.offers.some((m) => isSalvage(m.id)));
    const after = saveOf(rerolled);
    rerolled.start(after.seed, after);
    rerolled.chooseMod(salvage);
    assert.equal(rerolled.mode, 'upgrade');
    rerolled.chooseMod(rerolled.offers[0].id);
    assert.equal(rerolled.stage, stage + 1);
  }
});

test('Daily rewards remain one fixed card with no reroll, including boss rewards and Continue', () => {
  const seed = dailyForDate('2026-09-13')!.seed;
  for (const stage of [0, 1, 2, 3]) {
    const g = begin(seed, stage);
    if (stage === 3) g.earnedSalvage = 'ramjet';
    g.openReward();
    const original = ids(g);
    assert.equal(original.length, 1);
    assert(!g.canReroll);
    assert(!g.rerollReward());
    assert.equal(g.hp, 64);
    const save = saveOf(g);
    const continued = new Game();
    continued.start(seed, save);
    assert.deepEqual(ids(continued), original);
    assert(!continued.rerollReward());
    continued.chooseMod(original[0]);
    assert.equal(continued.mods.at(-1), original[0]);
    assert.equal(continued.hp, 76);
  }
});

test('Overtime saves the reroll; exhausted pools never charge for repeated or missing cards', () => {
  const initial = overtimeTestFromUrl(new URL('https://game.test/?test=overtime'))!;
  const g = new Game();
  g.start(initial.seed, initial);
  g.hp = 64;
  g.openReward();
  assert(g.rerollReward());
  const save = saveOf(g);
  const continued = new Game();
  continued.start(save.seed, save);
  continued.chooseMod(continued.offers[0].id);
  assert.equal(continued.overtime?.repairs, 0);
  assert.equal(continued.mods.length, initial.mods.length + 1);
  assert.equal(continued.hp, 64);
  const pool = new Game();
  pool.start('exhausted');
  pool.overtime = { baseMods: 19, repairs: 0 };
  let sawSmallPool = false;
  while (availableMods(pool.mods).length) {
    const legal = availableMods(pool.mods);
    if (legal.length < 6) {
      sawSmallPool = true;
      pool.openReward();
      const before = ids(pool),
        hp = pool.hp;
      assert(!pool.rerollReward());
      assert.deepEqual(ids(pool), before);
      assert.equal(pool.hp, hp);
      pool.setMode('playing');
    }
    pool.mods.push(legal[0].id);
    pool.gun = getGun(pool.mods);
  }
  assert(sawSmallPool);
  pool.openReward();
  assert.deepEqual(ids(pool), ['repair']);
  assert(!pool.rerollReward());
});

test('malformed or illegal reward snapshots cannot resume', () => {
  const g = begin();
  g.openReward();
  const valid = saveOf(g);
  for (const reward of [
    null,
    false,
    {},
    { ...valid.reward, rerolled: 'yes' },
    { ...valid.reward, offers: [] },
    { ...valid.reward, offers: ['missing'] },
    { ...valid.reward, offers: ['magnum', 'magnum'] },
    { ...valid.reward, offers: MODS.slice(0, 4).map((m) => m.id) },
    { ...valid.reward, offers: ['reprisal'] },
    { ...valid.reward, offers: ['repair'] },
    { ...valid.reward, offers: ['ramjet'] },
    { ...valid.reward, salvage: 'ramjet' },
    { ...valid.reward, enteringDetour: true },
    { ...valid.reward, enteringRoute: 'low' },
  ])
    assert.equal(loadCheckpoint({ ...valid, reward }), null);
  assert.equal(
    loadCheckpoint({
      ...valid,
      seed: dailyForDate('2026-09-13')!.seed,
      reward: { offers: ['magnum'], rerolled: true },
    }),
    null,
  );
  assert.equal(loadCheckpoint({ ...valid, stage: 19 }), null);
  assert.equal(loadCheckpoint({ ...valid, version: 4 }), null);
  assert(loadCheckpoint({ ...valid, reward: undefined }), 'existing entrance saves still work');
});

test('the direct reroll test opens a reward immediately and cannot touch saves or earned victories', () => {
  const save = rerollTestFromUrl(new URL('https://game.test/?test=reroll'))!;
  assert(loadCheckpoint(save));
  const g = new Game();
  let writes = 0,
    victories = 0;
  g.onCheckpoint = () => writes++;
  g.onBossDefeated = () => victories++;
  g.startTest(save);
  assert.equal(g.mode, 'upgrade');
  assert.equal(g.hp, 64);
  const original = ids(g);
  assert(g.rerollReward());
  g.chooseMod(g.offers[0].id);
  g.die();
  g.startTest(g.testRun!);
  assert.equal(g.mode, 'upgrade');
  assert.equal(g.hp, 64);
  assert.deepEqual(ids(g), original);
  assert(g.canReroll);
  assert.equal(writes, 0);
  assert.equal(victories, 0);
  for (const query of [
    '',
    '?test=rerolls',
    '?test=reroll&test=reroll',
    '?test=reroll&daily=2026-09-13',
    '?test=reroll&seed=run',
    '?test=reroll&build=precision',
  ])
    assert.equal(rerollTestFromUrl(new URL('https://game.test/' + query)), null);
});
