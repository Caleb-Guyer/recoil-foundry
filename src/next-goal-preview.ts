import { COMMENDATIONS } from './commendations.ts';
import { MODS } from './rules.ts';
import { loadLogbook } from './logbook.ts';
import { loadSecurityProfile } from './security.ts';
import { loadWeaponUnlocks, TOOL_LICENSES } from './weapon-unlocks.ts';
import type { GoalProgress } from './next-goal.ts';

export const GOAL_PREVIEWS = [
  'fresh',
  'tools',
  'security',
  'achievements',
  'discoveries',
  'complete',
] as const;
export type GoalPreview = (typeof GOAL_PREVIEWS)[number];
export function goalPreviewFromUrl(url: URL): GoalPreview | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'profile', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const profile = p.get('profile');
  return !invalid &&
    p.get('test') === 'next-goal' &&
    p.get('v') === '1' &&
    GOAL_PREVIEWS.includes(profile as GoalPreview)
    ? (profile as GoalPreview)
    : null;
}
// Display-only fixtures. They never enter ProgressStore or a Game checkpoint.
export function goalPreviewProgress(profile: GoalPreview): GoalProgress {
  const p: GoalProgress = {
    weapons: loadWeaponUnlocks({
      version: 1,
      cleared: true,
      overtime: true,
      licenses: TOOL_LICENSES,
    }),
    security: loadSecurityProfile({
      version: 1,
      unlocked: 3,
      bests: [{ level: 3, timeMs: 900000, seed: 'GOAL-PREVIEW' }],
    }),
    book: loadLogbook({
      version: 1,
      areas: ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'],
      escaped: true,
    }),
    earned: COMMENDATIONS.map((c) => c.id),
    victories: [
      'loader',
      'crane',
      'press',
      'kiln',
      'condenser',
      'turbine',
      'switchboard',
      'sorter',
      'boss',
    ],
    discovered: MODS.map((m) => m.id),
    milestones: { version: 1, arcBoss: true, circuit: true },
  };
  if (profile === 'fresh')
    return {
      ...p,
      weapons: loadWeaponUnlocks(null),
      security: loadSecurityProfile(null),
      book: loadLogbook(null),
      earned: [],
      victories: [],
      discovered: [],
      milestones: null,
    };
  if (profile === 'tools')
    return {
      ...p,
      weapons: loadWeaponUnlocks({ version: 1, cleared: true, licenses: ['twinbore'] }),
      earned: ['cable-cut'],
    };
  if (profile === 'security')
    return {
      ...p,
      security: loadSecurityProfile({ version: 1, unlocked: 3, bests: [] }),
      earned: p.earned.filter((id) => id !== 'redline'),
    };
  if (profile === 'achievements')
    return { ...p, earned: p.earned.filter((id) => id !== 'bank-job') };
  if (profile === 'discoveries')
    return { ...p, discovered: p.discovered.filter((id) => id !== 'heat-relay') };
  return p;
}
