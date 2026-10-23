import type Matter from 'matter-js';
import type { Vec } from './rules.ts';

// Sweep an axis-aligned actor hull against a solid's actual convex vertices.
// SAT includes the solid's edge normals, so rotated props have no phantom corners.
export function sweepBox(from: Vec, to: Vec, half: Vec, body: Matter.Body) {
  // Reject distant targets before allocating SAT axes/projections. Read live
  // bounds on every query so rotating, moving and newly broken cover is exact.
  if (
    body.bounds.min.x > Math.max(from.x, to.x) + half.x ||
    body.bounds.max.x < Math.min(from.x, to.x) - half.x ||
    body.bounds.min.y > Math.max(from.y, to.y) + half.y ||
    body.bounds.max.y < Math.min(from.y, to.y) - half.y
  )
    return null;
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
    let min = Infinity,
      max = -Infinity;
    for (const v of body.vertices) {
      const dot = v.x * axis.x + v.y * axis.y;
      min = Math.min(min, dot);
      max = Math.max(max, dot);
    }
    const radius = half.x * Math.abs(axis.x) + half.y * Math.abs(axis.y);
    const low = min - radius,
      high = max + radius;
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
  // The swept hull cannot intersect a convex body outside this envelope.
  // Read current Matter bounds each query: moving/rotating/broken cover remains
  // exact, without a spatial cache or a changed SAT collision result.
  // Synthetic swept bodies must also supply bounds enclosing their vertices.
  const minX = Math.min(from.x, to.x) - half.x,
    maxX = Math.max(from.x, to.x) + half.x,
    minY = Math.min(from.y, to.y) - half.y,
    maxY = Math.max(from.y, to.y) + half.y;
  for (const body of bodies) {
    if (
      body.bounds.min.x > maxX ||
      body.bounds.max.x < minX ||
      body.bounds.min.y > maxY ||
      body.bounds.max.y < minY
    )
      continue;
    const hit = sweepBox(from, to, half, body);
    if (hit && (!nearest || hit.t < nearest.t)) nearest = { ...hit, body };
  }
  return nearest;
}
