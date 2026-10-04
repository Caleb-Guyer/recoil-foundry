import type { Checkpoint } from './rules.ts';
import type { LogbookProgress } from './logbook.ts';
import type { RunRecap } from './run-history.ts';
import type { CommendationId } from './commendations.ts';
import type { StartingGun } from './starting-guns.ts';

export const WEAPON_UNLOCKS_KEY = 'rf-weapon-unlocks-v1';
export const WEAPON_REQUIREMENTS: Record<StartingGun, string> = {
  pistol: 'Standard issue',
  shotgun: 'Beat the Campaign to unlock.',
  nailgun: 'Complete Overtime to unlock.',
};
export interface WeaponUnlocks {
  version: 1;
  started: boolean;
  cleared: boolean;
  overtime: boolean;
}
export function loadWeaponUnlocks(raw: unknown): WeaponUnlocks {
  const p = raw as Partial<WeaponUnlocks> | null;
  const overtime = p?.version === 1 && p.overtime === true;
  const cleared = overtime || (p?.version === 1 && p.cleared === true);
  return {
    version: 1,
    started: cleared || (p?.version === 1 && p.started === true),
    cleared,
    overtime,
  };
}
export function validWeaponUnlocks(raw: unknown): boolean {
  return (
    !!raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Object.keys(raw).every((k) => ['version', 'started', 'cleared', 'overtime'].includes(k)) &&
    Object.entries(loadWeaponUnlocks(raw)).every(
      ([k, v]) => (raw as Record<string, unknown>)[k] === v,
    )
  );
}
export function migrateWeaponUnlocks(
  raw: unknown,
  checkpoint: Checkpoint | null,
  history: readonly RunRecap[],
  book: LogbookProgress,
  earned: readonly CommendationId[],
  securityCleared = false,
): WeaponUnlocks {
  const p = loadWeaponUnlocks(raw);
  const overtime =
    p.overtime ||
    earned.includes('after-hours') ||
    history.some((r) => r.mode === 'normal' && r.outcome === 'won' && r.overtime);
  const cleared =
    p.cleared ||
    overtime ||
    securityCleared ||
    !!checkpoint?.overtime ||
    book.escaped ||
    !!book.shutdown ||
    history.some((r) => r.outcome === 'won');
  return {
    version: 1,
    started: p.started || cleared || !!checkpoint || history.length > 0 || book.areas.length > 0,
    cleared,
    overtime,
  };
}
export function unlockedStartingGuns(p: WeaponUnlocks): StartingGun[] {
  return [
    'pistol',
    ...(p.cleared ? ['shotgun'] : []),
    ...(p.overtime ? ['nailgun'] : []),
  ] as StartingGun[];
}
export function availableStartingGun(gun: StartingGun, p: WeaponUnlocks): StartingGun {
  return unlockedStartingGuns(p).includes(gun) ? gun : 'pistol';
}
