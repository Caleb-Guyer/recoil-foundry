import { getRouteLevel } from './route-layouts.ts';
import { ROUTE_REMASTERS, ROUTE_REMASTER_IDS, type RouteRemasterId } from './route-remaster.ts';
import type { Checkpoint, RouteChoice } from './rules.ts';

export const CHOOSE_ROUTE_ROOMS = ROUTE_REMASTERS;
export const CHOOSE_ROUTE_ROOM_IDS = ROUTE_REMASTER_IDS;
export const CHOOSE_ROUTE_SCENES = {
  room: {
    name: 'Remastered route room',
    instruction:
      'An isolated route with the Service pistol and ordinary movement. Explore the cover and upper flanks. R restarts the room; Continue and unlocks stay untouched.',
  },
  preview: {
    name: 'Cleared route fork',
    instruction:
      'A cleared fork for comparing the actual next rooms. Approach either exit to see its preview, then take the exit and choose one upgrade to enter that route. Continue and unlocks stay untouched.',
  },
} as const;
export type ChooseRouteScene = keyof typeof CHOOSE_ROUTE_SCENES;
export interface ChooseRouteIdentity {
  room: RouteRemasterId;
  route: RouteChoice;
  mirror: boolean;
  destinationStage: 6 | 10;
}

// Both scenes share the same native seed. Its route mirror comes from the real
// destination rule, so a displayed preview and its direct room test agree.
function sceneSeed(room: RouteRemasterId, mirror: boolean) {
  const plan = CHOOSE_ROUTE_ROOMS[room];
  for (let i = 0; i < 256; i++) {
    const seed = `RF-C101-ROUTE-${plan.stage}-${plan.route === 'high' ? 'H' : 'L'}-${mirror ? 'M' : 'N'}-${i}`;
    if (getRouteLevel(seed, plan.stage, plan.route).mirrored === mirror) return seed;
  }
  throw new Error('No native route seed for the requested mirror');
}
export function chooseRouteTestIdentity(seed: string): ChooseRouteIdentity | null {
  const match = /^RF-C101-ROUTE-(6|10)-(L|H)-(M|N)-(\d{1,3})$/.exec(seed);
  if (!match || Number(match[4]) >= 256) return null;
  const destinationStage = Number(match[1]) as 6 | 10;
  const route = match[2] === 'H' ? 'high' : 'low';
  const mirror = match[3] === 'M';
  const room = CHOOSE_ROUTE_ROOM_IDS.find(
    (id) =>
      CHOOSE_ROUTE_ROOMS[id].stage === destinationStage && CHOOSE_ROUTE_ROOMS[id].route === route,
  );
  if (!room || sceneSeed(room, mirror) !== seed) return null;
  return { room, route, mirror, destinationStage };
}
export function chooseRouteTestFromUrl(url: URL): {
  checkpoint: Checkpoint;
  scene: ChooseRouteScene;
  room: RouteRemasterId;
  mirror: boolean;
} | null {
  const params = url.searchParams;
  if (params.get('test') !== 'route-choice' || params.get('v') !== '1') return null;
  let invalid = false;
  params.forEach((_, key) => {
    if (!['test', 'scene', 'room', 'mirror', 'v'].includes(key) || params.getAll(key).length !== 1)
      invalid = true;
  });
  const rawScene = params.get('scene') ?? 'room';
  const rawRoom = params.get('room') ?? 'boiler-tunnels';
  const rawMirror = params.get('mirror') ?? '0';
  if (
    invalid ||
    !Object.hasOwn(CHOOSE_ROUTE_SCENES, rawScene) ||
    !Object.hasOwn(CHOOSE_ROUTE_ROOMS, rawRoom) ||
    !['0', '1'].includes(rawMirror)
  )
    return null;
  const scene = rawScene as ChooseRouteScene;
  const room = rawRoom as RouteRemasterId;
  const mirror = rawMirror === '1';
  const plan = CHOOSE_ROUTE_ROOMS[room];
  const stage = scene === 'preview' ? plan.stage - 1 : plan.stage;
  return {
    scene,
    room,
    mirror,
    checkpoint: {
      version: 6,
      seed: sceneSeed(room, mirror),
      stage,
      ...(scene === 'room' ? { route: plan.route } : {}),
      startingGun: 'pistol',
      mods: [],
      missedUpgrades: stage,
      hp: 100,
      kills: 0,
      elapsed: 0,
      encounters: 1,
      teamwork: 1,
    },
  };
}
