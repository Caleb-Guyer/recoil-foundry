import { testCheckpoint } from './practice.ts';
import type { Checkpoint } from './rules.ts';

export function weaponMasteryTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'weapon-mastery') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'challenge', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const builds = {
    'bank-job': ['ricochet', 'banker', 'magnum'],
    'air-traffic': [
      'kick',
      'airshot',
      'rapid',
      'scatter',
      'magnum',
      'leech',
      'light',
      'pierce',
      'ricochet',
    ],
    'special-delivery': [
      'fold',
      'rewire',
      'ricochet',
      'pierce',
      'magnum',
      'rapid',
      'scatter',
      'leech',
      'light',
    ],
  };
  const challenge = p.get('challenge') ?? 'bank-job';
  if (invalid || !Object.hasOwn(builds, challenge)) return null;
  const mods = builds[challenge as keyof typeof builds];
  return {
    ...testCheckpoint('weapon-mastery-' + (challenge === 'bank-job' ? 7 : 2), mods.length),
    mods: [...mods],
  };
}
