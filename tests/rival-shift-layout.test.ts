import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { getLevel, type Level } from '../src/levels.ts';
import { getOvertimeLevel } from '../src/overtime.ts';
import {
  RIVAL_SHIFT_ARENAS,
  rivalShiftLevel,
  rivalShiftFans,
  rivalShiftBelts,
} from '../src/rival-shift-layout.ts';
import {
  RIVAL_SHIFT_BOSSES,
  rivalShiftCampaign,
  type RivalShiftBoss,
} from '../src/rival-shift-rules.ts';
import { rivalShiftTestFromUrl } from '../src/rival-shift-test.ts';
import type { Vec } from '../src/rules.ts';
import { ENEMY_STATS } from '../src/enemies.ts';

const BOSSES = Object.keys(RIVAL_SHIFT_BOSSES) as RivalShiftBoss[];
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1900, y: 300 },
};
function parsed(boss: RivalShiftBoss, phase = 1, mirror = false, ng = false) {
  const scene = rivalShiftTestFromUrl(
    new URL(
      `https://test/?test=rival-shift&boss=${RIVAL_SHIFT_BOSSES[boss].url}&phase=${phase}&mirror=${mirror ? 1 : 0}&ng=${ng ? 1 : 0}&v=1`,
    ),
  );
  assert(scene);
  return scene;
}
function fixture(boss: RivalShiftBoss, phase = 1, mirror = false, ng = false) {
  const g = new Game();
  g.startTest(parsed(boss, phase, mirror, ng).checkpoint);
  return g;
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
const points = (b: Matter.Body) => b.vertices.map(({ x, y }) => ({ x, y }));
function bounds(b: Matter.Body) {
  const p = points(b);
  return {
    left: Math.min(...p.map((v) => v.x)),
    right: Math.max(...p.map((v) => v.x)),
    top: Math.min(...p.map((v) => v.y)),
    bottom: Math.max(...p.map((v) => v.y)),
  };
}
function penetrates(a: readonly Vec[], b: readonly Vec[]) {
  for (const polygon of [a, b])
    for (let i = 0; i < polygon.length; i++) {
      const edge = {
        x: polygon[(i + 1) % polygon.length].x - polygon[i].x,
        y: polygon[(i + 1) % polygon.length].y - polygon[i].y,
      };
      const n = Math.hypot(edge.x, edge.y);
      if (n < 1e-9) continue;
      const axis = { x: -edge.y / n, y: edge.x / n },
        aa = a.map((p) => p.x * axis.x + p.y * axis.y),
        bb = b.map((p) => p.x * axis.x + p.y * axis.y);
      if (
        Math.min(Math.max(...aa), Math.max(...bb)) - Math.max(Math.min(...aa), Math.min(...bb)) <=
        1e-6
      )
        return false;
    }
  return true;
}
function nativeSeed(prefix: string, boss: RivalShiftBoss, mirror = false, ng = false) {
  for (let i = 0; i < 256; i++) {
    const seed = prefix + i,
      stage = RIVAL_SHIFT_BOSSES[boss].stage;
    const level = ng ? getOvertimeLevel(seed, stage, 5) : getLevel(seed, stage);
    if (level.mirrored === mirror && level.spawns[0]?.kind === boss) return seed;
  }
  throw new Error('No native seed');
}
function context(seed: string, boss: RivalShiftBoss, ng = false) {
  return {
    seed,
    stage: RIVAL_SHIFT_BOSSES[boss].stage,
    overtime: ng ? { baseMods: 19, repairs: 0, remix: 5 } : null,
    escape: false,
    detour: null,
    inAnnex: false,
    workshop: { active: false },
  } as Game;
}

test('only new Campaign and new NG+ arenas opt into Rival Shift; historical and special records stay exact', () => {
  for (const seed of [
    'HISTORY',
    'RF-C103-HISTORY',
    'RF-C102-OT-HISTORY',
    'RF-D104-HISTORY',
    'RF-C94-HISTORY',
    null,
    undefined,
  ])
    assert.equal(rivalShiftCampaign(seed), false);
  assert(rivalShiftCampaign('RF-C104-HISTORY'));
  assert(rivalShiftCampaign('RF-C105-OT-HISTORY'));
  for (const boss of BOSSES)
    for (const ng of [false, true]) {
      const prefix = ng ? 'RF-C103-OT-AUDIT-' : 'RF-C103-AUDIT-';
      const historicalSeed = nativeSeed(prefix, boss, false, ng),
        historical = context(historicalSeed, boss, ng);
      const old = ng
        ? getOvertimeLevel(historicalSeed, historical.stage, 5)
        : getLevel(historicalSeed, historical.stage);
      assert.equal(rivalShiftLevel(historical, old), old);
      const seed = nativeSeed('RF-C104-AUDIT-', boss, false, ng),
        g = context(seed, boss, ng);
      const original = ng ? getOvertimeLevel(seed, g.stage, 5) : getLevel(seed, g.stage);
      const before = structuredClone(original),
        remastered = rivalShiftLevel(g, original);
      assert.equal(remastered.id, RIVAL_SHIFT_ARENAS[boss].id);
      assert.deepEqual(original, before, 'layout transformation never mutates source records');
      assert.equal(
        remastered.spawns.length,
        original.spawns.length,
        'every native support survives',
      );
      for (const flag of ['escape', 'detour', 'inAnnex'] as const) {
        const special = { ...g, [flag]: true } as Game;
        assert.equal(rivalShiftLevel(special, original), original, flag);
      }
      assert.equal(
        rivalShiftLevel({ ...g, workshop: { active: true } } as Game, original),
        original,
      );
      assert.equal(rivalShiftLevel({ ...g, stage: 19 } as Game, original), original);
      const ordinary = { ...original, boss: false };
      assert.equal(rivalShiftLevel(g, ordinary), ordinary);
      const remixed = { ...original, bossRemix: 'condenser-cold-circuit' } as Level;
      assert.equal(rivalShiftLevel(g, remixed), remixed);
    }
});

test('Rival Shift physical terrain, complete native support rosters, props and door approaches have no overlaps', () => {
  for (const boss of BOSSES)
    for (const mirror of [false, true])
      for (const ng of [false, true]) {
        const g = fixture(boss, ng ? 2 : 1, mirror, ng),
          label = `${boss}/${mirror}/${ng}`;
        assert.equal(g.level.id, RIVAL_SHIFT_ARENAS[boss].id);
        const pending = g.waves.doors.map(({ spawn }) =>
          Matter.Bodies.rectangle(
            spawn.x,
            spawn.y,
            ENEMY_STATS[spawn.kind].w,
            ENEMY_STATS[spawn.kind].h,
          ),
        );
        const actors = [g.player, ...g.enemies.map((e) => e.body), ...g.props.bodies, ...pending];
        assert.deepEqual(bounds(g.terrain[0]), { left: 0, right: 2000, top: 740, bottom: 840 });
        assert.equal(g.terrain.length, 4 + g.level.solids.length);
        for (const [i, body] of g.terrain.slice(4).entries()) {
          const s = g.level.solids[i];
          assert.deepEqual(bounds(body), {
            left: s.x,
            right: s.x + s.w,
            top: s.y,
            bottom: s.y + s.h,
          });
        }
        for (const [i, body] of actors.entries()) {
          const b = bounds(body);
          assert(
            b.left >= 0 && b.right <= 2000 && b.top >= 0 && b.bottom <= 740,
            label + ' actor is in arena',
          );
          for (const solid of g.terrain)
            assert(!penetrates(points(body), points(solid)), label + ' actor embedded in terrain');
          for (const other of actors.slice(i + 1))
            assert(!penetrates(points(body), points(other)), label + ' actor overlap');
        }
        for (const body of [...g.terrain.slice(4), ...g.props.bodies]) {
          const b = bounds(body);
          assert(b.right <= 1860 && b.left >= 180, label + ' entry/exit approaches clear');
        }
        const scene = parsed(boss, ng ? 2 : 1, mirror, ng),
          native = ng
            ? getOvertimeLevel(scene.checkpoint.seed, g.stage, 5)
            : getLevel(scene.checkpoint.seed, g.stage);
        assert.deepEqual(
          [...g.enemies.slice(1).map((e) => e.kind), ...g.waves.doors.map((d) => d.spawn.kind)],
          native.spawns.slice(1).map((e) => e.kind),
        );
        dispose(g);
      }
});

test('phase machinery has clear mirrored shafts, ground-only belts and no exit or cover overlap', () => {
  for (const mirror of [false, true])
    for (const phase of [0, 1, 2]) {
      const fans = rivalShiftFans(phase, mirror),
        belts = rivalShiftBelts(phase, mirror);
      assert.equal(fans.length, phase);
      const solids = RIVAL_SHIFT_ARENAS.turbine.solids.map((s) => ({
        ...s,
        x: mirror ? 2000 - s.x - s.w : s.x,
      }));
      for (const f of fans) {
        assert.equal(f.y, 738);
        assert.equal(f.dir.y, -1);
        assert.equal(f.dir.x, 0);
        const left = f.x - f.width / 2,
          right = f.x + f.width / 2,
          top = f.y - f.length;
        for (const s of solids)
          assert(
            !(left < s.x + s.w && right > s.x && top < s.y + s.h && f.y > s.y),
            'fan shaft reaches clear air',
          );
      }
      for (const b of belts) {
        assert.equal(b.y, 740);
        assert(b.x > 180 && b.x + b.w < 1860);
        for (const s of RIVAL_SHIFT_ARENAS.boss.solids.map((s) => ({
          ...s,
          x: mirror ? 2000 - s.x - s.w : s.x,
        })))
          assert(
            !(s.y + s.h === 740 && b.x < s.x + s.w && b.x + b.w > s.x),
            'belt occupies real exposed floor',
          );
      }
      assert.deepEqual(
        rivalShiftFans(phase, false).map((f) => 2000 - f.x),
        rivalShiftFans(phase, true).map((f) => f.x),
      );
      assert.deepEqual(
        rivalShiftBelts(phase, false).map((b) => -b.speed),
        rivalShiftBelts(phase, true).map((b) => b.speed),
      );
    }
});

// Ordinary movement only: native attacks, force, cover, collisions and player health stay live.
test('running and jumping crosses both remastered arenas in every normal phase and mirror without recoil', () => {
  for (const boss of BOSSES)
    for (const phase of [1, 2, 3])
      for (const mirror of [false, true]) {
        const g = fixture(boss, phase, mirror),
          label = `${boss}/${phase}/${mirror}`;
        let previous = g.player.position.x,
          stuck = 0,
          jumps = 0;
        for (
          let frame = 0;
          frame < 900 && g.mode === 'playing' && g.player.position.x < 1880;
          frame++
        ) {
          const p = g.player.position,
            b = bounds(g.player);
          stuck = Math.abs(p.x - previous) < 0.2 ? stuck + 1 : 0;
          previous = p.x;
          const next = g.solidBodies.some((body) => {
            const o = bounds(body);
            return (
              o.left < b.right + 105 &&
              o.right > b.right + 2 &&
              o.top < b.bottom - 5 &&
              o.top > b.bottom - 185
            );
          });
          const jump = g.grounded && (next || stuck > 8);
          if (jump) jumps++;
          g.tick(1 / 60, { ...idle, right: true, jump });
          assert([g.hp, p.x, p.y].every(Number.isFinite));
          assert(bounds(g.player).bottom <= 741, label + ' fell through floor');
        }
        for (let i = 0; i < 120 && g.mode === 'playing' && !g.grounded; i++) g.tick(1 / 60, idle);
        assert.equal(g.mode, 'playing', label + ' survives crossing');
        assert(
          g.hp > 0 && g.player.position.x >= 1860,
          label + ': blocked at ' + JSON.stringify(g.player.position),
        );
        assert(g.grounded, label + ' lands on native floor');
        assert.equal(g.shotCount, 0);
        assert(jumps > 0);
        assert(g.enemies.some((e) => e.kind === boss && e.hp > 0));
        dispose(g);
      }
});
