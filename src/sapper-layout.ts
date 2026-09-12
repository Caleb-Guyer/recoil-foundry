import type { Level } from './levels.ts';
import { sample, seeded } from './rules.ts';
import { squadSpawns } from './squads.ts';

export function addSapper(level: Level, seed: string, stage: number, overtime = false): Level {
  if (level.setpiece) return level;
  if (level.boss || level.detour || level.freight || (!overtime && (stage < 4 || stage === 12)))
    return level;
  if (level.spawns.some((s) => s.kind === 'sapper'))
    return { ...level, sapperIntro: !overtime && stage === 4 };
  const rng = seeded(seed + ':sapper:' + stage);
  if ((overtime || stage !== 4) && rng() > (overtime ? 0.4 : stage >= 16 ? 0.65 : 0.4))
    return level;
  const paired = squadSpawns(level.spawns, level, seed, stage).filter((s) => s.squad);
  const snipers = level.spawns.filter((s) => s.kind === 'sniper').length;
  // Preserve coordinated pairs and the rooftop's two precision threats.
  const candidates = level.spawns.filter(
    (s) =>
      !s.elite &&
      ['runner', 'charger', 'hopper', 'shooter', 'sniper'].includes(s.kind) &&
      !(stage >= 16 && s.kind === 'sniper' && snipers <= 2) &&
      !paired.some((p) => p.x === s.x && p.y === s.y),
  );
  const near = candidates.filter((s) => s.x < 1000).sort((a, b) => a.x - b.x);
  const spawn =
    !overtime && stage === 4 ? (near[0] ?? candidates[0]) : sample(candidates, 1, rng)[0];
  if (!spawn) return level;
  return {
    ...level,
    sapperIntro: !overtime && stage === 4,
    spawns: level.spawns.map((s) => (s === spawn ? { kind: 'sapper', x: s.x, y: s.y } : { ...s })),
  };
}
