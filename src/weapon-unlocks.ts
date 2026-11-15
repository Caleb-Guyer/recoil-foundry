import type { Checkpoint } from './rules.ts';
import type { LogbookProgress } from './logbook-progress.ts';
import type { RunRecap } from './run-history.ts';
import type { CommendationId } from './commendations.ts';
import { WEAPON_CHALLENGE_TARGETS } from './weapon-challenge-rules.ts';
import {
  STARTING_GUN_IDS,
  EXPERIMENTAL_GUN_IDS,
  type ExperimentalGun,
  type StartingGun,
} from './starting-guns.ts';

export const WEAPON_UNLOCKS_KEY = 'rf-weapon-unlocks-v1';
export const WEAPON_REQUIREMENTS: Record<StartingGun, string> = {
  pistol: 'Standard issue',
  shotgun: 'Beat the Campaign to unlock.',
  nailgun: 'Complete Overtime to unlock.',
  twinbore: 'Defeat the Press or Kiln in Campaign or Daily.',
  carbine: 'Win two different Campaign miniboss hunts.',
  repeater: 'Complete the Boss Gauntlet.',
  bellows: 'Defeat 3 enemies within 180 units in one combat room.',
  'debt-collector': 'Defeat 3 enemies in one firing hold without taking damage, in one room.',
  switchjack: 'Travel 500 horizontal units in one damage-free recoil-assisted flight, then land.',
};
const LEGACY_TOOL_LICENSES = ['twinbore', 'carbine', 'repeater', 'bellows', 'switchjack'] as const;
export const TOOL_LICENSES = [...LEGACY_TOOL_LICENSES, 'debt-collector'] as const;
export type ToolLicense = (typeof TOOL_LICENSES)[number];
export interface WeaponUnlocks {
  version: 2;
  started: boolean;
  cleared: boolean;
  overtime: boolean;
  licenses?: ToolLicense[];
  challenges?: Partial<Record<ExperimentalGun, number>>;
}
export const WEAPON_CHALLENGES = {
  bellows: {
    name: 'Close Quarters',
    target: WEAPON_CHALLENGE_TARGETS.bellows,
    unit: 'close-range defeats',
    hint: 'Use any weapon in Campaign or Daily. Get within 180 units when each enemy falls. All three must be in the same combat room.',
  },
  'debt-collector': {
    name: 'Hold the Line',
    target: WEAPON_CHALLENGE_TARGETS['debt-collector'],
    unit: 'defeats in one hold',
    hint: 'Use any weapon in Campaign or Daily. Keep fire held for three defeats in one room. Releasing fire, taking damage or pausing resets the streak.',
  },
  switchjack: {
    name: 'Long Haul',
    target: WEAPON_CHALLENGE_TARGETS.switchjack,
    unit: 'horizontal flight units',
    hint: 'Use any weapon in Campaign or Daily. Take off from solid ground, use upward recoil and travel 500 units horizontally from takeoff, then land alive without taking damage. Damage, teleports and pausing cancel the flight.',
  },
} as const;

export function loadWeaponUnlocks(raw: unknown): WeaponUnlocks {
  const p = raw as (Omit<Partial<WeaponUnlocks>, 'version'> & { version?: number }) | null;
  const supported = p?.version === 1 || p?.version === 2;
  const overtime = supported && p.overtime === true;
  const cleared = overtime || (supported && p.cleared === true);
  const licenses = TOOL_LICENSES.filter(
    (id) =>
      (supported && Array.isArray(p.licenses) && p.licenses.includes(id)) ||
      (p?.version === 1 && cleared && id === 'debt-collector'),
  );
  const challenges: WeaponUnlocks['challenges'] = {};
  for (const gun of EXPERIMENTAL_GUN_IDS) {
    const value = p?.version === 2 ? p.challenges?.[gun] : undefined;
    if (typeof value === 'number' && Number.isFinite(value) && value >= 1)
      challenges[gun] = Math.min(WEAPON_CHALLENGES[gun].target, Math.floor(value));
  }
  return {
    version: 2,
    started:
      cleared ||
      licenses.length > 0 ||
      Object.keys(challenges).length > 0 ||
      (supported && p.started === true),
    cleared,
    overtime,
    ...(licenses.length ? { licenses } : {}),
    ...(Object.keys(challenges).length ? { challenges } : {}),
  };
}
export function validWeaponUnlocks(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const p = raw as Record<string, unknown>;
  if (p.version !== 1 && p.version !== 2) return false;
  const keys = ['version', 'started', 'cleared', 'overtime', 'licenses'];
  if (p.version === 2) keys.push('challenges');
  if (!Object.keys(p).every((key) => keys.includes(key))) return false;
  const normalized = loadWeaponUnlocks(raw);
  if (!(['started', 'cleared', 'overtime'] as const).every((key) => p[key] === normalized[key]))
    return false;
  const allowed = p.version === 1 ? LEGACY_TOOL_LICENSES : TOOL_LICENSES;
  if (
    p.licenses !== undefined &&
    (!Array.isArray(p.licenses) ||
      !p.licenses.length ||
      new Set(p.licenses).size !== p.licenses.length ||
      !p.licenses.every((id) => (allowed as readonly unknown[]).includes(id)))
  )
    return false;
  if (p.challenges !== undefined) {
    if (!p.challenges || typeof p.challenges !== 'object' || Array.isArray(p.challenges))
      return false;
    const entries = Object.entries(p.challenges);
    if (
      !entries.length ||
      !entries.every(
        ([gun, value]) =>
          EXPERIMENTAL_GUN_IDS.includes(gun as ExperimentalGun) &&
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value > 0 &&
          value <= WEAPON_CHALLENGES[gun as ExperimentalGun].target,
      )
    )
      return false;
  }
  return true;
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
  // Snapshot pre-challenge ownership once. Version 2 profiles must earn the new
  // challenges instead of gaining these tools from later legacy milestones.
  const legacy = (raw as { version?: number } | null)?.version !== 2;
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
      ((id === 'twinbore' || (legacy && id === 'bellows')) &&
        victories.some((kind) => kind === 'press' || kind === 'kiln')) ||
      ((id === 'carbine' || (legacy && id === 'switchjack')) &&
        ['cable-cut', 'plate-breaker', 'fuse-pulled'].filter((goal) =>
          earned.includes(goal as CommendationId),
        ).length >= 2) ||
      (id === 'repeater' && earned.includes('gauntlet-cleared')) ||
      (legacy && id === 'debt-collector' && cleared),
  );
  return {
    version: 2,
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
    ...(p.challenges ? { challenges: p.challenges } : {}),
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
export function recordWeaponChallenge(
  raw: unknown,
  gun: ExperimentalGun,
  current: number,
  complete: boolean,
): WeaponUnlocks {
  const p = loadWeaponUnlocks(raw);
  if (!Number.isFinite(current) || current < 0) return p;
  const target = WEAPON_CHALLENGES[gun].target;
  const best = Math.max(p.challenges?.[gun] ?? 0, Math.min(target, Math.floor(current)));
  const completed = complete && current >= target;
  return {
    ...p,
    started: p.started || best > 0 || completed,
    ...(best > 0 ? { challenges: { ...p.challenges, [gun]: best } } : {}),
    ...(completed
      ? { licenses: TOOL_LICENSES.filter((id) => id === gun || p.licenses?.includes(id)) }
      : {}),
  };
}
export function weaponChallengeStatus(gun: StartingGun, profile: WeaponUnlocks) {
  if (!EXPERIMENTAL_GUN_IDS.includes(gun as ExperimentalGun)) return null;
  const id = gun as ExperimentalGun;
  const info = WEAPON_CHALLENGES[id];
  const complete = unlockedStartingGuns(profile).includes(id);
  return {
    ...info,
    requirement: WEAPON_REQUIREMENTS[id],
    current: complete ? info.target : (profile.challenges?.[id] ?? 0),
    complete,
  };
}
export function availableStartingGun(gun: StartingGun, p: WeaponUnlocks): StartingGun {
  return unlockedStartingGuns(p).includes(gun) ? gun : 'pistol';
}
