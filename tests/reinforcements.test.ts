import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import type { Spawn } from '../src/levels.ts';
import { REINFORCEMENT_TELL, reinforcementDeadline } from '../src/reinforcements.ts';
import { dailyForDate } from '../src/daily.ts';
import { loadCheckpoint, MODS } from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';
import { musicScene } from '../src/music-score.ts';

const { Body, Composite, Query } = Matter;
const DT = 1 / 60;
function step(g: Game, count = 1, override: Partial<Input> = {}) {
  for (let i = 0; i < count; i++)
    g.tick(DT, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1600, y: 600 },
      ...override,
    });
}
function until(g: Game, predicate: () => boolean, limit = 300) {
  for (let i = 0; i < limit && !predicate(); i++) step(g);
  assert(predicate(), `Timed out in wave ${g.waves.phase}`);
}
const spawnKey = (spawn: Spawn) => `${spawn.kind}:${spawn.elite ?? ''}:${spawn.x}:${spawn.y}`;
const activeRoster = (g: Game) =>
  g.enemies.map((e) => ({
    kind: e.kind,
    elite: e.elite,
    x: e.body.position.x,
    y: e.body.position.y,
  }));
const pendingRoster = (g: Game) => g.waves.doors.map((door) => ({ ...door.spawn }));

function room(stage = 0, seed = 'reinforcements') {
  const g = new Game();
  g.start(seed, {
    version: 5,
    seed,
    stage,
    hp: 100,
    mods: MODS.slice(0, stage).map((m) => m.id),
    kills: 0,
    elapsed: 0,
  });
  return g;
}
function fixture(count = 3, stage = 0) {
  const g = room();
  g.stage = stage;
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const body of g.terrain.slice(4)) Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  g.hazards.clear();
  g.breaches.clear();
  const spawns: Spawn[] = Array.from({ length: count }, (_, i) => ({
    kind: i < 3 ? 'runner' : 'shooter',
    x: 550 + i * 140,
    y: 724,
  }));
  g.level = { ...g.level, solids: [], spawns, boss: false };
  for (const spawn of g.waves.reset(g.level))
    g.spawnEnemy(spawn.kind, spawn.x, spawn.y, spawn.elite);
  for (const e of g.enemies) e.timer = 100;
  Body.setPosition(g.player, { x: 140, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  return g;
}
function defeatOpening(g: Game) {
  for (const e of [...g.enemies]) g.hitEnemy(e, 99999);
  until(g, () => g.waves.phase === 'warning');
}

test('ordinary rooms split their exact authored roster into two groups without consuming placement randomness', () => {
  for (let i = 0; i < 25; i++)
    for (const stage of [0, 1, 4, 5, 8, 9]) {
      const g = room(stage, `wave-roster-${i}`),
        opening = activeRoster(g),
        final = pendingRoster(g),
        expected = g.level.spawns.map(spawnKey).sort();
      assert((g.level.freight ? opening.length === 0 : opening.length > 0) && final.length > 0);
      assert(final.length >= opening.length);
      assert.equal(g.waves.phase, 'opening');
      assert(g.waves.pending);
      assert(g.waves.doors.every((door) => door.state === 'sealed'));
      assert.deepEqual([...opening, ...final].map(spawnKey).sort(), expected);
      assert.equal(new Set([...opening, ...final].map(spawnKey)).size, expected.length);
      for (const category of [
        (spawn: Spawn) => !!spawn.elite,
        (spawn: Spawn) => spawn.kind === 'flyer',
        (spawn: Spawn) => ['runner', 'charger', 'hopper'].includes(spawn.kind),
      ])
        if (g.level.spawns.some(category)) assert(final.some(category));
      for (let j = 0; j < 100; j++) g.rng();
      const combatRandom = g.rng;
      g.rng = () => {
        throw new Error('Planning waves consumed combat randomness');
      };
      const replayed = g.waves.reset(g.level);
      g.rng = combatRandom;
      assert.deepEqual(replayed.map(spawnKey), opening.map(spawnKey));
      assert.deepEqual(pendingRoster(g).map(spawnKey), final.map(spawnKey));
    }
});

test('larger opening groups overlap while the first room preserves its small introduction', () => {
  for (const stage of [0, 4]) {
    const g = fixture(6, stage);
    assert.equal(g.enemies.length, stage === 0 ? 2 : 3);
    step(g, 10);
    assert.equal(g.waves.phase, 'opening');
    g.hitEnemy(g.enemies[0], 99999);
    if (stage === 0) {
      step(g, 10);
      assert.equal(g.waves.phase, 'opening');
      g.hitEnemy(g.enemies[0], 99999);
    }
    until(g, () => g.waves.phase === 'warning');
    assert.equal(g.enemies.length, stage === 0 ? 0 : 2);
    assert(
      g.waves.doors.every((door) => door.state === 'warning' && door.timer === REINFORCEMENT_TELL),
    );
  }
});

test('stalling an intact opening calls one finite wave after an area-specific deadline and full warning', () => {
  for (const stage of [0, 1, 4, 8, 12, 16]) {
    const g = fixture(6, stage),
      opening = g.enemies.length;
    const deadline = reinforcementDeadline(stage);
    for (let n = 0; n < Math.round(deadline * 60) - 1; n++) g.waves.update(DT);
    assert.equal(g.waves.phase, 'opening');
    assert.equal(g.enemies.length, opening);
    for (let n = 0; n < 2 && g.waves.phase === 'opening'; n++) g.waves.update(DT);
    assert.equal(g.waves.phase, 'warning');
    assert(g.waves.doors.every((d) => d.timer === REINFORCEMENT_TELL));
    for (let n = 0; n < 44; n++) g.waves.update(DT);
    assert.equal(g.enemies.length, opening);
    for (let n = 0; n < 120; n++) g.waves.update(DT);
    assert.equal(g.enemies.length, 6);
    assert.equal(g.waves.phase, 'final');
    g.waves.reset(g.level);
    assert.equal(g.waves.openingTime, 0);
    assert(g.waves.doors.every((d) => d.state === 'sealed'));
  }
});

test('the stall deadline uses combat time and freezes on pause and hit stop', () => {
  const g = fixture(6, 16);
  g.waves.update(2);
  g.setMode('paused');
  step(g, 600);
  assert.equal(g.waves.openingTime, 2);
  assert.equal(g.waves.phase, 'opening');
  g.setMode('playing');
  g.hitStop = 0.1;
  step(g, 4);
  assert.equal(g.waves.openingTime, 2);
  g.hitStop = 0;
  step(g);
  assert(g.waves.openingTime > 2);
  g.waves.clear();
  assert.equal(g.waves.openingTime, 0);
});

test('a fast opening clear gives the full warning and cannot clear, heal, or open the exit before the final group', () => {
  const g = fixture(),
    finalCount = g.waves.doors.length,
    sounds: string[] = [];
  g.hp = 50;
  g.onSound = (sound) => sounds.push(sound);
  Body.setPosition(g.player, { x: 1910, y: 722 });
  defeatOpening(g);
  const warningAt = g.time;
  assert(!g.clear);
  assert.equal(musicScene(g).clear, false);
  assert.equal(g.mode, 'playing');
  assert.equal(g.offers.length, 0);
  assert.equal(g.hp, 50);
  step(g, Math.floor(REINFORCEMENT_TELL * 60) - 1);
  assert.equal(g.enemies.length, 0);
  assert(!g.clear && g.waves.pending);
  assert.equal(sounds.filter((sound) => sound === 'reinforce').length, 1);
  until(g, () => g.enemies.length > 0);
  assert(g.time - warningAt >= REINFORCEMENT_TELL - 1e-8);
  assert.equal(g.enemies.length, finalCount);
  assert.equal(g.mode, 'playing');
  assert(!g.clear);
  assert.equal(g.hp, 50);
  for (const e of [...g.enemies]) g.hitEnemy(e, 99999);
  until(g, () => g.mode === 'upgrade');
  assert.equal(g.kills, g.level.spawns.length);
  assert.equal(g.hp, 50);
  assert.equal(sounds.filter((sound) => sound === 'clear').length, 1);
  g.chooseMod(g.offers[0].id);
  assert.equal(g.hp, 62);
  assert.equal(g.stage, 1);
  assert.equal(g.mods.length, 1);
});

test('the final roster materializes once and every door retires after its single spawn', () => {
  const g = fixture(6),
    expected = pendingRoster(g).map(spawnKey).sort(),
    actual: Spawn[] = [];
  const spawnEnemy = g.spawnEnemy.bind(g);
  g.spawnEnemy = (...args) => {
    const [kind, x, y, elite] = args;
    actual.push({ kind, x, y, elite });
    spawnEnemy(...args);
  };
  defeatOpening(g);
  until(g, () => actual.length === expected.length);
  assert.deepEqual(actual.map(spawnKey).sort(), expected);
  until(g, () => g.waves.doors.every((door) => door.state === 'spent'));
  step(g, 90);
  assert.equal(actual.length, expected.length);
});

test('a warned doorway waits for an overlapping player instead of spawning inside them', () => {
  const g = fixture(),
    door = g.waves.doors[0];
  Body.setPosition(g.player, { x: door.spawn.x, y: door.spawn.y - 2 });
  defeatOpening(g);
  step(g, Math.ceil(REINFORCEMENT_TELL * 60) + 10);
  assert.equal(door.state, 'warning');
  assert.equal(
    Query.collides(
      g.player,
      g.enemies.map((e) => e.body),
    ).length,
    0,
  );
  assert(g.waves.pending && !g.clear);
  assert.equal(g.hp, 100);
  Body.setPosition(g.player, { x: 140, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  until(g, () => door.state === 'open' || door.state === 'spent');
  assert(
    Query.collides(
      g.player,
      g.enemies.map((e) => e.body),
    ).length === 0,
  );
  assert.equal(g.hp, 100);
});

test('solid props block materialization until their hull leaves the warned doorway', () => {
  const g = fixture(),
    door = g.waves.doors[0],
    crate = g.props.spawn('crate', door.spawn.x, door.spawn.y - 6);
  Body.setStatic(crate.body, true);
  defeatOpening(g);
  step(g, Math.ceil(REINFORCEMENT_TELL * 60) + 10);
  assert.equal(door.state, 'warning');
  assert.equal(
    Query.collides(
      crate.body,
      g.enemies.map((e) => e.body),
    ).length,
    0,
  );
  assert(g.waves.pending && !g.clear);
  g.props.remove(crate);
  until(g, () => door.state === 'open' || door.state === 'spent');
  assert(
    Query.collides(
      g.enemies.find((e) => e.body.position.x === door.spawn.x)!.body,
      g.solidBodies,
    ).every((hit) => hit.depth < 0.1),
  );
});

test('a persistently blocked doorway relocates to a safe authored anchor with a fresh complete warning', () => {
  const g = fixture(6),
    door = g.waves.doors.at(-1)!,
    original = { ...door.spawn },
    sounds: string[] = [];
  g.onSound = (sound) => sounds.push(sound);
  Body.setPosition(g.player, { x: original.x, y: original.y - 2 });
  defeatOpening(g);
  until(g, () => spawnKey(door.spawn) !== spawnKey(original));
  assert(g.level.spawns.some((s) => s.x === door.spawn.x && s.y === door.spawn.y));
  assert.equal(door.state, 'warning');
  assert.equal(door.timer, REINFORCEMENT_TELL);
  const warnedAt = g.time;
  assert(g.waves.canEnter(door.spawn));
  step(g, Math.floor(REINFORCEMENT_TELL * 60) - 1);
  assert.equal(door.state, 'warning');
  until(g, () => door.state === 'open');
  assert(g.time - warnedAt >= REINFORCEMENT_TELL - 1e-8);
  assert.equal(
    Query.collides(
      g.player,
      g.enemies.map((e) => e.body),
    ).length,
    0,
  );
  assert(sounds.filter((sound) => sound === 'reinforce').length >= 2);
});

test('a blocked sole flying anchor waits safely and completes when cleared instead of vanishing or spawning in cover', () => {
  const g = fixture(),
    original = g.level.spawns.at(-1)!;
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  original.kind = 'flyer';
  original.y = 400;
  for (const spawn of g.waves.reset(g.level))
    g.spawnEnemy(spawn.kind, spawn.x, spawn.y, spawn.elite);
  const door = g.waves.doors.find((d) => d.spawn.kind === 'flyer')!,
    point = { ...door.spawn },
    crate = g.props.spawn('crate', point.x, point.y);
  Body.setStatic(crate.body, true);
  defeatOpening(g);
  step(g, 120);
  assert.equal(door.state, 'warning');
  assert.deepEqual(door.spawn, point);
  assert(g.waves.pending && !g.clear);
  assert(!g.enemies.some((e) => e.kind === 'flyer'));
  g.props.remove(crate);
  until(g, () => door.state === 'open');
  assert.equal(g.enemies.filter((e) => e.kind === 'flyer').length, 1);
});

test('deferred attack timers are independent of combat RNG and emergence preserves the normal grace period', () => {
  const games = [fixture(6), fixture(6)];
  for (let i = 0; i < 200; i++) games[0].rng();
  const records = games.map((g) => {
    const spawned: { key: string; timer: number; appearance: number }[] = [],
      spawnEnemy = g.spawnEnemy.bind(g);
    g.spawnEnemy = (...args) => {
      spawnEnemy(...args);
      const e = g.enemies.at(-1)!;
      spawned.push({
        key: spawnKey({ kind: e.kind, elite: e.elite, x: args[1], y: args[2] }),
        timer: e.timer,
        appearance: e.spawn,
      });
    };
    defeatOpening(g);
    until(g, () => g.waves.phase === 'final');
    assert(spawned.every((record) => record.appearance >= 0.65));
    return spawned;
  });
  assert.deepEqual(records[0], records[1]);
  const g = games[0],
    target = g.enemies.find((e) => e.kind === 'shooter')!,
    timer = target.timer,
    hp = target.hp;
  const fireAcross = () => {
    g.addShot({
      pos: { x: target.body.position.x - 50, y: target.body.position.y },
      vel: { x: 100, y: 0 },
      damage: 24,
      life: 1,
      friendly: true,
      radius: 2,
      bounces: 0,
      pierce: 0,
      fragment: false,
      split: true,
    });
    g.updateShots(DT);
  };
  fireAcross();
  assert.equal(target.hp, hp);
  step(g, 20);
  assert(target.spawn > 0);
  assert.equal(target.timer, timer);
  assert.equal(g.shots.filter((s) => !s.friendly).length, 0);
  until(g, () => target.spawn === 0);
  fireAcross();
  assert.equal(target.hp, hp - 24);
});

test('pause, hit stop, death, and room reset cannot advance or retain a queued warning', () => {
  for (const mode of ['paused', 'dead'] as const) {
    const g = fixture();
    defeatOpening(g);
    step(g, 8);
    const saved = structuredClone(g.waves.doors);
    g.setMode(mode);
    step(g, 120);
    assert.deepEqual(g.waves.doors, saved);
    assert.equal(g.enemies.length, 0);
    g.start(g.seed);
    assert.equal(g.waves.phase, 'opening');
    assert(g.waves.doors.every((door) => door.state === 'sealed'));
  }
  const g = fixture();
  defeatOpening(g);
  const timer = g.waves.doors[0].timer;
  g.hitStop = 0.1;
  step(g, 4);
  assert.equal(g.waves.doors[0].timer, timer);
  g.waves.clear();
  assert.equal(g.waves.phase, 'done');
  assert.equal(g.waves.pending, false);
  assert.equal(g.waves.doors.length, 0);
});

test('checkpoint continuation and daily retries reconstruct the entrance groups rather than saving transient waves', () => {
  for (const seed of ['wave-continue', dailyForDate('2026-09-06')!.seed]) {
    const g = room(5, seed),
      initial = { opening: activeRoster(g).map(spawnKey), final: pendingRoster(g).map(spawnKey) };
    let saved: Checkpoint | null = null;
    g.onCheckpoint = (checkpoint) => {
      saved = checkpoint;
    };
    defeatOpening(g);
    step(g, 12);
    g.save();
    const save = loadCheckpoint(JSON.parse(JSON.stringify(saved)))!;
    assert(save);
    assert(!('waves' in save));
    const restored = new Game();
    restored.start(seed, save);
    assert.equal(restored.waves.phase, 'opening');
    assert(restored.waves.doors.every((door) => door.state === 'sealed'));
    assert.deepEqual(
      {
        opening: activeRoster(restored).map(spawnKey),
        final: pendingRoster(restored).map(spawnKey),
      },
      initial,
    );
    assert.equal(restored.hp, save.hp);
    assert.equal(restored.elapsed, save.elapsed);
  }
});

test('bosses and the final escape remain single encounters without reinforcement doors', () => {
  for (const stage of [3, 7, 11]) {
    const g = room(stage);
    assert.equal(g.enemies.length, 1);
    assert.equal(g.waves.doors.length, 0);
    assert.equal(g.waves.pending, false);
    g.hitEnemy(g.enemies[0], 99999);
    until(g, () => g.clear);
    assert.equal(g.enemies.length, 0);
    assert.equal(g.waves.doors.length, 0);
    if (stage === 11) {
      g.startEscape();
      step(g, 180);
      assert.equal(g.waves.pending, false);
      assert.equal(g.waves.doors.length, 0);
      assert.equal(g.enemies.length, 0);
      assert(g.clear);
    }
  }
});
