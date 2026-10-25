import type { RouteChoice } from './rules.ts';

export interface RouteDecision {
  /** Zero-based destination room, recorded only after the upgrade is accepted. */
  stage: number;
  route: RouteChoice;
}
export const ROUTE_DECISION_STAGES = [2, 6, 10, 14, 18] as const;
export const ROUTE_HISTORY_LIMIT = ROUTE_DECISION_STAGES.length;
export function chooseRouteCampaign(seed: unknown): seed is string {
  if (typeof seed !== 'string') return false;
  const revision = /^RF-C(\d+)-/.exec(seed);
  return !!revision && Number(revision[1]) >= 101;
}
const isStage = (stage: unknown): stage is number =>
  typeof stage === 'number' && ROUTE_DECISION_STAGES.includes(stage as never);
const isRoute = (route: unknown): route is RouteChoice => route === 'low' || route === 'high';

/** Missing history is genuinely unknown; never reconstruct earlier decisions. */
export function loadRouteHistory(
  value: unknown,
  seed: unknown,
  stage: unknown,
  overtime = false,
): RouteDecision[] | null {
  if (value === undefined) return [];
  if (
    !chooseRouteCampaign(seed) ||
    !Number.isInteger(stage) ||
    typeof stage !== 'number' ||
    stage < 0 ||
    stage > 19 ||
    !Array.isArray(value) ||
    value.length > ROUTE_HISTORY_LIMIT
  )
    return null;
  // Overtime rewinds the stage counter. These remain the original Campaign's
  // decisions, rather than silently relabelling a later lap as the same route.
  const latest = overtime ? 19 : stage;
  let previous = -1;
  const result: RouteDecision[] = [];
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      Object.keys(item).length !== 2 ||
      !Object.hasOwn(item, 'stage') ||
      !Object.hasOwn(item, 'route') ||
      !isStage(item.stage) ||
      !isRoute(item.route) ||
      item.stage <= previous ||
      item.stage > latest
    )
      return null;
    result.push({ stage: item.stage, route: item.route });
    previous = item.stage;
  }
  return result;
}

/** Accept a new committed room once; a duplicate callback cannot rewrite it. */
export function recordRouteDecision(
  history: readonly RouteDecision[],
  stage: number,
  route: RouteChoice,
): RouteDecision[] {
  const copy = history.map((entry) => ({ ...entry }));
  if (
    !isStage(stage) ||
    !isRoute(route) ||
    copy.length >= ROUTE_HISTORY_LIMIT ||
    (copy.length && copy[copy.length - 1].stage >= stage)
  )
    return copy;
  return [...copy, { stage, route }];
}

const AREAS = ['Docks', 'Furnace', 'Cooling', 'Reclamation', 'Rooftops'];
/** All rendered labels come from bounded numeric stages and the route enum. */
export function routeHistoryMarkup(history: readonly RouteDecision[], overtime = false) {
  if (!history.length) return '';
  return (
    '<details class="route-history"><summary>Routes taken</summary>' +
    (overtime
      ? '<p class="hint">Routes from your first Campaign; this lap is not recorded.</p>'
      : '') +
    '<ol aria-label="Recorded Campaign route choices">' +
    history
      .map(
        (entry) =>
          '<li><span>Room ' +
          (entry.stage + 1) +
          ' · ' +
          AREAS[Math.floor(entry.stage / 4)] +
          '</span><strong>' +
          (entry.route === 'high' ? 'High route' : 'Low route') +
          '</strong></li>',
      )
      .join('') +
    '</ol></details>'
  );
}
