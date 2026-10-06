import { getLevel } from './levels.ts';
import { validBuild, type Checkpoint } from './rules.ts';
import { isStartingGun } from './starting-guns.ts';

export const SUPPORT_BUILDS = {
  collimator: {
    name: 'Collimator · ten beams',
    mods: ['cutting-torch', 'scatter', 'prism-array', 'collimator'],
    hint: 'Hold your aim steady to tighten all ten beams. Sweep to reopen the fan. The mint strip shows focus.',
  },
  heat: {
    name: 'Heat Relay',
    mods: ['cutting-torch', 'thermal-runaway', 'heat-relay'],
    hint: 'Track an enemy until it falls, then target another within one second. An orange fitting shows stored heat.',
  },
  overkill: {
    name: 'Overkill Bank · heavy rounds',
    mods: ['magnum', 'capacitor', 'overkill-bank'],
    hint: 'Pause to charge, then finish a wounded enemy. The gold fitting lights when excess damage is ready for the next shot.',
  },
  armor: {
    name: 'Scrap Armor',
    mods: ['magnum', 'ricochet', 'scrap-armor'],
    hint: 'Shoot a crate or cracked cover apart. Mint plates absorb one small enemy bullet for four seconds, with a six-second recharge.',
  },
  mass: {
    name: 'Overkill Bank · steel balls',
    mods: ['mass-driver', 'scatter', 'capacitor', 'overkill-bank'],
    hint: 'Charge a heavy volley and finish a wounded enemy. Excess damage boosts the next whole volley once.',
  },
  combined: {
    name: 'All four · ten beams',
    mods: [
      'cutting-torch',
      'scatter',
      'prism-array',
      'thermal-runaway',
      'heat-relay',
      'collimator',
      'overkill-bank',
      'scrap-armor',
    ],
    hint: 'Steady aim tightens the fan. Kill to carry heat and bank excess damage; break cover to collect one plate.',
  },
} as const;
export type SupportBuild = keyof typeof SUPPORT_BUILDS;
export function supportTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  const build = p.get('build') ?? 'collimator',
    gun = p.get('gun') ?? 'pistol';
  let invalid = false;
  p.forEach((_, key) => {
    if (
      !['test', 'build', 'gun', 'room', 'mirror', 'v'].includes(key) ||
      p.getAll(key).length !== 1
    )
      invalid = true;
  });
  if (
    invalid ||
    p.get('test') !== 'support' ||
    !Object.hasOwn(SUPPORT_BUILDS, build) ||
    !isStartingGun(gun) ||
    !['room', 'boss'].includes(p.get('room') ?? 'room') ||
    !['0', '1'].includes(p.get('mirror') ?? '0')
  )
    return null;
  const mods = [
    ...SUPPORT_BUILDS[build as SupportBuild].mods,
    'kick',
    'airshot',
    'light',
    'leech',
    'rapid',
  ];
  if (!validBuild(mods)) return null;
  const stage = p.get('room') === 'boss' ? 19 : build === 'combined' ? 14 : 10;
  for (let i = 0; i < 128; i++) {
    const seed = 'SUPPORT-4.13-' + i;
    if (getLevel(seed, stage).mirrored !== (p.get('mirror') === '1')) continue;
    return {
      version: 6,
      seed,
      stage,
      hp: 100,
      mods,
      startingGun: gun,
      kills: 0,
      elapsed: 0,
      missedUpgrades: stage - mods.length,
      ...(stage === 10 ? { route: 'low' as const } : {}),
    };
  }
  return null;
}
