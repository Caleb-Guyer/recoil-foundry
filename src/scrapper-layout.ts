import type { Level, Solid } from './levels.ts';
import { seeded, sample } from './rules.ts';
import { hazardBounds, hazardPlacement } from './hazard-layouts.ts';
import { breachPlacement } from './breach-layout.ts';

const overlaps = (a: Solid, b: Solid) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function addScrapper(level: Level, seed: string, stage: number): Level {
  if (level.boss || level.detour || ![8, 9, 12, 13].includes(stage)) return level;
  const rng = seeded(seed + ':scrapper:' + stage);
  if (rng() > (stage < 12 ? 0.45 : 0.75)) return level;
  const candidates = level.spawns.filter(
    (s) => !s.elite && (s.kind === 'runner' || s.kind === 'shooter'),
  );
  for (const spawn of sample(candidates, candidates.length, rng)) {
    // Match an existing 32-high anchor; preserve the roster and all elite rolls.
    const trial: Level = {
      ...level,
      spawns: level.spawns.map((s) => (s === spawn ? { ...s, kind: 'scrapper' } : s)),
    };
    const hazard = hazardPlacement(trial, seed, stage);
    const breach = breachPlacement(trial, seed, stage);
    const solids = [...level.solids, ...(breach?.solids ?? []), ...(breach?.panels ?? [])];
    const floor = spawn.y + (spawn.kind === 'runner' ? 17 : 16);
    for (const side of [level.mirrored ? 1 : -1, level.mirrored ? -1 : 1]) {
      const x = spawn.x + side * 110,
        y = floor - 23;
      if (x < 320 || x > 1740) continue;
      const space = {
        x: Math.min(x, spawn.x + side * 52) - 30,
        y: floor - 110,
        w: Math.abs(x - spawn.x - side * 52) + 60,
        h: 109,
      };
      if (solids.some((s) => overlaps(space, s))) continue;
      if (hazard && overlaps(space, hazardBounds(hazard, 44))) continue;
      if (level.spawns.some((s) => s !== spawn && Math.abs(s.x - x) < 90 && Math.abs(s.y - y) < 90))
        continue;
      if (
        floor !== 740 &&
        !level.solids.some((s) => s.y === floor && s.x + 28 < x && s.x + s.w - 28 > x)
      )
        continue;
      return { ...trial, scrapperCrate: { x, y } };
    }
  }
  return level;
}
