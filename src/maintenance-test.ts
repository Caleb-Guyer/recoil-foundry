import { type Checkpoint } from './rules.ts';
import { type MaintenanceKind } from './maintenance.ts';

export function maintenanceTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'maintenance') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'layout', 'build', 'variant', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const kind = p.get('layout') ?? 'piston',
    build = p.get('build') ?? 'standard';
  if (
    invalid ||
    !['piston', 'lift'].includes(kind) ||
    !['standard', 'recoil', 'portal'].includes(build) ||
    (p.has('variant') && !/^[1-9]\d{0,2}$/.test(p.get('variant')!))
  )
    return null;
  const mods = build === 'portal' ? ['fold'] : build === 'recoil' ? ['kick', 'light'] : [];
  return {
    version: 6,
    seed: 'MAINTENANCE-' + kind + (p.has('variant') ? '-' + p.get('variant') : ''),
    stage: 2,
    hp: 100,
    mods,
    detour: true,
    missedUpgrades: 3 - mods.length,
    kills: 0,
    elapsed: 0,
    maintenance: {
      stage: 2,
      kind: kind as MaintenanceKind,
      ...(p.has('variant') ? { revision: 2 as const } : {}),
    },
  };
}
