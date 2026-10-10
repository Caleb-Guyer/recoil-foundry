import { testCheckpoint } from './practice.ts';
import { BOSS_REMIXES, REMIX_IDS } from './boss-remix-rules.ts';
import { isStartingGun } from './starting-guns.ts';
import type { Checkpoint } from './rules.ts';

export function bossRemixTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'boss', 'variant', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const boss = p.get('boss') ?? 'loader',
    variant = p.get('variant') ?? '1',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    p.get('test') !== 'boss-remix' ||
    !['loader', 'press', 'condenser', 'sorter', 'boss'].includes(boss) ||
    !['1', '2'].includes(variant) ||
    !isStartingGun(gun) ||
    (p.has('v') && p.get('v') !== '1')
  )
    return null;
  const id = REMIX_IDS.filter((id) => BOSS_REMIXES[id].boss === boss)[Number(variant) - 1];
  return {
    ...testCheckpoint('REMIX-' + id, BOSS_REMIXES[id].stage),
    version: 6,
    startingGun: gun,
    bossRemix: id,
  };
}
