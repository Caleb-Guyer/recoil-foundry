import { testCheckpoint } from './practice.ts';
import { isHunt, huntSeed } from './hunt-rules.ts';
import { isStartingGun } from './starting-guns.ts';
import type { Checkpoint } from './rules.ts';
export function huntTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, k) => {
    if (!['test', 'hunt', 'gun', 'v'].includes(k) || p.getAll(k).length !== 1) invalid = true;
  });
  const kind = p.get('hunt') ?? 'cableweaver',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    p.get('test') !== 'hunt' ||
    !isHunt(kind) ||
    !isStartingGun(gun) ||
    (p.has('v') && p.get('v') !== '1')
  )
    return null;
  return { ...testCheckpoint(huntSeed(kind), 8), version: 6, huntTest: kind, startingGun: gun };
}
