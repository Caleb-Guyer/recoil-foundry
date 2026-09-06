import type { Level, Solid } from './levels.ts';
import type { Vec } from './rules.ts';
import { seeded, segmentBox } from './rules.ts';
import { ENEMY_STATS } from './enemies.ts';
import { hazardBounds, hazardPlacement } from './hazard-layouts.ts';

export interface BreachPlacement {
  id: string;
  solids: Solid[];
  panels: Solid[];
  pickup: Vec | null;
  approach: Vec; // Player center on safe support directly below the hatch.
  destination: Vec; // Player center standing on the exit perch.
}

const WIDTH = 224;
const overlaps = (a: Solid, b: Solid) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const expand = (rect: Solid, pad: number): Solid => ({
  x: rect.x - pad,
  y: rect.y - pad,
  w: rect.w + pad * 2,
  h: rect.h + pad * 2,
});
const playerHull = (position: Vec): Solid => ({
  x: position.x - 13,
  y: position.y - 18,
  w: 26,
  h: 36,
});

export function breachPlacement(level: Level, seed: string, stage: number): BreachPlacement | null {
  if (level.boss || level.id === 'last-flight' || ![1, 4, 7].includes(stage)) return null;
  const canonical = (rect: Solid): Solid => ({
    ...rect,
    x: level.mirrored ? 2000 - rect.x - rect.w : rect.x,
  });
  const worldPoint = (point: Vec): Vec => ({
    ...point,
    x: level.mirrored ? 2000 - point.x : point.x,
  });
  const worldRect = canonical;
  const source = level.solids.map(canonical);
  const hazard = hazardPlacement(level, seed, stage);
  const hazardSweep = hazard ? expand(hazardBounds(hazard, 44), 20) : null;
  const actors = level.spawns.map((spawn) => {
    const { w, h } = ENEMY_STATS[spawn.kind];
    return expand({ x: spawn.x - w / 2, y: spawn.y - h / 2, w, h }, 20);
  });
  const path = [{ x: 140, y: 680 }, ...level.route, { x: 1910, y: 720 }];
  // A straight waypoint segment alone misses head collisions during a jump.
  // Keep the lower footing's launch space open in either travel direction.
  const jumps = path.slice(1).flatMap((point, index): Solid[] => {
    const previous = path[index];
    if (Math.abs(point.y - previous.y) < 55) return [];
    const low = point.y > previous.y ? point : previous;
    return [{ x: low.x - 65, y: low.y - 170, w: 130, h: 170 }];
  });
  const candidates: BreachPlacement[] = [];
  const rewardArea = Math.floor(seeded(seed + ':breach-pickups')() * 3);
  const add = (left: number, floor: number, direction: number, ownPerch = false) => {
    const top = floor - 98;
    if (left < 280 || left + WIDTH > 1720) return;
    const local = (x: number, y: number, w: number, h: number): Solid =>
      worldRect({
        x: left + (direction === 1 ? x : WIDTH - x - w),
        y: top + y,
        w,
        h,
      });
    const solids = [
      local(0, 0, WIDTH, 14),
      local(0, 14, 14, 98),
      local(14, 98, 40, 14),
      local(170, 98, 54, 14),
    ];
    if (ownPerch) solids.push(local(WIDTH, 98, 96, 14));
    const panels = [local(54, 98, 116, 14), local(210, 14, 14, 84)];
    const chamber = worldRect({ x: left, y: top, w: WIDTH, h: 112 });
    const center = left + WIDTH / 2;
    const below = [{ x: 0, y: 740, w: 2000, h: 100 }, ...source]
      .filter(
        (solid) =>
          solid.y >= floor + 70 && solid.x <= center - 20 && solid.x + solid.w >= center + 20,
      )
      .sort((a, b) => a.y - b.y)[0];
    if (!below || below.y - floor > 360) return;
    const approach = worldPoint({ x: center, y: below.y - 18 });
    const destination = worldPoint({
      x: direction === 1 ? left + WIDTH + 48 : left - 48,
      y: floor - 18,
    });
    const ascent = worldRect({
      x: center - 20,
      y: floor + 14,
      w: 40,
      h: below.y - floor - 14,
    });
    const pieces = [...solids, ...panels];
    if (
      pieces.some(
        (piece) =>
          piece.x < 280 ||
          piece.x + piece.w > 1720 ||
          level.solids.some((solid) => overlaps(piece, solid)),
      )
    )
      return;
    if (level.solids.some((solid) => overlaps(chamber, solid))) return;
    if (pieces.some((piece) => jumps.some((jump) => overlaps(piece, jump)))) return;
    if (
      level.solids.some(
        (solid) =>
          overlaps(ascent, solid) ||
          overlaps(playerHull(approach), solid) ||
          overlaps(playerHull(destination), solid),
      )
    )
      return;
    if (
      actors.some(
        (actor) =>
          pieces.some((piece) => overlaps(piece, actor)) ||
          overlaps(chamber, actor) ||
          overlaps(ascent, actor) ||
          overlaps(playerHull(destination), actor),
      )
    )
      return;
    if (
      hazardSweep &&
      [...pieces, chamber, ascent, playerHull(approach), playerHull(destination)].some((rect) =>
        overlaps(rect, hazardSweep),
      )
    )
      return;
    if (
      pieces.some((piece) =>
        path
          .slice(1)
          .some((point, index) =>
            segmentBox(
              path[index],
              point,
              { x: piece.x - 18, y: piece.y - 24 },
              { x: piece.x + piece.w + 18, y: piece.y + piece.h + 24 },
            ),
          ),
      )
    )
      return;
    candidates.push({
      id: level.id + ':breach:' + stage + ':' + left + ':' + floor + ':' + direction,
      solids,
      panels,
      pickup:
        Math.floor(stage / 3) === rewardArea
          ? null
          : worldPoint({ x: left + (direction === 1 ? 145 : WIDTH - 145), y: floor - 28 }),
      approach,
      destination,
    });
  };
  // Prefer a passage that opens onto an existing perch. If the authored upper
  // shelves are occupied, an outboard lip supplies a compact new recoil perch.
  for (const support of source.filter(
    (solid) => solid.w >= 140 && solid.y >= 330 && solid.y <= 630,
  )) {
    for (const direction of [1, -1]) {
      add(direction === 1 ? support.x - WIDTH : support.x + support.w, support.y, direction);
    }
  }
  if (!candidates.length) {
    for (const floor of [460, 500, 420, 540, 380, 580, 340]) {
      for (let left = 280; left <= 1480; left += 20) {
        for (const direction of [1, -1]) add(left, floor, direction, true);
      }
      if (candidates.length) break;
    }
  }
  if (!candidates.length) return null;
  const rng = seeded(seed + ':breach:' + stage);
  return candidates[Math.floor(rng() * candidates.length)];
}
