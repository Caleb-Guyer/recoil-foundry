import test from 'node:test';
import assert from 'node:assert/strict';
import { switchboardLevel } from '../src/switchboard-layout.ts';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { getGun, loadCheckpoint, MODS, availableMods, validBuild } from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import {
  PRACTICE_BOSSES,
  loadEncounters,
  VICTORIES_KEY,
  practiceCheckpoint,
  testEncounterFromUrl,
  canPractice,
  practiceBuild,
} from '../src/practice.ts';
import type { Encounter, PracticeBoss } from '../src/practice.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 500 },
};
function step(g: Game, n = 1) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, idle);
}
function record(kind: PracticeBoss, mirrored = false): Encounter {
  for (let i = 0; i < 100; i++) {
    const seed = 'practice-check-' + i,
      level =
        kind === 'switchboard'
          ? switchboardLevel(seed)
          : getLevel(seed, PRACTICE_BOSSES[kind].stage);
    if (level.spawns[0].kind === kind && level.mirrored === mirrored) return { kind, seed };
  }
  assert.fail('No fixture for ' + kind);
}

test('custom practice requires the exact earned victory; test access does not become an unlock', () => {
  const earned = record('loader'),
    unseen = record('kiln');
  assert(canPractice(earned, [earned]));
  assert(!canPractice(unseen, [earned]));
  assert(!canPractice({ ...earned, seed: 'different' }, [earned]));
  assert(canPractice(unseen, [earned], unseen));
  assert(!canPractice(unseen, [earned]), 'custom builds use victories without the test exception');
  assert.deepEqual(loadEncounters([{ ...earned, build: ['magnum'] }]), [earned]);
});

test('custom practice filters undiscovered, incompatible and dependent upgrades before applying its cap', () => {
  const all = MODS.map((mod) => mod.id);
  assert.deepEqual(practiceBuild('loader', ['unknown', 'fold', 'rewire', 'light', 'magnum'], all), [
    'fold',
    'rewire',
    'light',
  ]);
  assert.deepEqual(practiceBuild('loader', ['fold', 'rewire', 'light'], ['rewire', 'light']), [
    'light',
  ]);
  assert.deepEqual(
    practiceBuild(
      'kiln',
      ['cutting-torch', 'burst', 'pulse-chamber', 'charge-lens', 'magnum', 'magnum'],
      all,
    ),
    ['cutting-torch', 'burst', 'pulse-chamber', 'magnum'],
  );
  assert.deepEqual(practiceBuild('kiln', ['rewire', 'light'], all), ['light']);
  assert.deepEqual(practiceBuild('kiln', all, []), []);
});

test('all bosses accept legal custom guns within their normal upgrade budget in both arena orientations', () => {
  const all = MODS.map((mod) => mod.id),
    build: string[] = [];
  while (build.length < 20) build.push(availableMods(build, true)[0].id);
  for (const kind of Object.keys(PRACTICE_BOSSES) as PracticeBoss[])
    for (const mirrored of [false, true]) {
      const g = new Game(),
        entry = record(kind, mirrored),
        limit = PRACTICE_BOSSES[kind].stage;
      assert(g.startPractice(entry, build, all));
      assert.deepEqual(g.mods, build.slice(0, limit));
      assert(validBuild(g.mods));
      assert.deepEqual(g.gun, getGun(g.mods));
      assert.deepEqual(g.practice?.build, g.mods);
      assert.notEqual(g.practice?.build, g.mods);
      assert.equal(g.hp, 100);
      assert.equal(g.enemies[0].kind, kind);
      assert.equal(g.level.mirrored, mirrored);
      assert(!g.workshop.active && !g.testRun);
      if (kind === 'switchboard') assert.equal(g.region, 'annex');
    }
  assert.equal(build.length, 20, 'caller-owned build is not shortened');
});

test('custom retries preserve the gun, reset the fight and cannot write progress or award discoveries', () => {
  const all = MODS.map((mod) => mod.id);
  for (const mods of [[], ['cutting-torch', 'burst', 'light'], ['fold', 'rewire', 'kick']]) {
    const g = new Game(),
      writes: unknown[] = [],
      awards: string[] = [],
      entry = record('kiln');
    g.onCheckpoint = (value) => writes.push(structuredClone(value));
    g.onBossDefeated = (kind) => awards.push(kind);
    g.onEnemyDefeated = (kind) => awards.push(kind);
    g.onCommendation = (id) => awards.push(id);
    g.start('custom-practice-save');
    const saved = structuredClone(writes[0]) as Checkpoint;
    g.startPractice(entry, mods, all);
    step(g, 45);
    g.fire();
    g.die();
    assert.equal(g.mode, 'dead');
    const previousPlayer = g.player;
    assert(g.startPractice(g.practice!, g.practice!.build ?? null, all));
    assert.notEqual(g.player, previousPlayer);
    assert.deepEqual(g.mods, mods);
    assert.equal(g.elapsed, 0);
    assert.equal(g.hp, 100);
    assert.equal(g.shots.length, 0);
    assert.equal(g.burstRemaining, 0);
    assert(g.portals.pair.every((portal) => !portal));
    g.enemies[0].spawn = 0;
    g.hitEnemy(g.enemies[0], 999999);
    step(g, 20);
    assert.equal(g.mode, 'won');
    g.save();
    g.openReward();
    g.chooseMod('magnum');
    g.startEscape();
    g.startOvertime();
    assert.deepEqual(g.mods, mods);
    assert.deepEqual(awards, []);
    assert.deepEqual(writes, [saved]);
    g.startPractice(entry);
    assert.equal(g.practice?.build, undefined, 'Preset clears the custom selection');
    assert.equal(g.mods.length, 7);
    g.start(saved.seed, saved);
    assert.equal(g.practice, null);
    assert.deepEqual(g.mods, saved.mods);
  }
});

test('the explicit Turbine test link selects its real boss and never overrides Daily or seeded links', () => {
  const base = 'https://caleb-guyer.github.io/recoil-foundry/';
  const entry = testEncounterFromUrl(new URL('?test=turbine', base));
  assert(entry);
  assert.equal(entry.kind, 'turbine');
  assert.equal(getLevel(entry.seed, 11).spawns[0].kind, 'turbine');
  assert.equal(practiceCheckpoint(entry)!.mods.length, 11);
  for (const query of [
    '',
    '?test=',
    '?test=constructor',
    '?test=unknown-boss',
    '?test=turbine&test=turbine',
    '?test=turbine&daily=2026-09-07',
    '?test=turbine&dv=22',
    '?test=turbine&seed=anything',
  ])
    assert.equal(testEncounterFromUrl(new URL(query, base)), null, query);
});

test('a direct Turbine test can lose, retry and win without a victory record or changing a saved run', () => {
  const entry = testEncounterFromUrl(new URL('https://example.com/?test=turbine'))!;
  const g = new Game(),
    writes: (Checkpoint | null)[] = [],
    victories: string[] = [];
  g.onCheckpoint = (value) => writes.push(value);
  g.onBossDefeated = (kind) => victories.push(kind);
  g.start('saved-before-test');
  const saved = structuredClone(writes[0])!;
  assert(g.startPractice(entry));
  assert.equal(g.stage, 11);
  assert.equal(g.hp, 100);
  assert.equal(g.mods.length, 11);
  g.die();
  assert.equal(g.mode, 'dead');
  assert(g.startPractice(g.practice!));
  assert.equal(g.hp, 100);
  assert.equal(g.elapsed, 0);
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 999999);
  step(g, 20);
  assert.equal(g.mode, 'won');
  g.save();
  assert.deepEqual(writes, [saved]);
  assert.deepEqual(victories, []);
  g.start(saved.seed, saved);
  assert.equal(g.practice, null);
  assert.equal(g.stage, saved.stage);
  assert.deepEqual(g.mods, saved.mods);
});

test('victory storage validates boss arenas and uses a separate key from old encounter-only unlocks', () => {
  assert.notEqual(VICTORIES_KEY, 'rf-encounters-v1');
  const kiln = record('kiln'),
    loader = record('loader');
  for (const raw of [null, {}, 'kiln', 3]) assert.deepEqual(loadEncounters(raw), []);
  const loaded = loadEncounters([
    null,
    {},
    { kind: 'constructor', seed: 'A' },
    { kind: ['kiln'], seed: kiln.seed },
    { kind: 'kiln', seed: 3 },
    { kind: 'kiln', seed: '' },
    { kind: 'kiln', seed: 'x'.repeat(41) },
    { kind: 'kiln', seed: record('press').seed },
    kiln,
    loader,
    kiln,
    { kind: 'future-boss', seed: 'A' },
  ]);
  assert.deepEqual(loaded, [kiln, loader]);
  assert.notEqual(loaded[0], kiln);
  assert.equal(practiceCheckpoint({ kind: 'kiln', seed: record('press').seed }), null);
});

test('seeing or damaging a boss never unlocks it; a normal-run defeat emits exactly one victory', () => {
  const g = new Game(),
    entry = record('kiln'),
    save = practiceCheckpoint(entry)!,
    victories: string[] = [];
  g.onBossDefeated = (kind) => victories.push(kind);
  g.start(entry.seed, save);
  const e = g.enemies[0];
  step(g, 60);
  assert.deepEqual(victories, []);
  e.spawn = 0;
  g.hitEnemy(e, 100);
  assert(e.hp > 0);
  assert.deepEqual(victories, []);
  g.hitEnemy(e, 99999);
  assert.deepEqual(victories, ['kiln']);
  g.hitEnemy(e, 99999);
  step(g, 30);
  assert.deepEqual(victories, ['kiln']);
});

test('practice wins, player deaths, and inactive or spawning bosses cannot grant victory unlocks', () => {
  for (const scenario of ['practice', 'loss', 'title', 'paused', 'dead', 'won', 'spawn'] as const) {
    const g = new Game(),
      entry = record('kiln'),
      victories: string[] = [];
    g.onBossDefeated = (kind) => victories.push(kind);
    if (scenario === 'practice') g.startPractice(entry);
    else g.start(entry.seed, practiceCheckpoint(entry)!);
    const e = g.enemies[0];
    if (scenario !== 'spawn') e.spawn = 0;
    if (scenario === 'loss') g.damagePlayer(999);
    else if (['title', 'paused', 'dead', 'won'].includes(scenario))
      g.setMode(scenario as 'title' | 'paused' | 'dead' | 'won');
    g.hitEnemy(e, 99999);
    step(g, 20);
    assert.deepEqual(victories, [], scenario);
  }
});

test('all normal boss defeats unlock practice, but ordinary enemy kills do not', () => {
  const g = new Game(),
    victories: string[] = [];
  g.onBossDefeated = (kind) => victories.push(kind);
  g.start('A');
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 99999);
  assert.deepEqual(victories, []);
  for (const kind of Object.keys(PRACTICE_BOSSES) as PracticeBoss[]) {
    const entry = record(kind);
    g.start(entry.seed, practiceCheckpoint(entry)!);
    g.enemies[0].spawn = 0;
    g.hitEnemy(g.enemies[0], 99999);
    assert.equal(victories.at(-1), kind);
  }
  assert.equal(victories.length, Object.keys(PRACTICE_BOSSES).length);
});

test('every practice boss keeps its discovered arena and gets the right number of real upgrades', () => {
  for (const kind of Object.keys(PRACTICE_BOSSES) as PracticeBoss[])
    for (const mirror of [false, true]) {
      const entry = record(kind, mirror),
        g = new Game(),
        saved: unknown[] = [];
      g.onCheckpoint = (value) => saved.push(value);
      assert(g.startPractice(entry));
      assert.equal(g.mode, 'playing');
      assert.equal(g.hp, 100);
      assert.equal(g.mods.length, PRACTICE_BOSSES[kind].stage);
      assert.equal(new Set(g.mods).size, g.mods.length);
      assert.deepEqual(g.gun, getGun(g.mods));
      assert.equal(g.enemies.length, 1);
      assert.equal(g.enemies[0].kind, kind);
      assert.equal(g.enemies[0].hp, g.enemies[0].maxHp);
      assert.deepEqual(
        g.level,
        kind === 'switchboard' ? switchboardLevel(entry.seed) : getLevel(entry.seed, g.stage),
      );
      assert.equal(g.level.mirrored, mirror);
      assert.equal(g.elapsed, 0);
      assert.equal(g.kills, 0);
      assert.equal(g.escape, null);
      assert.deepEqual(saved, []);
      assert(loadCheckpoint(practiceCheckpoint(entry)));
    }
});

test('practice death, retry, save, and victory cannot write or erase the normal checkpoint', () => {
  const g = new Game(),
    writes: (Checkpoint | null)[] = [],
    entry = record('kiln');
  g.onCheckpoint = (value) => writes.push(value);
  g.start('saved-run');
  const saved = structuredClone(writes[0]);
  g.startPractice(entry);
  step(g, 20);
  g.fire();
  const oldBody = g.player,
    mods = [...g.mods];
  g.damagePlayer(999);
  assert.equal(g.mode, 'dead');
  g.save();
  assert.deepEqual(writes, [saved]);
  assert(g.startPractice(entry));
  assert.notEqual(g.player, oldBody);
  assert.equal(g.hp, 100);
  assert.equal(g.elapsed, 0);
  assert.equal(g.shotCount, 0);
  assert.equal(g.shots.length, 0);
  assert.equal(g.burstRemaining, 0);
  assert.equal(g.enemies[0].kiln!.patches.length, 0);
  assert.deepEqual(g.mods, mods);
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 99999);
  step(g, 20);
  assert.equal(g.mode, 'won');
  assert.deepEqual(writes, [saved]);
  assert.equal(g.kills, 1);
  const elapsed = g.elapsed;
  step(g, 90);
  assert.equal(g.elapsed, elapsed);
  g.openReward();
  g.chooseMod('split');
  g.startEscape();
  assert.equal(g.stage, 7);
  assert.deepEqual(g.mods, mods);
  assert.deepEqual(g.offers, []);
  assert.equal(g.escape, null);
});

test('earned Reclaimer practice moves to Reclamation and ends without an escape route', () => {
  const g = new Game();
  g.startPractice(record('boss'));
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 99999);
  step(g, 20);
  assert.equal(g.mode, 'won');
  assert.equal(g.escape, null);
  assert.equal(g.mods.length, 15);
  assert.equal(g.stage, 15);
  assert.equal(g.level.area, 'reclamation');
  g.startEscape();
  assert.equal(g.escape, null);
});

test('a Daily encounter can be practised without touching its checkpoint, and Continue restores the real run', () => {
  const g = new Game(),
    day = dailyForDate('2026-09-07')!,
    dailySave: Checkpoint = {
      version: 5,
      seed: day.seed,
      stage: 7,
      hp: 47,
      mods: ['rapid', 'scatter', 'magnum', 'kick', 'pierce'],
      elapsed: 129.25,
      kills: 22,
    };
  let stored: Checkpoint | null = null,
    calls = 0;
  g.onCheckpoint = (value) => {
    stored = value;
    calls++;
  };
  g.start(day.seed, dailySave);
  const original = structuredClone(stored),
    entry: Encounter = { seed: day.seed, kind: g.enemies[0].kind as PracticeBoss };
  const victories: string[] = [];
  g.onBossDefeated = (kind) => victories.push(kind);
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 99999);
  assert.deepEqual(victories, [entry.kind]);
  g.startPractice(entry);
  g.die();
  g.startPractice(entry);
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 99999);
  step(g, 20);
  assert.equal(calls, 1);
  assert.deepEqual(victories, [entry.kind], 'Practice must not add victory unlocks');
  assert.deepEqual(stored, original);
  g.start(dailySave.seed, dailySave);
  assert.equal(g.practice, null);
  assert.equal(g.hp, 47);
  assert.equal(g.elapsed, 129.25);
  assert.deepEqual(g.mods, dailySave.mods);
  assert.equal(calls, 2);
  g.die();
  assert.equal(stored, null, 'A real run must still clear its checkpoint on death');
});

test('invalid practice requests leave the active game and saved run untouched', () => {
  const g = new Game(),
    saved: unknown[] = [];
  g.onCheckpoint = (value) => saved.push(value);
  g.start('A');
  const player = g.player,
    seed = g.seed;
  assert.equal(g.startPractice({ kind: 'kiln', seed: record('press').seed }), false);
  assert.equal(g.player, player);
  assert.equal(g.seed, seed);
  assert.equal(g.practice, null);
  assert.equal(saved.length, 1);
});
