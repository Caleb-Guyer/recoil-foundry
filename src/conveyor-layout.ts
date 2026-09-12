import { formerStage } from './rules.ts';
import type { Level, Solid } from './levels.ts';
import { seeded, sample } from './rules.ts';

export interface Conveyor {
  x: number;
  y: number;
  w: number;
  speed: number;
}
const overlaps = (a: Solid, b: Solid) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Flush inserts leave the authored geometry, jump heights and routes intact.
// Work in canonical coordinates so mirroring also reverses the belt direction.
export function conveyorPlacements(
  level: Level,
  seed: string,
  stage: number,
  machinery: Solid[] = [],
  fixtures: Solid[] = [],
): Conveyor[] {
  if (level.setpiece) return [];
  if (level.area === 'reclamation') return [];
  stage = formerStage(stage);
  if (level.boss || level.detour || level.freight || stage < 4 || level.area === 'docks') return [];
  const rng = seeded(seed + ':conveyors:' + stage);
  if (stage !== 4 && stage !== 6 && rng() > 0.6) return [];
  const canonical = (s: Solid) => ({ ...s, x: level.mirrored ? 2000 - s.x - s.w : s.x });
  const solids = level.solids.map(canonical);
  const excluded = [...machinery, ...fixtures, ...(level.coolant ?? [])].map(canonical);
  const candidates: Conveyor[] = [];
  const speed =
    level.area === 'furnace' ? (stage === 4 ? 1.7 : 2) : level.area === 'cooling' ? 2.6 : 3.2;
  for (const support of [{ x: 260, y: 740, w: 1480, h: 100 }, ...solids]) {
    if (support.w < 244 || support.y < 300) continue;
    for (let center = support.x + 122; center <= support.x + support.w - 122; center += 40) {
      for (const w of [320, 240, 180]) {
        if (center - w / 2 < support.x + 32 || center + w / 2 > support.x + support.w - 32)
          continue;
        const clear = { x: center - w / 2 - 44, y: support.y - 100, w: w + 88, h: 100 };
        if (
          solids.some((s) => overlaps(clear, s)) ||
          excluded.some((s) => overlaps({ ...clear, h: 116 }, s))
        )
          continue;
        candidates.push({ x: center - w / 2, y: support.y, w, speed });
        break;
      }
    }
  }
  const chosen: Conveyor[] = [];
  for (const c of sample(candidates, candidates.length, rng)) {
    if (chosen.some((b) => Math.abs(b.x + b.w / 2 - c.x - c.w / 2) < (b.w + c.w) / 2 + 220))
      continue;
    const sign = rng() < 0.5 ? -1 : 1;
    chosen.push({
      ...c,
      x: level.mirrored ? 2000 - c.x - c.w : c.x,
      speed: speed * sign * (level.mirrored ? -1 : 1),
    });
    if (chosen.length >= (stage >= 8 ? 2 : 1)) break;
  }
  return chosen;
}
