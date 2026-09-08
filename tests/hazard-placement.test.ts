import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { getLevel, LAYOUTS } from '../src/levels.ts';
import type { Level, Solid } from '../src/levels.ts';
import { hazardBounds, hazardPlacement } from '../src/hazard-layouts.ts';
import type { HazardKind } from '../src/hazard-layouts.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { Game } from '../src/game.ts';
import { STAGES } from '../src/rules.ts';

const overlaps = (a: Solid, b: Solid) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

test('hazards introduce one type at a time and keep sweeps, headroom, spawns and exits clear', () => {
  const coverage = new Set<string>();
  const kinds = new Set<HazardKind>();
  let lowCrusher = 0;
  for (let index = 0; index < 256; index++) {
    const seed = 'hazard-' + index;
    for (let stage = 0; stage < STAGES; stage++) {
      const level = getLevel(seed, stage);
      const before = JSON.stringify(level);
      const hazard = hazardPlacement(level, seed, stage);
      assert.equal(JSON.stringify(level), before, 'Hazards must not rewrite the room or route');
      if (stage === 0 || level.boss) {
        assert.equal(hazard, undefined);
        continue;
      }
      assert(hazard, `${seed}, ${level.id}, room ${stage + 1}: missing safe feature`);
      const introduced = ({ 1: 'lift', 4: 'crusher', 12: 'crumble' } as Record<number, string>)[
        stage
      ];
      if (introduced) assert.equal(hazard.kind, introduced);
      if (stage === 5) assert.notEqual(hazard.kind, 'crumble');
      coverage.add(level.id + ':' + level.mirrored);
      kinds.add(hazard.kind);
      const bounds = hazardBounds(hazard);
      const riders = hazardBounds(hazard, 44);
      assert(bounds.x >= 200 && bounds.x + bounds.w <= 1800);
      assert(bounds.y >= 380 && bounds.y + bounds.h <= 740);
      assert(!overlaps(bounds, { x: 110, y: 640, w: 65, h: 100 }));
      assert(!overlaps(bounds, { x: 1840, y: 590, w: 160, h: 150 }));
      if (hazard.kind === 'crusher') {
        assert.equal(hazard.y + hazard.travel, 708);
        assert([430, 470].includes(hazard.y));
        lowCrusher += Number(hazard.y === 470);
      } else {
        assert(740 - hazard.y <= 145, 'Platform must be reachable by an ordinary jump');
        assert(hazard.y + hazard.h <= 688, 'A full player hull must fit below the platform');
        assert.equal(hazard.travel, hazard.kind === 'lift' ? 160 : 0);
      }
      for (const solid of level.solids) {
        assert(!overlaps(riders, solid), `${level.id}: obstructed sweep or rider headroom`);
        const floorSpace =
          hazard.kind === 'crusher'
            ? { x: bounds.x - 36, y: 700, w: bounds.w + 72, h: 40 }
            : { x: bounds.x, y: hazard.y + hazard.h, w: bounds.w, h: 740 - hazard.y - hazard.h };
        assert(!overlaps(floorSpace, solid), `${level.id}: blocked floor or crusher escape`);
      }
      for (const spawn of level.spawns) {
        const { w, h } = ENEMY_STATS[spawn.kind];
        assert(!overlaps(bounds, { x: spawn.x - w / 2, y: spawn.y - h / 2, w, h }));
      }
      assert.deepEqual(hazardPlacement(level, seed, stage), hazard);
    }
  }
  assert.equal(coverage.size, LAYOUTS.length * 2);
  assert.equal(kinds.size, 3);
  assert(lowCrusher > 0, 'Low overhead cover should exercise the safe lower crusher rest');
});

test('hazard selection mirrors with the actual geometry and does not depend on request order', () => {
  for (let index = 0; index < 64; index++) {
    const seed = 'hazard-mirror-' + index;
    for (const stage of [9, 1, 5, 8, 4]) {
      const level = getLevel(seed, stage);
      const hazard = hazardPlacement(level, seed, stage)!;
      const mirrored: Level = {
        ...level,
        mirrored: !level.mirrored,
        solids: level.solids.map((solid) => ({ ...solid, x: 2000 - solid.x - solid.w })),
        spawns: level.spawns.map((spawn) => ({ ...spawn, x: 2000 - spawn.x })),
        route: level.route.map((point) => ({ ...point, x: 2000 - point.x })).reverse(),
      };
      assert.deepEqual(hazardPlacement(mirrored, seed, stage), { ...hazard, x: 2000 - hazard.x });
      hazardPlacement(getLevel('unrelated', 4), 'unrelated', 3);
      assert.deepEqual(hazardPlacement(level, seed, stage), hazard);
    }
  }
});

test('unsafe rooms omit their optional feature instead of overlapping cover or changing introduction type', () => {
  const level = getLevel('hazard-blocked', 1);
  level.solids = [{ x: 180, y: 100, w: 1640, h: 640 }];
  const before = JSON.stringify(level);
  for (const stage of [1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14])
    assert.equal(hazardPlacement(level, 'hazard-blocked', stage), undefined);
  assert.equal(JSON.stringify(level), before);
  assert.equal(hazardPlacement({ ...level, solids: [], boss: true }, 'boss', 3), undefined);
});

test('all layout orientations remain traversable with active hazards, ordinary jumps and normal health', () => {
  const { Composite, Query } = Matter;
  const cases = new Map<string, { seed: string; stage: number }>();
  for (let index = 0; index < 256 && cases.size < LAYOUTS.length * 2; index++) {
    const seed = 'hazard-route-' + index;
    for (const stage of [1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]) {
      const level = getLevel(seed, stage);
      if (hazardPlacement(level, seed, stage))
        cases.set(level.id + ':' + level.mirrored, { seed, stage });
    }
  }
  assert.equal(cases.size, LAYOUTS.length * 2);
  for (const [label, { seed, stage }] of cases) {
    const game = new Game();
    game.start(seed, { version: 4, seed, stage, hp: 100, mods: [], kills: 0, elapsed: 0 });
    assert.equal(game.hazards.items.length, 1, label);
    for (const prop of [...game.props.items]) game.props.remove(prop);
    for (const enemy of game.enemies) Composite.remove(game.engine.world, enemy.body);
    game.enemies = [];
    game.waves.clear();
    const path = [...game.level.route, { x: 1900, y: 720 }];
    let waypoint = 0;
    let previousX = game.player.position.x;
    let stuck = 0;
    for (let tick = 0; tick < 3600 && game.mode === 'playing' && waypoint < path.length; tick++) {
      const position = game.player.position;
      const target = path[waypoint];
      const dx = target.x - position.x;
      const dy = position.y - target.y;
      const ridingLift =
        dy < -65 &&
        game.hazards.items.some(
          (hazard) =>
            hazard.kind === 'lift' &&
            hazard.visible &&
            game.hazards.supported(game.player, hazard.body),
        );
      // A lift can replace a floor waypoint with a higher crossing. Keep walking
      // after boarding it instead of demanding a return to the floor underneath.
      if (Math.abs(dx) < 40 && (Math.abs(dy) < 65 || ridingLift)) {
        waypoint++;
        continue;
      }
      stuck = Math.abs(position.x - previousX) < 0.4 ? stuck + 1 : 0;
      previousX = position.x;
      const move = dx > 12 ? 1 : dx < -12 ? -1 : 0;
      const blocked =
        move &&
        Query.ray(game.solidBodies, position, { x: position.x + move * 70, y: position.y }, 24)
          .length > 0;
      game.tick(1 / 60, {
        left: move < 0,
        right: move > 0,
        jump: game.grounded && (dy > 50 || !!blocked || stuck > 12),
        jumpHeld: true,
        fire: false,
        aim: { x: position.x, y: position.y + 500 },
      });
    }
    assert(game.hp > 0, `${label}: route killed the ordinary walker`);
    assert(
      waypoint === path.length || game.mode === 'upgrade',
      `${label}: ${game.hazards.items[0].kind} stopped waypoint ${waypoint} at ${Math.round(game.player.position.x)},${Math.round(game.player.position.y)}`,
    );
  }
});
