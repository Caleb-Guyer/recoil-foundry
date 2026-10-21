import { FIRST_RUN_PREVIEW_SEED } from './first-session.ts';
import type { Checkpoint } from './rules.ts';

export const FIRST_RUN_SCENES = ['opening', 'upgrade', 'warmup'] as const;
export type FirstRunScene = (typeof FIRST_RUN_SCENES)[number];

export function firstRunPreviewFromUrl(url: URL): FirstRunScene | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const scene = p.get('scene') as FirstRunScene;
  return !invalid &&
    p.get('test') === 'first-run' &&
    p.get('v') === '1' &&
    FIRST_RUN_SCENES.includes(scene)
    ? scene
    : null;
}

// Uses the real first room / reward UI, with the existing test-run save guards.
export function firstRunTestFromUrl(url: URL): Checkpoint | null {
  const scene = firstRunPreviewFromUrl(url);
  if (!scene) return null;
  return {
    version: 6,
    seed: scene === 'opening' ? FIRST_RUN_PREVIEW_SEED : 'FIRST-RUN-' + scene.toUpperCase(),
    startingGun: 'pistol',
    stage: 0,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
    ...(scene === 'upgrade'
      ? { reward: { offers: ['magnum', 'scatter', 'rapid'], rerolled: false } }
      : {}),
  };
}
