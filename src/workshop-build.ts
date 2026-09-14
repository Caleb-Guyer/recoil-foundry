import { MODS, availableMods, validSavedBuild } from './rules.ts';

export const DISCOVERIES_KEY = 'rf-discovered-mods-v1';
export const WORKSHOP_BUILD_KEY = 'rf-workshop-build-v1';

export function loadDiscoveries(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set(value.filter((id): id is string => typeof id === 'string'));
  return MODS.filter((mod) => ids.has(mod.id)).map((mod) => mod.id);
}

export function discoverBuild(
  known: readonly string[],
  collected: readonly string[],
  legacyMods?: readonly string[],
): string[] {
  return loadDiscoveries(validSavedBuild(collected, legacyMods) ? [...known, ...collected] : known);
}

// Preserve acquisition order. Removing a prerequisite removes its dependents,
// while unrelated upgrades and the other legal branches remain untouched.
export function workshopBuild(value: unknown, known: readonly string[]): string[] {
  const result: string[] = [];
  if (!Array.isArray(value)) return result;
  for (const id of value.slice(0, MODS.length))
    if (known.includes(id) && availableMods(result, true).some((mod) => mod.id === id))
      result.push(id);
  return result;
}

export function workshopLink(url: URL) {
  return (
    url.searchParams.get('workshop') === '1' &&
    url.searchParams.getAll('workshop').length === 1 &&
    !['test', 'daily', 'dv', 'seed'].some((key) => url.searchParams.has(key))
  );
}
