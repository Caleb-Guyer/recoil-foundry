import { BoundedCache } from './bounded-cache.ts';
import { legalSwaps, type ReforgeSwap } from './reforge-rules.ts';
import { buildPath, draftFitReason, isFusion, sample, seeded, validSavedBuild } from './rules.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';
import { validUnlocks } from './longevity.ts';
import { UPRISING_ROUTES, uprisingRoute, type UprisingRouteId } from './uprising-model.ts';

export const UPRISING_REPAIR = 20;
export const UPRISING_REWARD_CHOICES = ['repair', 'reroll', 'refit'] as const;
export type UprisingRewardChoice = (typeof UPRISING_REWARD_CHOICES)[number];
export interface UprisingReward {
  version: 1;
  stage: 5 | 9 | 13 | 17;
  baseMods: string[];
  startingGun: StartingGun;
  unlocks: string[];
  legacyMods?: string[];
  offer?: ReforgeSwap;
  selected?: UprisingRewardChoice;
  rerollSpent?: true;
}
export interface UprisingRewardIdentity {
  seed: string;
  route: UprisingRouteId;
}
export interface UprisingRewardContext extends UprisingRewardIdentity {
  mods: readonly string[];
  startingGun: StartingGun;
  hp: number;
  unlocks: readonly string[];
  legacyMods?: readonly string[];
}
export interface UprisingRewardOutcome {
  reward?: UprisingReward;
}
const IDENTITIES = new Set([
  'cutting-torch',
  'shellshock',
  'mass-driver',
  'fold',
  'recall',
  'vector',
  'grindshot',
  'suspension',
  'tripwire',
  'crossfire',
]);
const offerCache = new BoundedCache<string, ReforgeSwap | null>(128, () => {});
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: readonly string[]) =>
  Object.keys(v).every((key) => allowed.includes(key));
const validIdentity = (value: UprisingRewardIdentity) =>
  typeof value.seed === 'string' &&
  Number(/^RF-C(\d+)-/.exec(value.seed)?.[1]) >= 105 &&
  UPRISING_ROUTES.some((route) => route.id === value.route);
export const uprisingRewardBuild = (mods: readonly string[], swap: ReforgeSwap) => [
  ...mods.filter((id) => id !== swap.from),
  swap.to,
];

/** A replacement leaf, never a free extra fitting, path change or lost trigger mechanism. */
export function uprisingRefitOffer(
  seed: string,
  route: UprisingRouteId,
  mods: readonly string[],
  startingGun: StartingGun,
  unlocks: readonly string[] = [],
  legacyMods?: readonly string[],
): ReforgeSwap | undefined {
  if (!validIdentity({ seed, route }) || !isStartingGun(startingGun) || !validUnlocks(unlocks))
    return undefined;
  const key = JSON.stringify([seed, route, mods, startingGun, unlocks, legacyMods]);
  const cached = offerCache.get(key);
  if (cached !== undefined) return cached ? { ...cached } : undefined;
  const stage = uprisingRoute(route).fork + 1;
  const path = buildPath(mods);
  const pool = legalSwaps(mods, stage, legacyMods, unlocks, seed).filter(
    (swap) =>
      !IDENTITIES.has(swap.from) &&
      !IDENTITIES.has(swap.to) &&
      !isFusion(swap.from) &&
      !isFusion(swap.to) &&
      buildPath(uprisingRewardBuild(mods, swap)) === path,
  );
  // A useful fit or an owned prerequisite is preferred, while the native legal pool
  // remains authoritative. The gun only changes this deterministic choice.
  const developed = pool.filter(
    (swap) =>
      !!draftFitReason(
        swap.to,
        mods.filter((id) => id !== swap.from),
        startingGun,
      ),
  );
  const candidates = developed.length ? developed : pool;
  // legalSwaps protects every prerequisite; validate the selected complete
  // build once rather than rebuilding every possible candidate on a menu open.
  const selected = sample(
    candidates,
    candidates.length,
    seeded(seed + ':uprising-payment-v1:' + route + ':' + startingGun + ':' + mods.join(',')),
  ).find((swap) => validSavedBuild(uprisingRewardBuild(mods, swap), legacyMods));
  offerCache.set(key, selected ? { ...selected } : null);
  return selected ? { ...selected } : undefined;
}

export function newJobReward(
  seed: string,
  route: UprisingRouteId,
  mods: readonly string[],
  startingGun: StartingGun = 'pistol',
  unlocks: readonly string[] = [],
  legacyMods?: readonly string[],
): UprisingReward {
  if (
    !validIdentity({ seed, route }) ||
    !isStartingGun(startingGun) ||
    !validUnlocks(unlocks) ||
    !validSavedBuild(mods, legacyMods)
  )
    throw new Error('Invalid Uprising payment context');
  const offer = uprisingRefitOffer(seed, route, mods, startingGun, unlocks, legacyMods);
  return {
    version: 1,
    stage: (uprisingRoute(route).fork + 1) as UprisingReward['stage'],
    baseMods: [...mods],
    startingGun,
    unlocks: [...unlocks],
    ...(legacyMods ? { legacyMods: [...legacyMods] } : {}),
    ...(offer ? { offer } : {}),
  };
}

/** Structural validation is available before a full checkpoint supplies its seed. */
export function validUprisingRewardShape(raw: unknown): raw is UprisingReward {
  if (
    !record(raw) ||
    !keys(raw, [
      'version',
      'stage',
      'baseMods',
      'startingGun',
      'unlocks',
      'legacyMods',
      'offer',
      'selected',
      'rerollSpent',
    ]) ||
    raw.version !== 1 ||
    typeof raw.stage !== 'number' ||
    ![5, 9, 13, 17].includes(raw.stage) ||
    !Array.isArray(raw.baseMods) ||
    !raw.baseMods.every((id) => typeof id === 'string') ||
    !isStartingGun(raw.startingGun) ||
    !validUnlocks(raw.unlocks) ||
    (raw.legacyMods !== undefined &&
      (!Array.isArray(raw.legacyMods) || !raw.legacyMods.every((id) => typeof id === 'string'))) ||
    !validSavedBuild(raw.baseMods, raw.legacyMods as string[] | undefined) ||
    (raw.offer !== undefined &&
      (!record(raw.offer) ||
        !keys(raw.offer, ['from', 'to']) ||
        typeof raw.offer.from !== 'string' ||
        typeof raw.offer.to !== 'string')) ||
    (raw.selected !== undefined &&
      !(UPRISING_REWARD_CHOICES as readonly unknown[]).includes(raw.selected)) ||
    (raw.rerollSpent !== undefined && (raw.rerollSpent !== true || raw.selected !== 'reroll')) ||
    (raw.selected === 'refit' && raw.offer === undefined)
  )
    return false;
  const reward = raw as unknown as UprisingReward;
  if (reward.offer) {
    const { from, to } = reward.offer;
    if (
      !reward.baseMods.includes(from) ||
      reward.baseMods.includes(to) ||
      reward.legacyMods?.includes(from) ||
      IDENTITIES.has(from) ||
      IDENTITIES.has(to) ||
      isFusion(from) ||
      isFusion(to) ||
      !validSavedBuild(uprisingRewardBuild(reward.baseMods, reward.offer), reward.legacyMods) ||
      buildPath(uprisingRewardBuild(reward.baseMods, reward.offer)) !== buildPath(reward.baseMods)
    )
      return false;
  }
  return true;
}
/** Closed historical receipts are validated against their own immutable snapshot. */
export function validUprisingReward(
  raw: unknown,
  identity: UprisingRewardIdentity,
): raw is UprisingReward {
  if (
    !validIdentity(identity) ||
    !validUprisingRewardShape(raw) ||
    raw.stage !== uprisingRoute(identity.route).fork + 1
  )
    return false;
  return same(
    raw.offer,
    uprisingRefitOffer(
      identity.seed,
      identity.route,
      raw.baseMods,
      raw.startingGun,
      raw.unlocks,
      raw.legacyMods,
    ),
  );
}

/** Use for the current payment stage; later-room upgrades need not match a historical snapshot. */
export function currentBuildMatchesReward(
  reward: UprisingReward,
  mods: readonly string[],
  startingGun: StartingGun,
  legacyMods?: readonly string[],
) {
  if (!same(legacyMods, reward.legacyMods) || startingGun !== reward.startingGun) return false;
  const expected =
    reward.selected === 'refit' && reward.offer
      ? uprisingRewardBuild(reward.baseMods, reward.offer)
      : reward.baseMods;
  return same(expected, mods);
}

/** Return an atomic, immutable payment. The caller commits the selected receipt before saving. */
export function chooseUprisingReward(
  reward: UprisingReward,
  choice: UprisingRewardChoice,
  context: UprisingRewardContext,
): { reward: UprisingReward; mods: string[]; hp: number } | null {
  if (
    !validUprisingReward(reward, context) ||
    reward.selected !== undefined ||
    !UPRISING_REWARD_CHOICES.includes(choice) ||
    !currentBuildMatchesReward(reward, context.mods, context.startingGun, context.legacyMods) ||
    !same(reward.unlocks, context.unlocks) ||
    !Number.isFinite(context.hp) ||
    context.hp <= 0 ||
    context.hp > 100 ||
    (choice === 'repair' && context.hp >= 100) ||
    (choice === 'refit' && !reward.offer)
  )
    return null;
  return {
    reward: { ...structuredClone(reward), selected: choice },
    mods: choice === 'refit' ? uprisingRewardBuild(context.mods, reward.offer!) : [...context.mods],
    hp: choice === 'repair' ? Math.min(100, context.hp + UPRISING_REPAIR) : context.hp,
  };
}

export function uprisingRerollCredits(outcomes: readonly UprisingRewardOutcome[]): number {
  return outcomes
    .slice(0, 4)
    .filter(
      ({ reward }) =>
        reward?.version === 1 && reward.selected === 'reroll' && reward.rerollSpent !== true,
    ).length;
}
/** One ordinary reroll spends the oldest stored payment credit, once. */
export function spendUprisingReroll(outcomes: readonly UprisingRewardOutcome[]): boolean {
  const reward = outcomes
    .slice(0, 4)
    .find(
      ({ reward }) =>
        reward?.version === 1 && reward.selected === 'reroll' && reward.rerollSpent !== true,
    )?.reward;
  if (!reward) return false;
  reward.rerollSpent = true;
  return true;
}
