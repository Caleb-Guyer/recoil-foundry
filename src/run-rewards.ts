import { COMMENDATIONS, type CommendationId } from './commendations.ts';
import { GUN_FINISHES, OUTFITS } from './cosmetics.ts';
import { LONGEVITY_MODS } from './longevity.ts';
import { UPRISING_CONTRACTS } from './uprising-model.ts';
import { STARTING_GUNS } from './starting-guns.ts';

export const RUN_REWARDS_KEY = 'rf-run-rewards-v1';
export const REWARD_CATALOG = [
  ...(['shotgun', 'nailgun'] as const).map((gun) => ({
    id: 'gun:' + gun,
    name: STARTING_GUNS[gun].name,
    label: 'Starting gun unlocked',
    detail: 'Available for Campaign and Workshop.',
    image: 'gun:' + gun,
  })),
  ...(['gun', 'outfit'] as const).flatMap((slot) =>
    Object.entries(slot === 'gun' ? GUN_FINISHES : OUTFITS)
      .filter(([, item]) => item.unlock)
      .map(([id, item]) => ({
        id: 'appearance:' + slot + ':' + id,
        name: item.name,
        label: slot === 'gun' ? 'Gun finish unlocked' : 'Outfit unlocked',
        detail:
          COMMENDATIONS.find((c) => c.id === item.unlock)!.name +
          ' · Equip in Workshop → Appearance.',
        image: 'appearance:' + slot + ':' + id,
      })),
  ),
  ...LONGEVITY_MODS.map((mod) => ({
    id: 'mod:' + mod.id,
    name: mod.name,
    label: 'Campaign fitting unlocked',
    detail: 'Enters the upgrade pool in your next Campaign.',
    image: 'mod:' + mod.id,
  })),
  ...UPRISING_CONTRACTS.map((c) => ({
    id: 'uprising:' + c.id,
    name: c.name,
    label: 'Contract completed',
    detail: c.reward,
    image: 'uprising:' + c.id,
  })),
];
export interface RunRewards {
  version: 1;
  seed: string;
  ids: string[];
}
export function loadRunRewards(raw: unknown): RunRewards | null {
  const p = raw as Partial<RunRewards> | null;
  if (
    p?.version !== 1 ||
    typeof p.seed !== 'string' ||
    !p.seed.length ||
    p.seed.length > 40 ||
    !Array.isArray(p.ids)
  )
    return null;
  return {
    version: 1,
    seed: p.seed,
    ids: REWARD_CATALOG.filter((r) => p.ids!.includes(r.id)).map((r) => r.id),
  };
}
export function validRunRewards(raw: unknown) {
  if (raw === null) return true;
  const clean = loadRunRewards(raw);
  return (
    !!clean &&
    !!raw &&
    Object.keys(raw).every((k) => ['version', 'seed', 'ids'].includes(k)) &&
    Array.isArray((raw as RunRewards).ids) &&
    (raw as RunRewards).ids.length === clean.ids.length
  );
}
export function addRunRewards(raw: unknown, seed: string, ids: readonly string[]): RunRewards {
  const before = loadRunRewards(raw);
  return loadRunRewards({
    version: 1,
    seed,
    ids: [...(before?.seed === seed ? before.ids : []), ...ids],
  })!;
}
export function commendationRewards(id: CommendationId) {
  return [
    ...Object.entries(GUN_FINISHES)
      .filter(([, p]) => p.unlock === id)
      .map(([key]) => 'appearance:gun:' + key),
    ...Object.entries(OUTFITS)
      .filter(([, p]) => p.unlock === id)
      .map(([key]) => 'appearance:outfit:' + key),
  ];
}
