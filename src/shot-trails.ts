import { distance } from './rules.ts';
import type { Vec } from './rules.ts';

export const SHOT_TRAIL_LENGTH = 48;
export const SHOT_TRAIL_POINTS = 8;
export interface ShotTrace {
  bank: boolean;
  pierce: boolean;
  points: Vec[];
}

export function recordShotTrace(trace: ShotTrace | undefined, point: Vec) {
  if (!trace || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  const points = trace.points;
  if (points.length && distance(points[points.length - 1], point) < 0.001) return;
  points.push({ ...point });
  let remaining = SHOT_TRAIL_LENGTH;
  for (let i = points.length - 1; i > 0; i--) {
    const newer = points[i],
      older = points[i - 1],
      length = distance(newer, older);
    if (length > remaining) {
      if (remaining < 0.001) points.splice(0, i);
      else
        points.splice(0, i, {
          x: newer.x + ((older.x - newer.x) * remaining) / length,
          y: newer.y + ((older.y - newer.y) * remaining) / length,
        });
      break;
    }
    remaining -= length;
  }
  // Drop only old vertices. Merging interior points would cut across a bounce.
  if (points.length > SHOT_TRAIL_POINTS) points.splice(0, points.length - SHOT_TRAIL_POINTS);
}
