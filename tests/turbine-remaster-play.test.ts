import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { rivalShiftTestFromUrl } from '../src/rival-shift-test.ts';
import { STARTING_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
import { TurbineRemaster } from '../src/turbine-remaster.ts';
import { playRoom } from './room-pilot.ts';

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
