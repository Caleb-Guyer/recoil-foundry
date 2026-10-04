import { isStartingGun } from './starting-guns.ts';
import { testCheckpoint } from './practice.ts';
import { uprisingTestFromUrl } from './uprising-test.ts';
import type { Checkpoint } from './rules.ts';

export function encounterTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'encounters') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'room', 'gun', 'route', 'seed', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const gun = p.get('gun') ?? 'pistol';
  const room = p.get('room') ?? '1';
  const seed = p.get('seed') ?? 'ENCOUNTERS';
  if (
    invalid ||
    (p.has('v') && p.get('v') !== '1') ||
    !isStartingGun(gun) ||
    !/^(?:[1-9]|1\d|20)$/.test(room) ||
    !/^[a-zA-Z0-9-]{1,32}$/.test(seed) ||
    /^RF-D\d+-/.test(seed)
  )
    return null;
  if (p.has('route')) {
    if (p.has('room') || p.has('seed')) return null;
    const job = uprisingTestFromUrl(
      new URL('https://test/?test=uprising&v=1&route=' + p.get('route')),
    );
    return job ? { ...job, startingGun: gun, encounters: 1 } : null;
  }
  return { ...testCheckpoint(seed, Number(room) - 1), startingGun: gun, encounters: 1 };
}
