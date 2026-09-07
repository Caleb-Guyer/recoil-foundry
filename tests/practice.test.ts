import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import {
  PRACTICE_BOSSES,
  loadEncounters,
  visibleEncounter,
  practiceCheckpoint,
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
      level = getLevel(seed, PRACTICE_BOSSES[kind].stage);
    if (level.spawns[0].kind === kind && level.mirrored === mirrored) return { kind, seed };
  }
  assert.fail('No fixture for ' + kind);
}

test('discovery storage accepts only actual encounters and preserves first discovery order', () => {
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

test('a boss must actually appear on the live camera before it becomes available', () => {
  const g = new Game(),
    entry = record('kiln'),
    save = practiceCheckpoint(entry)!;
  g.start(entry.seed, save);
  const e = g.enemies[0],
    p = e.body.position,
    seen = { x: p.x - 100, y: p.y - 100, w: 200, h: 200 },
    unseen = { x: 0, y: 0, w: 500, h: 800 };
  assert.equal(visibleEncounter(g, seen, []), null, 'The spawn warning revealed a boss');
  e.spawn = 0;
  assert.equal(visibleEncounter(g, unseen, []), null, 'Room entry revealed an offscreen boss');
  for (const mode of ['title', 'paused', 'dead', 'won'] as const) {
    g.setMode(mode);
    assert.equal(visibleEncounter(g, seen, []), null);
  }
  g.setMode('playing');
  assert.deepEqual(visibleEncounter(g, seen, []), entry);
  assert.equal(visibleEncounter(g, seen, [entry]), null);
  e.hp = 0;
  assert.equal(visibleEncounter(g, seen, []), null);
  g.startPractice(entry);
  g.enemies[0].spawn = 0;
  assert.equal(visibleEncounter(g, seen, []), null, 'Practice revealed an encounter');
  g.start('normal');
  assert.equal(visibleEncounter(g, { x: 0, y: 0, w: 2000, h: 840 }, []), null);
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
      assert.deepEqual(g.level, getLevel(entry.seed, g.stage));
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
  assert.equal(g.stage, 5);
  assert.deepEqual(g.mods, mods);
  assert.deepEqual(g.offers, []);
  assert.equal(g.escape, null);
});

test('rooftop practice ends at the boss instead of starting the escape route', () => {
  const g = new Game();
  g.startPractice(record('boss'));
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 99999);
  step(g, 20);
  assert.equal(g.mode, 'won');
  assert.equal(g.escape, null);
  assert.equal(g.mods.length, 8);
  g.startEscape();
  assert.equal(g.escape, null);
});

test('a Daily encounter can be practised without touching its checkpoint, and Continue restores the real run', () => {
  const g = new Game(),
    day = dailyForDate('2026-09-07')!,
    dailySave: Checkpoint = {
      version: 3,
      seed: day.seed,
      stage: 5,
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
  g.enemies[0].spawn = 0;
  assert.deepEqual(visibleEncounter(g, { x: 0, y: 0, w: 2000, h: 840 }, []), entry);
  g.startPractice(entry);
  g.die();
  g.startPractice(entry);
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 99999);
  step(g, 20);
  assert.equal(calls, 1);
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
