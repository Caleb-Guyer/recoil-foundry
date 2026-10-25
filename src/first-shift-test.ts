import { getLevel } from './levels.ts';
import { getOvertimeLevel } from './overtime.ts';
import { testCheckpoint } from './practice.ts';
import { availableMods, type Checkpoint } from './rules.ts';
import { loadUnlocks } from './longevity.ts';
import { FIRST_SHIFT_BOSSES, isFirstShiftBoss, type FirstShiftBoss } from './first-shift-rules.ts';
export interface FirstShiftIdentity {
  boss: FirstShiftBoss;
  phase: 0 | 1 | 2;
  mirror: boolean;
  ng: boolean;
  stage: 3 | 7;
}
const codes = { loader: 'L', crane: 'C', press: 'P', kiln: 'K' } as const;
const sceneSeeds = new Map<string, string>();
function sceneSeed(boss: FirstShiftBoss, phase: 0 | 1 | 2, mirror: boolean, ng: boolean): string {
  const key = `${boss}:${phase}:${mirror}:${ng}`;
  const cached = sceneSeeds.get(key);
  if (cached) return cached;
  for (let i = 0; i < 256; i++) {
    const seed = `RF-C103-FS-${codes[boss]}-${phase + 1}-${mirror ? 'M' : 'N'}-${ng ? 'O' : 'C'}-${i}`;
    const level = ng
      ? getOvertimeLevel(seed, FIRST_SHIFT_BOSSES[boss].stage, 2)
      : getLevel(seed, FIRST_SHIFT_BOSSES[boss].stage);
    if (level.mirrored === mirror && level.spawns[0]?.kind === boss) {
      sceneSeeds.set(key, seed);
      return seed;
    }
  }
  throw new Error('No native First Shift encounter for requested boss and mirror');
}
export function firstShiftTestIdentity(seed: string): FirstShiftIdentity | null {
  const m = /^RF-C103-FS-(L|C|P|K)-([1-3])-(M|N)-(O|C)-(0|[1-9]\d{0,2})$/.exec(seed);
  if (!m || Number(m[5]) >= 256) return null;
  const boss = (Object.keys(codes) as FirstShiftBoss[]).find((k) => codes[k] === m[1])!;
  const phase = (Number(m[2]) - 1) as 0 | 1 | 2,
    mirror = m[3] === 'M',
    ng = m[4] === 'O';
  if ((ng && phase === 0) || sceneSeed(boss, phase, mirror, ng) !== seed) return null;
  return { boss, phase, mirror, ng, stage: FIRST_SHIFT_BOSSES[boss].stage };
}
export function firstShiftTestFromUrl(
  url: URL,
): ({ checkpoint: Checkpoint } & FirstShiftIdentity) | null {
  const p = url.searchParams;
  if (p.get('test') !== 'first-shift' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'boss', 'phase', 'mirror', 'ng', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const boss = p.get('boss') ?? 'loader',
    rawNg = p.get('ng') ?? '0',
    rawMirror = p.get('mirror') ?? '0';
  const rawPhase = p.get('phase') ?? (rawNg === '1' ? '2' : '1');
  if (
    invalid ||
    !isFirstShiftBoss(boss) ||
    !['0', '1'].includes(rawNg) ||
    !['0', '1'].includes(rawMirror) ||
    !['1', '2', '3'].includes(rawPhase) ||
    (rawNg === '1' && rawPhase === '1')
  )
    return null;
  const ng = rawNg === '1',
    mirror = rawMirror === '1',
    phase = (Number(rawPhase) - 1) as 0 | 1 | 2,
    stage = FIRST_SHIFT_BOSSES[boss].stage;
  const checkpoint = testCheckpoint(sceneSeed(boss, phase, mirror, ng), ng ? 8 : stage);
  checkpoint.version = 6;
  checkpoint.stage = stage;
  checkpoint.startingGun = 'pistol';
  checkpoint.encounters = 1;
  if (ng) {
    checkpoint.missedUpgrades = 11;
    checkpoint.overtime = { baseMods: 8, repairs: 0, remix: 2 };
    for (let i = 0; i < stage; i++) {
      const next = availableMods(checkpoint.mods).find((m) => !loadUnlocks([m.id]).length);
      if (!next) throw new Error('No legal First Shift fixture fitting');
      checkpoint.mods.push(next.id);
    }
  }
  return { checkpoint, boss, phase, mirror, ng, stage };
}
