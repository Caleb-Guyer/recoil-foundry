import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { ADDED_LAYOUTS } from '../src/expanded-layouts.ts';
import { enemyHealth, ENEMY_STATS } from '../src/enemies.ts';
import {
  STAGES,
  bossStage,
  isDetourStage,
  loadCheckpoint,
  rewardMods,
  seeded,
  validBuild,
} from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';
import { expandedTestFromUrl, testCheckpoint } from '../src/practice.ts';

const base = 'https://caleb-guyer.github.io/recoil-foundry/';
const areas = ['docks', 'furnace', 'cooling', 'rooftops'];
function capture(g: Game) {
  let save: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    save = s;
  };
  g.save();
  return loadCheckpoint(save)!;
}

test('every added room combines familiar threats before the area boss, with one reward at each transition', () => {
  assert.equal(STAGES, 20);
  for (let index = 0; index < 120; index++) {
    for (let area = 0; area < 4; area++) {
      const stage = (area === 3 ? 4 : area) * 4 + 2,
        level = getLevel('expanded-' + index, stage);
      assert.equal(level.id, ADDED_LAYOUTS[area].id);
      assert.equal(level.area, areas[area]);
      assert.equal(level.spawns.length, [6, 9, 11, 12][area]);
      assert(new Set(level.spawns.map((s) => s.kind)).size >= 4);
      assert.equal(level.spawns.filter((s) => s.elite).length, area ? 1 : 0);
      assert(isDetourStage(stage));
      assert(!isDetourStage(stage - 1));
      assert.equal(bossStage(area === 3 ? 4 : area), stage + 1);
      assert(getLevel('expanded-' + index, stage + 1).boss);
    }
  }
});

test('every path retains three legal choices through twenty-three earned upgrades', () => {
  for (const root of ['deadeye', 'crossfire', 'shellshock']) {
    for (let seed = 0; seed < 120; seed++) {
      const mods = [root],
        rng = seeded(root + ':expanded:' + seed);
      while (mods.length < 23) {
        const offers = rewardMods(mods, 3, rng);
        assert.equal(offers.length, 3, `${root}: pick ${mods.length + 1}`);
        mods.push(offers[Math.floor(rng() * offers.length)].id);
        assert(validBuild(mods));
      }
    }
  }
});

test('boss durability scales with each area’s additional upgrade while ordinary opening enemies stay familiar', () => {
  assert.equal(enemyHealth('runner', 0), ENEMY_STATS.runner.hp);
  for (const [area, kind] of (['loader', 'press', 'turbine', 'interceptor'] as const).entries()) {
    assert.equal(
      enemyHealth(kind, bossStage(area === 3 ? 4 : area)),
      Math.ceil(ENEMY_STATS[kind].hp * [1.15, 1.3, 1.45, 1.95][area]),
    );
  }
  assert(enemyHealth('runner', 14) > enemyHealth('runner', 12));
});

test('all twelve legacy entrances preserve the same arena, health and gun through migration and future saves', () => {
  for (let stage = 0; stage < 12; stage++) {
    const old = { ...testCheckpoint('old-run', stage), version: 3 };
    old.hp = 63;
    old.elapsed = 72.5;
    old.kills = 29;
    const migrated = loadCheckpoint(old)!;
    assert(migrated);
    assert.equal(migrated.version, 5);
    assert.equal(
      migrated.stage,
      Math.floor(stage / 3) * 4 + (stage % 3 === 2 ? 3 : stage % 3) + (stage >= 9 ? 4 : 0),
    );
    assert.equal(migrated.missedUpgrades, migrated.stage - stage);
    assert.deepEqual(migrated.mods, old.mods);
    assert.equal(migrated.hp, old.hp);
    const g = new Game();
    g.start(migrated.seed, migrated);
    assert.equal(g.elapsed, old.elapsed);
    assert.equal(g.kills, old.kills);
    while (g.stage < STAGES - 1) {
      g.openReward();
      g.chooseMod(g.offers[0].id);
      assert(capture(g), `invalid resumed room ${g.stage}`);
    }
    g.clear = true;
    g.startEscape();
    const escape = capture(g);
    assert(escape?.escape);
    assert.equal(escape.mods.length, 19 - migrated.missedUpgrades!);
    const resumed = new Game();
    resumed.start(escape.seed, escape);
    assert(resumed.escape);
    assert.deepEqual(resumed.mods, g.mods);
  }
});

test('legacy detours retain their already-paid upgrade and rejoin the correct boss', () => {
  for (let area = 0; area < 4; area++) {
    const stage = area * 3 + 1;
    const old = { ...testCheckpoint('old-detour', stage + 1), version: 3, stage, detour: true };
    const migrated = loadCheckpoint(old)!;
    assert(migrated);
    assert.equal(migrated.stage, (area === 3 ? 4 : area) * 4 + 2);
    const g = new Game();
    g.start(migrated.seed, migrated);
    assert(g.detour);
    assert.equal(g.mods.length, stage + 1);
    g.enemies = [];
    g.waves.clear();
    g.clear = true;
    g.openReward();
    g.chooseMod(g.offers[0].id);
    assert.equal(g.stage, bossStage(area === 3 ? 4 : area));
    assert.deepEqual(g.detours, [area === 3 ? 4 : area]);
    assert.equal(g.mods.length, stage + 2);
    assert(capture(g));
  }
});

test('complete legacy escapes with optional rewards retain every earned upgrade', () => {
  for (const detours of [[], [0, 1, 2, 3]]) {
    const mods: string[] = [],
      rng = seeded('old-escape');
    while (mods.length < 11 + detours.length) mods.push(rewardMods(mods, 1, rng)[0].id);
    const old = {
      version: 3,
      seed: 'old-escape',
      stage: 11,
      hp: 67,
      kills: 80,
      elapsed: 455,
      mods,
      detours,
      escape: true,
    };
    const migrated = loadCheckpoint(old)!;
    assert(migrated);
    assert.equal(migrated.stage, 19);
    assert.equal(migrated.missedUpgrades, 8);
    assert.deepEqual(migrated.mods, mods);
    assert.deepEqual(loadCheckpoint(JSON.parse(JSON.stringify(migrated))), migrated);
  }
});

test('new-room links start in each added layout with a complete legal preset and reject ambiguous modes', () => {
  for (const [area, name] of areas.entries()) {
    const save = expandedTestFromUrl(new URL(`?test=expanded&area=${name}`, base))!;
    assert(save);
    assert.equal(save.stage, (area === 3 ? 4 : area) * 4 + 2);
    assert.equal(save.mods.length, save.stage);
    assert.equal(save.hp, 100);
    assert(validBuild(save.mods));
    assert(loadCheckpoint(save));
    assert.equal(getLevel(save.seed, save.stage).id, ADDED_LAYOUTS[area].id);
  }
  assert.equal(expandedTestFromUrl(new URL('?test=expanded', base))!.stage, 2);
  for (const query of [
    '',
    '?test=expanded&test=expanded',
    '?test=expanded&area=moon',
    '?test=expanded&area=',
    '?test=expanded&area=docks&area=rooftops',
    '?test=expanded&daily=2026-09-07',
    '?test=expanded&dv=24',
    '?test=expanded&seed=other',
  ])
    assert.equal(expandedTestFromUrl(new URL(query, base)), null, query);
});

test('a new-room test can advance, die and retry without overwriting a run or earning Practice victories', () => {
  const g = new Game(),
    saved: (Checkpoint | null)[] = [],
    wins: string[] = [];
  g.onCheckpoint = (s) => saved.push(s);
  g.onBossDefeated = (kind) => wins.push(kind);
  g.start('ordinary');
  const before = structuredClone(saved),
    save = expandedTestFromUrl(new URL('?test=expanded', base))!;
  g.startTest(save);
  g.mods.push('leech');
  assert.equal(g.testRun!.mods.length, 2, 'Retry preset shared mutable state');
  g.startTest(g.testRun!);
  assert.equal(g.mods.length, 2);
  g.openReward();
  g.chooseMod(g.offers[0].id);
  assert.equal(g.stage, 3);
  const boss = g.enemies[0];
  boss.spawn = 0;
  g.hitEnemy(boss, 999999);
  assert.deepEqual(wins, []);
  g.damagePlayer(999999);
  assert.equal(g.mode, 'dead');
  assert.deepEqual(saved, before);
  g.startTest(g.testRun!);
  assert.equal(g.hp, 100);
  assert.equal(g.stage, 2);
  const final = testCheckpoint('test-escape', 19);
  g.startTest(final);
  g.clear = true;
  g.startEscape();
  assert(g.escape);
  g.updateExtraction(3);
  assert.equal(g.mode, 'won');
  assert.deepEqual(saved, before);
  g.start('ordinary-again');
  assert.equal(g.testRun, null);
  assert.equal(saved.at(-1)!.seed, 'ordinary-again');
});
