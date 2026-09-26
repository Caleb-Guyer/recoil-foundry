import type Matter from 'matter-js';
import type { Game } from './game.ts';
import { clamp, type Vec } from './rules.ts';
import { firstSolid } from './collisions.ts';

export interface FlowLane extends Vec {
  dir: Vec;
  width: number;
  length: number;
}
const along = (v: FlowLane, distance: number, across = 0): Vec => ({
  x: v.x + v.dir.x * distance - v.dir.y * across,
  y: v.y + v.dir.y * distance + v.dir.x * across,
});

// Steam and ventilation use the same convex cover geometry in art and physics.
export function airflowReach(g: Game, v: FlowLane, across = 0, ignore?: Matter.Body) {
  const hit = firstSolid(
    along(v, 0, across),
    along(v, v.length, across),
    { x: 0, y: 0 },
    g.solidBodies.filter((b) => b !== ignore),
  );
  return v.length * (hit?.t ?? 1);
}
export function airflowExposed(g: Game, v: FlowLane, b: Matter.Body) {
  const dx = b.position.x - v.x,
    dy = b.position.y - v.y;
  const depth = dx * v.dir.x + dy * v.dir.y;
  const across = -dx * v.dir.y + dy * v.dir.x;
  const halfAlong = Math.max(
    ...b.vertices.map((p) =>
      Math.abs((p.x - b.position.x) * v.dir.x + (p.y - b.position.y) * v.dir.y),
    ),
  );
  const halfAcross = Math.max(
    ...b.vertices.map((p) =>
      Math.abs(-(p.x - b.position.x) * v.dir.y + (p.y - b.position.y) * v.dir.x),
    ),
  );
  if (
    depth + halfAlong <= 0 ||
    depth - halfAlong >= v.length ||
    Math.abs(across) >= v.width / 2 + halfAcross
  )
    return false;
  const lane = clamp(across, -v.width / 2 + 1, v.width / 2 - 1);
  const hit = firstSolid(along(v, 0, lane), along(v, v.length, lane), { x: 0, y: 0 }, [b]);
  return !!hit && hit.t * v.length <= airflowReach(g, v, lane, b) + 0.01;
}
