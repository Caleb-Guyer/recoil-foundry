import { getLevel } from './levels.ts';
import { validBuild, type Checkpoint } from './rules.ts';
import { isStartingGun } from './starting-guns.ts';

export const CONTINUITY_BUILDS = {
  scatter: {
    name: 'Five-beam Scattershot',
    mods: ['cutting-torch', 'scatter'],
    hint: 'Hold fire for five separate beams. Aim the center ray for focused damage.',
  },
  prism: {
    name: 'Ten-beam Prism spread',
    mods: ['cutting-torch', 'scatter', 'prism-array'],
    hint: 'Hold fire for two five-ray fans. Each ray keeps its own collisions.',
  },
  charge: {
    name: 'Five charged lances',
    mods: ['cutting-torch', 'scatter', 'charge-lens'],
    hint: 'Hold to charge, then release all five lances with one kick.',
  },
  splinter: {
    name: 'Splintering beam spread',
    mods: ['cutting-torch', 'scatter', 'split'],
    hint: 'Each of the five beams releases three fragments on first contact per pulse.',
  },
  backfire: {
    name: 'Forward and rear Prism fans',
    mods: ['cutting-torch', 'scatter', 'prism-array', 'backblast', 'backfire'],
    hint: 'Ten beams forward and ten behind. Rear fire keeps the same spread.',
  },
  bank: {
    name: 'Banking and piercing beam spread',
    mods: ['cutting-torch', 'scatter', 'ricochet', 'banker', 'pierce'],
    hint: 'Every ray can bank off walls and pierce enemies. Watch each path.',
  },
  pulse: {
    name: 'Five-ray Pulse Chamber',
    mods: ['cutting-torch', 'scatter', 'burst', 'pulse-chamber'],
    hint: 'Three spread pulses, then recovery. The last pulse hits harder and pierces farther.',
  },
} as const;
export type ContinuityBuild = keyof typeof CONTINUITY_BUILDS;

export function continuityTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  const build = p.get('build') ?? 'scatter';
  const gun = p.get('gun') ?? 'pistol';
  if (
    p.get('test') !== 'continuity' ||
    ['test', 'build', 'gun', 'room', 'mirror'].some((key) => p.getAll(key).length > 1) ||
    ['daily', 'dv', 'seed', 'workshop', 'area', 'variant', 'combo', 'max', 'mode', 'phase'].some(
      (key) => p.has(key),
    ) ||
    !Object.hasOwn(CONTINUITY_BUILDS, build) ||
    !isStartingGun(gun) ||
    !['room', 'boss'].includes(p.get('room') ?? 'room') ||
    !['0', '1'].includes(p.get('mirror') ?? '0')
  )
    return null;
  const mods = [
    ...CONTINUITY_BUILDS[build as ContinuityBuild].mods,
    'kick',
    'airshot',
    'light',
    'leech',
    'rapid',
  ];
  if (!validBuild(mods)) return null;
  const stage = p.get('room') === 'boss' ? 19 : 10;
  for (let i = 0; i < 128; i++) {
    const seed = 'CONTINUITY-4.12-' + i;
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
      ...(stage === 19 ? {} : { route: 'low' as const }),
    };
  }
  return null;
}
