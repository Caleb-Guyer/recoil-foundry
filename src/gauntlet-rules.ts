import { validBuild, availableMods, rewardMods, seeded } from './rules.ts';
import { getLevel } from './levels.ts';
import { PRACTICE_BOSSES, type PracticeBoss, type Encounter } from './practice.ts';
import { planWelder } from './welder-layout.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';

export const GAUNTLET_KEY = 'rf-boss-gauntlet-v1';
export const GAUNTLET_RULES = 1;
export const GAUNTLET_REPAIR = 30;
// Five fights allow only four fittings, far fewer than a Campaign boss budget.
export const GAUNTLET_BOSS_HP = [400, 550, 750, 950, 1150] as const;
export const GAUNTLET_ROUNDS = [
  ['loader', 'crane'],
  ['press', 'kiln'],
  ['condenser', 'turbine'],
  ['sorter', 'boss'],
  ['interceptor', 'welder'],
] as const satisfies readonly (readonly PracticeBoss[])[];
export const GAUNTLET_HINTS: Partial<Record<PracticeBoss, string>> = {
  loader: 'Cargo supports and a charging machine.',
  crane: 'Climb above its sweeping head.',
  press: 'Read the slam warning and move.',
  kiln: 'Mortars, floor fire and recovery openings.',
  condenser: 'Find cover between freezing volleys.',
  turbine: 'Keep room to dodge its circular volleys.',
  sorter: 'Watch the scrap magnet and falling loads.',
  boss: 'Break cover to open new firing lanes.',
  interceptor: 'A mobile rival with a changing gun.',
  welder: 'Escape warned seams and exposed firing lanes.',
};
export interface GauntletRecord {
  rules: number;
  gun: StartingGun;
  route: PracticeBoss[];
  mods: string[];
  repairs: number;
  timeMs: number;
  hits: number;
  shots: number;
}
const integer = (v: unknown, min: number, max: number): v is number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validGauntletRecord(v: unknown): v is GauntletRecord {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const r = v as GauntletRecord;
  return (
    Object.keys(v).length === 8 &&
    ['rules', 'gun', 'route', 'mods', 'repairs', 'timeMs', 'hits', 'shots'].every((k) =>
      Object.hasOwn(v, k),
    ) &&
    r.rules === GAUNTLET_RULES &&
    isStartingGun(r.gun) &&
    Array.isArray(r.route) &&
    r.route.length === 5 &&
    r.route.every((kind, i) => (GAUNTLET_ROUNDS[i] as readonly string[]).includes(kind)) &&
    Array.isArray(r.mods) &&
    r.mods.length <= 4 &&
    r.mods.every((id) => typeof id === 'string' && /^[a-z0-9-]{1,48}$/.test(id)) &&
    new Set(r.mods).size === r.mods.length &&
    validBuild(r.mods) &&
    integer(r.repairs, 0, 4) &&
    r.repairs + r.mods.length === 4 &&
    integer(r.timeMs, 1, 86400000) &&
    integer(r.hits, 0, 100000) &&
    integer(r.shots, 0, 1000000)
  );
}
export function gauntletRecordKey(r: Pick<GauntletRecord, 'rules' | 'gun' | 'route'>) {
  return JSON.stringify([r.rules, r.gun, r.route]);
}
export function loadGauntletRecords(raw: unknown): GauntletRecord[] {
  const seen = new Set<string>();
  return (Array.isArray(raw) ? raw.slice(0, 96) : [])
    .filter((v): v is GauntletRecord => {
      if (!validGauntletRecord(v) || seen.has(gauntletRecordKey(v))) return false;
      seen.add(gauntletRecordKey(v));
      return true;
    })
    .map((v) => structuredClone(v));
}
export function validGauntletRecords(raw: unknown) {
  return Array.isArray(raw) && raw.length <= 96 && loadGauntletRecords(raw).length === raw.length;
}
export function recordGauntlet(raw: unknown, r: GauntletRecord) {
  if (!validGauntletRecord(r)) throw new Error('Invalid Gauntlet completion.');
  const records = loadGauntletRecords(raw),
    key = gauntletRecordKey(r),
    old = records.find((v) => gauntletRecordKey(v) === key);
  const best =
    !old ||
    r.timeMs < old.timeMs ||
    (r.timeMs === old.timeMs &&
      (r.hits < old.hits || (r.hits === old.hits && r.shots < old.shots)));
  return {
    best,
    records: best
      ? [structuredClone(r), ...records.filter((v) => gauntletRecordKey(v) !== key)]
      : records,
  };
}
const encounters = new Map<PracticeBoss, Encounter>();
export function gauntletEncounter(kind: PracticeBoss): Encounter {
  const old = encounters.get(kind);
  if (old) return { ...old };
  if (!GAUNTLET_ROUNDS.some((pair) => (pair as readonly string[]).includes(kind)))
    throw new Error('Unknown Gauntlet boss.');
  for (let i = 0; i < 256; i++) {
    const seed = 'GAUNTLET-1-' + kind.toUpperCase() + '-' + i;
    if (
      kind === 'welder'
        ? !planWelder(seed)
        : getLevel(seed, PRACTICE_BOSSES[kind].stage).spawns[0]?.kind !== kind
    )
      continue;
    const record = { kind, seed };
    encounters.set(kind, record);
    return { ...record };
  }
  throw new Error('Gauntlet arena unavailable.');
}
export function gauntletOffers(mods: readonly string[], completed: number) {
  return rewardMods(mods, 3, seeded('GAUNTLET-1-SERVICE-' + completed + ':' + mods.join(',')), {
    stage: Math.max(0, completed - 1),
    unlocks: [],
  }).map((m) => m.id);
}
export function gauntletBuild(mods: readonly string[], id: string) {
  return availableMods(mods).some((m) => m.id === id) && validBuild([...mods, id]);
}
export function gauntletPreviewFromUrl(url: URL): StartingGun | null {
  const p = url.searchParams;
  let valid = true;
  p.forEach((_, k) => {
    if (!['test', 'gun', 'v'].includes(k) || p.getAll(k).length !== 1) valid = false;
  });
  const gun = p.get('gun') ?? 'pistol';
  return valid && p.get('test') === 'gauntlet' && isStartingGun(gun) ? gun : null;
}
