import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { rivalShiftTestFromUrl } from '../src/rival-shift-test.ts';
import { STARTING_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
import { TurbineRemaster } from '../src/turbine-remaster.ts';
import { playRoom } from './room-pilot.ts';
import { rotorCueBolts, dodgePilot } from './combat-pilot.ts';
import { distance } from '../src/rules.ts';

const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 300 },
};
function fixture(mirror: boolean, gun: StartingGun, ng = false) {
  const scene = rivalShiftTestFromUrl(
    new URL(
      `https://test/?test=rival-shift&boss=turbine&mirror=${mirror ? 1 : 0}&ng=${ng ? 1 : 0}&v=1`,
    ),
  );
  assert(scene);
  const cp = { ...scene.checkpoint, startingGun: gun };
  const g = new Game();
  let awards = 0,
    writes = 0;
  g.onBossDefeated = () => awards++;
  g.onCheckpoint = () => writes++;
  // An ordinary Continue must preserve native full NG+ health and support machines.
  if (ng) g.start(cp.seed, cp);
  else g.startTest(cp);
  const e = g.bossRemaster.enemy;
  assert(e && e.kind === 'turbine');
  assert(g.bossRemaster.rig instanceof TurbineRemaster);
  assert.equal(e.hp, e.maxHp);
  assert.equal(g.level.mirrored, mirror);
  assert.equal(g.startingGun, gun);
  return { g, e, writes: () => writes, awards: () => awards };
}
function bounds(g: Game) {
  assert([g.hp, g.player.position.x, g.player.position.y].every(Number.isFinite));
  const vertices = g.player.vertices;
  assert(Math.min(...vertices.map((v) => v.x)) >= -1);
  assert(Math.max(...vertices.map((v) => v.x)) <= g.worldWidth + 1);
  assert(Math.max(...vertices.map((v) => v.y)) <= 741);
}
function finish(g: Game) {
  for (let i = 0; i < 110; i++) g.tick(DT, idle);
  assert(g.clear);
  assert.equal(g.bossRemaster.visual, null);
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

for (const mirror of [false, true])
  for (const gun of STARTING_GUN_IDS)
    test(`Rival Turbine/${gun}/mirror=${mirror}: ordinary input completes native full-health fight`, () => {
      const { g, e, writes, awards } = fixture(mirror, gun);
      const hp = e.maxHp;
      const phases = new Set<number>();
      const result = playRoom(g, 180, () => {
        bounds(g);
        phases.add(e.phase);
        assert.equal(e.maxHp, hp);
        return e.hp <= 0;
      });
      assert(
        e.hp <= 0,
        `${gun}/${mirror}: player=${g.hp}, boss=${Math.round(e.hp)}, pos=${JSON.stringify(g.player.position)}`,
      );
      assert(result.hp > 0);
      assert.deepEqual([...phases].sort(), [0, 1, 2]);
      assert(g.shotCount > 20 && e.attacks > 0);
      assert.equal(g.bossRemaster.visual?.stage, 'destroyed');
      assert.equal(g.clear, false, 'destruction must finish before the reward');
      finish(g);
      assert.equal(awards(), 0);
      assert.equal(writes(), 0);
    });

for (const mirror of [false, true])
  test(`Rival Turbine/native NG+/mirror=${mirror}: earned pistol build faces native health and real support machines`, () => {
    const { g, e, awards } = fixture(mirror, 'pistol', true);
    const hp = e.maxHp;
    const supports = new Set<number>();
    assert.equal(g.level.spawns.length, 4);
    const phases = new Set<number>();
    let supportActed = false;
    const result = playRoom(g, 210, () => {
      bounds(g);
      phases.add(e.phase);
      for (const enemy of g.enemies) if (enemy !== e) supports.add(enemy.id);
      supportActed ||= g.enemies.some((enemy) => supports.has(enemy.id) && enemy.spawn <= 0);
      assert.equal(e.maxHp, hp);
      return e.hp <= 0;
    });
    assert(e.hp <= 0, `NG+/${mirror}: player=${g.hp}, boss=${Math.round(e.hp)}`);
    assert(result.hp > 0);
    assert.deepEqual([...phases].sort(), [1, 2]);
    assert(supportActed);
    assert.equal(supports.size, 3);
    assert(e.attacks > 0);
    assert.equal(awards(), 1);
    finish(g);
  });

// These run after the fourteen original fights, preserving their native fixture order.
test('the ordinary pilot forecasts real locked rotor releases in every phase and mirror while targeting a nearer support', () => {
  const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
  for (const mirror of [false, true])
    for (const phase of [0, 1, 2]) {
      const scene = rivalShiftTestFromUrl(
        new URL(
          `https://test/?test=rival-shift&boss=turbine&phase=${phase + 1}&mirror=${mirror ? 1 : 0}&v=1`,
        ),
      )!;
      const g = new Game();
      g.startTest(scene.checkpoint);
      const e = g.bossRemaster.enemy!,
        ai = g.bossRemaster.rig;
      assert(ai instanceof TurbineRemaster);
      for (const prop of [...g.props.items]) g.props.remove(prop);
      for (const body of g.terrain.slice(4)) Matter.Composite.remove(g.engine.world, body);
      g.terrain = g.terrain.slice(0, 4);
      Matter.Body.setPosition(e.body, { x: mirror ? 1400 : 600, y: 400 });
      Matter.Body.setPosition(g.player, { x: 1000, y: 400 });
      Matter.Body.setStatic(e.body, true);
      Matter.Body.setStatic(g.player, true);
      e.spawn = 0;
      const step = () => {
        g.time += DT;
        ai.update(DT);
      };
      const until = (done: () => boolean) => {
        for (let frame = 0; frame < 1200 && !done(); frame++) step();
        assert(done(), 'the real rotor must reach the expected release');
      };
      until(() => ai.state === 'windup' && g.time >= 1.25);
      assert(ai.cues.length > 0 && ai.cues.every((cue) => !cue.locked));
      assert.deepEqual(rotorCueBolts(g), [], 'tracking rays are not committed forecasts');
      until(() => ai.state === 'windup' && ai.cues.every((cue) => cue.locked));
      assert.equal(e.phase, phase);
      assert.deepEqual(e.turbine!.angles, [], 'the old native warning array is deliberately empty');
      const forecasts = rotorCueBolts(g),
        count = phase === 0 ? 3 : 5;
      assert.equal(forecasts.length, count);
      const support = g.spawnEnemy('flyer', 1000, 470);
      support.spawn = 0;
      assert(
        distance(support.body.position, g.player.position) <
          distance(e.body.position, g.player.position),
      );
      assert.deepEqual(
        rotorCueBolts(g),
        forecasts,
        'nearer firing targets cannot hide the boss commitment',
      );
      const before = { time: g.time, hp: g.hp, boss: e.hp, shots: g.shots.length };
      dodgePilot(g, support, true);
      assert.deepEqual({ time: g.time, hp: g.hp, boss: e.hp, shots: g.shots.length }, before);
      const first = forecasts.reduce((a, b) => (a.delay < b.delay ? a : b)),
        deadline = g.time + first.delay / 60;
      until(() => g.shots.some((shot) => shot.blade));
      const actual = g.shots.find((shot) => shot.blade)!;
      assert(
        Math.abs(g.time - deadline) <= 2 * DT,
        'forecast uses the real rotor release deadline',
      );
      near(actual.pos.x, first.p.x);
      near(actual.pos.y, first.p.y);
      near(actual.vel.x, first.v.x);
      near(actual.vel.y, first.v.y);
      near(actual.radius, first.radius);
      assert(actual.damageCause?.enemy === 'turbine' && actual.life === 4);
      until(() => g.shots.filter((shot) => shot.blade).length === count);
      assert.equal(
        rotorCueBolts(g).length,
        count,
        'the pending second wave stays visible after the first wave',
      );
      const origin = ai.snapshot.origin,
        dir = mirror ? -1 : 1;
      const cover = Matter.Bodies.rectangle(origin.x + dir * 35, origin.y, 20, 800, {
        isStatic: true,
      });
      g.terrain.push(cover);
      Matter.Composite.add(g.engine.world, cover);
      assert.deepEqual(
        rotorCueBolts(g),
        [],
        'cover before the real muzzle cannot predict an emitted round',
      );
      const admitted = g.shots.length;
      until(() => ai.state === 'recover');
      assert.equal(
        g.shots.length,
        admitted,
        'native cover really prevents those second-wave emissions',
      );
      g.bossRemaster.clear();
      assert.deepEqual(rotorCueBolts(g), [], 'an unowned or stopped rotor provides no forecast');
      Matter.Composite.clear(g.engine.world, false);
      Matter.Engine.clear(g.engine);
    }
});
