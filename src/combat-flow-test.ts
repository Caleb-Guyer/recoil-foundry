import type { Checkpoint, RouteChoice } from './rules.ts';
import { validSavedBuild } from './rules.ts';
import { isBranch } from './upgrade-branches.ts';
import { BRANCH_TEST_BUILDS } from './branch-builds.ts';
import { COMBAT_FLOW_ROOMS, isCombatFlowRoom } from './combat-flow-rooms.ts';
import { isStartingGun } from './starting-guns.ts';

export const COMBAT_FLOW_TEST_BUILDS = {
  native: [] as readonly string[],
  beam: BRANCH_TEST_BUILDS.prism.mods,
  blast: BRANCH_TEST_BUILDS.cluster.mods,
  chain: BRANCH_TEST_BUILDS.short.mods,
} as const;
export function combatFlowTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'flow' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (
      !['test', 'v', 'room', 'variant', 'gun', 'build', 'mirror', 'route'].includes(key) ||
      p.getAll(key).length !== 1
    )
      invalid = true;
  });
  const room = p.get('room') ?? 'overpass',
    variant = p.get('variant') ?? '1',
    gun = p.get('gun') ?? 'pistol',
    build = p.get('build') ?? 'native',
    mirror = p.get('mirror') ?? '0',
    route = p.get('route');
  if (
    invalid ||
    !isCombatFlowRoom(room) ||
    !['1', '2', '3'].includes(variant) ||
    !isStartingGun(gun) ||
    !Object.hasOwn(COMBAT_FLOW_TEST_BUILDS, build) ||
    !['0', '1'].includes(mirror) ||
    (route !== null &&
      (!['switchyard', 'scrap-bridge'].includes(room) || !['low', 'high'].includes(route)))
  )
    return null;
  const mods = [...COMBAT_FLOW_TEST_BUILDS[build as keyof typeof COMBAT_FLOW_TEST_BUILDS]],
    stage = COMBAT_FLOW_ROOMS[room].stage;
  if (!validSavedBuild(mods) || mods.length > stage || (stage < 8 && mods.some(isBranch)))
    return null;
  return {
    version: 6,
    seed:
      'RF-C99-FLOW-' +
      room +
      '-' +
      variant +
      '-' +
      (mirror === '1' ? 'M' : 'N') +
      '-' +
      (route ? route.toUpperCase() : 'NONE'),
    stage,
    startingGun: gun,
    hp: 100,
    mods,
    kills: 0,
    elapsed: 0,
    encounters: 1,
    teamwork: 1,
    ...(route ? { route: route as RouteChoice } : {}),
    ...(mods.length ? { missedUpgrades: stage - mods.length } : {}),
  };
}
