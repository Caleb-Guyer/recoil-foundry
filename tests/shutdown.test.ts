import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import {
  DISCONNECT,
  DISCONNECT_STAGES,
  SHUTDOWN_PANELS,
  shutdownTestFromUrl,
  shutdownLevel,
} from '../src/shutdown-layout.ts';
import { distance, getGun, loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { logbookEntries, loadLogbook, mergeLogbook, recordLogbook } from '../src/logbook.ts';
import { snapshotRun, loadRunHistory } from '../src/run-history.ts';
import { dailyForDate } from '../src/daily.ts';
import { withParents } from '../src/branch-builds.ts';
import { playRoom } from './room-pilot.ts';
const { Body, Bodies, Composite, Query } = Matter;
const preset = (scene = 'relay') =>
  shutdownTestFromUrl(new URL('https://test/?test=shutdown&scene=' + scene))!;
function fixture(scene = 'relay') {
  const g = new Game();
  g.startTest(preset(scene));
  return g;
}
function step(g: Game, count = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < count; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: g.aim,
      ...input,
    });
}
function near(g: Game, p = g.shutdown.target!) {
  Body.setPosition(g.player, { x: p.x + 70, y: p.y + 10 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.aim = { ...p };
}
function quiet(g: Game) {
  for (const e of [...g.enemies]) g.hitEnemy(e, 999999);
  g.waves.clear();
  g.mutations.clear();
  g.shots = [];
  g.hitStop = 0;
  step(g);
}
function bullet(g: Game, friendly = true) {
  const p = g.shutdown.target ?? DISCONNECT;
  g.addShot({
    pos: { x: p.x + 70, y: p.y },
    vel: { x: -30, y: 0 },
    radius: 2.5,
    damage: 25,
    life: 2,
    friendly,
    fragment: false,
    split: false,
    bounces: 0,
    pierce: 0,
  });
  g.updateShots(0.1);
}
test('presets are strict valid checkpoints and cannot mix with other test modes', () => {
  for (const scene of ['relay', 'retaliation', 'entrance', 'finale'])
    assert(loadCheckpoint(preset(scene)), scene);
  for (const query of [
    'test=shutdown&scene=wat',
    'test=shutdown&scene=finale&scene=relay',
    'test=shutdown&area=rooftops',
    'test=shutdown&test=story',
    'test=shutdown&daily=1',
  ])
    assert.equal(shutdownTestFromUrl(new URL('https://test/?' + query)), null);
  const p = preset('finale');
  for (const shutdown of [
    null,
    {},
    { disabled: [7, 3] },
    { disabled: [3, 3] },
    { disabled: [19] },
    { disabled: [3, 7], chamber: true, cycle: 0 },
    { disabled: [3, 7, 15], chamber: true, cycle: 4 },
    { disabled: [3, 7, 15], cycle: 1 },
    { disabled: [3, 7, 15], chamber: 'true', cycle: 0 },
  ])
    assert.equal(loadCheckpoint({ ...p, shutdown }), null, JSON.stringify(shutdown));
  assert.equal(loadCheckpoint({ ...preset(), shutdown: { disabled: [7] } }), null);
  assert.equal(loadCheckpoint({ ...p, escape: true }), null);
  assert.equal(loadCheckpoint({ ...p, stage: 18 }), null);
  assert.equal(loadCheckpoint({ ...p, shutdown: undefined })?.shutdown, undefined);
});
test('fresh campaigns and Daily start empty; older saves and unrelated tests never invent route progress', () => {
  const g = new Game();
  g.start('fresh-shutdown');
  assert.deepEqual(g.shutdown.state, { disabled: [] });
  g.start(dailyForDate('2026-09-18')!.seed);
  assert.deepEqual(g.shutdown.state, { disabled: [] });
  const old = { ...preset(), shutdown: undefined };
  g.start(old.seed, old);
  assert.equal(g.shutdown.state, null);
  g.startTest(old);
  assert.equal(g.shutdown.target, null);
  g.startWorkshop([]);
  assert.equal(g.shutdown.target, null);
  g.startPractice({ kind: 'loader' });
  assert.equal(g.shutdown.target, null);
});
test('disconnects are outside terrain across every boss variant and mirrored arena', () => {
  for (let i = 0; i < 45; i++)
    for (const stage of DISCONNECT_STAGES) {
      const g = new Game();
      g.start('cabinet-' + i);
      g.stage = stage;
      g.loadRoom(false, true);
      assert(g.shutdown.cabinet);
      assert.equal(
        Query.collides(Bodies.rectangle(DISCONNECT.x, DISCONNECT.y, 56, 74), g.terrain).length,
        0,
      );
      Body.setPosition(g.player, { x: 140, y: 722 });
      assert(distance(g.player.position, DISCONNECT) < 190);
      assert(distance(g.lineEnd(g.player.position, DISCONNECT), DISCONNECT) < 1);
    }
});
test('live boss, distant shots, enemy fire and paused input cannot sabotage a disconnect', () => {
  const g = fixture();
  near(g);
  g.clear = false;
  bullet(g);
  assert.equal(g.shutdown.state!.disabled.length, 0);
  g.clear = true;
  Body.setPosition(g.player, { x: 800, y: 592 });
  bullet(g);
  assert.equal(g.shutdown.state!.disabled.length, 0);
  near(g);
  bullet(g, false);
  assert.equal(g.shutdown.state!.disabled.length, 0);
  g.setMode('paused');
  assert(!g.shutdown.trigger());
  g.setMode('playing');
  bullet(g);
  assert.deepEqual(g.shutdown.state!.disabled, [3]);
  assert(!g.shutdown.trigger());
});
test('bullets and beams hit controls through real line-of-sight and cannot shoot through cover', () => {
  for (const wanted of [
    [],
    ['cutting-torch'],
    ['pulse-chamber'],
    ['rail-spike'],
    ['recall'],
    ['suspension'],
    ['grindshot'],
  ]) {
    const mods = withParents([], wanted)!;
    assert(mods);
    const g = fixture();
    g.mods = mods;
    g.gun = getGun(mods);
    near(g);
    const block = Bodies.rectangle(110, DISCONNECT.y, 8, 150, { isStatic: true });
    g.terrain.push(block);
    Composite.add(g.engine.world, block);
    step(g, 30, { fire: true, aim: DISCONNECT });
    assert.equal(g.shutdown.state!.disabled.length, 0, mods.join(','));
    g.terrain = g.terrain.filter((b) => b !== block);
    Composite.remove(g.engine.world, block);
    near(g);
    g.shots = [];
    for (let i = 0; i < 180 && !g.shutdown.state!.disabled.length; i++)
      step(g, 1, { fire: i % 60 < 40, aim: DISCONNECT });
    assert.deepEqual(g.shutdown.state!.disabled, [3], mods.join(','));
  }
});
test('moving props and nearby canister explosions can break the same exposed contact', () => {
  for (const mode of ['prop', 'blast']) {
    const g = fixture();
    near(g);
    if (mode === 'prop') {
      const p = g.props.spawn('crate', DISCONNECT.x + 26, DISCONNECT.y);
      Body.setVelocity(p.body, { x: -6, y: 0 });
      g.shutdown.update(1 / 60);
    } else {
      const p = g.props.spawn('canister', DISCONNECT.x + 70, DISCONNECT.y);
      g.props.explode(p);
    }
    assert.deepEqual(g.shutdown.state!.disabled, [3], mode);
  }
});
test('sabotage saves once, resumes the defeated room, and cannot be repeated after reload', () => {
  const p = preset(),
    g = new Game();
  let saved: Checkpoint | null = null;
  g.start(p.seed, p);
  quiet(g);
  g.onCheckpoint = (s) => (saved = s);
  near(g);
  g.shutdown.trigger();
  assert(saved && loadCheckpoint(saved));
  const h = new Game();
  h.start(saved.seed, saved);
  assert(h.clear);
  assert.equal(h.enemies.length, 0);
  assert.equal(h.shutdown.target, null);
  assert.deepEqual(h.shutdown.state!.disabled, [3]);
  h.stage = 4;
  h.loadRoom();
  assert(h.waves.doors.some((d) => d.spawn.elite));
});
test('security escalates through warned, supported reinforcement anchors without changing ordinary runs', () => {
  const g = fixture('retaliation');
  const extras = g.shutdown.reinforcements(g.level);
  assert.equal(extras.length, 3);
  for (const spawn of extras) {
    const e = g.spawnEnemy(spawn.kind, spawn.x, spawn.y, spawn.elite);
    assert.equal(Query.collides(e.body, g.terrain).length, 0);
  }
  assert(extras.some((e) => e.elite === 'twin'));
  assert(g.waves.doors.every((d) => d.state === 'sealed'));
  g.shutdown.state!.disabled = [];
  assert.deepEqual(g.shutdown.reinforcements(g.level), []);
});
test('the optional final entrance needs all disconnects and a defeated boss; normal extraction remains available', () => {
  const g = fixture('entrance');
  assert(g.shutdown.entrance);
  assert(!g.escape);
  g.clear = false;
  assert(!g.shutdown.enter());
  g.clear = true;
  g.shutdown.state!.disabled.pop();
  assert(!g.shutdown.enter());
  g.shutdown.state!.disabled.push(15);
  g.startEscape();
  assert(g.escape);
  assert(!g.shutdown.chamber);
  const h = fixture('entrance');
  Body.setPosition(h.player, { x: 140, y: 722 });
  step(h, 60, { left: true });
  assert(h.shutdown.chamber);
  assert.equal(h.level.id, 'continuity-control');
  assert(!h.escape);
  assert(!h.canBranch);
  assert.equal(h.mods.length, 19);
});
test('final chamber actors, props and controls fit; terminals cannot bypass waves or normal exits', () => {
  for (let cycle = 0; cycle < 3; cycle++) {
    const p = preset('finale');
    p.shutdown!.cycle = cycle;
    const g = new Game();
    g.startTest(p);
    for (const spawn of g.level.spawns) {
      const e = g.spawnEnemy(spawn.kind, spawn.x, spawn.y, spawn.elite);
      assert.equal(Query.collides(e.body, g.terrain).length, 0, JSON.stringify(spawn));
    }
    for (const panel of SHUTDOWN_PANELS)
      assert.equal(Query.collides(Bodies.rectangle(panel.x, panel.y, 34, 44), g.terrain).length, 0);
    assert.equal(g.shutdown.target, null);
    assert(!g.shutdown.trigger());
    Body.setPosition(g.player, { x: 1910, y: 722 });
    step(g);
    assert(!g.escape);
    quiet(g);
    g.startEscape();
    g.openReward();
    assert(!g.escape);
    assert.equal(g.mode, 'playing');
  }
});
test('finale advances once per defeated wave, checkpoints each cycle, pauses and ends without rewards', () => {
  const p = preset('finale'),
    g = new Game();
  let saved: Checkpoint | null = null;
  g.start(p.seed, p);
  g.onCheckpoint = (s) => (saved = s);
  const mods = [...g.mods];
  for (let cycle = 0; cycle < 3; cycle++) {
    quiet(g);
    near(g);
    assert(g.shutdown.trigger());
    assert.equal(g.shutdown.state!.cycle, cycle + 1);
    assert(saved && loadCheckpoint(saved));
    assert(!g.shutdown.trigger());
    if (cycle < 2) {
      assert(!g.clear);
      assert(g.waves.pending);
      const h = new Game();
      h.start(saved.seed, saved);
      assert(!h.clear);
      assert.equal(h.shutdown.state!.cycle, cycle + 1);
    }
  }
  assert.equal(g.mode, 'playing');
  const finalHealth = g.hp,
    finalShots = g.shotCount;
  g.damagePlayer(999);
  g.fire();
  assert.equal(g.hp, finalHealth, 'the completed shutdown protects its ending sequence');
  assert.equal(g.shotCount, finalShots);
  g.setMode('paused');
  step(g, 600);
  assert.equal(g.shutdown.finishTime, 0);
  g.setMode('playing');
  g.hitStop = 0;
  step(g, 300);
  assert.equal(g.mode, 'won');
  assert.equal(saved, null);
  assert.deepEqual(g.mods, mods);
  assert(g.shutdown.complete);
  const recap = snapshotRun(g, 'shutdown-result', 1)!;
  assert(recap.shutdown);
  assert(loadRunHistory([recap])[0].shutdown);
  const book = recordLogbook(loadLogbook(null), g);
  assert(book.shutdown);
  assert(!book.escaped);
  assert(logbookEntries([], book).some((e) => e.id === 'record:end-of-shift'));
});
test('isolated tests cannot write saves, recaps or permanent route lore; partial lore stays undiscovered', () => {
  const g = fixture();
  let writes = 0;
  g.onCheckpoint = () => writes++;
  near(g);
  g.shutdown.trigger();
  g.save();
  assert.equal(writes, 0);
  assert.equal(snapshotRun(g, 'test', 1), null);
  const empty = loadLogbook(null);
  assert.deepEqual(recordLogbook(empty, g), empty);
  g.testRun = null;
  const found = recordLogbook(empty, g);
  assert.deepEqual(found.disconnects, [3]);
  assert(!found.shutdown);
  const entries = logbookEntries([], found);
  assert(entries.some((e) => e.id === 'record:isolation-loading'));
  assert(!entries.some((e) => e.id === 'record:isolation-heat' || e.id === 'record:end-of-shift'));
  assert.deepEqual(
    mergeLogbook(found, loadLogbook({ version: 1, disconnects: [3, 7, 99] })).disconnects,
    [3, 7],
  );
});
test('a normal gun can finish all three combat waves with actual movement, damage and enemy AI', () => {
  const g = fixture('finale');
  for (let cycle = 0; cycle < 3; cycle++) {
    const result = playRoom(g, 110);
    assert(g.clear && g.hp > 0, JSON.stringify({ cycle, ...result }));
    near(g);
    assert(g.shutdown.trigger());
  }
  g.hitStop = 0;
  step(g, 300);
  assert.equal(g.mode, 'won');
});

test('all control platforms are reachable with ordinary jumps, independent of weapon upgrades', () => {
  const g = fixture('finale');
  quiet(g);
  g.mods = [];
  g.gun = getGun([]);
  for (const [x, y] of [
    [355, 675],
    [520, 590],
    [810, 490],
    [1000, 400],
    [1190, 490],
    [1470, 590],
  ]) {
    let arrived = false;
    for (let i = 0; i < 360; i++) {
      const dx = x - g.player.position.x,
        dy = y - 18 - g.player.position.y;
      if (g.grounded && Math.abs(dx) < 25 && Math.abs(dy) < 5) {
        arrived = true;
        break;
      }
      step(g, 1, { left: dx < -8, right: dx > 8, jump: g.grounded && dy < -20 });
    }
    assert(arrived, `${x},${y}: ${JSON.stringify(g.player.position)}`);
  }
});
