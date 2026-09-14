import {
  MOD_REQUIRES,
  FUSION_REQUIRES,
  availableMods,
  validBuild,
  isFusion,
  type Checkpoint,
} from './rules.ts';
import { BRANCH_GROUPS, BRANCH_PARENTS } from './upgrade-branches.ts';
import { getLevel } from './levels.ts';

export function withParents(build: readonly string[], wanted: readonly string[]): string[] | null {
  const result = [...build],
    visiting = new Set<string>();
  const add = (id: string): boolean => {
    if (result.includes(id)) return true;
    if (visiting.has(id)) return false;
    visiting.add(id);
    for (const parent of [
      MOD_REQUIRES[id],
      ...(FUSION_REQUIRES[id] ?? []),
      ...(BRANCH_PARENTS[id] ?? []),
    ])
      if (parent && !add(parent)) return false;
    if (!availableMods(result, true).some((mod) => mod.id === id)) return false;
    result.push(id);
    visiting.delete(id);
    return true;
  };
  return wanted.every(add) ? result : null;
}
export function completeBuild(build: readonly string[]) {
  const result = [...build];
  if (!validBuild(result)) return null;
  for (;;) {
    const next = availableMods(result, true)[0];
    if (!next) return result;
    result.push(next.id);
  }
}

export const BRANCH_TEST_BUILDS: Record<string, { name: string; mods: readonly string[] }> = {
  resonator: {
    name: 'Resonator',
    mods: [
      'cutting-torch',
      'burst',
      'pulse-chamber',
      'fold',
      'relay-gate',
      'resonator',
      'scatter',
      'airshot',
      'light',
      'leech',
    ],
  },
  flywheel: {
    name: 'Flywheel',
    mods: [
      'mass-driver',
      'skid-plate',
      'grindshot',
      'crosscut',
      'flywheel',
      'pierce',
      'banker',
      'airshot',
      'light',
      'leech',
    ],
  },
  storm: {
    name: 'Storm Cell',
    mods: [
      'shellshock',
      'cluster-shell',
      'arc-coil',
      'storm-cell',
      'aftershock',
      'blast-surf',
      'airshot',
      'light',
      'leech',
      'rapid',
    ],
  },
  pulse: {
    name: 'Pulse Chamber',
    mods: [
      'cutting-torch',
      'burst',
      'pulse-chamber',
      'thermal-runaway',
      'scatter',
      'airshot',
      'light',
      'leech',
      'kick',
    ],
  },
  charge: {
    name: 'Charge Lens',
    mods: [
      'cutting-torch',
      'charge-lens',
      'thermal-runaway',
      'scatter',
      'capacitor',
      'airshot',
      'light',
      'leech',
      'kick',
    ],
  },
  prism: {
    name: 'Prism Array',
    mods: [
      'cutting-torch',
      'prism-array',
      'thermal-runaway',
      'scatter',
      'pierce',
      'airshot',
      'light',
      'leech',
      'kick',
    ],
  },
  pinwheel: {
    name: 'Pinwheel',
    mods: [
      'crossfire',
      'pinwheel',
      'scatter',
      'rapid',
      'burst',
      'airshot',
      'light',
      'leech',
      'kick',
    ],
  },
  follow: {
    name: 'Follow-through',
    mods: [
      'crossfire',
      'afterimage',
      'follow-through',
      'vector',
      'afterburner',
      'airshot',
      'light',
      'leech',
      'kick',
    ],
  },
  shaped: {
    name: 'Shaped Charge',
    mods: [
      'shellshock',
      'shaped-charge',
      'fuse',
      'linked-fuse',
      'aftershock',
      'shockfront',
      'blast-surf',
      'airshot',
      'light',
      'leech',
    ],
  },
  cluster: {
    name: 'Cluster Shell',
    mods: [
      'shellshock',
      'cluster-shell',
      'fuse',
      'linked-fuse',
      'aftershock',
      'shockfront',
      'blast-surf',
      'airshot',
      'light',
      'leech',
    ],
  },
  skid: {
    name: 'Skid Plate',
    mods: [
      'mass-driver',
      'skid-plate',
      'pierce',
      'banker',
      'tether',
      'airshot',
      'light',
      'leech',
      'kick',
    ],
  },
  relay: {
    name: 'Relay Gate',
    mods: [
      'fold',
      'relay-gate',
      'slingshot',
      'banker',
      'ricochet',
      'airshot',
      'light',
      'leech',
      'kick',
    ],
  },
  short: {
    name: 'Short Circuit',
    mods: [
      'arc-coil',
      'short-circuit',
      'magnum',
      'rapid',
      'pierce',
      'airshot',
      'light',
      'leech',
      'kick',
    ],
  },
  triphammer: {
    name: 'Triphammer',
    mods: [
      'ramjet',
      'triphammer',
      'kick',
      'redline',
      'backblast',
      'breach',
      'airshot',
      'light',
      'leech',
    ],
  },
  crosscut: {
    name: 'Crosscut',
    mods: [
      'grindshot',
      'crosscut',
      'split',
      'shatter',
      'pierce',
      'banker',
      'airshot',
      'light',
      'leech',
    ],
  },
};
export interface MaxCombo {
  code: string;
  path: string;
  weapon: string;
  choices: string[];
  mods: string[];
}
let cachedCombos: MaxCombo[] | undefined;
export function maxCombos(): readonly MaxCombo[] {
  if (cachedCombos) return cachedCombos;
  const result: MaxCombo[] = [],
    seen = new Set<string>();
  for (const [path, root] of [
    ['precision', 'deadeye'],
    ['bullet-hell', 'crossfire'],
    ['demolition', 'shellshock'],
  ]) {
    for (const weapon of ['cutting-torch', 'rail-spike', 'mass-driver']) {
      const start = withParents([], [root, weapon]);
      if (!start) continue;
      const groups = Object.values(BRANCH_GROUPS);
      const walk = (build: string[], choices: string[], index: number) => {
        if (index === groups.length) {
          const options = build.some(isFusion)
            ? [build]
            : Object.keys(FUSION_REQUIRES).flatMap((id) => {
                const mods = withParents(build, [id]);
                return mods ? [mods] : [];
              });
          if (!options.length) options.push(build);
          for (const [i, option] of options.entries()) {
            const mods = completeBuild(option)!;
            const key = [...mods].sort().join(',');
            if (seen.has(key)) continue;
            seen.add(key);
            result.push({
              code: [path, weapon, ...choices, ...(i ? [mods.find(isFusion)!] : [])].join('.'),
              path,
              weapon,
              choices,
              mods,
            });
          }
          return;
        }
        const variants = groups[index].flatMap((id) => {
          const mods = withParents(build, [id]);
          return mods ? [{ mods, id }] : [];
        });
        if (!variants.length) walk(build, choices, index + 1);
        else for (const { mods, id } of variants) walk(mods, [...choices, id], index + 1);
      };
      walk(start, [], 0);
    }
  }
  cachedCombos = result;
  return cachedCombos;
}
export function branchTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.get('test') !== 'branches' ||
    ['test', 'build', 'max', 'combo', 'room', 'mirror'].some((key) => p.getAll(key).length > 1) ||
    ['daily', 'dv', 'seed', 'workshop', 'area', 'variant'].some((key) => p.has(key)) ||
    !['0', '1'].includes(p.get('mirror') ?? '0') ||
    !['0', '1'].includes(p.get('max') ?? '0') ||
    !['room', 'boss'].includes(p.get('room') ?? 'room')
  )
    return null;
  let mods: string[] | null;
  if (p.has('combo')) {
    if (p.has('build') || p.has('max')) return null;
    mods = [...(maxCombos().find((combo) => combo.code === p.get('combo'))?.mods ?? [])];
    if (!mods.length) return null;
  } else {
    const key = p.get('build') ?? 'pulse';
    if (!Object.hasOwn(BRANCH_TEST_BUILDS, key)) return null;
    const preset = BRANCH_TEST_BUILDS[key];
    mods = p.get('max') === '1' ? completeBuild(preset.mods) : [...preset.mods];
  }
  if (!mods || !validBuild(mods)) return null;
  const stage = p.get('room') === 'boss' ? 19 : 10;
  for (let i = 0; i < 4096; i++) {
    const seed = 'BRANCHES-71-' + i;
    if (getLevel(seed, stage).mirrored !== (p.get('mirror') === '1')) continue;
    while (mods.length < stage) {
      const next = availableMods(mods).find((m) => !Object.hasOwn(BRANCH_PARENTS, m.id));
      if (!next) break;
      mods.push(next.id);
    }
    return {
      version: 6,
      seed,
      stage,
      hp: 100,
      mods,
      kills: 0,
      elapsed: 0,
      ...(p.get('room') === 'boss' ? {} : { route: 'low' as const }),
    };
  }
  return null;
}
