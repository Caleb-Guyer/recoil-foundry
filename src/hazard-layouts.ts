import { formerStage } from './rules.ts';
import type { Level, Solid } from './levels.ts';
import { ENEMY_STATS } from './enemies.ts';
import { sample, seeded } from './rules.ts';

export type HazardKind = 'lift' | 'crusher' | 'crumble';
export interface HazardPlacement {
  kind: HazardKind;
  x: number;
  y: number;
  w: number;
  h: number;
  travel: number;
}

// Placement x is the center; y is the top at rest. Bounds cover the whole motion.
export function hazardBounds(placement: HazardPlacement, headroom = 0): Solid {
  const top = placement.y - (placement.kind === 'lift' ? placement.travel : 0);
  const bottom = placement.y + placement.h + (placement.kind === 'crusher' ? placement.travel : 0);
  return {
    x: placement.x - placement.w / 2,
    y: top - headroom,
    w: placement.w,
    h: bottom - top + headroom,
  };
}

const overlaps = (a: Solid, b: Solid) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const SHAPES: Record<HazardKind, Omit<HazardPlacement, 'x' | 'kind'>> = {
  lift: { y: 670, w: 132, h: 18, travel: 160 },
  crusher: { y: 430, w: 104, h: 32, travel: 278 },
  crumble: { y: 610, w: 130, h: 18, travel: 0 },
};

function candidates(level: Level, kind: HazardKind): HazardPlacement[] {
  const result: HazardPlacement[] = [];
  const shapes =
    kind === 'crusher' ? [SHAPES[kind], { ...SHAPES[kind], y: 470, travel: 238 }] : [SHAPES[kind]];
  for (const shape of shapes) {
    for (let canonicalX = 280; canonicalX <= 1720; canonicalX += 20) {
      // Low roads reserve the end bays for their guaranteed breakable cover.
      if (level.routeChoice === 'low' && (canonicalX < 420 || canonicalX > 1580)) continue;
      const placement = { kind, x: level.mirrored ? 2000 - canonicalX : canonicalX, ...shape };
      const swept = hazardBounds(placement, 44);
      const clearance = { x: swept.x - 12, y: swept.y, w: swept.w + 24, h: swept.h };
      // Riders have headroom throughout motion. Optional platforms also leave a
      // clear floor below them, so their removal or position cannot break a route.
      const launchRoom = kind === 'crumble' ? 64 : 12;
      const floorSpace: Solid =
        kind === 'crusher'
          ? { x: swept.x - 36, y: 700, w: swept.w + 72, h: 40 }
          : {
              x: swept.x - launchRoom,
              y: placement.y + placement.h,
              w: swept.w + launchRoom * 2,
              h: 740 - placement.y - placement.h,
            };
      if (level.solids.some((solid) => overlaps(clearance, solid) || overlaps(floorSpace, solid)))
        continue;
      if (
        level.spawns.some((spawn) => {
          const { w, h } = ENEMY_STATS[spawn.kind];
          return overlaps(clearance, {
            x: spawn.x - w / 2 - 12,
            y: spawn.y - h / 2 - 12,
            w: w + 24,
            h: h + 24,
          });
        })
      )
        continue;
      result.push(placement);
    }
    // Lower the rest position only when overhead cover rules out 430px.
    if (result.length) break;
  }
  return result;
}

export function hazardPlacement(
  level: Level,
  seed: string,
  stage: number,
): HazardPlacement | undefined {
  if (level.setpiece) return;
  if (level.area === 'reclamation') return;
  stage = formerStage(stage);
  if (level.boss || level.freight || stage === 0) return;
  const kinds: HazardKind[] = level.added
    ? ([['lift'], ['crusher'], ['lift'], ['crumble']][Math.floor(stage / 4)] as HazardKind[])
    : stage === 1
      ? ['lift']
      : stage === 4
        ? ['crusher']
        : stage === 12
          ? ['crumble']
          : stage === 5 || stage === 8 || stage === 9
            ? ['lift', 'crusher']
            : ['lift', 'crusher', 'crumble'];
  const rng = seeded(seed + ':hazards:' + stage);
  for (const kind of sample(kinds, kinds.length, rng)) {
    const available = candidates(level, kind);
    const interior = available.filter((placement) => placement.x >= 420 && placement.x <= 1580);
    const pool = interior.length ? interior : available;
    if (pool.length) return { ...pool[Math.floor(rng() * pool.length)] };
  }
}
