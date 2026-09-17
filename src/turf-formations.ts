import { distance, seeded, type Vec } from './rules.ts';

export const TURF_RED_COUNT = 14;
export const TURF_BLUE_COUNT = 12;
export const TURF_SPACING = 105;
export type TurfKind = 'runner' | 'shooter' | 'flyer';
export const TURF_FORMATIONS = {
  ground: { name: 'Ground Assault', blue: [6, 2, 4], red: [7, 2, 5] },
  crossfire: { name: 'Crossfire', blue: [2, 6, 4], red: [2, 7, 5] },
  air: { name: 'Air Battle', blue: [2, 2, 8], red: [3, 2, 9] },
} as const;
export type TurfFormation = keyof typeof TURF_FORMATIONS;
export type TurfSites = Record<TurfKind, Vec[]>;
export interface TurfUnit extends Vec {
  kind: TurfKind;
}
const kinds: TurfKind[] = ['runner', 'shooter', 'flyer'];

// Plan against real free space before spawning bodies. An unsuitable formation
// is skipped as a whole, so tight rooms cannot silently turn a ground push into
// a swarm of replacement flyers. These choices never consume combat RNG.
export function planTurfFormation(
  formation: TurfFormation,
  sites: TurfSites,
  width: number,
  allied: boolean,
  seed: string,
): TurfUnit[] | undefined {
  const counts = TURF_FORMATIONS[formation][allied ? 'blue' : 'red'];
  const front = (p: Vec) => (allied ? p.x : width - p.x) / (width / 2);
  const lane = (p: Vec) => Math.min(2, Math.floor(front(p) * 3));
  for (let attempt = 0; attempt < 16; attempt++) {
    const rng = seeded(seed + ':' + formation + ':' + allied + ':' + attempt);
    const result: TurfUnit[] = [];
    const candidates = kinds.map((kind) =>
      sites[kind].map((p) => ({ ...p, tie: rng() * (attempt ? 260 : 45) })),
    );
    // Reserve the scarcer supported sites before placing airborne troops.
    for (const index of [1, 0, 2]) {
      const kind = kinds[index];
      for (let n = 0; n < counts[index]; n++) {
        const ranked = candidates[index]
          .filter((p) => result.every((other) => distance(p, other) >= TURF_SPACING))
          .map((p) => {
            const spread = Math.min(300, ...result.map((other) => distance(p, other)));
            const occupied = result.filter((other) => lane(other) === lane(p)).length;
            const role =
              kind === 'runner'
                ? p.y * 0.3 + front(p) * 100
                : kind === 'shooter'
                  ? formation === 'crossfire'
                    ? (p.y < 620 ? 220 : 0) - p.y * 0.1
                    : (1 - front(p)) * 180
                  : (660 - p.y) * 0.12;
            return { p, score: spread - occupied * 95 + role + p.tie };
          })
          .sort((a, b) => b.score - a.score);
        if (!ranked.length) break;
        const { x, y } = ranked[0].p;
        result.push({ kind, x, y });
      }
    }
    if (result.length !== counts.reduce((a, b) => a + b, 0)) continue;
    if ([0, 1, 2].some((n) => result.filter((p) => lane(p) === n).length < 2)) continue;
    if (formation === 'crossfire') {
      const perches = result.filter((p) => p.kind === 'shooter' && p.y < 620);
      if (
        perches.length < 2 ||
        Math.max(...perches.map((p) => p.y)) - Math.min(...perches.map((p) => p.y)) < 60
      )
        continue;
    }
    if (formation === 'ground') {
      const runners = result.filter((p) => p.kind === 'runner');
      const shooters = result.filter((p) => p.kind === 'shooter');
      const averageFront = (team: TurfUnit[]) =>
        team.reduce((sum, p) => sum + front(p), 0) / team.length;
      if (runners.filter((p) => p.y >= 580).length < Math.ceil(runners.length / 2)) continue;
      if (averageFront(runners) <= averageFront(shooters)) continue;
    }
    return result;
  }
}
