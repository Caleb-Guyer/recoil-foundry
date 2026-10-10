import { COMMENDATIONS } from './commendations.ts';
import { goalById, goalMeasure, type GoalProgress, type NextGoal } from './next-goal.ts';
export { goalMeasure } from './next-goal.ts';
import { selectedGoal } from './tracked-goal.ts';
import { LONGEVITY_IDS } from './longevity.ts';
import { MODS, MOD_REQUIRES, FUSION_REQUIRES, type Vec } from './rules.ts';
import { BRANCH_PARENTS } from './upgrade-branches.ts';
import { HUNTS, type HuntKind } from './hunt-rules.ts';
import { RECOIL_TRIALS, type RecoilTrialKind } from './recoil-trial-rules.ts';
import { SUPPORT_MASTERIES } from './support-mastery.ts';
import type { CombatResults } from './combat-report.ts';
import type { SecurityLevel } from './security.ts';
import type { GauntletMode } from './gauntlet-rules.ts';
const GAUNTLET_GOALS = [
  'weapon:repeater',
  'commendation:gauntlet-cleared',
  'commendation:remix-gauntlet-cleared',
  'commendation:remix-gauntlet-unserviced',
];
const REMIX_GOALS = [
  'commendation:remix-gauntlet-cleared',
  'commendation:remix-gauntlet-unserviced',
];

export const GOAL_RUN_KEY = 'rf-goal-run-v1';
export interface GoalRun {
  version: 1;
  seed: string;
  id: string;
  before: number;
  discoveries: string[];
  resumed: boolean;
}
const ids = new Set([
  'campaign',
  'weapon:twinbore',
  'weapon:carbine',
  'weapon:repeater',
  'weapon:nailgun',
  'security:1',
  'security:2',
  'security:3',
  ...LONGEVITY_IDS.map((id) => 'license:' + id),
  ...COMMENDATIONS.map((c) => 'commendation:' + c.id),
  ...COMMENDATIONS.flatMap((c) => ('boss' in c ? ['encounter:' + c.boss] : [])),
  ...MODS.map((m) => 'discover:' + m.id),
]);

export function loadGoalRun(raw: unknown): GoalRun | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as GoalRun;
  if (
    r.version !== 1 ||
    typeof r.seed !== 'string' ||
    !r.seed.length ||
    r.seed.length > 40 ||
    /[\u0000-\u001f\u007f-\u009f]/.test(r.seed) ||
    !ids.has(r.id) ||
    !Number.isSafeInteger(r.before) ||
    r.before < 0 ||
    r.before > 3 ||
    typeof r.resumed !== 'boolean' ||
    !Array.isArray(r.discoveries) ||
    Object.keys(r).some(
      (k) => !['version', 'seed', 'id', 'before', 'discoveries', 'resumed'].includes(k),
    )
  )
    return null;
  const discoveries = MODS.filter((m) => r.discoveries.includes(m.id)).map((m) => m.id);
  if (discoveries.length !== r.discoveries.length) return null;
  return { version: 1, seed: r.seed, id: r.id, before: r.before, discoveries, resumed: r.resumed };
}
export function validGoalRun(raw: unknown) {
  return raw === null || !!loadGoalRun(raw);
}

export function beginGoalRun(
  seed: string,
  p: GoalProgress,
  previous?: unknown,
  continuing = false,
  tracked?: unknown,
): GoalRun | null {
  const stored = loadGoalRun(previous);
  if (continuing && stored?.seed === seed && goalById(p, stored.id)) return stored;
  const goal = selectedGoal(p, tracked);
  if (goal.kind === 'complete') return null;
  return {
    version: 1,
    seed,
    id: goal.id,
    before: goalMeasure(goal.id, p).current,
    discoveries: [...p.discovered],
    resumed: continuing,
  };
}

export interface GoalAttempt {
  stage: number;
  overtime: boolean;
  security: SecurityLevel;
  gauntlet?: number;
  gauntletMode?: GauntletMode;
  gauntletRepairs?: number;
  results?: CombatResults;
}
export function goalRunSummary(run: GoalRun, p: GoalProgress, attempt: GoalAttempt, ended = false) {
  const goal = goalById(p, run.id);
  if (!goal) return null;
  const measure = goalMeasure(run.id, p);
  let status = ended ? 'Goal not completed this attempt.' : 'In progress';
  if (measure.complete)
    status =
      'Goal complete' +
      (measure.target > 1
        ? ` · ${ended && measure.current > run.before ? run.before + ' → ' : ''}${measure.current} / ${measure.target} ${measure.unit}`
        : '');
  else if (measure.target > 1) {
    status = `${measure.current} / ${measure.target} ${measure.unit}`;
    if (ended && measure.current > run.before) status = `${run.before} → ${status}`;
  } else if (
    run.id === 'campaign' ||
    run.id.startsWith('security:') ||
    run.id === 'weapon:nailgun'
  ) {
    const room = Math.min(20, Math.max(1, attempt.stage + 1));
    status =
      (ended ? 'Reached ' : '') +
      (attempt.overtime ? 'Overtime · ' : 'Campaign · ') +
      `room ${room} / 20`;
    if (run.id === 'weapon:nailgun' && !attempt.overtime) status += ' · Overtime follows victory';
    if (run.id.startsWith('security:') && attempt.security !== Number(run.id.slice(9)))
      status =
        'Needs Security ' +
        ['I', 'II', 'III'][Number(run.id.slice(9)) - 1] +
        ' · this run uses ' +
        (attempt.security ? 'Security ' + ['I', 'II', 'III'][attempt.security - 1] : 'Standard');
  } else if (attempt.gauntlet !== undefined && GAUNTLET_GOALS.includes(run.id))
    status =
      REMIX_GOALS.includes(run.id) && attempt.gauntletMode !== 'remix'
        ? 'Needs the Remix route · this attempt uses Classic'
        : run.id === 'commendation:remix-gauntlet-unserviced' && (attempt.gauntletRepairs ?? 0) > 0
          ? 'Repair chosen · begin a new Gauntlet to try this goal again'
          : `${attempt.gauntlet} / 5 bosses defeated this attempt`;
  else if (GAUNTLET_GOALS.includes(run.id)) status = 'Needs Boss Gauntlet · this is a Campaign run';
  else {
    const mastery = SUPPORT_MASTERIES.find((m) => run.id === 'commendation:' + m.id);
    if (mastery && attempt.results)
      status = `${Math.min(mastery.target, attempt.results[mastery.counter])} / ${mastery.target} ${mastery.unit} this attempt`;
    else if (ended && goal.kind === 'discovery') status = 'Not collected this attempt.';
  }
  return {
    goal,
    status,
    complete: measure.complete,
    advanced: measure.current > run.before,
    discoveries: p.discovered.filter((id) => !run.discoveries.includes(id)).length,
    resumed: run.resumed,
  };
}

export type GoalAction =
  | { kind: 'campaign'; label: string; security?: SecurityLevel }
  | { kind: 'gauntlet'; label: string; mode?: GauntletMode }
  | { kind: 'recoil'; label: string; course: RecoilTrialKind }
  | { kind: 'maintenance'; label: string };
export function goalAction(
  goal: NextGoal,
  p: GoalProgress,
  courses: readonly RecoilTrialKind[] = [],
  shafts = 0,
): GoalAction | null {
  if (goal.kind === 'complete') return null;
  if (GAUNTLET_GOALS.includes(goal.id) && p.weapons.cleared)
    return {
      kind: 'gauntlet',
      label: REMIX_GOALS.includes(goal.id) ? 'Set up Remix Gauntlet ↗' : 'Set up Boss Gauntlet ↗',
      ...(REMIX_GOALS.includes(goal.id) ? { mode: 'remix' as const } : {}),
    };
  const course = (Object.keys(RECOIL_TRIALS) as RecoilTrialKind[]).find(
    (k) => goal.id === 'commendation:' + RECOIL_TRIALS[k].commendation,
  );
  if (course && courses.includes(course))
    return { kind: 'recoil', course, label: 'Open ' + RECOIL_TRIALS[course].name + ' Practice ↗' };
  if (goal.id === 'commendation:maintenance-certified' && shafts)
    return { kind: 'maintenance', label: 'Open Maintenance Trials ↗' };
  const level =
    goal.id === 'commendation:redline'
      ? 3
      : goal.id.startsWith('security:')
        ? (Number(goal.id.slice(9)) as SecurityLevel)
        : undefined;
  if (level !== undefined && level <= p.security.unlocked)
    return {
      kind: 'campaign',
      security: level,
      label: 'Set up Security ' + ['I', 'II', 'III'][level - 1] + ' ↗',
    };
  return {
    kind: 'campaign',
    label: p.weapons.started ? 'Set up Campaign ↗' : 'Start Campaign ↗',
  };
}

export function goalOfferLabel(id: string, mod: string, equipped: readonly string[]) {
  if (equipped.includes(mod)) return '';
  if (id === 'discover:' + mod) return 'Goal fitting';
  const root = id.startsWith('discover:') ? id.slice(9) : undefined;
  const parents = new Set<string>();
  function visit(m: string) {
    for (const p of [MOD_REQUIRES[m], ...(FUSION_REQUIRES[m] ?? []), ...(BRANCH_PARENTS[m] ?? [])])
      if (p && !parents.has(p)) {
        parents.add(p);
        visit(p);
      }
  }
  if (root) {
    visit(root);
    if (parents.has(mod)) return 'Goal prerequisite';
  }
  const c = COMMENDATIONS.find((c) => id === 'commendation:' + c.id);
  if (c && 'upgrades' in c && (c.upgrades as readonly string[]).includes(mod))
    return 'Helps your goal';
  if (
    (id === 'license:ground-fault' && mod === 'arc-coil') ||
    (id === 'license:conductive-tether' && ['arc-coil', 'tether'].includes(mod)) ||
    (id === 'license:static-reservoir' && ['kick', 'airshot'].includes(mod))
  )
    return 'Helps your goal';
  return '';
}

export function goalHuntLabel(id: string, kind: HuntKind, p: GoalProgress) {
  if (goalMeasure(id, p).complete) return '';
  if (p.earned.includes(HUNTS[kind].commendation)) return '';
  if (id === 'weapon:carbine') return 'Counts toward Coil carbine';
  if (id === 'commendation:' + HUNTS[kind].commendation) return 'Your goal hunt';
  return '';
}
export interface GoalCue {
  pos: Vec;
  text: string;
}
// One brief, nearby cue per room. Returning to the door does not restart it.
export class GoalOpportunity {
  private room = '';
  private shownAt: number | null = null;
  cue(room: string, time: number, player: Vec, door: Vec | null, text: string): GoalCue | null {
    if (room !== this.room) {
      this.room = room;
      this.shownAt = null;
    }
    if (!door || !text || Math.hypot(player.x - door.x, player.y - door.y) > 280) return null;
    this.shownAt ??= time;
    return time - this.shownAt < 5 ? { pos: door, text } : null;
  }
  reset() {
    this.room = '';
    this.shownAt = null;
  }
}
