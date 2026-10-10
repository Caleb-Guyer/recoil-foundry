import type { Lore } from './lore-upgrades.ts';

export const REMIX_GAUNTLET_MASTERIES = [
  {
    id: 'remix-gauntlet-cleared',
    gauntlet: 'remix',
    name: 'Full Circuit',
    objective: 'Complete all five rounds of the Remix Gauntlet on either tier.',
    reward: 'Circuit Runner',
    slot: 'Outfit',
    lore: [
      'DISPATCH · REVISED INSPECTION ROUTE',
      'T. Orr · dispatch',
      'Every department moved its machinery. You still completed the circuit with the same tool you brought through the gate.\n\nThe inspection crew left a teal jacket at the final station. Its amber cuffs match the lamps beside every route you reopened.',
    ] as Lore,
  },
  {
    id: 'remix-gauntlet-unserviced',
    gauntlet: 'remix',
    name: 'Self-Sufficient',
    objective: 'Complete the Remix Gauntlet without choosing a repair between fights.',
    reward: 'Cold Steel',
    slot: 'Gun finish',
    lore: [
      'MAINTENANCE · SERVICE REQUEST CLOSED',
      'M. Vale · maintenance',
      'Five machines inspected and four service stops passed without a repair request. Every spare part stayed on its shelf.\n\nI polished the receiver myself. The steel is pale, the grip dark violet, and the sight still carries the quiet green of the first service lamp.',
    ] as Lore,
  },
] as const;
