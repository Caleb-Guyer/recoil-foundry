import type { Level } from './levels.ts';
import { seeded, sample } from './rules.ts';

export function addHarpooner(level: Level, seed: string, stage: number, overtime = false): Level {
  if (level.boss || level.detour || level.freight || (!overtime && stage !== 12)) return level;
  if (level.spawns.some((s) => s.kind === 'harpooner'))
    return { ...level, harpoonIntro: !overtime };
  const rng = seeded(seed + ':harpooner:' + stage);
  if (overtime && stage !== 12 && rng() > 0.6) return level;
  const borers = level.spawns.filter((s) => s.kind === 'borer').length;
  const candidates = level.spawns.filter(
    (s) =>
      !s.elite &&
      (['runner', 'charger', 'hopper'].includes(s.kind) || (s.kind === 'borer' && borers > 1)),
  );
  // The solo introduction belongs near the entrance, not across an empty room.
  const spawn = overtime ? sample(candidates, 1, rng)[0] : candidates.sort((a, b) => a.x - b.x)[0];
  if (!spawn) return level;
  return {
    ...level,
    harpoonIntro: !overtime,
    spawns: level.spawns.map((s) =>
      s === spawn ? { kind: 'harpooner', x: s.x, y: s.y } : { ...s },
    ),
  };
}
