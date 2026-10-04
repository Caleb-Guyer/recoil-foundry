import { isStartingGun } from './starting-guns.ts';
import { testCheckpoint } from './practice.ts';
import type { Checkpoint } from './rules.ts';

export function teamworkTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'unit', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const unit = p.get('unit') ?? 'repair',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    p.get('test') !== 'teamwork' ||
    !['repair', 'relay'].includes(unit) ||
    !isStartingGun(gun) ||
    (p.has('v') && p.get('v') !== '1')
  )
    return null;
  return {
    ...testCheckpoint('TEAMWORK-0', unit === 'repair' ? 6 : 10),
    version: 6,
    startingGun: gun,
    encounters: 1,
    teamwork: 1,
  };
}
