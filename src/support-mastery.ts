import type { CombatResults } from './combat-report.ts';
import type { Lore } from './lore-upgrades.ts';

export const SUPPORT_MASTERIES = [
  {
    id: 'relay-race',
    name: 'Relay Race',
    upgrades: ['heat-relay'],
    counter: 'heatTransfers',
    target: 6,
    unit: 'heat transfers',
    objective: 'Complete six Heat Relay transfers in one Campaign or Daily run.',
    reward: 'Heatline',
    slot: 'Gun finish',
    lore: [
      'THERMAL SYSTEMS · HANDOVER RECORD',
      'M. Vale · Maintenance',
      'Six handovers without losing the heat between stations. The old production line could not manage that on a good day.\n\nI painted the transfer path on your receiver. Follow the pale line across the red enamel. Every joint leads somewhere useful.',
    ] as Lore,
  },
  {
    id: 'stored-energy',
    name: 'Stored Energy',
    upgrades: ['overkill-bank'],
    counter: 'bankCharges',
    target: 8,
    unit: 'stored charges used',
    objective: 'Spend eight Overkill Bank charges in one Campaign or Daily run.',
    reward: 'Reservoir',
    slot: 'Gun finish',
    lore: [
      'POWER ACCOUNTS · RESERVE DISCHARGE',
      'Dr. S. Anik · Development',
      'The reserve was intended to recover energy that the tool had already spent. You have made eight useful withdrawals in one shift. I have amended the efficiency report.\n\nThe brass cells on the new receiver are an acknowledgement, not a charge indicator. The working circuit still has its own lamp.',
    ] as Lore,
  },
  {
    id: 'scrap-certified',
    name: 'Reclaimed Protection',
    upgrades: ['scrap-armor'],
    counter: 'armorBlocks',
    target: 5,
    unit: 'bullets blocked',
    objective: 'Block five enemy bullets with Scrap Armor in one Campaign or Daily run.',
    reward: 'Patchwork',
    slot: 'Outfit',
    lore: [
      'SAFETY STORES · RECLAIMED MATERIAL',
      'E. Holt · Safety',
      'Five bullets stopped by material that had already been written off. I have asked Stores to reconsider their definition of waste.\n\nYour jacket is repaired with panels from three departments. The seams are visible because I want the next inspector to ask where they came from.',
    ] as Lore,
  },
] as const;
export type SupportMasteryId = (typeof SUPPORT_MASTERIES)[number]['id'];
export interface SupportMasteryAttempt {
  results: CombatResults;
  label: string;
}
export interface SupportMasteryProgress {
  current: number;
  target: number;
  unit: string;
  label: string;
  complete: boolean;
  partialFrom?: number;
}
export function supportMasteryProgress(
  id: string,
  earned: boolean,
  attempt?: SupportMasteryAttempt,
): SupportMasteryProgress | undefined {
  const mastery = SUPPORT_MASTERIES.find((m) => m.id === id);
  if (!mastery) return;
  return {
    current: earned
      ? mastery.target
      : Math.min(mastery.target, attempt?.results[mastery.counter] ?? 0),
    target: mastery.target,
    unit: mastery.unit,
    label: earned ? 'Mastery complete' : (attempt?.label ?? 'Single-run target'),
    complete: earned,
    ...(!earned && attempt?.results.partial ? { partialFrom: attempt.results.fromStage + 1 } : {}),
  };
}
