import { rewardMods, seeded, type Checkpoint } from './rules.ts';
import { isSecurityLevel } from './security.ts';
import { getLevel } from './levels.ts';
import { reinforceSecurity } from './security-layouts.ts';
export function securityTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'security') return null;
  let invalid = false;
  p.forEach((_, k) => {
    if (!['test', 'level', 'area', 'boss', 'mirror', 'v'].includes(k) || p.getAll(k).length !== 1)
      invalid = true;
  });
  const level = Number(p.get('level') ?? 3);
  const area = ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'].indexOf(
    p.get('area') ?? 'docks',
  );
  if (
    invalid ||
    !isSecurityLevel(level) ||
    !level ||
    area < 0 ||
    !['0', '1'].includes(p.get('boss') ?? '0') ||
    !['0', '1'].includes(p.get('mirror') ?? '0')
  )
    return null;
  const stage = area * 4 + (p.get('boss') === '1' ? 3 : level === 3 ? 0 : 1);
  const prefix = 'SECURITY-' + level + '-' + area + '-';
  const mirrored = p.get('mirror') === '1';
  const seed = Array.from({ length: 100 }, (_, i) => prefix + i).find((s) => {
    const room = getLevel(s, stage);
    return (
      room.mirrored === mirrored &&
      (level === 3 ||
        p.get('boss') === '1' ||
        reinforceSecurity(room, s, stage, level).spawns.some((spawn) => spawn.squad))
    );
  });
  if (!seed) return null;
  const rng = seeded(seed);
  const mods: string[] = [];
  for (let i = 0; i < stage; i++) {
    const choices = rewardMods(mods, 3, rng, { stage: i, overtime: false, seed });
    mods.push(choices[Math.floor(rng() * choices.length)].id);
  }
  return {
    version: 6,
    seed,
    stage,
    hp: 100,
    mods,
    kills: 0,
    elapsed: 0,
    security: { level, rules: 1 },
  };
}
