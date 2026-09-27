import type { Checkpoint } from './rules.ts';

export interface WelderSave {
  stage: number;
  status: 'scheduled' | 'defeated' | 'claimed';
}
export const WELDER_HP = 2400;
export const welderBonus = (s?: WelderSave | null) => (s?.status === 'claimed' ? 1 : 0);

export function validWelder(d: Checkpoint) {
  const s = d.welder;
  if (s === undefined) return d.reward?.welder === undefined;
  if (
    !s ||
    typeof s !== 'object' ||
    d.version !== 6 ||
    d.overtime?.remix !== 5 ||
    typeof d.seed !== 'string' ||
    !Number.isInteger(s.stage) ||
    ![1, 4, 5, 8, 9, 12, 13, 16, 17].includes(s.stage) ||
    !['scheduled', 'defeated', 'claimed'].includes(s.status)
  )
    return false;
  if (s.status === 'scheduled')
    return d.stage <= s.stage && !d.reward?.welder && !(d.stage === s.stage && d.reward);
  if (d.stage < s.stage || (s.status === 'defeated' && (d.stage !== s.stage || d.escape)))
    return false;
  if (
    d.reward?.welder !== undefined &&
    (d.reward.welder !== true ||
      s.status !== 'defeated' ||
      d.reward.rerolled ||
      d.reward.courier ||
      d.reward.auditor ||
      d.reward.salvage)
  )
    return false;
  return !(s.status === 'defeated' && d.reward && !d.reward.welder);
}
