import { seeded, type Checkpoint } from './rules.ts';

export function annexRevision(seed: string, save?: Pick<Checkpoint, 'annexVersion'>): 1 | 2 | 3 {
  return (
    save?.annexVersion ??
    (/^RF-D82-/.test(seed) ? 3 : /^RF-D81-/.test(seed) ? 2 : save || /^RF-D80-/.test(seed) ? 1 : 3)
  );
}
export type RegionChoice = 'cooling' | 'annex';
export type RegionDecision = 'pending' | RegionChoice;
export const REGION_NAMES: Record<RegionChoice, string> = {
  cooling: 'Cooling Works',
  annex: 'Transmission Annex',
};
// Daily 78/79 retain their original rooms and reward sequence.
export function dailyRegion(seed: string): RegionChoice | null {
  return /^RF-D(?:80|81|82)-/.test(seed)
    ? seeded(seed + ':region:annex-v1')() < 0.5
      ? 'cooling'
      : 'annex'
    : null;
}
export function isAnnexStage(
  region: RegionDecision | null | undefined,
  stage: number,
  overtime = false,
  version: 1 | 2 | 3 = 1,
) {
  return region === 'annex' && !overtime && stage >= 8 && stage <= (version >= 3 ? 11 : 10);
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
      ![1, 2, 3].includes(d.annexVersion) ||
      (/^RF-D80-/.test(d.seed) && d.annexVersion !== 1) ||
      (/^RF-D81-/.test(d.seed) && d.annexVersion !== 2) ||
      (/^RF-D82-/.test(d.seed) && d.annexVersion !== 3))
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
    isAnnexStage(region, d.stage, !!d.overtime, annexRevision(d.seed, d)) &&
    (d.route || d.detour || d.reward?.enteringRoute || d.reward?.enteringDetour)
  )
    return false;
  return true;
}
