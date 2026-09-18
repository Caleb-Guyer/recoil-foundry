import {
  availableMods,
  buildPath,
  MOD_PATHS,
  MOD_REQUIRES,
  FUSION_REQUIRES,
  seeded,
  sample,
  validSavedBuild,
  fusionUnlocked,
  isFusion,
  type Checkpoint,
} from './rules.ts';
import { BRANCH_STAGE, BRANCH_PARENTS, isBranch } from './upgrade-branches.ts';
import { dailyForDate } from './daily.ts';

export const REFORGE_STAGES = [3, 7, 11];
export interface ReforgeSave {
  stage: number;
  used: boolean;
}
export interface ReforgeRoomSave {
  open?: true;
  salvage?: string;
}
export interface ReforgeSwap {
  from: string;
  to: string;
}

export function planReforge(seed: string): ReforgeSave | null {
  const rng = seeded(seed + ':reforge-v1');
  return rng() < 0.35
    ? { stage: REFORGE_STAGES[Math.floor(rng() * REFORGE_STAGES.length)], used: false }
    : null;
}

export function legalSwaps(
  mods: readonly string[],
  stage: number,
  legacyMods?: readonly string[],
): ReforgeSwap[] {
  if (!validSavedBuild(mods, legacyMods)) return [];
  const path = buildPath(mods),
    swaps: ReforgeSwap[] = [];
  const required = new Set(
    mods.flatMap((id) => [
      ...(MOD_REQUIRES[id] ? [MOD_REQUIRES[id]] : []),
      ...(BRANCH_PARENTS[id] ?? []),
      ...(FUSION_REQUIRES[id] ?? []),
    ]),
  );
  for (const from of mods.slice(legacyMods?.length ?? 0)) {
    // Removing a parent must never strand an existing evolution or fusion.
    if (required.has(from)) continue;
    const remaining = mods.filter((id) => id !== from);
    for (const mod of availableMods(remaining)) {
      if (
        mod.id === from ||
        (isFusion(mod.id) && !fusionUnlocked({ stage })) ||
        (isBranch(mod.id) && stage < BRANCH_STAGE)
      )
        continue;
      if (path && MOD_PATHS[mod.id]?.path && MOD_PATHS[mod.id].path !== path) continue;
      const next = [...remaining, mod.id];
      // A station cannot erase the only path upgrade to unlock another path.
      if (path && buildPath(next) !== path) continue;
      swaps.push({ from, to: mod.id });
    }
  }
  return swaps;
}

export function reforgeOffers(
  mods: readonly string[],
  seed: string,
  stage: number,
  legacyMods?: readonly string[],
): ReforgeSwap[] {
  const rng = seeded(seed + ':reforge-offers:' + stage + ':' + mods.join(','));
  const pool = sample(legalSwaps(mods, stage, legacyMods), 10000, rng);
  const count = /^RF-D\d+-/.test(seed) ? 1 : 3,
    chosen: ReforgeSwap[] = [];
  // Prefer different sacrifices and rewards; a build with one removable leaf
  // can still choose between several replacements for that leaf.
  for (const uniqueSource of [true, false])
    for (const swap of pool) {
      if (chosen.length >= count) return chosen;
      if (chosen.some((s) => s.to === swap.to || (uniqueSource && s.from === swap.from))) continue;
      chosen.push(swap);
    }
  return chosen;
}

export function validReforge(d: Checkpoint) {
  const s = d.reforge,
    room = d.reforgeRoom;
  if (s === undefined) return room === undefined;
  if (
    !s ||
    typeof s !== 'object' ||
    ![5, 6].includes(d.version) ||
    !REFORGE_STAGES.includes(s.stage) ||
    typeof s.used !== 'boolean' ||
    (s.used && !d.overtime && d.stage < s.stage)
  )
    return false;
  if (room === undefined) return true;
  if (
    !room ||
    typeof room !== 'object' ||
    d.stage !== s.stage ||
    d.detour ||
    d.escape ||
    d.overtime ||
    (room.open !== undefined && room.open !== true) ||
    (room.open && (s.used || d.reward)) ||
    (room.salvage !== undefined &&
      room.salvage !==
        ({ 3: 'ramjet', 7: 'cinder', 11: 'crosswind' } as Record<number, string>)[d.stage])
  )
    return false;
  return !room.open || reforgeOffers(d.mods, d.seed, d.stage, d.legacyMods).length > 0;
}

export function reforgeTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'build', 'phase', 'daily', 'v'].includes(key)) invalid = true;
  });
  if (
    invalid ||
    p.get('test') !== 'reforge' ||
    p.getAll('test').length !== 1 ||
    (p.has('build') &&
      (p.getAll('build').length !== 1 ||
        !['standard', 'beam', 'portal'].includes(p.get('build')!))) ||
    (p.has('phase') &&
      (p.getAll('phase').length !== 1 || !['room', 'fight'].includes(p.get('phase')!))) ||
    (p.has('daily') && (p.getAll('daily').length !== 1 || p.get('daily') !== '1'))
  )
    return null;
  const mods = ['magnum', 'light', 'airshot', 'rapid', 'kick', 'landing', 'pierce'];
  if (p.get('build') === 'beam') mods.splice(3, 1, 'cutting-torch');
  if (p.get('build') === 'portal') mods.splice(3, 1, 'fold');
  return {
    version: 6,
    seed: p.has('daily') ? dailyForDate('2026-09-18')!.seed : 'REFORGE-84',
    stage: 7,
    hp: p.get('phase') === 'fight' ? 100 : 64,
    mods,
    kills: 0,
    elapsed: 0,
    reforge: { stage: 7, used: false },
    ...(p.get('phase') === 'fight'
      ? {}
      : {
          reforgeRoom: {
            salvage: 'cinder',
            ...(p.get('phase') === 'room' ? {} : { open: true as const }),
          },
        }),
  };
}
