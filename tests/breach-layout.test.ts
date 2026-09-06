import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { breachPlacement } from '../src/breach-layout.ts';
import type { BreachPlacement } from '../src/breach-layout.ts';
import { getLevel, LAYOUTS } from '../src/levels.ts';
import type { Level, Solid } from '../src/levels.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { hazardBounds, hazardPlacement } from '../src/hazard-layouts.ts';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { segmentBox } from '../src/rules.ts';

const overlaps = (a: Solid, b: Solid) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const mirrorRect = (s: Solid): Solid => ({ ...s, x: 2000 - s.x - s.w });
const mirrorPoint = <T extends { x: number; y: number }>(p: T): T => ({ ...p, x: 2000 - p.x });

test('sparse vents preserve authored geometry, actors, route, hazard sweep and safe room ends', () => {
  const coverage = new Set<string>();
  let count = 0;
  let pickups = 0;
  let attached = 0;
  let freestanding = 0;
  for (let i = 0; i < 256; i++) {
    const seed = 'breach-' + i;
    let runPickups = 0;
    for (let stage = 0; stage < 9; stage++) {
      const level = getLevel(seed, stage);
      const before = JSON.stringify(level);
      const vent = breachPlacement(level, seed, stage);
      assert.equal(JSON.stringify(level), before);
      if (![1, 4, 7].includes(stage) || level.boss) {
        assert.equal(vent, null);
        continue;
      }
      if (!vent) continue;
      count++;
      runPickups += Number(!!vent.pickup);
      coverage.add(level.id + ':' + level.mirrored);
      attached += Number(vent.solids.length === 4);
      freestanding += Number(vent.solids.length === 5);
      assert.equal(vent.panels.length, 2);
      assert.deepEqual([vent.panels[0].w, vent.panels[0].h], [116, 14]);
      assert.deepEqual([vent.panels[1].w, vent.panels[1].h], [14, 84]);
      assert(vent.approach.y - vent.destination.y >= 70);
      assert(vent.approach.y - vent.destination.y <= 360);
      const pieces = [...vent.solids, ...vent.panels];
      const hazard = hazardPlacement(level, seed, stage);
      const path = [{ x: 140, y: 680 }, ...level.route, { x: 1910, y: 720 }];
      for (const piece of pieces) {
        assert(piece.x >= 280 && piece.x + piece.w <= 1720);
        assert(piece.y > 200 && piece.y + piece.h < 660);
        for (const solid of level.solids) assert(!overlaps(piece, solid), level.id);
        for (const other of pieces) if (piece !== other) assert(!overlaps(piece, other));
        for (const spawn of level.spawns) {
          const { w, h } = ENEMY_STATS[spawn.kind];
          assert(!overlaps(piece, { x: spawn.x - w / 2, y: spawn.y - h / 2, w, h }));
        }
        if (hazard) assert(!overlaps(piece, hazardBounds(hazard, 44)));
        assert(
          !path
            .slice(1)
            .some((p, j) =>
              segmentBox(
                path[j],
                p,
                { x: piece.x - 18, y: piece.y - 24 },
                { x: piece.x + piece.w + 18, y: piece.y + piece.h + 24 },
              ),
            ),
        );
      }
      const destinationHull = {
        x: vent.destination.x - 13,
        y: vent.destination.y - 18,
        w: 26,
        h: 36,
      };
      assert(![...level.solids, ...pieces].some((s) => overlaps(destinationHull, s)));
      assert(
        [...level.solids, ...vent.solids].some(
          (s) =>
            s.y === vent.destination.y + 18 &&
            s.x <= destinationHull.x &&
            s.x + s.w >= destinationHull.x + 26,
        ),
      );
      assert.deepEqual(breachPlacement(level, seed, stage), vent);
    }
    assert(runPickups <= 2, 'A run must not add more than two supply detours');
    pickups += runPickups;
  }
  assert.equal(coverage.size, LAYOUTS.length * 2);
  assert(count > 256 * 3 * 0.9, `Only ${count}/768 eligible rooms have a usable vent`);
  assert(pickups > 450);
  assert(attached > 0 && freestanding > 0);
});

test('vents mirror with actual room geometry and reconstruct independently from checkpoints', () => {
  for (let i = 0; i < 64; i++) {
    const seed = 'breach-mirror-' + i;
    for (const stage of [7, 1, 4]) {
      const level = getLevel(seed, stage);
      const vent = breachPlacement(level, seed, stage);
      const mirrored: Level = {
        ...level,
        mirrored: !level.mirrored,
        solids: level.solids.map(mirrorRect),
        spawns: level.spawns.map(mirrorPoint),
        route: level.route.map(mirrorPoint).reverse(),
      };
      assert.deepEqual(
        breachPlacement(mirrored, seed, stage),
        vent && {
          ...vent,
          solids: vent.solids.map(mirrorRect),
          panels: vent.panels.map(mirrorRect),
          pickup: vent.pickup && mirrorPoint(vent.pickup),
          approach: mirrorPoint(vent.approach),
          destination: mirrorPoint(vent.destination),
        },
        `${seed} ${level.id}`,
      );
      breachPlacement(getLevel('unrelated', 1), 'unrelated', 1);
      assert.deepEqual(breachPlacement(level, seed, stage), vent);
    }
  }
  const seed = 'breach-checkpoint';
  const game = new Game();
  game.start(seed, { version: 3, seed, stage: 4, hp: 67, mods: [], kills: 12, elapsed: 95 });
  const expected = structuredClone(game.breaches.placement);
  game.breaches.clear();
  game.loadRoom();
  assert.deepEqual(game.breaches.placement, expected);
});

test('ineligible and obstructed rooms safely omit the optional passage', () => {
  const level = getLevel('no-breach', 1);
  const blocked = { ...level, solids: [{ x: 0, y: 0, w: 2000, h: 740 }] };
  assert.equal(breachPlacement(blocked, 'no-breach', 1), null);
  assert.equal(breachPlacement({ ...level, boss: true }, 'no-breach', 1), null);
  assert.equal(breachPlacement({ ...level, id: 'last-flight' }, 'no-breach', 7), null);
});

function cases() {
  const result = new Map<string, { seed: string; stage: number }>();
  for (let i = 0; i < 256 && result.size < LAYOUTS.length * 2; i++) {
    const seed = 'breach-route-' + i;
    for (const stage of [1, 4, 7]) {
      const level = getLevel(seed, stage);
      if (breachPlacement(level, seed, stage))
        result.set(level.id + ':' + level.mirrored, { seed, stage });
    }
  }
  assert.equal(result.size, LAYOUTS.length * 2);
  return result;
}

function fixture(seed: string, stage: number) {
  const game = new Game();
  game.start(seed, { version: 3, seed, stage, hp: 100, mods: [], kills: 0, elapsed: 0 });
  for (const enemy of game.enemies) Matter.Composite.remove(game.engine.world, enemy.body);
  game.enemies = [];
  for (const prop of [...game.props.items]) game.props.remove(prop);
  return game;
}

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 0, y: 0 },
};

test('all layout orientations keep their ordinary route with panels intact and hazards active', () => {
  for (const [label, { seed, stage }] of cases()) {
    const game = fixture(seed, stage);
    const path = [...game.level.route, { x: 1900, y: 720 }];
    let waypoint = 0,
      previousX = game.player.position.x,
      stuck = 0;
    for (let tick = 0; tick < 3600 && game.mode === 'playing' && waypoint < path.length; tick++) {
      const p = game.player.position,
        target = path[waypoint];
      const dx = target.x - p.x,
        dy = p.y - target.y;
      const riding =
        dy < -65 &&
        game.hazards.items.some(
          (h) => h.kind === 'lift' && h.visible && game.hazards.supported(game.player, h.body),
        );
      if (Math.abs(dx) < 40 && (Math.abs(dy) < 65 || riding)) {
        waypoint++;
        continue;
      }
      stuck = Math.abs(p.x - previousX) < 0.4 ? stuck + 1 : 0;
      previousX = p.x;
      // A lift can interrupt a jump across a gap. Return to the previous
      // footing and retry once its phase changes instead of jumping at a wall.
      if (stuck > 90 && waypoint > 0) {
        waypoint--;
        stuck = 0;
        continue;
      }
      const move = dx > 12 ? 1 : dx < -12 ? -1 : 0;
      const blocked =
        move &&
        Matter.Query.ray(game.solidBodies, p, { x: p.x + move * 70, y: p.y }, 24).length > 0;
      game.tick(1 / 60, {
        ...idle,
        left: move < 0,
        right: move > 0,
        jump: game.grounded && ((dy > 50 && Math.abs(dx) < 270) || !!blocked || stuck > 12),
      });
    }
    assert(game.hp > 0, label);
    assert(
      waypoint === path.length || game.mode === 'upgrade',
      `${label}: blocked at ${JSON.stringify(game.player.position)}, waypoint ${waypoint}`,
    );
    assert.equal(game.shotCount, 0);
    assert.equal(game.breaches.panels.length, 2);
  }
});

function usePassage(game: Game, vent: BreachPlacement) {
  // Isolate the optional route at its documented entry, using the baseline gun
  // and real input for both destructible panels, recoil ascent and perch landing.
  Matter.Body.setPosition(game.player, vent.approach);
  const floor = vent.panels[0].y;
  const sign = Math.sign(vent.destination.x - vent.approach.x);
  const exit = { x: vent.panels[1].x + 7, y: vent.panels[1].y + 42 };
  let entered = false;
  for (let frame = 0; frame < 1200; frame++) {
    const p = game.player.position;
    if (
      game.breaches.panels.length === 0 &&
      Math.abs(p.x - vent.destination.x) < 24 &&
      Math.abs(p.y - vent.destination.y) < 4 &&
      game.grounded
    )
      return { entered, frames: frame };
    const hatch = game.breaches.panels.find((panel) => panel.rect.w > panel.rect.h);
    const inside = p.y < floor - 20;
    entered ||= inside && Math.abs(p.x - vent.approach.x) < 55;
    const onRim = (p.x - vent.approach.x) * sign > 64;
    let input = { ...idle };
    if (hatch) input = { ...input, fire: true, aim: hatch.body.position };
    else if (!inside && !onRim)
      input = { ...input, jump: game.grounded, fire: true, aim: { x: p.x, y: p.y + 500 } };
    else {
      const dx = vent.destination.x - p.x;
      input = {
        ...input,
        left: dx < -5,
        right: dx > 5,
        fire: onRim && game.breaches.panels.length > 0,
        aim: exit,
      };
    }
    game.tick(1 / 60, input);
  }
  assert.fail(
    `Passage ${vent.id}: player ${JSON.stringify(game.player.position)}, panels ${game.breaches.panels.length}`,
  );
}

test('baseline shots and downward recoil open the hatch, pass through the chamber and land on every layout perch', () => {
  for (const [label, { seed, stage }] of cases()) {
    const game = fixture(seed, stage);
    const vent = game.breaches.placement!;
    const result = usePassage(game, vent);
    assert(result.entered, label);
    assert(result.frames < 900, label);
    assert.equal(game.hp, 100, label);
    assert(game.shotCount >= 4, label);
  }
});
