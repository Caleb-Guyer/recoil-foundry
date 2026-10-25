import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { PROP_STATS } from '../src/props.ts';
import { validCombatFlowSpec } from '../src/combat-flow-rules.ts';
import { splitWaves } from '../src/reinforcements.ts';
import { hazardBounds } from '../src/hazard-layouts.ts';
import { getRouteLevel } from '../src/route-layouts.ts';
import type { Level, Solid } from '../src/levels.ts';
import { segmentBox, type Checkpoint, type RouteChoice } from '../src/rules.ts';
import {
  chooseRouteSeed,
  remasterRouteLevel,
  routeRemasterRoom,
  routeRemasterTraits,
  ROUTE_REMASTERS,
  ROUTE_REMASTER_IDS,
} from '../src/route-remaster.ts';
import { playRoom } from './room-pilot.ts';

const overlap = (a: Solid, b: Solid) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.1 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.1;
const cases = ROUTE_REMASTER_IDS.flatMap((id) =>
  [false, true].map((mirror) => ({ id, mirror, ...ROUTE_REMASTERS[id] })),
);
const levelFor = (room: (typeof cases)[number]) =>
  routeRemasterRoom(room.stage, room.route, room.mirror);
function gameFor(room: (typeof cases)[number]) {
  const checkpoint: Checkpoint = {
    version: 6,
    seed: 'RF-C101-ROUTE-TEST',
    stage: room.stage,
    route: room.route,
    hp: 100,
    mods: [],
    missedUpgrades: room.stage,
    kills: 0,
    elapsed: 0,
    startingGun: 'pistol',
    encounters: 1,
  };
  const g = new Game();
  g.startTest(checkpoint, levelFor(room));
  // The explicit layout is fixed above; keep the ordinary test lifecycle for traversal.
  if (g.testRun) delete g.testRun.rematchRoom;
  return g;
}
const dispose = (g: Game) => {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
};

test('only new Campaign route identities remaster the four middle-zone branches', () => {
  assert(chooseRouteSeed('RF-C101-X'));
  assert(chooseRouteSeed('RF-C102-X'));
  for (const seed of ['RF-C100-X', 'RF-C99-X', 'RF-D90-2026-10-25', 'RF-C101-OT-X', 'custom', ''])
    assert(!chooseRouteSeed(seed));
  for (const stage of [6, 10])
    for (const route of ['low', 'high'] as const) {
      const before = getRouteLevel('RF-C100-UNCHANGED', stage, route),
        snapshot = structuredClone(before);
      for (const seed of ['RF-C100-X', 'RF-C99-X', 'RF-D90-2026-10-25', 'RF-C101-OT-X'])
        assert.equal(remasterRouteLevel(before, seed, stage, route), before);
      const next = remasterRouteLevel(before, 'RF-C101-X', stage, route);
      assert.notEqual(next, before);
      assert.equal(next.mirrored, before.mirrored);
      assert.deepEqual(before, snapshot);
      for (const special of [
        { ...before, boss: true },
        { ...before, detour: true as const },
        { ...before, annex: true as const },
        { ...before, routeChoice: undefined },
      ])
        assert.equal(remasterRouteLevel(special, 'RF-C101-X', stage, route), special);
    }
  const other = getRouteLevel('RF-C101-X', 2, 'low');
  assert.equal(remasterRouteLevel(other, 'RF-C101-X', 2, 'low'), other);
});

test('all four layouts, physical anchors and moving machinery have clearance in both mirrors', () => {
  for (const room of cases) {
    const l = levelFor(room);
    assert.equal(l.name, room.name);
    assert.equal(l.id, room.id);
    assert.equal(l.routeChoice, room.route);
    assert.equal(l.route[0].x, room.mirror ? 190 : 280);
    assert(l.route.at(-1)!.x > l.route[0].x);
    const actors = l.spawns.map((s) => {
      const d = ENEMY_STATS[s.kind];
      return { x: s.x - d.w / 2, y: s.y - d.h / 2, w: d.w, h: d.h };
    });
    for (const body of [
      { x: 127, y: 660, w: 26, h: 60 },
      { x: 1840, y: 590, w: 160, h: 150 },
      ...actors,
    ])
      for (const solid of l.solids)
        assert(!overlap(body, solid), room.id + ' actor/terrain ' + JSON.stringify(body));
    const supports = [{ x: 0, y: 740, w: 2000, h: 100 }, ...l.solids];
    for (const spawn of l.spawns)
      if (!['flyer', 'skimmer'].includes(spawn.kind)) {
        const d = ENEMY_STATS[spawn.kind];
        assert(
          supports.some(
            (s) =>
              Math.abs(s.y - spawn.y - d.h / 2) < 0.1 &&
              spawn.x - d.w / 2 >= s.x &&
              spawn.x + d.w / 2 <= s.x + s.w,
          ),
          room.id + ' unsupported spawn',
        );
      }
    const props = l.setpiece!.props.map((p) => {
      const d = PROP_STATS[p.kind];
      return { x: p.x - d.w / 2, y: p.y - d.h / 2, w: d.w, h: d.h };
    });
    for (const body of props) {
      for (const solid of l.solids) assert(!overlap(body, solid), room.id + ' prop/terrain');
      for (const actor of actors) assert(!overlap(body, actor), room.id + ' prop/spawn');
      assert(
        supports.some(
          (s) =>
            Math.abs(s.y - body.y - body.h) < 0.1 && body.x >= s.x && body.x + body.w <= s.x + s.w,
        ),
        room.id + ' unsupported prop',
      );
    }
    for (const lift of l.hazards ?? []) {
      const swept = hazardBounds(lift, 44);
      for (const solid of l.solids)
        assert(!overlap(swept, solid), room.id + ' lift/rider headroom');
      for (const body of [...actors, ...props])
        assert(!overlap(swept, body), room.id + ' machinery/anchor');
    }
    for (const vent of l.vents ?? []) {
      const valve = { x: vent.valve.x - 13, y: vent.valve.y - 13, w: 26, h: 26 };
      for (const solid of l.solids) assert(!overlap(valve, solid), room.id + ' clipped valve');
    }
    for (const pool of l.coolant ?? [])
      for (const solid of l.solids) assert(!overlap(pool, solid), room.id + ' coolant/terrain');
  }
});

test('the three cohorts use native complete warning groups and bounded pressure', () => {
  for (const room of cases) {
    const l = levelFor(room);
    assert(validCombatFlowSpec(l.combatFlow, l.spawns.length));
    const [opening, reserve] = splitWaves(l, 'RF-C101-X', room.stage);
    assert.equal(opening.length, 3);
    assert.equal(opening.length + reserve.length, l.spawns.length);
    assert(l.combatFlow!.beats.every((b) => b.length <= 3));
    const g = gameFor(room);
    assert.equal(g.enemies.length, 3);
    assert.equal(g.enemies.length + g.waves.doors.length, l.spawns.length);
    assert(g.waves.flow);
    assert.deepEqual(g.mods, []);
    dispose(g);
  }
});

test('route traits describe real authored mechanics, and constructor calls never share mutable geometry', () => {
  for (const room of cases) {
    const l = levelFor(room);
    assert.deepEqual(routeRemasterTraits(l), room.traits);
    const again = levelFor(room);
    assert.deepEqual(l, again);
    l.solids[0].x = -900;
    l.setpiece!.props[0].x = -900;
    l.combatFlow!.beats[0].push(500);
    assert.notDeepEqual(l, levelFor(room));
    assert.deepEqual(again, levelFor(room));
  }
  assert(routeRemasterRoom(6, 'low').vents?.some((v) => v.overpressure));
  assert(routeRemasterRoom(6, 'high').hazards?.some((v) => v.kind === 'lift'));
  assert(routeRemasterRoom(10, 'low').coolant?.length);
  assert(routeRemasterRoom(10, 'high').fans?.some((v) => v.dir.y === -1));
  assert.equal(routeRemasterTraits({ id: 'old' }), undefined);
  for (const stage of [2, 5, 7, 14])
    assert.throws(() => routeRemasterRoom(stage as 6, 'low'), RangeError);
});

function navigationGame(room: (typeof cases)[number]) {
  const g = gameFor(room);
  for (const e of g.enemies) Matter.Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.areaEvents.clear();
  g.hazards.clear();
  g.pressure.clear();
  g.crosswind.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  g.clear = true;
  g.clearAt = g.time + 1000;
  return g;
}
test('ordinary walking and jumps recover every permanent floor route in both directions', () => {
  for (const room of cases)
    for (const reverse of [false, true]) {
      const g = navigationGame(room);
      Matter.Body.setPosition(g.player, { x: reverse ? 1860 : 140, y: 680 });
      const points = (reverse ? [...g.level.route].reverse() : [...g.level.route]).concat([
        { x: reverse ? 110 : 1890, y: 716 },
      ]);
      let index = 0,
        stuck = 0,
        lastX = g.player.position.x;
      for (let frame = 0; frame < 2400 && index < points.length && g.mode === 'playing'; frame++) {
        const p = g.player.position,
          target = points[index],
          dx = target.x - p.x,
          dy = p.y - target.y;
        if (Math.abs(dx) < 40 && Math.abs(dy) < 65) {
          index++;
          continue;
        }
        stuck = Math.abs(p.x - lastX) < 0.4 ? stuck + 1 : 0;
        lastX = p.x;
        const move = dx > 12 ? 1 : dx < -12 ? -1 : 0;
        const blocked =
          move && Matter.Query.ray(g.solidBodies, p, { x: p.x + move * 70, y: p.y }, 24).length > 0;
        g.tick(1 / 60, {
          left: move < 0,
          right: move > 0,
          jump: g.grounded && (dy > 50 || !!blocked || stuck > 12),
          jumpHeld: true,
          fire: false,
          aim: { x: p.x, y: p.y + 500 },
        });
      }
      assert.equal(
        index,
        points.length,
        room.id +
          ' ' +
          room.mirror +
          ' reverse' +
          reverse +
          ' stopped' +
          index +
          ' ' +
          JSON.stringify(g.player.position),
      );
      assert.deepEqual(g.mods, []);
      dispose(g);
    }
});

test('all four native pistol encounters clear with ordinary input and no simulation overrides', () => {
  for (const room of cases) {
    const g = gameFor(room);
    let arrivals = g.enemies.length;
    const spawn = g.spawnEnemy.bind(g);
    g.spawnEnemy = (...args: Parameters<Game['spawnEnemy']>) => {
      arrivals++;
      return spawn(...args);
    };
    const result = playRoom(g, 110);
    assert(g.clear, room.id + ' mirror' + room.mirror + ' ' + JSON.stringify(result));
    assert(g.hp > 0);
    assert.equal(arrivals, g.level.spawns.length);
    // Valve bursts and explosive props can defeat a machine without a credited shot kill.
    assert(g.kills > 0 && g.kills <= arrivals);
    assert(g.shotCount > 0);
    assert.deepEqual(g.mods, []);
    dispose(g);
  }
});

test('enabled native support introductions keep two visible, reachable partners with clear links', () => {
  for (const room of cases) {
    const l = routeRemasterRoom(room.stage, room.route, room.mirror, true);
    const pair = l.spawns.filter((spawn) => spawn.teamwork);
    assert.equal(pair.length, 2);
    assert.equal(l.teamworkIntro, room.stage === 6 ? 'repairer' : 'relay');
    assert.equal(pair.filter((s) => s.kind === l.teamworkIntro).length, 1);
    assert(Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) >= 75);
    assert(Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) <= 430);
    for (const solid of l.solids)
      assert(
        !segmentBox(
          pair[0],
          pair[1],
          { x: solid.x - 2, y: solid.y - 2 },
          { x: solid.x + solid.w + 2, y: solid.y + solid.h + 2 },
        ),
        room.id + ' blocked support link',
      );
    const disabled = routeRemasterRoom(room.stage, room.route, room.mirror, false);
    assert.equal(disabled.teamworkIntro, undefined);
    assert(!disabled.spawns.some((s) => s.kind === 'repairer' || s.kind === 'relay'));
  }
});
