import type { Checkpoint } from './rules.ts';

export const UPRISING_FORKS = [4, 8, 12, 16] as const;
const LEGACY_UPRISING_FORKS = [0, 4, 12, 16] as const;
export const UPRISING_ROUTES = [
  {
    id: 'rail-heist',
    fork: 4,
    district: 'railworks',
    name: 'Prototype train',
    mission: 'steal',
    objective: 'Reach the cargo platform, break the prototype case, then collect it.',
    consequence: 'Recover 8 health. Pursuit crews appear in later transit rooms.',
  },
  {
    id: 'rail-escape',
    fork: 4,
    district: 'railworks',
    name: 'Last train out',
    mission: 'escape',
    objective: 'Jump beside both route switches, then board the marked platform within 40 seconds.',
    consequence: 'Recover 8 health. Avoid a cargo pursuit.',
  },
  {
    id: 'rail-guard',
    fork: 4,
    district: 'railworks',
    name: 'Convoy watch',
    mission: 'defend',
    contract: 'rail-license',
    objective: 'Jump beside the generator to activate it. Protect it for 18 seconds.',
    consequence: 'Recover 8 health. Crew barricades shelter later boss arenas.',
  },
  {
    id: 'core-sabotage',
    fork: 8,
    district: 'core',
    name: 'Cut production',
    mission: 'sabotage',
    objective: 'Destroy both power relays to lower the reactor platforms.',
    consequence:
      'Recover 8 health. Shut down later environmental machinery and isolate the final defense.',
  },
  {
    id: 'core-defense',
    fork: 8,
    district: 'core',
    name: 'Keep the lights on',
    mission: 'defend',
    objective: 'Jump beside the generator to activate it. Protect it for 18 seconds.',
    consequence:
      'Recover 8 health. Preserve the reactor platforms and complete Core certification.',
  },
  {
    id: 'core-recovery',
    fork: 8,
    district: 'core',
    name: 'Research salvage',
    mission: 'steal',
    contract: 'core-license',
    objective: 'Break the prototype case, then collect it.',
    consequence: 'Recover 8 health. The stolen research draws pursuit crews.',
  },
  {
    id: 'crew-relief',
    fork: 12,
    district: 'reclamation',
    name: 'Crew relief',
    mission: 'defend',
    objective: 'Jump beside the generator to activate it. Protect it for 18 seconds.',
    consequence: 'Recover 8 health. Crew barricades shelter the final arena.',
  },
  {
    id: 'scrap-raid',
    fork: 12,
    district: 'reclamation',
    name: 'Seized inventory',
    mission: 'steal',
    objective: 'Break the prototype case, then collect it.',
    consequence: 'Recover 8 health. Cargo pursuit changes the final security response.',
  },
  {
    id: 'signal-cut',
    fork: 16,
    district: 'rooftops',
    name: 'Cut the command line',
    mission: 'sabotage',
    objective: 'Destroy both command relays.',
    consequence: 'Recover 8 health. Disable the final boss ring attack; watch its aimed volleys.',
  },
  {
    id: 'roof-escape',
    fork: 16,
    district: 'rooftops',
    name: 'Rooftop evacuation',
    mission: 'escape',
    objective: 'Jump beside both route switches, then board the marked platform within 40 seconds.',
    consequence: 'Recover 8 health. Reach the finale without another pursuit.',
  },
  {
    id: 'roof-relief',
    fork: 16,
    district: 'rooftops',
    name: 'Last crew standing',
    mission: 'defend',
    contract: 'uprising-veteran',
    objective: 'Jump beside the generator to activate it. Protect it for 18 seconds.',
    consequence: 'Recover 8 health. Crew barricades shelter the final arena.',
  },
] as const;
export type UprisingRouteId = (typeof UPRISING_ROUTES)[number]['id'];
export type UprisingMissionKind = (typeof UPRISING_ROUTES)[number]['mission'];
export type UprisingDistrict = (typeof UPRISING_ROUTES)[number]['district'];
export const UPRISING_DISTRICTS = {
  railworks: 'Railworks',
  core: 'Foundry Core',
  reclamation: 'Reclamation',
  rooftops: 'Rooftops',
} as const;
export const UPRISING_FINALES = ['isolated', 'hunted', 'mutiny', 'overloaded'] as const;
export type UprisingFinale = (typeof UPRISING_FINALES)[number];
export const FINALE_NAMES: Record<UprisingFinale, string> = {
  isolated: 'Isolated defense',
  hunted: 'Security pursuit',
  mutiny: 'Crew uprising',
  overloaded: 'Command overload',
};
export const UPRISING_CONTRACTS = [
  {
    id: 'rail-license',
    name: 'Railworks certification',
    requirement: 'Complete Prototype train and Last train out across Campaign runs.',
    routes: ['rail-heist', 'rail-escape'],
    reward: 'Unlock Convoy watch as a new Railworks route.',
  },
  {
    id: 'core-license',
    name: 'Core certification',
    requirement: 'Complete Cut production and Keep the lights on across Campaign runs.',
    routes: ['core-sabotage', 'core-defense'],
    reward: 'Unlock Research salvage as a new Foundry Core route.',
  },
  {
    id: 'uprising-veteran',
    name: 'A factory of your own',
    requirement: 'Escape after defeating three different Uprising finales.',
    routes: [],
    reward: 'Unlock Last crew standing as a new Rooftops route.',
  },
] as const;
export type UprisingContractId = (typeof UPRISING_CONTRACTS)[number]['id'];
export interface UprisingOutcome {
  route: UprisingRouteId;
  result: 'success' | 'failed';
  clean?: true;
}
export interface UprisingRun {
  version: 1 | 2;
  choices: UprisingRouteId[];
  outcomes: UprisingOutcome[];
  unlocks: UprisingContractId[];
  plan?: UprisingRouteId[];
}
export const UPRISING_RECORDS_KEY = 'rf-uprising-v1';
export interface UprisingRecords {
  version: 1;
  routes: UprisingRouteId[];
  clean: UprisingRouteId[];
  finales: UprisingFinale[];
}
const routeIds = UPRISING_ROUTES.map((r) => r.id);
const contractIds = UPRISING_CONTRACTS.map((c) => c.id);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const unique = (v: unknown, allowed: readonly string[]) =>
  Array.isArray(v) &&
  v.every((id) => typeof id === 'string' && allowed.includes(id)) &&
  new Set(v).size === v.length;
export const uprisingRoute = (id: UprisingRouteId) => UPRISING_ROUTES.find((r) => r.id === id)!;
// Continue preserves the schedule committed by an older run.
export const uprisingForks = (run: UprisingRun) =>
  run.version === 1 ? LEGACY_UPRISING_FORKS : UPRISING_FORKS;
export const uprisingFork = (run: UprisingRun, id: UprisingRouteId) =>
  uprisingForks(run)[UPRISING_FORKS.indexOf(uprisingRoute(id).fork)];
export function loadUprisingRecords(raw: unknown): UprisingRecords {
  const v = object(raw) && raw.version === 1 ? raw : {};
  const routes = routeIds.filter((id) => Array.isArray(v.routes) && v.routes.includes(id));
  return {
    version: 1,
    routes,
    clean: routes.filter((id) => Array.isArray(v.clean) && v.clean.includes(id)),
    finales: UPRISING_FINALES.filter((id) => Array.isArray(v.finales) && v.finales.includes(id)),
  };
}
export function validUprisingRecords(raw: unknown): raw is UprisingRecords {
  return (
    object(raw) &&
    raw.version === 1 &&
    Object.keys(raw).every((k) => ['version', 'routes', 'clean', 'finales'].includes(k)) &&
    unique(raw.routes, routeIds) &&
    unique(raw.clean, raw.routes as string[]) &&
    unique(raw.finales, UPRISING_FINALES)
  );
}
export function uprisingContracts(raw: unknown) {
  const records = loadUprisingRecords(raw);
  return UPRISING_CONTRACTS.map((c) => {
    const current =
      c.id === 'uprising-veteran'
        ? records.finales.length
        : c.routes.filter((id) => records.routes.includes(id)).length;
    const target = c.id === 'uprising-veteran' ? 3 : c.routes.length;
    return { ...c, current: Math.min(current, target), target, unlocked: current >= target };
  });
}
export function newUprising(raw: unknown = null, plan?: readonly UprisingRouteId[]): UprisingRun {
  const unlocks = uprisingContracts(raw)
    .filter((c) => c.unlocked)
    .map((c) => c.id);
  // A shared route plan carries its original structural access, independently of collection.
  for (const id of plan ?? []) {
    const route = uprisingRoute(id);
    if ('contract' in route && !unlocks.includes(route.contract)) unlocks.push(route.contract);
  }
  return {
    version: 2,
    choices: [],
    outcomes: [],
    unlocks,
    ...(plan?.length ? { plan: [...plan] } : {}),
  };
}
export function validUprisingRun(raw: unknown): raw is UprisingRun {
  if (
    !object(raw) ||
    ![1, 2].includes(raw.version as number) ||
    !Object.keys(raw).every((k) =>
      ['version', 'choices', 'outcomes', 'unlocks', 'plan'].includes(k),
    ) ||
    !unique(raw.unlocks, contractIds)
  )
    return false;
  const allowed = (list: unknown) =>
    Array.isArray(list) &&
    list.length <= UPRISING_FORKS.length &&
    list.every(
      (id, i) =>
        routeIds.includes(id) &&
        uprisingRoute(id).fork === UPRISING_FORKS[i] &&
        (!('contract' in uprisingRoute(id)) ||
          (raw.unlocks as string[]).includes((uprisingRoute(id) as { contract: string }).contract)),
    );
  if (
    !allowed(raw.choices) ||
    (raw.plan !== undefined &&
      (!allowed(raw.plan) ||
        (raw.choices as string[]).some(
          (id, i) => (raw.plan as string[])[i] !== undefined && (raw.plan as string[])[i] !== id,
        )))
  )
    return false;
  return (
    Array.isArray(raw.outcomes) &&
    raw.outcomes.length <= (raw.choices as string[]).length &&
    raw.outcomes.every(
      (o, i) =>
        object(o) &&
        Object.keys(o).every((k) => ['route', 'result', 'clean'].includes(k)) &&
        o.route === (raw.choices as string[])[i] &&
        ['success', 'failed'].includes(o.result as string) &&
        (o.clean === undefined || (o.clean === true && o.result === 'success')),
    )
  );
}
export function validUprisingCheckpoint(d: Checkpoint) {
  if (d.uprising === undefined) return true;
  const u = d.uprising;
  if (d.version !== 6 || /^RF-D\d+-/.test(d.seed) || !validUprisingRun(u)) return false;
  const forks = uprisingForks(u);
  const minimum = forks.filter((f) => f < d.stage).length;
  const maximum = forks.filter((f) => f <= d.stage).length;
  const resolved = forks.filter((f) => f + 1 < d.stage || (f + 1 === d.stage && !!d.reward)).length;
  return (
    u.choices.length >= minimum &&
    u.choices.length <= maximum &&
    (u.choices.length === minimum ||
      (!!d.reward &&
        !d.reward.auditor &&
        !d.reward.courier &&
        !d.reward.welder &&
        !d.reward.enteringDetour)) &&
    u.outcomes.length >= resolved &&
    u.outcomes.length <= forks.filter((f) => f + 1 <= d.stage).length
  );
}
export function uprisingChoices(run: UprisingRun | null, stage: number) {
  if (!run) return [];
  const index = uprisingForks(run).indexOf(stage as never);
  if (index === -1) return [];
  if (run.choices[index]) return [];
  return UPRISING_ROUTES.filter(
    (r) =>
      uprisingFork(run, r.id) === stage &&
      (!('contract' in r) || run.unlocks.includes(r.contract)) &&
      (!run.plan?.[index] || run.plan[index] === r.id),
  );
}
export const successfulUprising = (run: UprisingRun | null, id: UprisingRouteId) =>
  !!run?.outcomes.some((o) => o.route === id && o.result === 'success');
export function uprisingFinale(run: UprisingRun): UprisingFinale {
  if (successfulUprising(run, 'core-sabotage') || successfulUprising(run, 'signal-cut'))
    return 'isolated';
  if (
    ['rail-heist', 'core-recovery', 'scrap-raid'].some((id) =>
      successfulUprising(run, id as UprisingRouteId),
    )
  )
    return 'hunted';
  if (
    ['rail-guard', 'crew-relief', 'roof-relief'].some((id) =>
      successfulUprising(run, id as UprisingRouteId),
    )
  )
    return 'mutiny';
  return 'overloaded';
}
export function recordUprising(
  raw: unknown,
  route?: UprisingRouteId,
  clean = false,
  finale?: UprisingFinale,
): UprisingRecords {
  const records = loadUprisingRecords(raw);
  return loadUprisingRecords({
    ...records,
    routes: [...records.routes, ...(route ? [route] : [])],
    clean: [...records.clean, ...(route && clean ? [route] : [])],
    finales: [...records.finales, ...(finale ? [finale] : [])],
  });
}
export function uprisingPlan(raw: string | null): UprisingRouteId[] | null {
  if (!raw) return [];
  const plan = raw.split(',');
  return plan.length <= UPRISING_FORKS.length &&
    plan.every(
      (id, i) =>
        routeIds.includes(id as UprisingRouteId) &&
        uprisingRoute(id as UprisingRouteId).fork === UPRISING_FORKS[i],
    )
    ? (plan as UprisingRouteId[])
    : null;
}
