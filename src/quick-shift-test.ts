import { quickShiftFromSeed, type QuickShiftChallenge } from './quick-shift-rules.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';

export const QUICK_SHIFT_TEST_SCENES = ['run', 'drafts', 'seeds'] as const;
export type QuickShiftTestScene = (typeof QUICK_SHIFT_TEST_SCENES)[number];
export interface QuickShiftFixture {
  scene: QuickShiftTestScene;
  challenge: QuickShiftChallenge;
  gun: StartingGun;
}
/** Explicit private tests use native drafts and fights without saving records or Continue. */
export function quickShiftTestFromUrl(url: URL): QuickShiftFixture | null {
  const p = url.searchParams;
  if (p.get('test') !== 'quick-shift' || p.get('v') !== '1' || url.hash) return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const scene = p.get('scene') ?? 'run',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    !QUICK_SHIFT_TEST_SCENES.includes(scene as QuickShiftTestScene) ||
    !isStartingGun(gun)
  )
    return null;
  return {
    scene: scene as QuickShiftTestScene,
    challenge: quickShiftFromSeed(scene === 'drafts' ? 'RF-Q1-DRAFT531' : 'RF-Q1-QUICK531')!,
    gun,
  };
}
