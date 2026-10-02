import { loadCommendations, type CommendationId } from './commendations.ts';
import { GUN_FINISHES, OUTFITS } from './cosmetics.ts';

export const APPEARANCE_SEEN_KEY = 'rf-appearance-seen-v1';

const rewards = new Set<CommendationId>(
  [...Object.values(GUN_FINISHES), ...Object.values(OUTFITS)].flatMap((item) =>
    item.unlock ? [item.unlock] : [],
  ),
);

export function loadSeenAppearances(raw: unknown, earned: readonly CommendationId[]) {
  return loadCommendations(raw).filter((id) => rewards.has(id) && earned.includes(id));
}

export function unseenAppearances(earned: readonly CommendationId[], seen: unknown) {
  const viewed = new Set(loadSeenAppearances(seen, earned));
  return loadSeenAppearances(earned, earned).filter((id) => !viewed.has(id));
}
