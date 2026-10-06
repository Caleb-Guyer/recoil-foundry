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
  return 'RF-C88-' + newSeed(previous?.replace(/^RF-C\d+-/, ''), random);
}
