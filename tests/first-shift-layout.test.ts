import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { firstShiftTestFromUrl } from '../src/first-shift-test.ts';
import { FIRST_SHIFT_BOSSES, type FirstShiftBoss } from '../src/first-shift-rules.ts';
import { COUNTERWEIGHT } from '../src/counterweight-layouts.ts';
import type { Vec } from '../src/rules.ts';

const BOSSES = Object.keys(FIRST_SHIFT_BOSSES) as FirstShiftBoss[];
const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1900, y: 500 },
};
const vertices = (body: Matter.Body) => body.vertices.map(({ x, y }) => ({ x, y }));
function hull(body: Matter.Body) {
  const points = vertices(body);
  return {
    left: Math.min(...points.map((p) => p.x)),
    right: Math.max(...points.map((p) => p.x)),
    top: Math.min(...points.map((p) => p.y)),
    bottom: Math.max(...points.map((p) => p.y)),
  };
}
const rectangle = (left: number, top: number, right: number, bottom: number): Vec[] => [
  { x: left, y: top },
  { x: right, y: top },
  { x: right, y: bottom },
  { x: left, y: bottom },
];
// Native velocity-expanded Matter bounds are deliberately excluded. SAT uses
// the real convex vertices, including the chamfered player and tilted beam.
function penetrates(a: readonly Vec[], b: readonly Vec[], epsilon = 1e-6) {
  for (const polygon of [a, b])
    for (let i = 0; i < polygon.length; i++) {
      const edge = {
        x: polygon[(i + 1) % polygon.length].x - polygon[i].x,
        y: polygon[(i + 1) % polygon.length].y - polygon[i].y,
      };
      const length = Math.hypot(edge.x, edge.y);
      if (length < 1e-9) continue;
      const axis = { x: -edge.y / length, y: edge.x / length };
      const aa = a.map((p) => p.x * axis.x + p.y * axis.y),
        bb = b.map((p) => p.x * axis.x + p.y * axis.y);
      if (
        Math.min(Math.max(...aa), Math.max(...bb)) - Math.max(Math.min(...aa), Math.min(...bb)) <=
        epsilon
      )
        return false;
    }
  return true;
}
function fixture(boss: FirstShiftBoss, mirror: boolean, ng = false) {
  const source = firstShiftTestFromUrl(
    new URL(
      `https://test/?test=first-shift&boss=${boss}&mirror=${mirror ? 1 : 0}&ng=${ng ? 1 : 0}&v=1`,
    ),
  );
  assert(source);
  const g = new Game();
  g.startTest(source.checkpoint);
  return g;
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function tick(g: Game, input: Partial<Input> = {}) {
  g.tick(DT, { ...idle, ...input });
  assert([g.hp, g.player.position.x, g.player.position.y].every(Number.isFinite));
}
function cross(g: Game) {
  let previous = g.player.position.x,
    stuck = 0,
    jumps = 0;
  for (let frame = 0; frame < 900 && g.mode === 'playing' && g.player.position.x < 1880; frame++) {
    const p = g.player.position,
      player = hull(g.player);
    stuck = Math.abs(p.x - previous) < 0.2 ? stuck + 1 : 0;
    previous = p.x;
    const nextStep = g.solidBodies.some((body) => {
      const obstacle = hull(body);
      return (
        obstacle.left < player.right + 105 &&
        obstacle.right > player.right + 2 &&
        obstacle.top < player.bottom - 5 &&
        obstacle.top > player.bottom - 185
      );
    });
    const jump = g.grounded && (nextStep || stuck > 8);
    if (jump) jumps++;
    tick(g, { right: true, jump });
  }
  // Release horizontal input and let the actual gravity/floor settle the hull
  // in the exit strip. Live attacks and body collisions remain enabled.
  for (let i = 0; i < 120 && g.mode === 'playing' && !g.grounded; i++) tick(g);
  assert.equal(g.mode, 'playing');
  assert(g.hp > 0, 'ordinary movement must survive this crossing');
  assert(
    g.player.position.x >= 1860,
    `route blocked at ${g.player.position.x},${g.player.position.y}`,
  );
  assert(g.grounded, 'there is a real landing surface at the exit');
  assert(hull(g.player).bottom <= 740.2, 'the player does not fall through the floor at the exit');
  assert.equal(g.shotCount, 0, 'traversal uses no weapon or recoil');
  assert(jumps > 0, 'raised obstacles require real jumps');
  return jumps;
}

test('all four First Shift arenas and both normal/NG+ mirrors spawn real bodies without terrain, prop, cargo or door penetration', () => {
  for (const boss of BOSSES)
    for (const mirror of [false, true])
      for (const ng of [false, true]) {
        const g = fixture(boss, mirror, ng),
          label = `${boss}/${mirror}/${ng}`;
        const actors = [
          { label: 'player', body: g.player },
          ...g.enemies.map((e) => ({ label: e.kind, body: e.body })),
          ...g.props.items.map((p) => ({ label: p.kind, body: p.body })),
          ...g.counterweights.items.map((p) => ({ label: 'counterweight', body: p.body })),
          ...g.enemies
            .filter((e) => e.crane)
            .map((e) => ({ label: 'crane head', body: e.crane!.body })),
        ];
        assert.equal(
          g.props.items.length,
          g.level.setpiece!.props.length + (g.level.setpiece!.cargo?.length ?? 0),
        );
        assert.deepEqual(hull(g.terrain[0]), { left: 0, right: 2000, top: 740, bottom: 840 });
        assert.equal(
          g.terrain.length,
          4 + g.level.solids.length,
          'four boundary bodies precede authored terrain',
        );
        for (const [index, solid] of g.terrain.slice(4).entries()) {
          const actual = hull(solid),
            plan = g.level.solids[index];
          assert.deepEqual(actual, {
            left: plan.x,
            right: plan.x + plan.w,
            top: plan.y,
            bottom: plan.y + plan.h,
          });
          assert(
            actual.left >= 0 && actual.right <= 2000 && actual.top >= 0 && actual.bottom <= 740,
            label + ' terrain stays above the floor',
          );
        }
        for (const [i, actor] of actors.entries()) {
          const actual = hull(actor.body);
          assert(
            actual.left >= 0 && actual.right <= 2000 && actual.top >= 0 && actual.bottom <= 740,
            label + ' ' + actor.label + ' stays inside the arena',
          );
          for (const solid of g.terrain)
            assert(
              !penetrates(vertices(actor.body), vertices(solid)),
              label + ' ' + actor.label + ' embedded in terrain',
            );
          for (const other of actors.slice(i + 1))
            assert(
              !penetrates(vertices(actor.body), vertices(other.body)),
              label + ' ' + actor.label + ' overlaps ' + other.label,
            );
        }
        const entry = rectangle(80, 620, 180, 740),
          exit = rectangle(1860, 600, 1955, 740);
        for (const body of [...g.terrain.slice(4), ...g.props.bodies, ...g.counterweights.bodies]) {
          assert(!penetrates(entry, vertices(body)), label + ' entry hull is blocked');
          assert(!penetrates(exit, vertices(body)), label + ' exit door or approach is blocked');
        }
        for (const load of g.cargo.items) {
          const actual = hull(load.body),
            shaft = rectangle(actual.left, actual.top, actual.right, 740);
          for (const solid of g.terrain)
            assert(
              !penetrates(shaft, vertices(solid)),
              label + ' cargo drop shaft intersects terrain',
            );
          assert(
            actual.left > 180 && actual.right < 1860,
            'cargo never falls across an entry or exit',
          );
        }
        dispose(g);
      }
});

test('Crane counterweight has a real clear sweep at either physical limit in both mirrors', () => {
  for (const mirror of [false, true]) {
    const g = fixture('crane', mirror);
    assert.equal(g.counterweights.items.length, 1);
    for (const item of g.counterweights.items) {
      const center = item.body.position;
      assert.deepEqual(item.joint.pointA, { x: item.placement.x, y: item.placement.y });
      assert.equal(item.joint.bodyB, item.body);
      for (const angle of [-COUNTERWEIGHT.angle, 0, COUNTERWEIGHT.angle]) {
        const cos = Math.cos(angle),
          sin = Math.sin(angle);
        const rotated = vertices(item.body).map((p) => ({
          x: center.x + (p.x - center.x) * cos - (p.y - center.y) * sin,
          y: center.y + (p.x - center.x) * sin + (p.y - center.y) * cos,
        }));
        for (const solid of [...g.terrain, ...g.props.bodies])
          assert(
            !penetrates(rotated, vertices(solid)),
            'full native beam sweep retains its clear physical space',
          );
      }
    }
    dispose(g);
  }
});

test('native weaponless run/jump inputs cross every new ground route in both mirrors while the boss remains live', () => {
  for (const boss of BOSSES)
    for (const mirror of [false, true]) {
      const g = fixture(boss, mirror);
      cross(g);
      assert(
        g.enemies.some((e) => e.kind === boss && e.hp > 0),
        'crossing is not a simulated boss clear',
      );
      dispose(g);
    }
});

test('released short jumps can land, retreat and recover through every arena without firing, teleporting or altering AI', () => {
  for (const boss of BOSSES)
    for (const mirror of [false, true]) {
      const g = fixture(boss, mirror);
      let previous = g.player.position.x,
        stuck = 0;
      for (let i = 0; i < 300 && stuck < 12 && g.mode === 'playing'; i++) {
        stuck = g.grounded && Math.abs(g.player.position.x - previous) < 0.2 ? stuck + 1 : 0;
        previous = g.player.position.x;
        tick(g, { right: true });
      }
      assert(stuck >= 12, 'first unsupported ascent or obstacle is reached without a jump');
      const approach = g.player.position.x;
      let jumped = false,
        cut = false;
      for (let i = 0; i < 45 && g.mode === 'playing'; i++) {
        const jump = !jumped && g.grounded;
        jumped ||= jump;
        tick(g, { right: true, jump, jumpHeld: false });
        cut ||= g.jumpCut;
      }
      assert(jumped && cut, 'a real released jump is shortened by native controls');
      assert(g.player.position.x < 1860, 'the short attempt has not completed the route');
      // Walk back to make another approach. No body position, velocity, health,
      // weapon stats, platforms, collision filters or enemy state are changed.
      for (let i = 0; i < 180 && g.mode === 'playing' && g.player.position.x > approach - 170; i++)
        tick(g, { left: true });
      for (let i = 0; i < 90 && g.mode === 'playing' && !g.grounded; i++) tick(g);
      assert(g.grounded && g.hp > 0, 'a missed ascent leaves a recoverable physical landing');
      cross(g);
      dispose(g);
    }
});
