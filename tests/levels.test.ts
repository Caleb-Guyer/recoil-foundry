import test from 'node:test';
import assert from 'node:assert/strict';
import { getLevel, LAYOUTS, BOSS_LAYOUTS, SPECIAL_LAYOUTS } from '../src/levels.ts';
import { FREIGHT } from '../src/freight-layout.ts';
import { PHYSICS_LAYOUTS } from '../src/physics-layouts.ts';
import { STAGES } from '../src/rules.ts';
import { Game } from '../src/game.ts';
import Matter from 'matter-js';
import { ENEMY_STATS, isBoss } from '../src/enemies.ts';
const overlap = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.1 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.1;
test('twenty-stage seeds produce fifteen regular layouts and a boss at the end of each area', () => {
  const seen = new Set<string>();
  let mirrored = 0;
  for (let i = 0; i < 100; i++) {
    const seed = 'levels-' + i,
      levels = Array.from({ length: STAGES }, (_, stage) => getLevel(seed, stage));
    assert.deepEqual(
      levels,
      Array.from({ length: STAGES }, (_, stage) => getLevel(seed, stage)),
    );
    assert.equal(new Set(levels.map((l) => l.id)).size, STAGES);
    assert.deepEqual(
      levels.map((l) => l.area),
      ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'].flatMap((area) =>
        Array(4).fill(area),
      ),
    );
    for (const [stage, level] of levels.entries()) {
      seen.add(level.id);
      mirrored += Number(level.mirrored);
      assert.equal(level.boss, [3, 7, 11, 15, 19].includes(stage));
      assert.equal(
        level.spawns.some((e) => isBoss(e.kind)),
        level.boss,
      );
      if (level.boss) {
        assert.equal(level.spawns.length, 1);
        if (stage === 3) assert(['loader', 'crane'].includes(level.spawns[0].kind));
        else if (stage === 7) assert(['press', 'kiln'].includes(level.spawns[0].kind));
        else if (stage === 11) assert(['condenser', 'turbine'].includes(level.spawns[0].kind));
        else if (stage === 15) assert(['sorter', 'boss'].includes(level.spawns[0].kind));
        else assert.equal(level.spawns[0].kind, 'interceptor');
      }
      assert(level.solids.length >= 5);
      assert(level.spawns.length > 0);
    }
  }
  assert.equal(seen.size, LAYOUTS.length + BOSS_LAYOUTS.length + SPECIAL_LAYOUTS.length);
  assert(mirrored > 100);
});

test('room-entrance checkpoints reconstruct the correct area across all transitions', () => {
  for (let stage = 0; stage < STAGES; stage++) {
    const save = {
      version: 5 as const,
      seed: 'area-continue',
      stage,
      hp: 63,
      mods: ['burst', 'banker'],
      kills: 12,
      elapsed: 48,
    };
    const g = new Game();
    g.start(save.seed, save);
    assert.equal(g.mode, 'playing');
    assert.deepEqual(g.level, getLevel(save.seed, stage));
    assert.equal(
      g.level.area,
      stage < 4
        ? 'docks'
        : stage < 8
          ? 'furnace'
          : stage < 12
            ? 'cooling'
            : stage < 16
              ? 'reclamation'
              : 'rooftops',
    );
    assert.equal(g.hp, save.hp);
    assert.deepEqual(g.mods, save.mods);
    assert.equal(g.kills, save.kills);
    assert.equal(g.elapsed, save.elapsed);
  }
});
test('all generated enemy hulls, player starts and exits are clear of solid obstacles', () => {
  for (let i = 0; i < 60; i++)
    for (let stage = 0; stage < STAGES; stage++) {
      const level = getLevel('spawn-' + i, stage);
      const actors = [
        { x: 127, y: 662, w: 26, h: 36 },
        ...level.spawns.map((s) => {
          const { w, h } = ENEMY_STATS[s.kind];
          return { x: s.x - w / 2, y: s.y - h / 2, w, h };
        }),
      ];
      for (const s of level.solids) {
        assert(s.w >= 80 && s.h >= 22);
        assert(s.x >= 220 && s.x + s.w <= (level.freight ? 2000 : 1780));
        assert(s.y >= (level.freight ? FREIGHT.top : 200) && s.y + s.h <= 740);
        for (const a of actors) assert(!overlap(a, s), level.id + ' overlapping spawn');
        assert(!overlap(s, { x: 1840, y: 590, w: 160, h: 150 }), level.id + ' blocked exit');
      }
      for (const s of level.spawns) assert(s.kind === 'boss' || s.x >= 380);
    }
});
test('routes and spawn anchors stay aligned when a layout is mirrored', () => {
  for (let i = 0; i < 50; i++)
    for (let stage = 0; stage < STAGES; stage++) {
      const level = getLevel('mirror-' + i, stage),
        source = [...LAYOUTS, ...BOSS_LAYOUTS, ...SPECIAL_LAYOUTS].find((l) => l.id === level.id)!;
      const transformed = source.solids.map((s) => ({
        ...s,
        x: level.mirrored ? 2000 - s.x - s.w : s.x,
      }));
      assert.deepEqual(level.solids, transformed);
      assert(level.route[0].x < level.route.at(-1)!.x);
    }
});
test('every authored route traverses both ways with ordinary jumps and no upgrades', () => {
  const { Body, Bodies, Composite, Query } = Matter;
  for (const source of [...LAYOUTS, ...BOSS_LAYOUTS, ...PHYSICS_LAYOUTS])
    for (const reverse of [false, true]) {
      const g = new Game();
      g.start('route-check');
      for (const prop of [...g.props.items]) g.props.remove(prop);
      for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
      g.enemies = [];
      g.waves.clear();
      for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
      g.terrain = g.terrain.slice(0, 4);
      for (const s of source.solids) {
        const b = Bodies.rectangle(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, {
          isStatic: true,
          friction: 0,
          label: 'terrain',
        });
        g.terrain.push(b);
        Composite.add(g.engine.world, b);
      }
      g.level = { ...source, mirrored: false, boss: BOSS_LAYOUTS.includes(source) };
      g.props.reset(g.level);
      Body.setPosition(g.player, { x: reverse ? 1860 : 140, y: 680 });
      const path = (reverse ? [...source.route].reverse() : [...source.route]).concat([
        { x: reverse ? 100 : 1900, y: 720 },
      ]);
      let index = 0,
        previousX = g.player.position.x,
        stuck = 0;
      for (let i = 0; i < 3600 && g.mode === 'playing' && index < path.length; i++) {
        const p = g.player.position,
          target = path[index],
          dx = target.x - p.x,
          dy = p.y - target.y;
        if (Math.abs(dx) < 40 && Math.abs(dy) < 65) {
          index++;
          continue;
        }
        stuck = Math.abs(p.x - previousX) < 0.4 ? stuck + 1 : 0;
        previousX = p.x;
        const move = dx > 12 ? 1 : dx < -12 ? -1 : 0;
        const blocked =
          move && Query.ray(g.solidBodies, p, { x: p.x + move * 70, y: p.y }, 24).length > 0;
        g.tick(1 / 60, {
          left: move < 0,
          right: move > 0,
          jump: g.grounded && (dy > 50 || !!blocked || stuck > 12),
          jumpHeld: true,
          fire: false,
          aim: { x: p.x, y: p.y + 500 },
        });
        if (!reverse && g.mode === 'upgrade') {
          index = path.length;
          break;
        }
      }
      assert(
        index >= path.length,
        source.id + (reverse ? ' reversed' : '') + ' route stopped at ' + index,
      );
    }
});
