import { isMeleeWeapon, type StartingGun, type MeleeWeapon } from './starting-guns.ts';

export const MELEE_FITTINGS = [
  {
    id: 'wide-guard',
    weapon: 'katana',
    name: 'Wide Guard',
    description: 'Extend the slash parry window from 0.10 to 0.22 seconds.',
    mark: 'wide-guard',
  },
  {
    id: 'riposte-edge',
    weapon: 'katana',
    name: 'Riposte Edge',
    description: 'Parrying a round primes your next slash for 75% more damage.',
    mark: 'riposte-edge',
  },
  {
    id: 'second-beat',
    weapon: 'katana',
    name: 'Second Beat',
    description: 'A single slash can parry two incoming light rounds within its guard window.',
    mark: 'second-beat',
  },
  {
    id: 'counterweight-head',
    weapon: 'hammer',
    name: 'Counterweight',
    description: 'Increase the hammer’s knockback impulse by 60%. Heavy machines resist the shove.',
    mark: 'counterweight-head',
  },
  {
    id: 'sweeping-face',
    weapon: 'hammer',
    name: 'Sweeping Face',
    description: 'Widen the hammer swing and extend its reach by 32 units.',
    mark: 'sweeping-face',
  },
  {
    id: 'rebound-clutch',
    weapon: 'hammer',
    name: 'Rebound Clutch',
    description:
      'Landing a hit on an enemy cuts that swing’s recovery by 25%. Each swing earns the reduction once.',
    mark: 'rebound-clutch',
  },
  {
    id: 'quick-wind',
    weapon: 'spear',
    name: 'Quick Wind',
    description: 'Reach full spear charge in 0.35 seconds instead of 0.70.',
    mark: 'quick-wind',
  },
  {
    id: 'deep-drive',
    weapon: 'spear',
    name: 'Deep Drive',
    description: 'Charging the spear adds up to 38 more units of reach and 40% more thrust damage.',
    mark: 'deep-drive',
  },
  {
    id: 'tandem-point',
    weapon: 'spear',
    name: 'Tandem Point',
    description:
      'After a thrust damages its first enemy, it deals 40% more damage to each additional enemy it pierces.',
    mark: 'tandem-point',
  },
] as const;
const owners = new Map<string, MeleeWeapon>(MELEE_FITTINGS.map((m) => [m.id, m.weapon]));
export const meleeFittingOwner = (id: string) => owners.get(id);
export function buildMeleeWeapon(mods: readonly string[]) {
  for (const id of mods) {
    const weapon = owners.get(id);
    if (weapon) return weapon;
  }
  return undefined;
}
const shared = new Set([
  'magnum',
  'rapid',
  'airshot',
  'kick',
  'leech',
  'light',
  'landing',
  'redline',
  'capacitor',
  'reserve-cell',
  'fold',
  'rewire',
  'slingshot',
  'grapnel',
  'double-jump',
  'wing-harness',
  'wallrunner',
  'air-brake',
  'spring-step',
  'glide-rig',
  'ground-anchor',
  'impulse-reserve',
  'field-patch',
  'opening-shot',
  'ramjet',
  'wrecking-ball',
  'triphammer',
  'ricochet-harness',
  'slip-gauge',
  'wake-wire',
  'spoof',
  'standing-orders',
  'priority-target',
  'cross-talk',
  'dead-switch',
  'deadeye',
  'execute',
  'false-silhouette',
  'gimbal-mount',
  'momentum-battery',
  'regulator',
  'recoil-runner',
]);
export function toolAllowsFitting(id: string, gun: StartingGun) {
  const owner = owners.get(id);
  return owner ? owner === gun : !isMeleeWeapon(gun) || shared.has(id);
}
