import { dailyFromSeed } from './daily.ts';

export function newSeed(
  previous?: string,
  random = () => crypto.getRandomValues(new Uint32Array(1))[0],
) {
  let seed: string;
  do {
    seed = random().toString(36).toUpperCase();
  } while (seed === previous);
  return seed;
}
export function retrySeed(previous: string, random?: () => number) {
  return dailyFromSeed(previous)?.seed ?? newSeed(previous, random);
}
// Reward revisions live in the seed, so Continue and replay need no migration.
export function newCampaignSeed(previous?: string, random?: () => number) {
  return 'RF-C111-' + newSeed(previous?.replace(/^RF-C\d+-/, ''), random);
}

/** New shifts use Seed Lock; complete older seeds keep their saved rules. */
export function newQuickShiftSeed(previous?: string, random?: () => number) {
  return 'RF-Q2-' + newSeed(previous?.replace(/^RF-Q[12]-/, ''), random);
}
