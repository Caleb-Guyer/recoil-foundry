import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from '../src/game.ts';
import { firstShiftTestFromUrl } from '../src/first-shift-test.ts';
import { STARTING_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
import { playRoom } from './room-pilot.ts';
import { getOvertimeLevel } from '../src/overtime.ts';

/** A player strategy for shotgun recoil: stop firing to preserve a warning-time jump. */
export function playShotgunCrane(g: Game, seconds = 180) {
  let dodge = 0;
  for (let frame = 0; frame < seconds * 60 && g.mode === 'playing'; frame++) {
    const target = g.enemies.find((e) => e.kind === 'crane' && e.hp > 0);
    if (!target) return;
    const p = g.player.position;
    const correction = 220 - p.x - g.player.velocity.x * 6;
    const input: Input = {
      left: correction < -15,
      right: correction > 15,
      jump: false,
      jumpHeld: true,
      fire: true,
      aim: { ...target.body.position },
    };
    let vertical = false;
    for (const cue of g.bossRemaster.visual?.warnings ?? []) {
      if (cue.kind !== 'hull' || !cue.locked) continue;
      const horizontal = Math.abs(cue.to.x - cue.from.x) > Math.abs(cue.to.y - cue.from.y);
      if (horizontal) {
        const left = Math.min(cue.from.x, cue.to.x) - cue.halfWidth - 13;
        const right = Math.max(cue.from.x, cue.to.x) + cue.halfWidth + 13;
        if (p.x > left - 30 && p.x < right + 30 && p.y + 18 > cue.from.y - cue.halfHeight - 180) {
          input.fire = false;
          input.jump = g.grounded;
        }
      } else {
        vertical = true;
        if (!dodge) dodge = p.x < cue.from.x ? -1 : 1;
        input.left = dodge < 0;
        input.right = dodge > 0;
        input.fire = false;
      }
    }
    if (!vertical) dodge = 0;
    g.tick(1 / 60, input);
    assert([g.hp, p.x, p.y].every(Number.isFinite));
  }
}

/** Add visible-hook evasions to the ordinary room pilot without touching simulation state. */
export function playHookAwareRoom(g: Game, seconds: number, stop: () => boolean) {
  const tick = g.tick.bind(g);
  let dodge = 0;
  g.tick = (dt, input) => {
    const next = { ...input, aim: { ...input.aim } };
    const p = g.player.position;
    let vertical = false;
    for (const cue of g.bossRemaster.visual?.warnings ?? []) {
      if (cue.kind !== 'hull' || !cue.locked) continue;
      const horizontal = Math.abs(cue.to.x - cue.from.x) > Math.abs(cue.to.y - cue.from.y);
      if (horizontal) {
        const left = Math.min(cue.from.x, cue.to.x) - cue.halfWidth - 13;
        const right = Math.max(cue.from.x, cue.to.x) + cue.halfWidth + 13;
        if (
          p.x > left - 30 &&
          p.x < right + 30 &&
          p.y + 18 > cue.from.y - cue.halfHeight - 120 &&
          p.y - 18 < cue.from.y + cue.halfHeight + 80
        ) {
          next.jump = g.grounded;
          next.fire = false;
          if (!g.grounded && g.player.velocity.y > -4) {
            next.fire = true;
            next.aim = { x: p.x, y: p.y + 300 };
          }
        }
      } else {
        vertical = true;
        if (!dodge)
          dodge = p.x < 100 ? 1 : p.x > g.worldWidth - 100 ? -1 : p.x < cue.from.x ? -1 : 1;
        next.left = dodge < 0;
        next.right = dodge > 0;
        next.fire = false;
      }
    }
    if (!vertical) dodge = 0;
    tick(dt, next);
  };
  try {
    playRoom(g, seconds, stop);
  } finally {
    g.tick = tick;
  }
}

function nativeFixture(
  boss: 'loader' | 'crane',
  mirror = false,
  gun: StartingGun = 'pistol',
  ng = false,
) {
  const scene = firstShiftTestFromUrl(
    new URL(
      `https://example.test/?test=first-shift&boss=${boss}&mirror=${mirror ? 1 : 0}&ng=${ng ? 1 : 0}&v=1`,
    ),
  );
  assert(scene);
  const checkpoint = structuredClone(scene.checkpoint);
  checkpoint.startingGun = gun;
  if (ng) {
    // Canonical phase-preview identities deliberately reduce starting health.
    // A separate native campaign identity proves a full-health NG+ encounter.
    let found = false;
    for (let i = 0; i < 256; i++) {
      const seed = `RF-C103-NG-AUDIT-${boss}-${i}`;
      const level = getOvertimeLevel(seed, 3, 2);
      if (level.mirrored === mirror && level.spawns[0].kind === boss) {
        checkpoint.seed = seed;
        found = true;
        break;
      }
    }
    assert(found);
  }
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
  const e = g.enemies.find((e) => e.kind === boss)!;
  assert(e);
  assert.equal(e.hp, e.maxHp);
  assert.equal(e.maxHp, ng ? 4200 : 920);
  assert.equal(g.level.bossRemaster, boss);
  assert.equal(g.level.mirrored, mirror);
  assert.equal(g.mods.length, ng ? 11 : 3);
  return { g, e, writes: () => writes, awards: () => awards };
}
function assertIsolatedVictory(f: ReturnType<typeof nativeFixture>) {
  const { g, e } = f;
  assert(
    e.hp <= 0,
    `native fight failed: player=${g.hp},boss=${Math.round(e.hp)},attacks=${e.attacks}`,
  );
  assert(g.hp > 0);
  assert(g.shotCount > 10);
  assert(g.kills >= 1);
  assert.equal(g.bossRemaster.visual?.stage, 'destroyed');
  assert.equal(g.clear, false);
  for (let i = 0; i < 90; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1000, y: 150 },
    });
  assert(g.clear);
  g.save();
  assert.equal(f.writes(), 0);
  assert.equal(f.awards(), 0);
}

for (const boss of ['loader', 'crane'] as const)
  for (const mirror of [false, true])
    test(`${boss} mirror=${mirror}: full native encounter clears through all three phases with an earned pistol build`, () => {
      const f = nativeFixture(boss, mirror),
        phases = new Set<number>();
      playRoom(f.g, 180, () => {
        phases.add(f.e.phase);
        return f.e.hp <= 0;
      });
      assert.deepEqual([...phases].sort(), [0, 1, 2]);
      assertIsolatedVictory(f);
    });

for (const boss of ['loader', 'crane'] as const)
  for (const gun of STARTING_GUN_IDS.filter((gun) => gun !== 'pistol'))
    for (const mirror of [false, true])
      test(`${boss} mirror=${mirror}: native ${gun} can clear using ordinary inputs and legal earned-stage upgrades`, () => {
        const f = nativeFixture(boss, mirror, gun);
        if (boss === 'crane' && gun === 'shotgun') playShotgunCrane(f.g);
        else playRoom(f.g, 180, () => f.e.hp <= 0);
        assert.equal(f.g.startingGun, gun);
        assertIsolatedVictory(f);
      });

test('Loader New Game+ retains full native health and support wave and can be cleared by pistol', () => {
  const f = nativeFixture('loader', false, 'pistol', true);
  const supportRoster = f.g.level.spawns.filter((s) => s.kind !== 'loader');
  assert.equal(supportRoster.length, 3);
  const seen = new Set<string>();
  playRoom(f.g, 240, () => {
    for (const e of f.g.enemies) if (e.kind !== 'loader') seen.add(e.kind);
    return f.e.hp <= 0;
  });
  assert(seen.size >= 2);
  assert(f.g.kills >= 4);
  assertIsolatedVictory(f);
});

test('Crane New Game+ full native health and support wave can be cleared with support-first pistol strategy', () => {
  const f = nativeFixture('crane', false, 'pistol', true);
  assert.equal(f.g.level.spawns.filter((s) => s.kind !== 'crane').length, 3);
  // Prioritize deployed support enemies, then stop cancelling warning-time
  // jumps with upward-shot recoil while focusing the surviving Crane.
  playHookAwareRoom(
    f.g,
    120,
    () => f.g.time > 5 && !f.g.waves.pending && f.g.enemies.every((e) => e.kind === 'crane'),
  );
  assert(f.g.hp > 0);
  assert.equal(f.g.enemies.filter((e) => e.kind !== 'crane').length, 0);
  playShotgunCrane(f.g, 240);
  assert(f.g.kills >= 4);
  assertIsolatedVictory(f);
});
