import { dailyFromSeed } from './daily.ts';

export const SEED_LOCK_CAMPAIGN_REVISION = 111;
export const SEED_LOCK_DAILY_REVISION = 92;

/** The saved run identity owns combat randomness; older runs keep their original stream. */
export function seedLockedCombat(seed: string): boolean {
  const campaign = /^RF-C(\d+)-/.exec(seed);
  if (campaign) return Number(campaign[1]) >= SEED_LOCK_CAMPAIGN_REVISION;
  const daily = dailyFromSeed(seed);
  return !!daily && Number(/^RF-D(\d+)-/.exec(daily.seed)![1]) >= SEED_LOCK_DAILY_REVISION;
}
