import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { firstShiftTestFromUrl } from '../src/first-shift-test.ts';
import { STARTING_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
import { PressRemaster, KilnRemaster } from '../src/first-shift-furnace.ts';
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
function fixture(boss: 'press' | 'kiln', mirror: boolean, gun: StartingGun, ng = false) {
  const scene = firstShiftTestFromUrl(
    new URL(
      `https://test/?test=first-shift&boss=${boss}&mirror=${mirror ? 1 : 0}&ng=${ng ? 1 : 0}&v=1`,
    ),
  );
  assert(scene);
  const cp = { ...scene.checkpoint, startingGun: gun };
  const g = new Game();
  let writes = 0,
    awards = 0;
  g.onCheckpoint = () => writes++;
  g.onBossDefeated = () => awards++;
  // The NG+ fixture normally selects a reduced-health phase. Starting the same
  // legal native checkpoint as an ordinary Continue proves the complete 5,050 HP
  // encounter, including its three ordinary support machines.
  if (ng) g.start(cp.seed, cp);
  else g.startTest(cp);
  const e = g.bossRemaster.enemy!;
  assert(e && e.kind === boss);
  assert.equal(e.hp, e.maxHp);
  assert.equal(g.startingGun, gun);
  assert.equal(g.level.mirrored, mirror);
  assert(g.bossRemaster.rig instanceof (boss === 'press' ? PressRemaster : KilnRemaster));
  if (ng) {
    assert.equal(e.maxHp, 5050);
    assert.equal(g.level.spawns.length, 4);
    assert.equal(g.testRun, null);
  }
  return { g, e, writes: () => writes, awards: () => awards };
}
function nativeBounds(g: Game) {
  const vertices = g.player.vertices;
  const minX = Math.min(...vertices.map((v) => v.x)),
    maxX = Math.max(...vertices.map((v) => v.x));
  const bottom = Math.max(...vertices.map((v) => v.y));
  assert([g.hp, minX, maxX, bottom].every(Number.isFinite));
  assert(minX >= -1 && maxX <= g.worldWidth + 1, 'the native side walls failed');
  assert(bottom <= 741, 'the native floor failed');
}
function finish(g: Game) {
  for (let frame = 0; frame < 100; frame++) g.tick(DT, idle);
  assert(g.clear);
  assert.equal(g.bossRemaster.visual, null);
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

// The existing room pilot sends normal movement, jump, aim and fire inputs.
// No health, collision, terrain, AI, damage or projectile values are changed.
for (const boss of ['press', 'kiln'] as const)
  for (const mirror of [false, true])
    for (const gun of STARTING_GUN_IDS)
      test(`${boss}/${gun}/mirror=${mirror}: ordinary inputs clear all three full-health phases`, () => {
        const { g, e, writes, awards } = fixture(boss, mirror, gun);
        const initialHealth = e.maxHp;
        const phases = new Set<number>();
        const result = playRoom(g, 120, () => {
          phases.add(e.phase);
          nativeBounds(g);
          assert.equal(e.maxHp, initialHealth);
          for (const cue of g.bossRemaster.visual?.warnings ?? []) {
            assert(cue.progress >= 0 && cue.progress <= 1);
            if (cue.kind === 'lane') assert(cue.width > 0 && cue.top < cue.bottom);
          }
          return e.hp <= 0;
        });
        assert(e.hp <= 0, `${boss}/${gun} failed with player=${g.hp}, boss=${Math.round(e.hp)}`);
        assert(result.hp > 0);
        assert.deepEqual([...phases].sort(), [0, 1, 2]);
        assert(g.shotCount > 10 && e.attacks > 0);
        assert.equal(g.kills, 1);
        assert.equal(g.bossRemaster.visual?.stage, 'destroyed');
        assert.equal(g.clear, false, 'native room reward skipped the destruction beat');
        finish(g);
        g.save();
        assert.equal(writes(), 0);
        assert.equal(awards(), 0);
        dispose(g);
      });

for (const boss of ['press', 'kiln'] as const)
  for (const mirror of [false, true])
    test(`${boss}/nativeNG+/mirror=${mirror}: earned pistol build clears full 5,050 HP and real support machines`, () => {
      const { g, e, awards } = fixture(boss, mirror, 'pistol', true);
      const phases = new Set<number>();
      const moves = new Set<string>();
      const nativeSupports = new Set<number>();
      let supportActed = false;
      const result = playRoom(g, 180, () => {
        nativeBounds(g);
        phases.add(e.phase);
        if (g.bossRemaster.rig?.state === 'windup') moves.add(g.bossRemaster.rig.move);
        for (const enemy of g.enemies) if (enemy !== e) nativeSupports.add(enemy.id);
        supportActed ||= g.enemies.some(
          (enemy) => nativeSupports.has(enemy.id) && enemy.spawn <= 0,
        );
        assert.equal(e.maxHp, 5050);
        return e.hp <= 0;
      });
      assert(e.hp <= 0, `native NG+ failed with player=${g.hp}, boss=${Math.round(e.hp)}`);
      assert(result.hp > 0);
      assert(supportActed);
      assert.equal(nativeSupports.size, 3, 'all three native support machines spawned');
      assert.deepEqual([...phases].sort(), [1, 2]);
      assert(e.attacks > 0);
      for (const move of boss === 'press' ? ['stamp', 'flak'] : ['ember', 'grate', 'flak'])
        assert(moves.has(move), 'the native fight did not demonstrate ' + move);
      assert.equal(g.kills, 4);
      assert.equal(awards(), 1);
      finish(g);
      dispose(g);
    });
