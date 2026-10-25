import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { SorterRemaster } from '../src/sorter-remaster.ts';
import { CondenserRemaster } from '../src/condenser-remaster.ts';
import { bossRemasterTestFromUrl } from '../src/boss-remaster-test.ts';
import { incomingEdgeCues } from '../src/combat-readability.ts';
import type { BossRemasterCue, BossRemasterVisual } from '../src/boss-remaster-cues.ts';
import { replayGuidance } from '../src/replay-guidance.ts';

const DT = 1 / 60;
const view = { x: 200, y: 100, w: 800, h: 600 };
function fixture(boss: 'condenser' | 'sorter', phase = 1) {
  const g = new Game();
  const link = bossRemasterTestFromUrl(
    new URL(`https://test/?test=boss-remaster&boss=${boss}&phase=${phase}&v=1`),
  )!;
  assert(link);
  g.startTest(link.checkpoint);
  const e = g.bossRemaster.enemy!;
  assert(e);
  e.spawn = 0;
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const body of g.terrain.slice(4)) Matter.Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  Matter.Body.setPosition(e.body, { x: 1100, y: 400 });
  Matter.Body.setPosition(g.player, { x: 500, y: 400 });
  g.time += 2; // End only the visual startup; this is a collector/rig test, not a gameplay clear.
  return { g, e, rig: g.bossRemaster.rig! };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function advance(g: Game, done: () => boolean) {
  for (let i = 0; i < 1800 && !done(); i++) {
    if (g.hitStop > 0) g.hitStop = Math.max(0, g.hitStop - DT);
    else {
      g.time += DT;
      g.bossRemaster.rig!.update(DT);
    }
  }
  assert(done());
}
function cues(g: Game, active = true) {
  return incomingEdgeCues(
    g.shots,
    g.player.position,
    view,
    g.time,
    g.solidBodies,
    28,
    g.enemies,
    () => active,
    g.bossRemaster,
  );
}
function supplied(g: Game, warnings: readonly BossRemasterCue[], player = g.player.position) {
  const e = g.bossRemaster.enemy!;
  const visual: BossRemasterVisual = {
    kind: 'sorter',
    center: { ...e.body.position },
    phase: 1,
    stage: 'combat',
    progress: 1,
    warnings,
  };
  const source = { owns: (enemy: typeof e) => enemy === e, visual, rig: { remaining: 0.4 } };
  return {
    source,
    get: () =>
      incomingEdgeCues([], player, view, g.time, g.solidBodies, 28, [e], () => true, source),
  };
}

test('native remastered pressure tells use committed paths and live cover instead of legacy aim/timer', () => {
  const { g, e, rig } = fixture('condenser');
  assert(rig instanceof CondenserRemaster);
  advance(g, () => rig.state === 'windup');
  assert.equal(cues(g).length, 0, 'a tracking sight does not leak an offscreen boss');
  advance(g, () => rig.state === 'windup' && rig.remaining <= 0.42);
  const first = cues(g);
  assert.equal(first.length, 1);
  assert.equal(first[0].source, e.id);
  assert.equal(first[0].pos.x, 972);
  assert.equal(first[0].phase, 'tell');
  assert.equal(first[0].fireIn, rig.remaining);
  e.attack = 'ring';
  e.timer = 99;
  e.aim = { x: 0, y: 1 };
  assert.deepEqual(cues(g), first, 'the supplied locked paths remain authoritative');
  const wall = Matter.Bodies.rectangle(800, 400, 30, 400, { isStatic: true, label: 'terrain' });
  g.terrain.push(wall);
  Matter.Composite.add(g.engine.world, wall);
  assert.equal(cues(g).length, 0, 'the rig clips every fan path at physical cover');
  Matter.Body.setPosition(wall, { x: 800, y: 50 });
  assert.equal(cues(g).length, 1, 'the warning returns when the real obstruction moves');
  dispose(g);
});

test('native Sorter induction emits one edge cue only for the actual committed lane', () => {
  const { g, rig } = fixture('sorter');
  assert(rig instanceof SorterRemaster);
  advance(g, () => rig.state === 'windup' && rig.remaining <= 0.55);
  assert.equal(rig.move, 'induction');
  assert.equal(cues(g).length, 1);
  Matter.Body.setPosition(g.player, { x: 555.1, y: 400 });
  assert.equal(cues(g).length, 0, 'the 26px hull has cleared the 84px field');
  Matter.Body.setPosition(g.player, { x: 554.9, y: 400 });
  assert.equal(cues(g).length, 1);
  assert.equal(cues(g, false).length, 0, 'a frozen or staggered attacker cannot warn');
  dispose(g);
});

test('floor-band edge warnings preserve the real elevated safe region and butt-ended footprint', () => {
  const { g } = fixture('sorter');
  const warning: BossRemasterCue = {
    kind: 'segment',
    from: { x: 64, y: 690 },
    to: { x: 1936, y: 690 },
    width: 100,
    progress: 0.8,
    active: false,
    locked: true,
  };
  assert.equal(supplied(g, [warning], { x: 500, y: 621.9 }).get().length, 0);
  assert.equal(supplied(g, [warning], { x: 500, y: 622.1 }).get().length, 1);
  assert.equal(supplied(g, [{ ...warning, locked: false }], { x: 500, y: 650 }).get().length, 0);
  const short = { ...warning, from: { x: 1100, y: 400 }, to: { x: 520, y: 400 }, width: 22 };
  assert.equal(
    supplied(g, [short]).get().length,
    0,
    'no rounded cap extends a clipped path past its end',
  );
  assert.equal(supplied(g, [{ ...short, to: { x: 512.9, y: 400 } }]).get().length, 1);
  dispose(g);
});

test('supplied fan paths preserve safe gaps and merge actual incoming rays into one existing chevron', () => {
  const { g } = fixture('sorter');
  const fan: BossRemasterCue = {
    kind: 'fan',
    from: { x: 1100, y: 400 },
    ends: [
      { x: 300, y: 200 },
      { x: 300, y: 600 },
    ],
    width: 22,
    progress: 0.9,
    active: false,
    locked: true,
  };
  assert.equal(supplied(g, [fan]).get().length, 0, 'no reconstructed center ray fills the gap');
  const center = { ...fan, ends: [...fan.ends, { x: 300, y: 400 }] };
  assert.equal(supplied(g, [center, center]).get().length, 1);
  const diagonal: BossRemasterCue = {
    kind: 'segment',
    from: { x: 1100, y: 0 },
    to: { x: 400, y: 700 },
    width: 10,
    progress: 1,
    active: false,
    locked: true,
  };
  assert.equal(
    supplied(g, [diagonal]).get().length,
    0,
    'the diagonal band does not inherit its broad bounding box',
  );
  dispose(g);
});

test('startup, phase breaks, recovery and destruction never fall through to legacy boss reconstruction', () => {
  const { g, e } = fixture('sorter');
  const warning: BossRemasterCue = {
    kind: 'lane',
    x: 500,
    width: 84,
    top: 50,
    bottom: 740,
    progress: 1,
    active: false,
    locked: true,
  };
  const test = supplied(g, [warning]);
  assert.equal(test.get().length, 1);
  for (const stage of ['startup', 'transition', 'destroyed'] as const) {
    test.source.visual = { ...test.source.visual, stage };
    assert.equal(test.get().length, 0);
  }
  test.source.visual = { ...test.source.visual, stage: 'combat', warnings: [] };
  assert.equal(test.get().length, 0);
  test.source.visual = { ...test.source.visual, warnings: [warning] };
  for (const remaining of [-1, NaN, Infinity, 1.7]) {
    test.source.rig.remaining = remaining;
    assert.equal(test.get().length, 0);
  }
  test.source.rig.remaining = 0;
  test.source.visual = { ...test.source.visual, warnings: [{ ...warning, active: true }] };
  assert.equal(test.get()[0].fireIn, 0);
  Matter.Body.setPosition(e.body, { x: 900, y: 400 });
  assert.equal(test.get().length, 0, 'the ordinary world warning handles a visible boss');
  dispose(g);
});

test('collector leaves rig, gameplay clocks, world geometry and combat randomness untouched', () => {
  const { g, e, rig } = fixture('condenser');
  assert(rig instanceof CondenserRemaster);
  advance(g, () => rig.state === 'windup' && rig.remaining <= 0.42);
  const snapshot = JSON.stringify({
    hp: g.hp,
    time: g.time,
    elapsed: g.elapsed,
    enemy: { hp: e.hp, timer: e.timer, aim: e.aim },
    state: rig.snapshot,
    shots: g.shots,
    solids: g.solidBodies.map((body) => body.vertices.map(({ x, y }) => ({ x, y }))),
  });
  let draws = 0;
  g.rng = () => {
    draws++;
    return 0.5;
  };
  for (let i = 0; i < 30; i++) assert.equal(cues(g).length, 1);
  assert.equal(draws, 0);
  assert.equal(
    JSON.stringify({
      hp: g.hp,
      time: g.time,
      elapsed: g.elapsed,
      enemy: { hp: e.hp, timer: e.timer, aim: e.aim },
      state: rig.snapshot,
      shots: g.shots,
      solids: g.solidBodies.map((body) => body.vertices.map(({ x, y }) => ({ x, y }))),
    }),
    snapshot,
  );
  dispose(g);
});

test('native remastered projectiles retain boss source and incoming origin for hit feedback and replay labels', () => {
  for (const boss of ['condenser', 'sorter'] as const) {
    const { g, e } = fixture(boss);
    const blade = boss === 'sorter';
    g.enemyShot(e, Math.PI, 10, 22, e.body.position, blade);
    assert.equal(g.shots.length, 1);
    assert.deepEqual(g.shots[0].damageCause, { type: blade ? 'blade' : 'shot', enemy: boss });
    for (let i = 0; i < 90 && !g.damageControl.lastHit; i++) {
      g.time += DT;
      g.updateShots(DT);
    }
    const hit = g.damageControl.lastHit;
    assert(hit);
    assert.equal(hit.cause.enemy, boss);
    assert.equal(hit.cause.type, blade ? 'blade' : 'shot');
    assert(hit.origin && hit.direction);
    assert(
      replayGuidance(hit.cause).label.startsWith(
        boss === 'sorter' ? 'The Sorter' : 'The Condenser',
      ),
    );
    dispose(g);
  }
});
