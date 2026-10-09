import { goalPreviewProgress } from './next-goal-preview.ts';
import { MODS } from './rules.ts';
import { loadLogbook } from './logbook.ts';
import type { GoalProgress } from './next-goal.ts';
export const TRACKING_PREVIEWS = ['tools', 'achievements', 'upgrades', 'fresh'] as const;
export type TrackingPreview = (typeof TRACKING_PREVIEWS)[number];
export function trackingPreviewFromUrl(url: URL): TrackingPreview | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'profile', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const profile = p.get('profile') as TrackingPreview;
  return !invalid &&
    p.get('test') === 'track-goal' &&
    p.get('v') === '1' &&
    TRACKING_PREVIEWS.includes(profile)
    ? profile
    : null;
}
// Only the title and Logbook read these fixtures. Selections stay in memory and
// never enter ProgressStore, a checkpoint, or a playable fictional profile.
export function trackingPreviewProgress(profile: TrackingPreview): GoalProgress {
  const p = goalPreviewProgress(
    profile === 'tools' ? 'tools' : profile === 'fresh' ? 'fresh' : 'complete',
  );
  p.book = loadLogbook({ ...p.book, enemies: p.victories });
  p.revealed = profile === 'fresh' ? [] : MODS.map((m) => 'mod:' + m.id);
  if (profile === 'achievements')
    p.earned = p.earned.filter((id) => !['bank-job', 'air-traffic'].includes(id));
  if (profile === 'upgrades')
    p.discovered = p.discovered.filter((id) => !['magnum', 'heat-relay'].includes(id));
  return p;
}
