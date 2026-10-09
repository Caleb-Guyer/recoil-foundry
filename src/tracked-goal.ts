import { COMMENDATIONS } from './commendations.ts';
import type { LogbookEntry } from './logbook.ts';
import { LONGEVITY_IDS, unlockGoals, type LongevityId } from './longevity.ts';
import { MODS } from './rules.ts';
import { goalById, goalMeasure, nextGoal, type GoalProgress } from './next-goal.ts';

export const TRACKED_GOAL_KEY = 'rf-tracked-goal-v1';
export interface TrackedGoal {
  version: 1;
  id: string;
}
const ids = new Set([
  ...['twinbore', 'carbine', 'repeater', 'nailgun'].map((id) => 'weapon:' + id),
  ...LONGEVITY_IDS.map((id) => 'license:' + id),
  ...MODS.map((m) => 'discover:' + m.id),
  ...COMMENDATIONS.map((c) => 'commendation:' + c.id),
]);
export function loadTrackedGoal(raw: unknown): TrackedGoal | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as TrackedGoal;
  return p.version === 1 &&
    ids.has(p.id) &&
    Object.keys(p).every((k) => ['version', 'id'].includes(k))
    ? { version: 1, id: p.id }
    : null;
}
export function validTrackedGoal(raw: unknown) {
  return raw === null || !!loadTrackedGoal(raw);
}

// A chosen goal must still be revealed, incomplete and available after the first
// Campaign clear. Importing a preference cannot reveal or grant its reward.
export function trackedGoal(p: GoalProgress, raw: unknown) {
  const tracked = loadTrackedGoal(raw);
  if (!tracked || !p.weapons.cleared) return null;
  const goal = goalById(p, tracked.id);
  if (!goal || goalMeasure(goal.id, p).complete) return null;
  if (goal.kind === 'discovery') {
    const id = goal.id.slice(9);
    const namedLicense =
      LONGEVITY_IDS.includes(id as LongevityId) &&
      unlockGoals(p.book, p.earned, p.victories, p.milestones).some(
        (g) => g.id === id && g.unlocked,
      );
    if (!p.revealed?.includes('mod:' + id) && !namedLicense) return null;
  }
  return goal;
}
export function selectedGoal(p: GoalProgress, raw?: unknown) {
  return trackedGoal(p, raw) ?? nextGoal(p);
}

export function logbookGoal(entry: LogbookEntry, p: GoalProgress) {
  const id = entry.weapon
    ? 'weapon:' + entry.weapon
    : entry.id.startsWith('commendation:')
      ? entry.id
      : entry.mod
        ? (entry.goal && !entry.goal.unlocked ? 'license:' : 'discover:') + entry.mod.id
        : '';
  if (entry.state === 'unseen' && !(entry.mod && entry.goal?.unlocked)) return null;
  return trackedGoal(p, { version: 1, id });
}
