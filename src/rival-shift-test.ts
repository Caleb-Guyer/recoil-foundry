import { getLevel } from './levels.ts';
import { getOvertimeLevel } from './overtime.ts';
import { testCheckpoint } from './practice.ts';
import { availableMods, type Checkpoint } from './rules.ts';
import { loadUnlocks } from './longevity.ts';
import { RIVAL_SHIFT_BOSSES, type RivalShiftBoss } from './rival-shift-rules.ts';
export interface RivalShiftIdentity {
  boss: RivalShiftBoss;
  phase: 0 | 1 | 2;
  mirror: boolean;
  ng: boolean;
  stage: 11 | 15;
}
const codes = { turbine: 'T', boss: 'I' } as const;
const sceneSeeds = new Map<string, string>();
function sceneSeed(boss: RivalShiftBoss, phase: 0 | 1 | 2, mirror: boolean, ng: boolean): string {
  const key = `${boss}:${phase}:${mirror}:${ng}`;
  const cached = sceneSeeds.get(key);
  if (cached) return cached;
  for (let i = 0; i < 256; i++) {
    const seed = `RF-C104-RS-${codes[boss]}-${phase + 1}-${mirror ? 'M' : 'N'}-${ng ? 'O' : 'C'}-${i}`;
    const level = ng
      ? getOvertimeLevel(seed, RIVAL_SHIFT_BOSSES[boss].stage, 5)
      : getLevel(seed, RIVAL_SHIFT_BOSSES[boss].stage);
    if (level.mirrored === mirror && level.spawns[0]?.kind === boss) {
      sceneSeeds.set(key, seed);
      return seed;
    }
  }
  throw new Error('No native Rival Shift encounter for requested boss and mirror');
}
export function rivalShiftTestIdentity(seed: string): RivalShiftIdentity | null {
  const m = /^RF-C104-RS-(T|I)-([1-3])-(M|N)-(O|C)-(0|[1-9]\d{0,2})$/.exec(seed);
  if (!m || Number(m[5]) >= 256) return null;
  const boss = m[1] === 'T' ? 'turbine' : 'boss',
    phase = (Number(m[2]) - 1) as 0 | 1 | 2,
    mirror = m[3] === 'M',
    ng = m[4] === 'O';
  if ((ng && phase === 0) || sceneSeed(boss, phase, mirror, ng) !== seed) return null;
  return { boss, phase, mirror, ng, stage: RIVAL_SHIFT_BOSSES[boss].stage };
}
export function rivalShiftTestFromUrl(
  url: URL,
): ({ checkpoint: Checkpoint } & RivalShiftIdentity) | null {
  const p = url.searchParams;
  if (p.get('test') !== 'rival-shift' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'boss', 'phase', 'mirror', 'ng', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const requestedBoss = p.get('boss') ?? 'turbine',
    rawNg = p.get('ng') ?? '0',
    rawMirror = p.get('mirror') ?? '0';
  const rawPhase = p.get('phase') ?? (rawNg === '1' ? '2' : '1');
  if (
    invalid ||
    !['turbine', 'interceptor'].includes(requestedBoss) ||
    !['0', '1'].includes(rawNg) ||
    !['0', '1'].includes(rawMirror) ||
    !['1', '2', '3'].includes(rawPhase) ||
    (rawNg === '1' && rawPhase === '1')
  )
    return null;
  const boss: RivalShiftBoss = requestedBoss === 'turbine' ? 'turbine' : 'boss',
    ng = rawNg === '1',
    mirror = rawMirror === '1',
    phase = (Number(rawPhase) - 1) as 0 | 1 | 2,
    stage = RIVAL_SHIFT_BOSSES[boss].stage;
  const checkpoint = testCheckpoint(sceneSeed(boss, phase, mirror, ng), ng ? 8 : stage);
  checkpoint.version = 6;
  checkpoint.stage = stage;
  checkpoint.startingGun = 'pistol';
  checkpoint.encounters = 1;
  if (ng) {
    checkpoint.missedUpgrades = 11;
    checkpoint.overtime = { baseMods: 8, repairs: 0, remix: 5 };
    for (let i = 0; i < stage; i++) {
      const next = availableMods(checkpoint.mods).find((m) => !loadUnlocks([m.id]).length);
      if (!next) throw new Error('No legal Rival Shift fixture fitting');
      checkpoint.mods.push(next.id);
    }
  }
  return { checkpoint, boss, phase, mirror, ng, stage };
}
