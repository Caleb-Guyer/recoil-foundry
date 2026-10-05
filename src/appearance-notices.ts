import { loadCommendations, type CommendationId } from './commendations.ts';
import { GUN_FINISHES, OUTFITS, type Cosmetics } from './cosmetics.ts';

export const APPEARANCE_SEEN_KEY = 'rf-appearance-seen-v1';
export const APPEARANCE_ITEMS_SEEN_KEY = 'rf-appearance-items-seen-v1';
export type AppearanceItemId = `gun:${Cosmetics['gun']}` | `outfit:${Cosmetics['outfit']}`;

const rewardItems = (['gun', 'outfit'] as const).flatMap((slot) =>
  Object.entries(slot === 'gun' ? GUN_FINISHES : OUTFITS).flatMap(([id, item]) =>
    item.unlock ? [{ id: `${slot}:${id}` as AppearanceItemId, unlock: item.unlock }] : [],
  ),
);

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

export function loadSeenAppearanceItems(raw: unknown, earned: readonly CommendationId[]) {
  const available = new Set(
    rewardItems.filter((item) => earned.includes(item.unlock)).map((item) => item.id),
  );
  return Array.isArray(raw)
    ? [...new Set(raw.filter((id): id is AppearanceItemId => available.has(id)))]
    : [];
}

export function unseenAppearanceItems(
  earned: readonly CommendationId[],
  seen: unknown,
  legacySeen?: unknown,
) {
  const viewed = new Set(loadSeenAppearanceItems(seen, earned)),
    legacy = new Set(loadSeenAppearances(legacySeen, earned));
  // Older section acknowledgements covered every style awarded by a commendation.
  return rewardItems
    .filter(
      (item) => earned.includes(item.unlock) && !viewed.has(item.id) && !legacy.has(item.unlock),
    )
    .map((item) => item.id);
}

export function acknowledgeAppearanceItem(
  seen: unknown,
  earned: readonly CommendationId[],
  id: AppearanceItemId,
) {
  return loadSeenAppearanceItems([...loadSeenAppearanceItems(seen, earned), id], earned);
}
