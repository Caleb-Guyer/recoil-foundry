import type { Level, Spawn } from './levels.ts';
import { getLevel } from './levels.ts';
import { areaIndex, seeded, sample, STAGES } from './rules.ts';
import { enemyHealth, isBoss } from './enemies.ts';
import type { EnemyKind } from './levels.ts';
import type { EliteKind } from './enemies.ts';
import { addHarpooner } from './harpooner-layout.ts';
import { addSapper } from './sapper-layout.ts';

// A separate, short seed keeps the first lap stable and lets an earned boss
// victory reconstruct its ordinary Practice arena from this same seed.
export const overtimeSeed = (seed: string) =>
  'OT-' + Math.floor(seeded(seed + ':overtime')() * 0xffffffff).toString(36);
export function overtimeHealth(kind: EnemyKind, stage: number, elite?: EliteKind) {
  return Math.ceil(
    isBoss(kind)
      ? Math.max(enemyHealth(kind, stage) * 1.4, 4200 + areaIndex(stage) * 850)
      : enemyHealth(kind, STAGES - 1, elite) * (1.2 + stage * 0.025),
  );
}
export function getOvertimeLevel(seed: string, stage: number): Level {
  const level = getLevel(overtimeSeed(seed), stage);
  const rng = seeded(seed + ':overtime-roster:' + stage);
  if (level.boss) {
    // Reinforcement points are reserved before props and hazards are placed.
    // Flying supports fit in all boss arenas without inventing floor anchors.
    const points = [500, 900, 1300, 1650].flatMap((x) => [230, 340].map((y) => ({ x, y })));
    const free = points.filter(
      (p) =>
        !level.solids.some(
          (s) => p.x + 24 > s.x && p.x - 24 < s.x + s.w && p.y + 24 > s.y && p.y - 24 < s.y + s.h,
        ),
    );
    const supports: Spawn[] = sample(free, 3, rng).map((p, i) => ({
      ...p,
      kind: i === 0 ? 'sifter' : i === 1 ? 'skimmer' : 'flyer',
    }));
    return { ...level, spawns: [...level.spawns, ...supports] };
  }
  const spawns: Spawn[] = level.spawns.map((s) => {
    if (
      s.elite ||
      s.kind === 'scrapper' ||
      s.kind === 'harpooner' ||
      s.kind === 'sapper' ||
      s.kind === 'wallcrawler' ||
      s.kind === 'angler'
    )
      return { ...s };
    const pool: EnemyKind[] = ['runner', 'charger', 'hopper', 'borer'].includes(s.kind)
      ? ['charger', 'hopper', 'borer']
      : ['flyer', 'skimmer', 'sifter'].includes(s.kind)
        ? ['flyer', 'skimmer', 'sifter']
        : ['shooter', 'sniper'];
    return { ...s, kind: sample(pool, 1, rng)[0] };
  });
  const target = stage >= 12 ? 3 : 2;
  const present = new Set(spawns.flatMap((s) => (s.elite ? [s.elite] : [])));
  for (const s of sample(
    spawns.filter(
      (s) =>
        !s.elite && !['scrapper', 'harpooner', 'sapper', 'wallcrawler', 'angler'].includes(s.kind),
    ),
    spawns.length,
    rng,
  )) {
    if (present.size >= target) break;
    const air = ['flyer', 'skimmer', 'sifter'].includes(s.kind);
    const elite: EliteKind = air
      ? 'volatile'
      : s.kind === 'shooter' || s.kind === 'sniper'
        ? 'twin'
        : 'shielded';
    if (present.has(elite)) continue;
    s.kind = elite === 'volatile' ? 'flyer' : elite === 'twin' ? 'shooter' : 'runner';
    s.elite = elite;
    present.add(elite);
  }
  return addSapper(
    addHarpooner(
      {
        ...level,
        spawns,
        harpoonIntro: false,
        sapperIntro: false,
        crawlerIntro: false,
        anglerIntro: false,
      },
      seed,
      stage,
      true,
    ),
    seed,
    stage,
    true,
  );
}
