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
  twinbore: {
    name: 'Twinbore',
    trait: 'Paired rounds · Measured kicks',
    description:
      'Two tightly spaced rounds per shot. A slower cycle rewards lining up close targets.',
  },
  carbine: {
    name: 'Coil carbine',
    trait: 'Penetrating rounds · Long sight lines',
    description:
      'Fast, heavy rounds cross one extra enemy. Deliberate shots with a firm recoil kick.',
  },
  repeater: {
    name: 'Pressure repeater',
    trait: 'Continuous fire · Light rounds',
    description:
      'A steady stream of light rounds. Small, frequent kicks make fine flight corrections.',
  },
  bellows: {
    name: 'Bellows Cannon',
    trait: 'Hold to inhale · Release to blast',
    description:
      'Hold fire to inhale and drift forward. Release a short shrapnel blast and kick backward. Scrap boosts damage; none is required. Heavy enemies resist suction. Beam, Seeker Rack and Suspension replace this trigger.',
  },
  'debt-collector': {
    name: 'Debt Collector',
    trait: 'Fire now · Pay recoil on release',
    description:
      'Fire rounds immediately while banking recoil, even in midair. Release to vent one kick opposite your current aim. A full chamber vents automatically.',
  },
  switchjack: {
    name: 'Switchjack',
    trait: 'Launch a bolt · Press again to relocate',
    description:
      'Fire a slow bolt. Press fire again while it is live to relocate to it, consuming it. The route must fit your whole body; blocked attempts leave the bolt flying. Beam, Seeker Rack and Suspension replace this trigger.',
  },
} as const;
export type StartingGun = keyof typeof STARTING_GUNS;
export const STARTING_GUN_IDS = Object.keys(STARTING_GUNS) as StartingGun[];
// Freeze old Daily rotations even when later releases extend the tool catalog.
export const ORIGINAL_GUN_IDS: readonly StartingGun[] = [
  'pistol',
  'shotgun',
  'nailgun',
  'twinbore',
  'carbine',
  'repeater',
];
export const EXPERIMENTAL_GUN_IDS = ['bellows', 'debt-collector', 'switchjack'] as const;
export type ExperimentalGun = (typeof EXPERIMENTAL_GUN_IDS)[number];
export function isExperimentalGun(value: unknown): value is ExperimentalGun {
  return typeof value === 'string' && (EXPERIMENTAL_GUN_IDS as readonly string[]).includes(value);
}
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
  } else if (id === 'twinbore') {
    const pellets = gun.pellets;
    gun.pellets += 1;
    gun.damage *= (pellets / gun.pellets) * 1.4;
    gun.interval *= 1.4;
    gun.recoil *= 1.4;
    gun.spread = Math.max(gun.spread, mods.includes('deadeye') ? 0.013 : 0.026);
  } else if (id === 'carbine') {
    gun.damage *= 2.1;
    gun.interval *= 2.1;
    gun.recoil *= 1.5;
    gun.projectileSpeed *= 1.75;
    gun.pierce += 1;
  } else if (id === 'repeater') {
    gun.damage *= 0.55;
    gun.interval *= 0.55;
    gun.recoil *= 0.62;
    gun.projectileSpeed *= 1.12;
  } else if (id === 'bellows') {
    const pellets = gun.pellets;
    gun.pellets += 4;
    gun.damage *= (pellets / gun.pellets) * 2.8;
    gun.interval *= 2.8;
    gun.recoil *= 2.4;
    gun.spread = Math.max(gun.spread, mods.includes('deadeye') ? 0.055 : 0.11);
    gun.projectileSpeed *= 0.8;
  } else if (id === 'debt-collector') {
    gun.damage *= 0.9;
    gun.interval *= 0.9;
    gun.projectileSpeed *= 1.08;
  } else if (id === 'switchjack') {
    gun.damage *= 2.7;
    gun.interval *= 2.7;
    gun.recoil *= 1.4;
    gun.projectileSpeed *= 0.28;
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
  const version = Number(match[1]);
  const rotation =
    version >= 93
      ? STARTING_GUN_IDS
      : version >= 89
        ? ORIGINAL_GUN_IDS
        : ORIGINAL_GUN_IDS.slice(0, 3);
  return rotation[((day % rotation.length) + rotation.length) % rotation.length];
}

export function validStartingGunSave(value: unknown, seed: string): boolean {
  return (
    value === undefined ||
    (isStartingGun(value) && (!dailyStartingGun(seed) || value === dailyStartingGun(seed)))
  );
}
