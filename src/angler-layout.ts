import type { Level } from './levels.ts';
import { sample, seeded } from './rules.ts';
import { squadSpawns } from './squads.ts';

export function addAngler(level: Level, seed: string, stage: number, overtime = false): Level {
  if (
    level.boss ||
    level.detour ||
    level.freight ||
    level.crossing ||
    stage < 5 ||
    [8, 12].includes(stage) ||
    (level.setpiece && !level.counterweights)
  )
    return level;
  if (level.spawns.some((s) => s.kind === 'angler'))
    return { ...level, anglerIntro: !overtime && stage === 5 };
  const rng = seeded(seed + ':angler:' + stage + ':' + level.id);
  if (stage !== 5 && rng() > (stage >= 16 ? 0.75 : 0.35)) return level;
  const paired = squadSpawns(level.spawns, level, seed, stage).filter((s) => s.squad);
  const snipers = level.spawns.filter((s) => s.kind === 'sniper').length;
  const candidates = level.spawns.filter(
    (s) =>
      !s.elite &&
      !s.squad &&
      ['runner', 'shooter', 'charger', 'hopper', 'sniper'].includes(s.kind) &&
      !(stage >= 16 && s.kind === 'sniper' && snipers <= 2) &&
      !paired.some((p) => p.x === s.x && p.y === s.y),
  );
  const intro = candidates.filter((s) => s.x >= 380 && s.x <= 1100);
  const chosen = sample(stage === 5 && intro.length ? intro : candidates, 1, rng)[0];
  if (!chosen) return level;
  return {
    ...level,
    anglerIntro: !overtime && stage === 5,
    spawns: level.spawns.map((s) => (s === chosen ? { kind: 'angler', x: s.x, y: s.y } : { ...s })),
  };
}
