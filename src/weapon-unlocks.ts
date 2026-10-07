import type { Checkpoint } from './rules.ts';
import type { LogbookProgress } from './logbook.ts';
import type { RunRecap } from './run-history.ts';
import type { CommendationId } from './commendations.ts';
import { STARTING_GUN_IDS, type StartingGun } from './starting-guns.ts';

export const WEAPON_UNLOCKS_KEY = 'rf-weapon-unlocks-v1';
export const WEAPON_REQUIREMENTS: Record<StartingGun, string> = {
  pistol: 'Standard issue',
  shotgun: 'Beat the Campaign to unlock.',
  nailgun: 'Complete Overtime to unlock.',
  twinbore: 'Defeat the Press or Kiln in Campaign or Daily.',
  carbine: 'Win two different Campaign miniboss hunts.',
  repeater: 'Complete the Boss Gauntlet.',
};
export const TOOL_LICENSES = ['twinbore', 'carbine', 'repeater'] as const;
export type ToolLicense = (typeof TOOL_LICENSES)[number];
export interface WeaponUnlocks {
  version: 1;
  started: boolean;
  cleared: boolean;
  overtime: boolean;
  licenses?: ToolLicense[];
}
export function loadWeaponUnlocks(raw: unknown): WeaponUnlocks {
  const p = raw as Partial<WeaponUnlocks> | null;
  const overtime = p?.version === 1 && p.overtime === true;
  const cleared = overtime || (p?.version === 1 && p.cleared === true);
  const licenses = TOOL_LICENSES.filter(
    (id) => p?.version === 1 && Array.isArray(p.licenses) && p.licenses.includes(id),
  );
  return {
    version: 1,
    started: cleared || licenses.length > 0 || (p?.version === 1 && p.started === true),
    cleared,
    overtime,
    ...(licenses.length ? { licenses } : {}),
  };
}
export function validWeaponUnlocks(raw: unknown): boolean {
  return (
    !!raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Object.keys(raw).every((k) =>
      ['version', 'started', 'cleared', 'overtime', 'licenses'].includes(k),
    ) &&
    ((raw as WeaponUnlocks).licenses === undefined ||
      (Array.isArray((raw as WeaponUnlocks).licenses) &&
        (raw as WeaponUnlocks).licenses!.length > 0 &&
        (raw as WeaponUnlocks).licenses!.length === loadWeaponUnlocks(raw).licenses?.length)) &&
    Object.entries(loadWeaponUnlocks(raw)).every(
      ([k, v]) => k === 'licenses' || (raw as Record<string, unknown>)[k] === v,
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
  victories: readonly string[] = [],
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
  const licenses = TOOL_LICENSES.filter(
    (id) =>
      p.licenses?.includes(id) ||
      (id === 'twinbore' && victories.some((kind) => kind === 'press' || kind === 'kiln')) ||
      (id === 'carbine' &&
        ['cable-cut', 'plate-breaker', 'fuse-pulled'].filter((goal) =>
          earned.includes(goal as CommendationId),
        ).length >= 2) ||
      (id === 'repeater' && earned.includes('gauntlet-cleared')),
  );
  return {
    version: 1,
    started:
      p.started ||
      cleared ||
      licenses.length > 0 ||
      !!checkpoint ||
      history.length > 0 ||
      book.areas.length > 0,
    cleared,
    overtime,
    ...(licenses.length ? { licenses } : {}),
  };
}
export function unlockedStartingGuns(p: WeaponUnlocks): StartingGun[] {
  return STARTING_GUN_IDS.filter(
    (id) =>
      id === 'pistol' ||
      (id === 'shotgun' && p.cleared) ||
      (id === 'nailgun' && p.overtime) ||
      p.licenses?.includes(id as ToolLicense),
  );
}
export function availableStartingGun(gun: StartingGun, p: WeaponUnlocks): StartingGun {
  return unlockedStartingGuns(p).includes(gun) ? gun : 'pistol';
}
