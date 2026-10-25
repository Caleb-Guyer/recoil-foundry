import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { UPRISING_REMASTER_ROOMS } from '../src/uprising-remaster-rooms.ts';
import { UPRISING_ROOMS } from '../src/uprising-rooms.ts';
import { UPRISING_ROUTES, uprisingRoute } from '../src/uprising-model.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { PROP_STATS } from '../src/props.ts';
import { Game, type Input } from '../src/game.ts';
import { uprisingRemasterTestFromUrl } from '../src/uprising-remaster-test.ts';
import type { Vec } from '../src/rules.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1900, y: 300 },
};
const rect = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
const points = (body: Matter.Body) => body.vertices.map(({ x, y }) => ({ x, y }));
function overlaps(a: readonly Vec[], b: readonly Vec[]) {
  for (const polygon of [a, b])
    for (let i = 0; i < polygon.length; i++) {
      const edge = {
        x: polygon[(i + 1) % polygon.length].x - polygon[i].x,
        y: polygon[(i + 1) % polygon.length].y - polygon[i].y,
      };
      const n = Math.hypot(edge.x, edge.y);
      if (n < 1e-9) continue;
      const axis = { x: -edge.y / n, y: edge.x / n };
      const aa = a.map((p) => p.x * axis.x + p.y * axis.y),
        bb = b.map((p) => p.x * axis.x + p.y * axis.y);
      if (
        Math.min(Math.max(...aa), Math.max(...bb)) - Math.max(Math.min(...aa), Math.min(...bb)) <=
        1e-6
      )
        return false;
    }
  return true;
}
function polygon(x: number, y: number, w: number, h: number) {
  return rect(x - w / 2, y - h / 2, w, h);
}
function fixture(route: string) {
  const spec = uprisingRemasterTestFromUrl(
    new URL(`https://test/?test=uprising-remaster&route=${route}&v=1`),
  );
  assert(spec);
  const g = new Game();
  g.startTest(spec.checkpoint);
  return g;
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

test('eleven remastered job plans are independent authored geometry and leave old plans unchanged', () => {
  const legacy = structuredClone(UPRISING_ROOMS);
  assert.equal(Object.keys(UPRISING_REMASTER_ROOMS).length, 11);
  for (const route of UPRISING_ROUTES) {
    const room = UPRISING_REMASTER_ROOMS[route.id];
    assert(room);
    assert.notDeepEqual(room.solids, UPRISING_ROOMS[route.id].solids);
    assert(room.reinforcements.length === 3);
    assert(room.route[0].x < 300);
    assert(room.route.at(-1)!.x >= 1840);
  }
  assert.deepEqual(UPRISING_ROOMS, legacy);
});

test('all authored terrain, supported objectives, props, patrols and wave bodies have real non-overlapping hulls', () => {
  for (const route of UPRISING_ROUTES) {
    const room = UPRISING_REMASTER_ROOMS[route.id],
      terrain = room.solids.map((s) => rect(s.x, s.y, s.w, s.h));
    for (const s of room.solids)
      assert(
        s.x >= 180 && s.x + s.w <= 1820 && s.y > 200 && s.y + s.h < 700,
        route.id + ' safe terrain bounds',
      );
    for (let i = 0; i < terrain.length; i++)
      for (const other of terrain.slice(i + 1))
        assert(!overlaps(terrain[i], other), route.id + ' terrain overlap');
    const actors = [
      { name: 'player', poly: polygon(140, 720, 26, 36) },
      ...room.props.map((p) => ({
        name: p.kind,
        poly: polygon(p.x, p.y, PROP_STATS[p.kind].w, PROP_STATS[p.kind].h),
      })),
      ...room.objectives.map((p, i) => ({
        name: 'objective ' + i,
        poly: polygon(
          p.x,
          p.y,
          route.mission === 'defend' ? 96 : 44,
          route.mission === 'defend' ? 56 : 44,
        ),
      })),
      ...room.spawns.map((s) => ({
        name: s.kind,
        poly: polygon(s.x, s.y, ENEMY_STATS[s.kind].w, ENEMY_STATS[s.kind].h),
      })),
    ];
    for (const [i, a] of actors.entries()) {
      for (const solid of terrain)
        assert(!overlaps(a.poly, solid), `${route.id} ${a.name} in terrain`);
      for (const other of actors.slice(i + 1))
        assert(
          !overlaps(a.poly, other.poly),
          `${route.id} ${a.name}/${other.name} initial overlap`,
        );
    }
    for (const group of room.reinforcements)
      for (const spawn of group) {
        const size = ENEMY_STATS[spawn.kind],
          poly = polygon(spawn.x, spawn.y, size.w, size.h);
        assert(
          spawn.x - size.w / 2 >= 180 &&
            spawn.x + size.w / 2 <= 1830 &&
            spawn.y - size.h / 2 > 0 &&
            spawn.y + size.h / 2 <= 740,
          route.id + ' reinforcement stays in arena',
        );
        for (const solid of terrain)
          assert(!overlaps(poly, solid), `${route.id} ${spawn.kind} reinforcement in terrain`);
        for (const actor of actors.filter(
          (a) => a.name !== 'player' && !room.spawns.some((s) => s.kind === a.name),
        ))
          assert(
            !overlaps(poly, actor.poly),
            `${route.id} ${spawn.kind} reinforcement in ${actor.name}`,
          );
      }
    for (const [i, p] of room.objectives.entries()) {
      const bottom = p.y + (route.mission === 'defend' ? 28 : 22),
        half = route.mission === 'defend' ? 48 : 22;
      assert(bottom <= 740, route.id + ' objective floor');
      assert(
        Math.abs(bottom - 740) <= 1.01 ||
          room.solids.some(
            (s) => Math.abs(bottom - s.y) <= 1.01 && p.x - half >= s.x && p.x + half <= s.x + s.w,
          ),
        `${route.id} objective ${i} lacks a support`,
      );
    }
  }
});

test('convoy sweeps and lowering bridge paths clear every unrelated solid and leave standing floor clearance', () => {
  for (const route of UPRISING_ROUTES) {
    const room = UPRISING_REMASTER_ROOMS[route.id],
      motion = room.convoy ?? room.sabotageBridge;
    if (!motion) continue;
    const s = room.solids[motion.solid];
    const endX = room.convoy ? room.convoy.toX - s.w / 2 : s.x,
      endY = room.sabotageBridge ? s.y + room.sabotageBridge.drop : s.y;
    for (let step = 0; step <= 100; step++) {
      const t = step / 100,
        x = s.x + (endX - s.x) * t,
        y = s.y + (endY - s.y) * t,
        poly = rect(x, y, s.w, s.h);
      assert(740 - y - s.h >= 44, route.id + ' machine leaves standing floor clearance');
      room.solids.forEach((other, i) => {
        if (i !== motion.solid)
          assert(
            !overlaps(poly, rect(other.x, other.y, other.w, other.h)),
            route.id + ' machine sweep through terrain',
          );
      });
      for (const p of room.props) {
        const size = PROP_STATS[p.kind];
        assert(
          !overlaps(poly, polygon(p.x, p.y, size.w, size.h)),
          route.id + ' machine sweep through prop',
        );
      }
      if (room.convoy)
        for (const node of room.objectives) {
          const dx = x - s.x,
            dy = y - s.y,
            nodePoly = polygon(
              node.x + dx,
              node.y + dy,
              route.mission === 'defend' ? 96 : 44,
              route.mission === 'defend' ? 56 : 44,
            );
          room.solids.forEach((other, i) => {
            if (i !== motion.solid)
              assert(
                !overlaps(nodePoly, rect(other.x, other.y, other.w, other.h)),
                route.id + ' carried objective sweep',
              );
          });
        }
    }
  }
});

test('all extraction pads sit inside actual final supports and stay clear of the room exit', () => {
  for (const route of UPRISING_ROUTES) {
    const room = UPRISING_REMASTER_ROOMS[route.id];
    if (!room.evacuation) continue;
    const pad = room.evacuation,
      floor = pad.y + pad.h;
    assert(
      pad.x >= 250 && pad.x + pad.w <= 1780 && pad.w >= 100 && pad.h >= 80,
      route.id + ' extraction separate from exit',
    );
    assert(
      room.solids.some(
        (s, i) =>
          Math.abs(
            s.y + (room.sabotageBridge?.solid === i ? room.sabotageBridge.drop : 0) - floor,
          ) < 1e-6 &&
          pad.x >= s.x &&
          pad.x + pad.w <= s.x + s.w,
      ),
      route.id + ' extraction has no final support',
    );
    for (const [i, s] of room.solids.entries()) {
      if (room.sabotageBridge?.solid === i) continue;
      assert(
        !overlaps(rect(pad.x, pad.y, pad.w, pad.h), rect(s.x, s.y, s.w, s.h)),
        route.id + ' extraction clips terrain',
      );
    }
  }
});

test('native remastered job rooms instantiate their authored physical hulls and complete patrol roster', () => {
  for (const route of UPRISING_ROUTES) {
    const g = fixture(route.id),
      room = UPRISING_REMASTER_ROOMS[route.id];
    assert.equal(g.level.id, 'uprising-' + route.id);
    assert.deepEqual(g.level.solids, room.solids);
    assert.equal(g.terrain.length, room.solids.length + 4);
    assert.equal(g.level.spawns.length, room.spawns.length);
    assert.deepEqual(g.level.spawns, room.spawns);
    for (const body of [g.player, ...g.enemies.map((e) => e.body), ...g.props.bodies])
      for (const solid of g.terrain)
        assert(
          !overlaps(points(body), points(solid)),
          route.id + ' native actor penetrates terrain',
        );
    assert.equal(g.uprising.nodes.length, room.objectives.length);
    dispose(g);
  }
});

test('ordinary grounded movement and jumps retain a floor recovery route across all eleven live job arenas', () => {
  for (const route of UPRISING_ROUTES) {
    const g = fixture(route.id);
    let previous = g.player.position.x,
      stuck = 0;
    for (
      let frame = 0;
      frame < 900 && g.mode === 'playing' && g.player.position.x < 1840;
      frame++
    ) {
      const p = g.player.position;
      stuck = Math.abs(p.x - previous) < 0.2 ? stuck + 1 : 0;
      previous = p.x;
      const obstacle = g.solidBodies.some(
        (b) =>
          b.bounds.min.x < p.x + 75 &&
          b.bounds.max.x > p.x + 15 &&
          b.bounds.min.y < p.y + 13 &&
          b.bounds.min.y > p.y - 140,
      );
      g.tick(1 / 60, { ...idle, right: true, jump: g.grounded && (obstacle || stuck > 10) });
    }
    assert(g.hp > 0, route.id + ' crossing must survive');
    assert(
      g.player.position.x >= 1830,
      `${route.id} route stalled at${g.player.position.x},${g.player.position.y}`,
    );
    assert.equal(g.shotCount, 0);
    dispose(g);
  }
});
