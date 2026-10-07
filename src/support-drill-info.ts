import { SUPPORT_MASTERIES, type SupportMasteryId } from './support-mastery.ts';

export const SUPPORT_DRILLS = {
  heat: {
    mastery: 'relay-race',
    name: 'Heat Relay',
    mods: ['cutting-torch', 'thermal-runaway', 'heat-relay'],
    instruction:
      'Hold the beam on a target until it falls. Switch to another target within one second to carry its heat. Repeat six times.',
  },
  overkill: {
    mastery: 'stored-energy',
    name: 'Overkill Bank',
    mods: ['magnum', 'overkill-bank'],
    instruction:
      'Finish the weak target on the left to store excess damage. Spend the charge on the tougher target on the right. Repeat eight times.',
  },
  armor: {
    mastery: 'scrap-certified',
    name: 'Scrap Armor',
    mods: ['magnum', 'scrap-armor'],
    instruction:
      'Break the cover to collect a plate, then intercept the incoming bullet. A plate lasts four seconds; new plates recharge in six. Block five bullets.',
  },
} as const satisfies Record<
  string,
  { mastery: SupportMasteryId; name: string; mods: readonly string[]; instruction: string }
>;
export type SupportDrillId = keyof typeof SUPPORT_DRILLS;
export function supportDrillForEntry(id: string): SupportDrillId | undefined {
  return (Object.keys(SUPPORT_DRILLS) as SupportDrillId[]).find(
    (key) => id === 'commendation:' + SUPPORT_DRILLS[key].mastery,
  );
}
export function supportDrillMastery(id: SupportDrillId) {
  return SUPPORT_MASTERIES.find((m) => m.id === SUPPORT_DRILLS[id].mastery)!;
}
export function supportDrillFromUrl(url: URL): SupportDrillId | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'build', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const id = p.get('build') ?? '';
  return !invalid && p.get('test') === 'drill' && Object.hasOwn(SUPPORT_DRILLS, id)
    ? (id as SupportDrillId)
    : null;
}
