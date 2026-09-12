import type { Level, Spawn, Solid } from './levels.ts';
import { seeded, sample } from './rules.ts';
import { squadSpawns } from './squads.ts';
import { breakableSolids } from './destruction-layout.ts';
import { hazardBounds, hazardPlacement } from './hazard-layouts.ts';
import { breachPlacement } from './breach-layout.ts';

const overlap = (a: Solid, b: Solid) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export function addWallcrawler(level: Level, seed: string, stage: number, overtime = false): Level {
  if (stage < 8 || level.boss || level.detour || level.freight || level.crossing || level.setpiece)
    return level;
  if (level.spawns.some((s) => s.kind === 'wallcrawler'))
    return { ...level, crawlerIntro: !overtime && stage === 8 };
  const rng = seeded(seed + ':wallcrawler:' + stage + ':' + level.id);
  if (rng() > (stage >= 16 ? 0.8 : 0.5)) return level;
  const paired = squadSpawns(level.spawns, level, seed, stage).filter((s) => s.squad);
  const candidates = level.spawns.filter(
    (s) =>
      !s.elite &&
      !s.squad &&
      ['runner', 'shooter', 'hopper', 'charger', 'flyer'].includes(s.kind) &&
      !(level.routeChoice === 'high' && s.kind === 'flyer') &&
      !paired.some((p) => p.x === s.x && p.y === s.y),
  );
  const replaced = sample(candidates, 1, rng)[0];
  if (!replaced) return level;
  const weak = breakableSolids(level, seed, stage);
  const surfaces = sample(level.solids, level.solids.length, rng).sort(
    (a, b) => Number(weak.includes(b)) - Number(weak.includes(a)),
  );
  const hazard = hazardPlacement(level, seed, stage),
    breach = breachPlacement(level, seed, stage);
  const blockers = [...level.solids, ...(breach?.solids ?? []), ...(breach?.panels ?? [])];
  for (const s of surfaces) {
    if (s.w < 65 || s.y < 300) continue;
    const underside = { x: s.x + s.w * (stage >= 16 ? 0.75 : 0.5), y: s.y + s.h + 17 };
    const sides = [
      { x: s.x - 17, y: s.y + s.h / 2 },
      { x: s.x + s.w + 17, y: s.y + s.h / 2 },
    ];
    // Upper undersides create crossfire on roofs; low side faces introduce the
    // climb in Cooling Works. Cracked supports are preferred in both areas.
    const points = stage >= 16 ? [underside, ...sides] : [...sides, underside];
    for (const p of points) {
      if (p.x < 380 || p.x > (stage === 8 ? 1100 : 1720) || p.y < 300 || p.y > 685) continue;
      const space = { x: p.x - 15, y: p.y - 15, w: 30, h: 30 };
      if (blockers.some((b) => overlap(space, b))) continue;
      if (hazard && overlap(space, hazardBounds(hazard, 40))) continue;
      if (level.magnets?.some((m) => Math.abs(m.x - p.x) < 80)) continue;
      if (
        level.scrapperCrate &&
        Math.abs(level.scrapperCrate.x - p.x) < 77 &&
        Math.abs(level.scrapperCrate.y - p.y) < 77
      )
        continue;
      if (level.spawns.some((s) => s !== replaced && Math.hypot(s.x - p.x, s.y - p.y) < 85))
        continue;
      const spawn: Spawn = { kind: 'wallcrawler', ...p };
      return {
        ...level,
        crawlerIntro: !overtime && stage === 8,
        spawns: level.spawns.map((s) => (s === replaced ? spawn : { ...s })),
      };
    }
  }
  return level;
}
