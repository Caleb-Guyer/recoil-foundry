import type { Level, Solid } from './levels.ts';
import { ENEMY_STATS } from './enemies.ts';
import { seeded, sample } from './rules.ts';

export const CARGO_SIZE = { w: 96, h: 56 };
export interface CargoPlacement {
  x: number;
  y: number;
  anchorY: number;
}
const overlap = (a: Solid, b: Solid) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// One suspended load in selected third rooms. A clear shaft leaves a low,
// jumpable obstacle after landing, with ample room away from either exit.
export function cargoPlacement(
  level: Level,
  seed: string,
  stage: number,
  machinery: Solid[] = [],
  props: Solid[] = [],
): CargoPlacement | null {
  if (!level.added || level.boss || level.detour || stage % 4 !== 2) return null;
  const rng = seeded(seed + ':cargo:' + level.id);
  if (stage !== 2 && rng() >= 0.65) return null;
  const candidates: CargoPlacement[] = [];
  for (let canonical = 400; canonical <= 1600; canonical += 10) {
    const x = level.mirrored ? 2000 - canonical : canonical;
    for (const y of [405, 575]) {
      const top = y - CARGO_SIZE.h / 2;
      const shaft = {
        x: x - CARGO_SIZE.w / 2 - 10,
        y: top - 12,
        w: CARGO_SIZE.w + 20,
        h: 740 - top + 12,
      };
      if ([...level.solids, ...machinery].some((s) => overlap(shaft, s))) continue;
      const anchorY = Math.max(
        110,
        ...level.solids
          .filter((s) => x > s.x + 12 && x < s.x + s.w - 12 && s.y + s.h <= top - 45)
          .map((s) => s.y + s.h),
      );
      const body = {
        x: x - CARGO_SIZE.w / 2 - 12,
        y: y - CARGO_SIZE.h / 2 - 12,
        w: CARGO_SIZE.w + 24,
        h: CARGO_SIZE.h + 24,
      };
      const cable = { x: x - 9, y: anchorY, w: 18, h: top - anchorY };
      const anchors = level.spawns.map((s) => ({
        x: s.x - ENEMY_STATS[s.kind].w / 2,
        y: s.y - ENEMY_STATS[s.kind].h / 2,
        w: ENEMY_STATS[s.kind].w,
        h: ENEMY_STATS[s.kind].h,
      }));
      if (
        [...props, ...anchors].some((s) => overlap(body, s) || overlap(cable, s)) ||
        [...level.solids, ...machinery].some((s) => overlap(cable, s))
      )
        continue;
      candidates.push({ x, y, anchorY });
      break;
    }
  }
  return sample(candidates, 1, rng)[0] ?? null;
}
