import type Matter from 'matter-js';
import type { Vec } from './rules.ts';

// Sweep an axis-aligned actor hull against a solid's actual convex vertices.
// SAT includes the solid's edge normals, so rotated props have no phantom corners.
export function sweepBox(from: Vec, to: Vec, half: Vec, body: Matter.Body) {
  const axes: Vec[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  for (let i = 0; i < body.vertices.length; i++) {
    const a = body.vertices[i],
      b = body.vertices[(i + 1) % body.vertices.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length) axes.push({ x: -(b.y - a.y) / length, y: (b.x - a.x) / length });
  }
  let enter = -Infinity,
    leave = Infinity;
  let normal: Vec = { x: 0, y: 0 };
  for (const axis of axes) {
    const dots = body.vertices.map((v) => v.x * axis.x + v.y * axis.y);
    const radius = half.x * Math.abs(axis.x) + half.y * Math.abs(axis.y);
    const low = Math.min(...dots) - radius,
      high = Math.max(...dots) + radius;
    const start = from.x * axis.x + from.y * axis.y;
    const delta = (to.x - from.x) * axis.x + (to.y - from.y) * axis.y;
    if (Math.abs(delta) < 1e-9) {
      // Sliding along a floor or an edge is not an impact.
      if (start <= low + 1e-6 || start >= high - 1e-6) return null;
      continue;
    }
    const a = (low - start) / delta,
      b = (high - start) / delta;
    const near = Math.min(a, b);
    if (near > enter) {
      enter = near;
      normal = { x: -Math.sign(delta) * axis.x, y: -Math.sign(delta) * axis.y };
    }
    leave = Math.min(leave, Math.max(a, b));
    if (enter > leave) return null;
  }
  if (leave <= 0 || enter > 1 || enter === -Infinity) return null;
  return { t: Math.max(0, enter), normal };
}

export function firstSolid(from: Vec, to: Vec, half: Vec, bodies: Matter.Body[]) {
  let nearest: { t: number; normal: Vec; body: Matter.Body } | undefined;
  for (const body of bodies) {
    const hit = sweepBox(from, to, half, body);
    if (hit && (!nearest || hit.t < nearest.t)) nearest = { ...hit, body };
  }
  return nearest;
}
