export const FIRST_SHIFT_BOSSES = {
  loader: { name: 'The Loader', stage: 3 },
  crane: { name: 'The Crane', stage: 3 },
  press: { name: 'The Press', stage: 7 },
  kiln: { name: 'The Kiln', stage: 7 },
} as const;
export type FirstShiftBoss = keyof typeof FIRST_SHIFT_BOSSES;
export function firstShiftCampaign(seed: unknown) {
  return typeof seed === 'string' && Number(/^RF-C(\d+)-/.exec(seed)?.[1]) >= 103;
}
export function isFirstShiftBoss(kind: unknown): kind is FirstShiftBoss {
  return typeof kind === 'string' && Object.hasOwn(FIRST_SHIFT_BOSSES, kind);
}
