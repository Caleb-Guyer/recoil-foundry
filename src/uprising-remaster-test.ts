import { getLevel } from './levels.ts';
import { testCheckpoint } from './practice.ts';
import { rewardMods, seeded, isRouteStage, type Checkpoint } from './rules.ts';
import { loadUnlocks } from './longevity.ts';
import {
  UPRISING_ROUTES,
  UPRISING_CONTRACTS,
  newUprising,
  uprisingRoute,
  type UprisingRouteId,
} from './uprising-model.ts';
import { newJobReward } from './uprising-rewards.ts';

export const UPRISING_REMASTER_TEST_ROUTES = [
  ...UPRISING_ROUTES.map((r) => r.id),
  'choose',
  'rewards',
  'consequences',
] as const;
export type UprisingRemasterTestRoute = UprisingRouteId | 'choose' | 'rewards' | 'consequences';
export interface UprisingRemasterTestIdentity {
  route: UprisingRemasterTestRoute;
  scene: 'job' | 'choose' | 'rewards' | 'consequences';
}
export interface UprisingRemasterFixture extends UprisingRemasterTestIdentity {
  checkpoint: Checkpoint;
}
const codes: Record<UprisingRemasterTestRoute, string> = {
  'rail-heist': 'RH',
  'rail-escape': 'RE',
  'rail-guard': 'RG',
  'core-sabotage': 'CS',
  'core-defense': 'CD',
  'core-recovery': 'CR',
  'crew-relief': 'CL',
  'scrap-raid': 'SR',
  'signal-cut': 'SC',
  'roof-escape': 'RX',
  'roof-relief': 'RR',
  choose: 'C',
  rewards: 'R',
  consequences: 'X',
};
function sceneSeed(route: UprisingRemasterTestRoute) {
  for (let i = 0; i < 256; i++) {
    const seed = `RF-C105-JOB-${codes[route]}-${i}`;
    if (route !== 'consequences' || getLevel(seed, 11).spawns[0]?.kind === 'turbine') return seed;
  }
  throw new Error('No natural Turbine for the bounded consequence comparison');
}
function identity(route: UprisingRemasterTestRoute): UprisingRemasterTestIdentity {
  return {
    route,
    scene: route === 'choose' || route === 'rewards' || route === 'consequences' ? route : 'job',
  };
}
export function uprisingRemasterTestIdentity(seed: string): UprisingRemasterTestIdentity | null {
  const match = /^RF-C105-JOB-([A-Z]{1,2})-(0|[1-9]\d{0,2})$/.exec(seed);
  if (!match || Number(match[2]) >= 256) return null;
  const route = UPRISING_REMASTER_TEST_ROUTES.find((r) => codes[r] === match[1]);
  return route && sceneSeed(route) === seed ? identity(route) : null;
}
/** Isolated native missions. The existing startTest/save guards own all progress isolation. */
export function uprisingRemasterTestFromUrl(url: URL): UprisingRemasterFixture | null {
  const p = url.searchParams;
  if (p.get('test') !== 'uprising-remaster' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'route', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const requested = p.get('route') ?? 'rail-heist';
  if (invalid || !UPRISING_REMASTER_TEST_ROUTES.some((route) => route === requested)) return null;
  const route = requested as UprisingRemasterTestRoute,
    seed = sceneSeed(route);
  const defaults: UprisingRouteId[] = ['rail-escape', 'core-defense', 'crew-relief', 'roof-escape'];
  const stage =
    route === 'choose'
      ? 4
      : route === 'rewards'
        ? 5
        : route === 'consequences'
          ? 11
          : uprisingRoute(route).fork + 1;
  const cp = testCheckpoint(seed, stage);
  cp.version = 6;
  cp.startingGun = 'pistol';
  cp.encounters = 1;
  cp.unlocks = loadUnlocks(cp.mods);
  const mission =
    route === 'choose'
      ? null
      : route === 'rewards'
        ? 'rail-heist'
        : route === 'consequences'
          ? 'core-sabotage'
          : route;
  const count =
    route === 'choose'
      ? 0
      : route === 'consequences'
        ? 2
        : defaults.findIndex((id) => uprisingRoute(id).fork === uprisingRoute(mission!).fork) + 1;
  const choices = defaults.slice(0, count);
  if (mission) choices[count - 1] = mission;
  const uprising = newUprising(null, choices);
  uprising.version = 3;
  uprising.unlocks = UPRISING_CONTRACTS.map((c) => c.id);
  uprising.choices = choices;
  const completed =
    route === 'consequences' || route === 'rewards' ? choices : choices.slice(0, -1);
  uprising.outcomes = completed.map((id) => ({ route: id, result: 'success' }));
  cp.uprising = uprising;
  if (route === 'choose' || route === 'rewards') {
    cp.reward = {
      offers: rewardMods(cp.mods, 3, seeded(seed + ':offers'), {
        stage,
        seed,
        unlocks: cp.unlocks,
      })
        .slice(0, 3)
        .map((m) => m.id),
      rerolled: false,
      ...(isRouteStage(stage + 1) ? { enteringRoute: 'low' as const } : {}),
    };
  }
  if (route === 'rewards') {
    // A payment-only fixture leaves all three choices available to compare.
    cp.hp = 64;
    uprising.outcomes[0].reward = newJobReward(seed, 'rail-heist', cp.mods, 'pistol', cp.unlocks);
  }
  return { ...identity(route), checkpoint: cp };
}
