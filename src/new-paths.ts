// Path identities, forks and prerequisites are shared by rewards, saves and Workshop.
export const NEW_PATH_MODS = [
  {
    id: 'coolant-rounds',
    name: 'Coolant Rounds',
    description:
      'Hits build cold and slow enemies. 20% less direct damage. Bosses build a bonus hit instead.',
    mark: 'coolant-rounds',
  },
  {
    id: 'deep-freeze',
    name: 'Deep Freeze',
    description:
      'Full cold briefly freezes ordinary enemies. They resist freezing again for a moment.',
    mark: 'deep-freeze',
  },
  {
    id: 'icebreaker',
    name: 'Icebreaker',
    description: 'Hit a frozen enemy to shatter it for heavy damage and three ice fragments.',
    mark: 'icebreaker',
  },
  {
    id: 'cold-snap',
    name: 'Cold Snap',
    description:
      'Full cold bursts for extra damage instead of freezing. Brief recharge between bursts.',
    mark: 'cold-snap',
  },
  {
    id: 'cold-front',
    name: 'Cold Front',
    description: 'Cold bursts chill nearby exposed enemies. Follow up with a shot to burst them.',
    mark: 'cold-front',
  },
  {
    id: 'suspension',
    name: 'Suspension',
    description:
      'Hold to park rounds; release to launch. Recoil stays immediate. 30 rounds max; old or excess rounds auto-launch.',
    mark: 'suspension',
  },
  {
    id: 'crosshatch',
    name: 'Crosshatch',
    description:
      'Release your stored rounds toward the current aim point, converging from different angles.',
    mark: 'crosshatch',
  },
  {
    id: 'thread-the-needle',
    name: 'Thread the Needle',
    description:
      'Your last round follows a beat later. Consecutive hits in that release strengthen it; a miss breaks the streak.',
    mark: 'thread-the-needle',
  },
  {
    id: 'tripline',
    name: 'Tripline',
    description:
      'Park rounds farther toward your aim as proximity traps. They launch at exposed enemies and expire after four seconds.',
    mark: 'tripline',
  },
  {
    id: 'chain-release',
    name: 'Chain Release',
    description:
      'A triggered trap launches nearby parked rounds at the same enemy, if their shot is clear.',
    mark: 'chain-release',
  },
  {
    id: 'retrace',
    name: 'Retrace',
    description:
      'Recall rounds return along their outward route, including banks and unchanged portals.',
    mark: 'retrace',
  },
  {
    id: 'wallrunner',
    name: 'Wallrunner',
    description:
      'Recoil into a wall to grip briefly. Jump away; touch a different surface before gripping that wall again.',
    mark: 'wallrunner',
  },
  {
    id: 'air-brake',
    name: 'Air Brake',
    description:
      'Release fire in recoil flight to brake once per jump. Your next airborne shot kicks 35% harder.',
    mark: 'air-brake',
  },
] as const;
export const NEW_PATH_PARENTS: Record<string, string> = {
  'deep-freeze': 'coolant-rounds',
  icebreaker: 'deep-freeze',
  'cold-snap': 'coolant-rounds',
  'cold-front': 'cold-snap',
  crosshatch: 'suspension',
  'thread-the-needle': 'crosshatch',
  tripline: 'suspension',
  'chain-release': 'tripline',
  retrace: 'recall',
  wallrunner: 'light',
  'air-brake': 'kick',
};
export const NEW_PATH_IDS = {
  'coolant-rounds': { path: 'cryogenic' },
  'deep-freeze': { path: 'cryogenic' },
  icebreaker: { path: 'cryogenic' },
  'cold-snap': { path: 'cryogenic' },
  'cold-front': { path: 'cryogenic' },
  suspension: { path: 'stasis' },
  crosshatch: { path: 'stasis' },
  'thread-the-needle': { path: 'stasis' },
  tripline: { path: 'stasis' },
  'chain-release': { path: 'stasis' },
} as const;
