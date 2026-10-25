import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from '../src/game.ts';
import { rivalShiftTestFromUrl } from '../src/rival-shift-test.ts';
import { STARTING_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
import { enemyHealth } from '../src/enemies.ts';
import { overtimeHealth } from '../src/overtime.ts';
import { playRoom } from './room-pilot.ts';
import { ReclamationInterceptorRemaster } from '../src/reclamation-interceptor-remaster.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 300 },
};
function nativeFixture(mirror = false, gun: StartingGun = 'pistol', ng = false) {
  const scene = rivalShiftTestFromUrl(
    new URL(
      `https://example.test/?test=rival-shift&boss=interceptor&mirror=${mirror ? 1 : 0}&ng=${ng ? 1 : 0}&v=1`,
    ),
  );
  assert(scene);
  const checkpoint = structuredClone(scene.checkpoint);
  checkpoint.startingGun = gun;
  const g = new Game();
  let writes = 0,
    awards = 0;
  g.onCheckpoint = () => {
    writes++;
  };
  g.onBossDefeated = () => {
    awards++;
  };
  g.startTest(checkpoint);
  const e = g.enemies.find((e) => e.kind === 'boss')!;
  assert(e);
  assert.equal(e.hp, e.maxHp);
  assert.equal(e.maxHp, ng ? overtimeHealth('boss', 15) : enemyHealth('boss', 15));
  assert(g.bossRemaster.rig instanceof ReclamationInterceptorRemaster);
  assert.equal(g.level.id, 'rival-shift-interceptor');
  assert.equal(g.level.mirrored, mirror);
  return { g, e, writes: () => writes, awards: () => awards };
}
function assertVictory(f: ReturnType<typeof nativeFixture>) {
  const { g, e } = f;
  assert(
    e.hp <= 0,
    `fight failed: player=${g.hp}, boss=${Math.round(e.hp)}, attacks=${e.attacks}, phase=${e.phase}, mode=${g.mode}`,
  );
  assert(g.hp > 0);
  assert(g.shotCount > 3);
  assert.equal(g.clear, false);
  assert.equal(g.bossRemaster.visual?.stage, 'destroyed');
  for (let i = 0; i < 90; i++) g.tick(1 / 60, idle);
  assert(g.clear);
  g.save();
  assert.equal(f.writes(), 0);
  assert.equal(f.awards(), 0);
}
for (const gun of STARTING_GUN_IDS)
  for (const mirror of [false, true])
    test(`Reclamation Interceptor ${gun} mirror=${mirror}: full native three-phase fight and unchanged rewards`, (t) => {
      const f = nativeFixture(mirror, gun),
        phases = new Set<number>();
      playRoom(f.g, 210, () => {
        phases.add(f.e.phase);
        assert(f.g.player.position.x >= -1 && f.g.player.position.x <= 2001);
        assert(f.g.player.position.y <= 723.5);
        return f.e.hp <= 0;
      });
      assert.deepEqual([...phases].sort(), [0, 1, 2]);
      t.diagnostic(
        `native fight: ${f.g.time.toFixed(2)}s, player HP ${f.g.hp}, shots ${f.g.shotCount}, completed attacks ${f.e.attacks}`,
      );
      assertVictory(f);
    });
for (const mirror of [false, true])
  test(`Reclamation Interceptor New Game+ mirror=${mirror}: full native health and real remix-five supports`, (t) => {
    const f = nativeFixture(mirror, 'pistol', true),
      phases = new Set<number>();
    assert.equal(f.g.overtime?.remix, 5);
    assert.equal(f.g.level.spawns.filter((s) => s.kind !== 'boss').length, 3);
    playRoom(f.g, 300, () => {
      phases.add(f.e.phase);
      return f.e.hp <= 0;
    });
    assert.deepEqual([...phases].sort(), [1, 2]);
    t.diagnostic(
      `native fight: ${f.g.time.toFixed(2)}s, player HP ${f.g.hp}, shots ${f.g.shotCount}, completed attacks ${f.e.attacks}`,
    );
    assertVictory(f);
  });
