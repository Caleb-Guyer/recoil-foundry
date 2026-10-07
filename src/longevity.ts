import type { LogbookProgress } from './logbook.ts';
import type { CommendationId } from './commendations.ts';
import { TOOLROOM_MODS, toolroomDraftAllowed, type ToolroomFamily } from './toolroom-catalog.ts';

// Campaign unlocks are separate from ownership and structural build legality.
// A run snapshots these IDs; earning a goal changes the next run's draft.
export const LONGEVITY_MODS = [
  {
    id: 'double-jump',
    name: 'Double Jump',
    description: 'Press jump again in the air for one extra jump. Landing recharges it.',
    color: '#b8ddc9',
    mark: 'double-jump',
  },
  {
    id: 'wing-harness',
    name: 'Wing Harness',
    description:
      'Hold jump while descending to glide. Each landing restores 1.2 seconds of glide; recoil still supplies lift.',
    color: '#b8ddc9',
    mark: 'wing-harness',
  },
  {
    id: 'ground-fault',
    name: 'Ground Fault',
    description:
      'Arc Coil releases a 75%-strength floor pulse instead of chaining. Up to three grounded targets within 190 units; floors and cover block it.',
    color: '#b9e4ed',
    mark: 'ground-fault',
  },
  {
    id: 'static-reservoir',
    name: 'Static Reservoir',
    description:
      'Three airborne recoil shots store one cell. The next Arc Coil discharge spends it on a half-strength bonus arc. Landing drains unused charge.',
    color: '#b9e4ed',
    mark: 'static-reservoir',
  },
  {
    id: 'conductive-tether',
    name: 'Conductive Tether',
    description:
      'An Arc Coil discharge also sends 35% of its damage down your enemy tether. One transfer per discharge; shields and broken cover stop it.',
    color: '#b9e4ed',
    mark: 'conductive-tether',
  },
  ...TOOLROOM_MODS,
] as const;
export type LongevityId = (typeof LONGEVITY_MODS)[number]['id'];
export const LONGEVITY_IDS: readonly LongevityId[] = LONGEVITY_MODS.map((m) => m.id);
export function loadUnlocks(raw: unknown): LongevityId[] {
  return LONGEVITY_IDS.filter((id) => Array.isArray(raw) && raw.includes(id));
}
export function validUnlocks(raw: unknown): raw is LongevityId[] {
  return Array.isArray(raw) && raw.length === loadUnlocks(raw).length;
}
export function draftUnlocked(id: string, unlocks: readonly string[] = [], seed = '') {
  return (
    (!LONGEVITY_IDS.includes(id as LongevityId) ||
      (!/^RF-D\d+-/.test(seed) && unlocks.includes(id))) &&
    toolroomDraftAllowed(id, seed)
  );
}
export const MILESTONES_KEY = 'rf-milestones-v1';
export interface Milestones {
  version: 1;
  arcBoss?: true;
  circuit?: true;
}
export type MilestoneId = 'arcBoss' | 'circuit';
export function loadMilestones(raw: unknown): Milestones {
  const v = raw as Partial<Milestones> | null;
  return {
    version: 1,
    ...(v?.version === 1 && v.arcBoss === true ? { arcBoss: true } : {}),
    ...(v?.version === 1 && v.circuit === true ? { circuit: true } : {}),
  };
}
export function validMilestones(raw: unknown): raw is Milestones {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const v = raw as Milestones;
  return (
    v.version === 1 &&
    Object.keys(v).every((k) => ['version', 'arcBoss', 'circuit'].includes(k)) &&
    (v.arcBoss === undefined || v.arcBoss === true) &&
    (v.circuit === undefined || v.circuit === true)
  );
}
export interface UnlockGoal {
  id: LongevityId;
  name: string;
  requirement: string;
  current: number;
  target: number;
  unlocked: boolean;
}
export function unlockGoals(
  book: LogbookProgress,
  earned: readonly CommendationId[],
  victories: readonly string[],
  rawMilestones: unknown,
): UnlockGoal[] {
  const milestones = loadMilestones(rawMilestones);
  const progress: readonly [string, number, number][] = [
    [
      'Defeat the Loader or Crane in Campaign or Daily.',
      Number(victories.some((v) => v === 'loader' || v === 'crane')),
      1,
    ],
    [
      'Visit three different main zones in Campaign or Daily.',
      Math.min(3, new Set(book.areas).size),
      3,
    ],
    ['Defeat a boss with Arc Coil equipped in Campaign or Daily.', Number(!!milestones.arcBoss), 1],
    [
      'Earn Air Traffic: defeat six enemies in one room without landing between kills.',
      Number(earned.includes('air-traffic')),
      1,
    ],
    [
      'Link two hostile machines with Tether while Arc Coil is equipped in Campaign or Daily.',
      Number(!!milestones.circuit),
      1,
    ],
  ];
  const families: Record<ToolroomFamily, readonly [string, number, number]> = {
    mobility: [
      'Defeat the Loader or Crane in Campaign or Daily.',
      Number(victories.some((v) => ['loader', 'crane'].includes(v))),
      1,
    ],
    precision: [
      'Defeat the Press or Kiln in Campaign or Daily.',
      Number(victories.some((v) => ['press', 'kiln'].includes(v))),
      1,
    ],
    thermal: [
      'Defeat the Condenser, Turbine or Switchboard in Campaign or Daily.',
      Number(victories.some((v) => ['condenser', 'turbine', 'switchboard'].includes(v))),
      1,
    ],
    banking: [
      'Defeat three different main bosses in Campaign or Daily.',
      Math.min(
        3,
        new Set(
          victories.filter((v) =>
            [
              'loader',
              'crane',
              'press',
              'kiln',
              'condenser',
              'turbine',
              'switchboard',
              'sorter',
              'boss',
              'interceptor',
              'welder',
            ].includes(v),
          ),
        ).size,
      ),
      3,
    ],
    defense: ['Defeat the Sorter in Campaign or Daily.', Number(victories.includes('sorter')), 1],
    cadence: [
      'Complete the Campaign escape or factory shutdown.',
      Number(book.escaped || !!book.shutdown),
      1,
    ],
  };
  const goals = [...progress, ...TOOLROOM_MODS.map((mod) => families[mod.family])];
  return LONGEVITY_MODS.map((mod, i) => ({
    id: mod.id,
    name: mod.name,
    requirement: goals[i][0],
    current: goals[i][1],
    target: goals[i][2],
    unlocked: goals[i][1] >= goals[i][2],
  }));
}
