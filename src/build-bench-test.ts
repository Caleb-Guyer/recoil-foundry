import { MODS, validBuild } from './rules.ts';
import { withParents } from './branch-builds.ts';
import { workshopBuild } from './workshop-build.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';
import type { WorkshopScenario } from './workshop.ts';

export const BUILD_BENCH_SCENES = [
  'browse',
  'dependencies',
  'comparison',
  'groups',
  'incoming',
  'cover',
  'recoil',
] as const;
export type BuildBenchScene = (typeof BUILD_BENCH_SCENES)[number];
export interface BuildBenchFixture {
  scene: BuildBenchScene;
  editor: boolean;
  known: string[];
  mods: string[];
  gun: StartingGun;
  range: WorkshopScenario;
  title: string;
  hint: string;
  initialBrowse?: { query: string };
  initialInspect?: string;
}
const fixtures = {
  browse: {
    title: 'Find a fitting',
    wanted: ['ricochet', 'light'],
    hint: 'Search names and descriptions, then filter mechanics or legal follow-ups.',
    query: 'recoil',
  },
  dependencies: {
    title: 'Upgrade paths',
    wanted: ['rail-spike', 'light'],
    hint: 'Inspect Deadeye and preview removing it. Cancel or confirm the full dependent cascade.',
    inspect: 'deadeye',
  },
  comparison: {
    title: 'Gun comparisons',
    wanted: ['scatter', 'cutting-torch', 'light'],
    hint: 'Inspect Prism Array to compare your actual Scattershot beam gun with its legal split-beam follow-up.',
    inspect: 'prism-array',
  },
  groups: {
    title: 'Grouped targets',
    wanted: ['pierce', 'split', 'ricochet', 'rapid'],
    hint: 'Fire through real grouped targets and compare penetration, splitting and area effects.',
  },
  incoming: {
    title: 'Incoming fire',
    wanted: ['countershot', 'reprisal', 'scrap-armor'],
    hint: 'Watch the locked warnings. Stop firing to recharge Countershot. Break the supply crate behind the entrance to earn and test Scrap Armor.',
  },
  cover: {
    title: 'Cover and banks',
    wanted: ['ricochet', 'banker', 'shellshock'],
    hint: 'Bank rounds, break cover and reset the room to restore real props and terrain.',
  },
  recoil: {
    title: 'Recoil course',
    wanted: [
      'kick',
      'double-jump',
      'spring-step',
      'wing-harness',
      'glide-rig',
      'ricochet-harness',
      'spring-rivets',
    ],
    hint: 'Jump and fire downward to climb. Exercise actual recoil rebounds and spring launches.',
  },
} as const;
/** Authored, private test data. This never imports or updates a player's profile. */
export function buildBenchTestFromUrl(url: URL): BuildBenchFixture | null {
  const p = url.searchParams;
  if (p.get('test') !== 'build-bench' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const scene = p.get('scene') ?? 'browse',
    gun = p.get('gun') ?? 'pistol';
  if (invalid || !BUILD_BENCH_SCENES.includes(scene as BuildBenchScene) || !isStartingGun(gun))
    return null;
  const chosen = scene as BuildBenchScene,
    config = fixtures[chosen],
    known = MODS.map((m) => m.id);
  const mods = withParents([], config.wanted);
  if (!mods || !validBuild(mods) || workshopBuild(mods, known).length !== mods.length) return null;
  const editor = ['browse', 'dependencies', 'comparison'].includes(chosen);
  return {
    scene: chosen,
    editor,
    known,
    mods,
    gun,
    range: editor ? 'standard' : (chosen as WorkshopScenario),
    title: config.title,
    hint:
      config.hint +
      ' This isolated bench leaves Continue, discoveries, weapons and saved builds untouched.',
    ...('query' in config ? { initialBrowse: { query: config.query } } : {}),
    ...('inspect' in config ? { initialInspect: config.inspect } : {}),
  };
}
