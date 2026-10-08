import { rewardMods, seeded, type Checkpoint } from './rules.ts';
import { LONGEVITY_IDS } from './longevity.ts';

const BUILDS = {
  beam: ['cutting-torch', 'scatter', 'magnum', 'rapid', 'light', 'burst', 'pierce', 'leech'],
  precision: ['deadeye', 'magnum', 'rapid', 'capacitor', 'leech', 'airshot', 'light', 'pierce'],
  volley: ['crossfire', 'scatter', 'magnum', 'rapid', 'light', 'burst', 'ricochet', 'pierce'],
} as const;

export function progressionTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'build', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const build = p.get('build') ?? 'beam';
  if (
    invalid ||
    p.get('test') !== 'progression' ||
    (p.has('v') && p.get('v') !== '1') ||
    !Object.hasOwn(BUILDS, build)
  )
    return null;
  const seed = 'RF-C90-DRAFT-' + build,
    mods = [...BUILDS[build as keyof typeof BUILDS]],
    stage = 8;
  return {
    version: 6,
    seed,
    stage,
    hp: 100,
    mods,
    unlocks: [...LONGEVITY_IDS],
    kills: 32,
    elapsed: 180,
    reward: {
      offers: rewardMods(mods, 3, seeded(seed + ':rewards:' + stage), {
        seed,
        stage,
        unlocks: LONGEVITY_IDS,
      }).map((m) => m.id),
      rerolled: false,
    },
  };
}
