import type { UprisingRouteId } from './uprising-model.ts';

export const uprisingRemasterSeed = (seed: unknown) =>
  typeof seed === 'string' && Number(/^RF-C(\d+)-/.exec(seed)?.[1] ?? 0) >= 105;

export const UPRISING_REMASTER = {
  boarding: 2,
  reinforcementCap: 8,
  safeArrival: 105,
  bridgeSpeed: 90,
  interaction: 120,
} as const;
export const UPRISING_REMASTER_JOBS: Record<
  UprisingRouteId,
  {
    objective: string;
    holds?: readonly number[];
    escapeTime?: number;
  }
> = {
  'rail-heist': {
    objective: 'Break into the moving cargo, collect the prototype and extract through pursuit.',
  },
  'rail-escape': {
    objective: 'Open all three route switches, then board the far platform before dispatch closes.',
    escapeTime: 48,
  },
  'rail-guard': {
    objective: 'Activate the convoy generator and protect its journey across the rail yard.',
    holds: [25],
  },
  'core-sabotage': {
    objective: 'Destroy both relays, clear the patrol and cross the lowered service bridge.',
  },
  'core-defense': {
    objective: 'Start the generator and hold the changing approaches until power stabilizes.',
    holds: [20],
  },
  'core-recovery': {
    objective: 'Open the research interlock, recover the case and reach extraction.',
  },
  'crew-relief': {
    objective: 'Restore and protect both crew generators, one station at a time.',
    holds: [8, 9],
  },
  'scrap-raid': {
    objective: 'Break the seized case, take the inventory and escape the counterattack.',
  },
  'signal-cut': { objective: 'Destroy both command relays, then reach the lowered rooftop link.' },
  'roof-escape': {
    objective: 'Open the rooftop relays and hold the evacuation deck before the transport leaves.',
    escapeTime: 44,
  },
  'roof-relief': {
    objective: 'Bring three crew stations online and protect each final hold.',
    holds: [6, 6, 7],
  },
};

export function uprisingRemasterObjective(route: UprisingRouteId) {
  return UPRISING_REMASTER_JOBS[route].objective;
}
