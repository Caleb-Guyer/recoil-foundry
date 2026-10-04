import type { Gun } from './rules.ts';

export const STARTING_GUNS = {
  pistol: {
    name: 'Service pistol',
    trait: 'Balanced aim and recoil',
    description: 'Accurate single rounds. Steady kicks for learning recoil flight.',
  },
  shotgun: {
    name: 'Recoil shotgun',
    trait: 'Close range · Big kicks',
    description: 'Five pellets and a strong launch. Wide spread and slower follow-up shots.',
  },
  nailgun: {
    name: 'Burst nailgun',
    trait: 'Precise bursts · Smaller kicks',
    description: 'Three quick nails, then recovery. Controlled aim with less lift per shot.',
  },
} as const;
export type StartingGun = keyof typeof STARTING_GUNS;
export const STARTING_GUN_IDS = Object.keys(STARTING_GUNS) as StartingGun[];
export function isStartingGun(value: unknown): value is StartingGun {
  return typeof value === 'string' && Object.hasOwn(STARTING_GUNS, value);
}

// A separate identity from upgrade ownership: no free prerequisites or picks.
// Preserve the original pistol's exact stats and each upgrade's damage scaling.
export function applyStartingGun(gun: Gun, id: StartingGun, mods: readonly string[]): Gun {
  if (id === 'shotgun') {
    const pellets = gun.pellets;
    gun.pellets += 4;
    gun.damage *= (pellets / gun.pellets) * 2.5;
    gun.interval *= 2.5;
    gun.recoil *= 2.2;
    gun.spread = Math.max(gun.spread, mods.includes('deadeye') ? 0.0475 : 0.095);
  } else if (id === 'nailgun') {
    gun.burstCount = 3;
    // Three rounds over the original 3.1-interval burst cycle match pistol DPS.
    gun.damage *= 3.1 / 3;
    gun.recoil *= 0.55;
    // The Burst fitting improves this native mechanism rather than doing nothing.
    if (mods.includes('burst')) gun.interval *= 0.8;
  }
  return gun;
}

// New challenges rotate their starting tool by UTC date. Earlier Daily links
// retain the pistol, and a player-selected Campaign gun cannot affect a Daily.
export function dailyStartingGun(seed: string): StartingGun | undefined {
  if (typeof seed !== 'string') return undefined;
  const match = /^RF-D(\d+)-(\d{4}-\d{2}-\d{2})$/.exec(seed);
  if (!match) return undefined;
  const date = new Date(match[2] + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== match[2])
    return undefined;
  if (Number(match[1]) < 86) return 'pistol';
  const day = Math.floor(date.getTime() / 86400000);
  return STARTING_GUN_IDS[((day % 3) + 3) % 3];
}

export function validStartingGunSave(value: unknown, seed: string): boolean {
  return (
    value === undefined ||
    (isStartingGun(value) && (!dailyStartingGun(seed) || value === dailyStartingGun(seed)))
  );
}
