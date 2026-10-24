import { LONGEVITY_IDS } from './longevity.ts';
import { rewardMods, seeded, type Checkpoint } from './rules.ts';
import type { StartingGun } from './starting-guns.ts';

export const BETTER_DRAFTS_SCENES = {
  pistol: {
    name: 'Service pistol draft',
    instruction:
      'Compare these opening choices with the shotgun test. The same seed uses your current weapon to find a useful fit. Continue and unlocks stay untouched.',
  },
  shotgun: {
    name: 'Recoil shotgun draft',
    instruction:
      'Compare these opening choices with the pistol test. The same seed uses your current weapon to find a useful fit. Continue and unlocks stay untouched.',
  },
  beam: {
    name: 'Beam build draft',
    instruction:
      'Preview real choices for an established beam build, then take a fitting or try a reroll. Continue and unlocks stay untouched.',
  },
  hold: {
    name: 'Hold and reroll',
    instruction:
      'Hold one offered card, then reroll the other two. The normal reroll costs 12 health and can be used once per reward. Continue and unlocks stay untouched.',
  },
  declined: {
    name: 'Fresh choices',
    instruction:
      'Try a draft after declining six upgrades earlier in this zone. Recently declined choices are set aside when enough alternatives remain. Continue and unlocks stay untouched.',
  },
} as const;
export type BetterDraftsScene = keyof typeof BETTER_DRAFTS_SCENES;
export const BETTER_DRAFTS_IDS = Object.keys(BETTER_DRAFTS_SCENES) as BetterDraftsScene[];

const BEAM_BUILD = [
  'cutting-torch',
  'scatter',
  'magnum',
  'rapid',
  'light',
  'burst',
  'pierce',
  'leech',
];
export const BETTER_DRAFTS_DECLINED = [
  'double-jump',
  'magnum',
  'burst',
  'backblast',
  'wing-harness',
  'coolant-rounds',
] as const;

// An explicit reward checkpoint uses the real draft and reward UI, while the
// existing testRun boundary keeps callbacks away from saved player progress.
export function betterDraftsTestFromUrl(
  url: URL,
): { checkpoint: Checkpoint; scene: BetterDraftsScene } | null {
  const p = url.searchParams;
  if (p.get('test') !== 'drafts' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const rawScene = p.get('scene') ?? 'pistol';
  if (invalid || !Object.hasOwn(BETTER_DRAFTS_SCENES, rawScene)) return null;
  const scene = rawScene as BetterDraftsScene;
  const paired = scene === 'pistol' || scene === 'shotgun';
  const seed = 'RF-C100-DRAFTS-' + (paired ? 'TOOLS-1' : scene.toUpperCase());
  const stage = scene === 'beam' ? 8 : scene === 'declined' ? 2 : 0;
  const mods =
    scene === 'beam' ? [...BEAM_BUILD] : scene === 'declined' ? ['scatter', 'rapid'] : [];
  const startingGun: StartingGun = scene === 'shotgun' ? 'shotgun' : 'pistol';
  const declined = scene === 'declined' ? [...BETTER_DRAFTS_DECLINED] : [];
  return {
    scene,
    checkpoint: {
      version: 6,
      seed,
      stage,
      startingGun,
      hp: 76,
      mods,
      unlocks: [...LONGEVITY_IDS],
      kills: 0,
      elapsed: 0,
      ...(declined.length ? { draftHistory: { zone: 0, declined } } : {}),
      reward: {
        offers: rewardMods(mods, 3, seeded(seed + ':rewards:' + stage), {
          seed,
          stage,
          startingGun,
          unlocks: LONGEVITY_IDS,
          recentDeclined: declined,
        }).map((m) => m.id),
        rerolled: false,
      },
    },
  };
}
