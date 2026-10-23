// Recovery rules stay available without downloading document artwork or prose.
export const RECORD_RULES = [
  {
    id: 'isolation-loading',
    unlock: 'disconnect',
    stage: 3,
  },
  {
    id: 'isolation-heat',
    unlock: 'disconnect',
    stage: 7,
  },
  {
    id: 'isolation-reclaim',
    unlock: 'disconnect',
    stage: 15,
  },
  {
    id: 'end-of-shift',
    unlock: 'shutdown',
  },
  {
    id: 'last-break',
    unlock: 'found',
    story: 'breakroom',
  },
  {
    id: 'return-address',
    unlock: 'found',
    story: 'dispatch',
  },
  {
    id: 'cold-control',
    unlock: 'found',
    story: 'experiment',
  },
  {
    id: 'still-here',
    unlock: 'found',
    story: 'hideout',
  },
  {
    id: 'handover',
    unlock: 'always',
  },
  {
    id: 'continuity',
    unlock: 'reclamation',
  },
  {
    id: 'breakroom',
    unlock: 'cooling',
  },
  {
    id: 'departure',
    unlock: 'escaped',
  },
] as const;
