export const RIVAL_SHIFT_BOSSES = {
  turbine: { name: 'The Turbine', stage: 11, url: 'turbine' },
  boss: { name: 'The Interceptor', stage: 15, url: 'interceptor' },
} as const;
/** Internal enemy identities: the final Reclaimer uses a different kind. */
export type RivalShiftBoss = keyof typeof RIVAL_SHIFT_BOSSES;
export function rivalShiftCampaign(seed: unknown) {
  return typeof seed === 'string' && Number(/^RF-C(\d+)-/.exec(seed)?.[1]) >= 104;
}
export function isRivalShiftBoss(kind: unknown): kind is RivalShiftBoss {
  return typeof kind === 'string' && Object.hasOwn(RIVAL_SHIFT_BOSSES, kind);
}
