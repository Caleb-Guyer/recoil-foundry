import { isStartingGun } from './starting-guns.ts';
import { testCheckpoint } from './practice.ts';
import type { Checkpoint } from './rules.ts';

// Explicit playtests use the production controls and renderer, without progress writes.
export function combatFeelTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'combat-feel') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const gun = p.get('gun') ?? 'shotgun';
  if (invalid || !isStartingGun(gun)) return null;
  return { ...testCheckpoint('COMBAT-FEEL', 0), startingGun: gun };
}
