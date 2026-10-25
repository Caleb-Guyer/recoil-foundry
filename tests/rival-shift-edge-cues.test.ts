import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { rivalShiftTestFromUrl } from '../src/rival-shift-test.ts';
import { TurbineRemaster } from '../src/turbine-remaster.ts';
import { ReclamationInterceptorRemaster } from '../src/reclamation-interceptor-remaster.ts';
import { incomingEdgeCues, EDGE_CUE_TIME } from '../src/combat-readability.ts';
import type { BossRemasterCue, BossRemasterVisual } from '../src/boss-remaster-cues.ts';

const DT = 1 / 60;
const view = { x: 200, y: 100, w: 800, h: 600 };
const near = (actual: number, expected: number) =>
  assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function fixture(boss: 'turbine' | 'interceptor') {
  const scene = rivalShiftTestFromUrl(new URL(`https://test/?test=rival-shift&boss=${boss}&v=1`));
  assert(scene);
  const g = new Game();
  g.startTest(scene.checkpoint);
  const e = g.bossRemaster.enemy!;
  e.spawn = 0;
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const body of g.terrain.slice(4)) Matter.Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  Matter.Body.setPosition(e.body, { x: 1100, y: 400 });
  Matter.Body.setPosition(g.player, { x: 500, y: 400 });
  g.time += 2; // End visual startup only; these are timing/collector checks, not play sessions.
  return { g, e, rig: g.bossRemaster.rig! };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function advance(g: Game, done: () => boolean, frames = 1800) {
  for (let i = 0; i < frames && !done(); i++) {
    if (g.hitStop > 0) g.hitStop = Math.max(0, g.hitStop - DT);
    else {
      g.time += DT;
      g.bossRemaster.rig!.update(DT);
    }
  }
  assert(done(), `rig did not reach state: ${g.bossRemaster.rig?.state}`);
}
function read(g: Game, active = true) {
  return incomingEdgeCues(
    [],
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
function centerLane(g: Game) {
  const lane = g.bossRemaster.visual?.warnings.find(
    (c) => c.kind === 'segment' && Math.abs(c.to.y - c.from.y) < 1e-6,
  );
  assert(lane && lane.kind === 'segment');
  return lane;
}

for (const boss of ['turbine', 'interceptor'] as const)
  test(`${boss} offscreen cues use committed native lanes, live cover and exact pending release times`, () => {
    const { g, e, rig } = fixture(boss);
    assert(
      boss === 'turbine'
        ? rig instanceof TurbineRemaster
        : rig instanceof ReclamationInterceptorRemaster,
    );
    advance(g, () => rig.state === 'windup');
    assert.equal(read(g).length, 0, 'tracking aim does not reveal an offscreen enemy');
    assert(g.bossRemaster.visual!.warnings.every((c) => !c.locked && !c.active));
    advance(g, () => rig.state === 'windup' && rig.remaining <= 0.45);
    const lane = centerLane(g),
      warning = read(g);
    assert.equal(warning.length, 1);
    assert.equal(warning[0].source, e.id);
    assert.equal(warning[0].phase, 'tell');
    near(warning[0].fireIn!, lane.fireIn!);
    assert(lane.fireIn! >= rig.remaining);
    const origin = { ...lane.from },
      aim = { ...e.aim };
    Matter.Body.setPosition(g.player, { x: 500, y: 650 });
    advance(g, () => rig.remaining <= 0.35);
    assert.deepEqual(e.aim, aim, 'the target stops tracking after the actual aim lock');
    assert.deepEqual(centerLane(g).from, origin);
    assert.equal(read(g).length, 0, 'dodging the committed lane removes its warning');
    Matter.Body.setPosition(g.player, { x: 500, y: 400 });
    assert.equal(read(g).length, 1);
    const wall = Matter.Bodies.rectangle(800, 400, 30, 400, { isStatic: true, label: 'terrain' });
    g.terrain.push(wall);
    Matter.Composite.add(g.engine.world, wall);
    assert.equal(read(g).length, 0, 'real cover clips the native warning path');
    Matter.Body.setPosition(wall, { x: 800, y: 50 });
    assert.equal(read(g).length, 1, 'moving that actual cover restores the path');
    advance(g, () => rig.state === 'active');
    const first = centerLane(g);
    assert.equal(first.active, false, 'a future projectile lane is not current damaging geometry');
    assert(first.locked && first.fireIn! > 0);
    near(read(g)[0].fireIn!, first.fireIn!);
    if (boss === 'turbine') {
      assert(rig.remaining > EDGE_CUE_TIME, 'the entire gust window exceeds the edge horizon');
      assert.equal(
        read(g).length,
        1,
        'an imminent blade still warns inside that long active window',
      );
      near(first.fireIn!, 0.25 + 0.16);
      advance(g, () => rig.state === 'active' && rig.remaining <= 1.35);
      const next = centerLane(g);
      assert.equal(next.active, false);
      assert(next.fireIn! > 0.5, 'the repeated lane now points to its second scheduled blade');
      near(read(g)[0].fireIn!, next.fireIn!);
      assert(
        Math.abs(next.fireIn! - rig.remaining) > 0.3,
        'release time differs from the remaining whole attack',
      );
    } else {
      near(first.fireIn!, 0.17);
      advance(g, () => rig.state === 'active' && rig.remaining <= 0.25);
      near(read(g)[0].fireIn!, centerLane(g).fireIn!);
    }
    assert.equal(
      read(g, false).length,
      0,
      'frozen or staggered sources cannot emit an incoming tell',
    );
    dispose(g);
  });

test('each touching lane owns its future timestamp, outside-horizon lanes stay quiet, and old rigs retain fallback behavior', () => {
  const { g, e } = fixture('turbine');
  const lane: BossRemasterCue = {
    kind: 'segment',
    from: { x: 1100, y: 400 },
    to: { x: 300, y: 400 },
    width: 22,
    progress: 1,
    active: false,
    locked: true,
    fireIn: 0.22,
  };
  const source = {
    owns: (enemy: typeof e) => enemy === e,
    rig: { remaining: 2.5 },
    visual: {
      kind: 'turbine',
      center: { ...e.body.position },
      phase: 0,
      stage: 'combat',
      progress: 1,
      warnings: [lane],
    } as BossRemasterVisual,
  };
  const collect = () =>
    incomingEdgeCues(
      [],
      g.player.position,
      view,
      g.time,
      g.solidBodies,
      28,
      [e],
      () => true,
      source,
    );
  assert.equal(collect().length, 1);
  near(collect()[0].fireIn!, 0.22);
  source.visual = {
    ...source.visual,
    warnings: [
      { ...lane, fireIn: 0.9 },
      { ...lane, fireIn: 0.15 },
    ],
  };
  near(collect()[0].fireIn!, 0.15);
  for (const fireIn of [NaN, Infinity, -0.1, EDGE_CUE_TIME + 0.01]) {
    source.visual = { ...source.visual, warnings: [{ ...lane, fireIn }] };
    assert.equal(collect().length, 0);
  }
  source.visual = { ...source.visual, warnings: [{ ...lane, fireIn: 0.2, locked: false }] };
  assert.equal(collect().length, 0);
  source.visual = { ...source.visual, warnings: [{ ...lane, fireIn: undefined }] };
  assert.equal(collect().length, 0, 'older rig fallback still honors horizon');
  source.rig.remaining = 0.4;
  near(collect()[0].fireIn!, 0.4);
  source.visual = { ...source.visual, warnings: [{ ...lane, active: true }] };
  near(collect()[0].fireIn!, 0);
  for (const stage of ['startup', 'transition', 'destroyed'] as const) {
    source.visual = { ...source.visual, stage };
    assert.equal(collect().length, 0);
  }
  dispose(g);
});

for (const boss of ['turbine', 'interceptor'] as const)
  test(`${boss} owned warnings stay silent during startup and retain clocks, geometry and schedule through pause`, () => {
    const { g, e, rig } = fixture(boss);
    g.time = 0;
    assert.equal(g.bossRemaster.visual?.stage, 'startup');
    assert.deepEqual(g.bossRemaster.visual?.warnings, []);
    assert.equal(read(g).length, 0);
    g.time = 2;
    advance(g, () => rig.state === 'windup' && rig.remaining <= 0.45);
    const before = {
      clock: g.time,
      hp: g.hp,
      remaining: rig.remaining,
      snapshot: structuredClone(rig.snapshot),
      cues: structuredClone(read(g)),
      origin: { ...e.body.position },
    };
    g.setMode('paused');
    for (let i = 0; i < 30; i++) {
      rig.update(DT);
      g.tick(DT, {
        left: false,
        right: false,
        jump: false,
        jumpHeld: false,
        fire: false,
        aim: { x: 0, y: 0 },
      });
    }
    assert.equal(g.time, before.clock);
    assert.equal(g.hp, before.hp);
    near(rig.remaining, before.remaining);
    assert.deepEqual(rig.snapshot, before.snapshot);
    assert.deepEqual(e.body.position, before.origin);
    g.setMode('playing');
    assert.deepEqual(
      read(g),
      before.cues,
      'resuming does not silently advance or retarget a committed warning',
    );
    dispose(g);
  });
