import { MODS } from './rules.ts';
import { workshopBuild } from './workshop-build.ts';

export const BLUEPRINTS_KEY = 'rf-blueprints-v1';
export const BLUEPRINT_SLOTS = 6;
export const BLUEPRINT_NAME_LIMIT = 32;
export const BLUEPRINT_CODE_LIMIT = 8192;
export interface Blueprint {
  name: string;
  mods: string[];
}
export type BlueprintSlots = (Blueprint | null)[];
const all = MODS.map((mod) => mod.id);
export function validBlueprintMods(value: unknown): value is string[] {
  if (
    !Array.isArray(value) ||
    value.length > MODS.length ||
    value.some((id) => typeof id !== 'string')
  )
    return false;
  const legal = workshopBuild(value, all);
  return legal.length === value.length && legal.every((id, i) => id === value[i]);
}
export function validBlueprint(value: unknown): value is Blueprint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 2 &&
    typeof record.name === 'string' &&
    record.name.length > 0 &&
    record.name.length <= BLUEPRINT_NAME_LIMIT &&
    record.name.trim() === record.name &&
    !/[\u0000-\u001f\u007f-\u009f]/.test(record.name) &&
    validBlueprintMods(record.mods)
  );
}
export function loadBlueprints(value: unknown): BlueprintSlots {
  return Array.from({ length: BLUEPRINT_SLOTS }, (_, i) => {
    const item = Array.isArray(value) ? value[i] : null;
    return validBlueprint(item) ? { name: item.name, mods: [...item.mods] } : null;
  });
}
export function validBlueprintSlots(value: unknown): value is BlueprintSlots {
  return (
    Array.isArray(value) &&
    value.length === BLUEPRINT_SLOTS &&
    value.every((item) => item === null || validBlueprint(item))
  );
}
export function setBlueprint(
  slots: BlueprintSlots,
  index: number,
  value: Blueprint | null,
): BlueprintSlots {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= BLUEPRINT_SLOTS ||
    (value !== null && !validBlueprint(value))
  )
    throw new Error('Choose a slot and a name of 1–32 characters.');
  const next = loadBlueprints(slots);
  next[index] = value ? { name: value.name, mods: [...value.mods] } : null;
  return next;
}
// Names stay local. Codes contain only the versioned upgrade sequence.
export function blueprintCode(mods: readonly string[]): string {
  if (!validBlueprintMods(mods))
    throw new Error('This build cannot be shared under the current upgrade rules.');
  return (
    'RF1.' + btoa(JSON.stringify(mods)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  );
}
export function parseBlueprintCode(text: string): Blueprint {
  const code = text.trim();
  if (code.length > BLUEPRINT_CODE_LIMIT || !/^RF1\.[A-Za-z0-9_-]+$/.test(code))
    throw new Error('Enter a valid RF1 blueprint code.');
  try {
    const data: unknown = JSON.parse(atob(code.slice(4).replace(/-/g, '+').replace(/_/g, '/')));
    if (!validBlueprintMods(data) || blueprintCode(data) !== code) throw new Error();
    return { name: 'Shared build', mods: [...data] };
  } catch {
    throw new Error('This code is damaged or uses unsupported upgrade rules.');
  }
}
export function blueprintPreview(blueprint: Blueprint, known: readonly string[]) {
  const mods = workshopBuild(blueprint.mods, known);
  const hidden = blueprint.mods.filter((id) => !known.includes(id)).length;
  return {
    mods,
    hidden,
    unavailable: blueprint.mods.length - mods.length,
    labels: blueprint.mods.map((id) =>
      known.includes(id) ? MODS.find((mod) => mod.id === id)!.name : 'Undiscovered upgrade',
    ),
  };
}
