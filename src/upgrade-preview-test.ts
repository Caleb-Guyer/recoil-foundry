import type { Checkpoint } from './rules.ts';
import { isStartingGun } from './starting-guns.ts';

export const UPGRADE_PREVIEW_PRESETS: Record<string, { mods: string[]; offers: string[] }> = {
  basic: { mods: [], offers: ['magnum', 'scatter', 'rapid'] },
  rail: { mods: ['deadeye', 'capacitor'], offers: ['magnum', 'scatter', 'rail-spike'] },
  beam: { mods: ['cutting-torch', 'burst'], offers: ['scatter', 'rapid', 'pulse-chamber'] },
  stasis: { mods: ['suspension', 'crosshatch'], offers: ['convoy', 'thread-the-needle', 'rapid'] },
  shell: { mods: ['shellshock', 'fuse'], offers: ['implosion', 'aftershock', 'shaped-charge'] },
  support: {
    mods: ['cutting-torch', 'scatter', 'prism-array'],
    offers: ['collimator', 'overkill-bank', 'scrap-armor'],
  },
  heat: {
    mods: ['cutting-torch', 'thermal-runaway'],
    offers: ['heat-relay', 'overkill-bank', 'scrap-armor'],
  },
};
// Explicit reward-screen previews use the regular UI without profile callbacks.
export function upgradePreviewTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'upgrade-preview') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'build', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const key = p.get('build') ?? 'basic',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    !Object.hasOwn(UPGRADE_PREVIEW_PRESETS, key) ||
    !isStartingGun(gun) ||
    (p.has('v') && p.get('v') !== '1')
  )
    return null;
  const preset = UPGRADE_PREVIEW_PRESETS[key];
  const stage = key === 'basic' ? 0 : 8;
  return {
    version: 6,
    seed: 'UPGRADE-PREVIEW-' + key.toUpperCase(),
    startingGun: gun,
    stage,
    missedUpgrades: stage - preset.mods.length,
    hp: 76,
    mods: [...preset.mods],
    kills: 0,
    elapsed: 0,
    reward: { offers: [...preset.offers], rerolled: false },
  };
}
