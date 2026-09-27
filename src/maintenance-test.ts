import { type Checkpoint } from './rules.ts';
import { type MaintenanceKind } from './maintenance.ts';

export function maintenanceTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'maintenance') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'layout', 'build', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const kind = p.get('layout') ?? 'piston',
    build = p.get('build') ?? 'standard';
  if (
    invalid ||
    !['piston', 'lift'].includes(kind) ||
    !['standard', 'recoil', 'portal'].includes(build)
  )
    return null;
  const mods = build === 'portal' ? ['fold'] : build === 'recoil' ? ['kick', 'light'] : [];
  return {
    version: 6,
    seed: 'MAINTENANCE-' + kind,
    stage: 2,
    hp: 100,
    mods,
    detour: true,
    missedUpgrades: 3 - mods.length,
    kills: 0,
    elapsed: 0,
    maintenance: { stage: 2, kind: kind as MaintenanceKind },
  };
}
