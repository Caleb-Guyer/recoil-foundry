import { seeded, type Checkpoint } from './rules.ts';

export type RegionChoice = 'cooling' | 'annex';
export type RegionDecision = 'pending' | RegionChoice;
export const REGION_NAMES: Record<RegionChoice, string> = {
  cooling: 'Cooling Works',
  annex: 'Transmission Annex',
};
// Daily 78/79 retain their original rooms and reward sequence.
export function dailyRegion(seed: string): RegionChoice | null {
  return /^RF-D(?:80|81)-/.test(seed)
    ? seeded(seed + ':region:annex-v1')() < 0.5
      ? 'cooling'
      : 'annex'
    : null;
}
export function isAnnexStage(
  region: RegionDecision | null | undefined,
  stage: number,
  overtime = false,
) {
  return region === 'annex' && !overtime && stage >= 8 && stage <= 10;
}
export function validRegion(d: Checkpoint) {
  if (
    d.region !== undefined &&
    (d.version !== 6 || !['pending', 'cooling', 'annex'].includes(d.region))
  )
    return false;
  const region = d.region ?? dailyRegion(d.seed);
  if (
    d.annexVersion !== undefined &&
    (d.version !== 6 ||
      !region ||
      ![1, 2].includes(d.annexVersion) ||
      (/^RF-D80-/.test(d.seed) && d.annexVersion !== 1) ||
      (/^RF-D81-/.test(d.seed) && d.annexVersion !== 2))
  )
    return false;
  if (!region) return true;
  const daily = /^RF-D\d+-/.test(d.seed);
  if (daily && region !== dailyRegion(d.seed)) return false;
  if (
    !daily &&
    (region === 'pending'
      ? d.stage > 7 || !!d.overtime || (d.stage === 7 && !!d.reward)
      : d.stage < 7 && !d.overtime)
  )
    return false;
  if (
    isAnnexStage(region, d.stage, !!d.overtime) &&
    (d.route || d.detour || d.reward?.enteringRoute || d.reward?.enteringDetour)
  )
    return false;
  return true;
}
