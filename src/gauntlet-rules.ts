import { validBuild, availableMods, rewardMods, seeded } from './rules.ts';
import { getLevel } from './levels.ts';
import { PRACTICE_BOSSES, type PracticeBoss, type Encounter } from './practice.ts';
import { planWelder } from './welder-layout.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';
import {
  BOSS_REMIXES,
  REMIX_IDS,
  isBossRemix,
  remixEncounter,
  type BossRemixId,
} from './boss-remix-rules.ts';
import type { GauntletChallenge } from './gauntlet-challenge.ts';

export const GAUNTLET_KEY = 'rf-boss-gauntlet-v1';
export const GAUNTLET_RULES = 1;
export const GAUNTLET_REPAIR = 30;
export const GAUNTLET_RECORD_LIMIT = 512;
export type GauntletMode = 'classic' | 'remix';
export type GauntletTier = 'standard' | 'overclocked';
export type GauntletChoice = PracticeBoss | BossRemixId;
export interface GauntletOptions {
  mode?: GauntletMode;
  tier?: GauntletTier;
  seen?: readonly BossRemixId[];
  challenge?: GauntletChallenge;
  path?: 1 | 2;
}
export const REMIX_GAUNTLET_BASE = [
  'loader',
  'press',
  'condenser',
  'sorter',
  'interceptor',
] as const;
export const REMIX_GAUNTLET_FAMILIES = ['loader', 'press', 'condenser', 'sorter', 'boss'] as const;
export function remixGauntletChoices(
  round: number,
  seen: readonly BossRemixId[],
): GauntletChoice[] {
  if (round < 0 || round >= 5) return [];
  const choices = REMIX_IDS.filter(
    (id) => BOSS_REMIXES[id].boss === REMIX_GAUNTLET_FAMILIES[round] && seen.includes(id),
  );
  return choices.length ? choices : [REMIX_GAUNTLET_BASE[round]];
}
export function validRemixRoute(route: unknown): route is GauntletChoice[] {
  return (
    Array.isArray(route) &&
    route.length === 5 &&
    route.some(isBossRemix) &&
    route.every(
      (choice, i) =>
        choice === REMIX_GAUNTLET_BASE[i] ||
        (isBossRemix(choice) && BOSS_REMIXES[choice].boss === REMIX_GAUNTLET_FAMILIES[i]),
    )
  );
}
export const isGauntletTier = (value: unknown): value is GauntletTier =>
  value === 'standard' || value === 'overclocked';
// Authored remix arenas need more movement between openings; four fittings
// should still sustain a full circuit, including the charged starting tools.
export const REMIX_GAUNTLET_BOSS_HP = [400, 500, 575, 800, 1000] as const;
export function gauntletBossHp(
  round: number,
  tier: GauntletTier = 'standard',
  mode: GauntletMode = 'classic',
) {
  const hp = mode === 'remix' ? REMIX_GAUNTLET_BOSS_HP[round] : GAUNTLET_BOSS_HP[round];
  return Math.round(hp * (tier === 'overclocked' ? 1.15 : 1));
}
export const gauntletChoiceName = (choice: GauntletChoice) =>
  isBossRemix(choice) ? BOSS_REMIXES[choice].name : PRACTICE_BOSSES[choice].name;
export const gauntletRouteLabel = (route: readonly GauntletChoice[]) =>
  route.map(gauntletChoiceName).join(' → ');
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
  route: GauntletChoice[];
  mode?: 'remix';
  tier?: GauntletTier;
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
  const remix = r.mode === 'remix';
  return (
    Object.keys(v).length === (remix ? 10 : 8) &&
    [
      'rules',
      'gun',
      'route',
      'mods',
      'repairs',
      'timeMs',
      'hits',
      'shots',
      ...(remix ? ['mode', 'tier'] : []),
    ].every((k) => Object.hasOwn(v, k)) &&
    r.rules === GAUNTLET_RULES &&
    isStartingGun(r.gun) &&
    Array.isArray(r.route) &&
    r.route.length === 5 &&
    (remix
      ? isGauntletTier(r.tier) && validRemixRoute(r.route)
      : r.route.every((kind, i) => (GAUNTLET_ROUNDS[i] as readonly string[]).includes(kind))) &&
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
export function gauntletRecordKey(
  r: Pick<GauntletRecord, 'rules' | 'gun' | 'route' | 'mode' | 'tier'>,
) {
  return JSON.stringify([r.rules, r.gun, r.route, ...(r.mode === 'remix' ? [r.mode, r.tier] : [])]);
}
export function loadGauntletRecords(raw: unknown): GauntletRecord[] {
  const seen = new Set<string>();
  return (Array.isArray(raw) ? raw.slice(0, GAUNTLET_RECORD_LIMIT) : [])
    .filter((v): v is GauntletRecord => {
      if (!validGauntletRecord(v) || seen.has(gauntletRecordKey(v))) return false;
      seen.add(gauntletRecordKey(v));
      return true;
    })
    .map((v) => structuredClone(v));
}
export function validGauntletRecords(raw: unknown) {
  return (
    Array.isArray(raw) &&
    raw.length <= GAUNTLET_RECORD_LIMIT &&
    loadGauntletRecords(raw).length === raw.length
  );
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
      ? [structuredClone(r), ...records.filter((v) => gauntletRecordKey(v) !== key)].slice(
          0,
          GAUNTLET_RECORD_LIMIT,
        )
      : records,
  };
}
const encounters = new Map<PracticeBoss, Encounter>();
export function gauntletEncounter(kind: GauntletChoice): Encounter {
  if (isBossRemix(kind)) return remixEncounter(kind);
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
export function remixGauntletPreviewFromUrl(
  url: URL,
): (GauntletOptions & { gun: StartingGun; setup?: true }) | null {
  const p = url.searchParams;
  if (p.get('test') !== 'remix-gauntlet') return null;
  let valid = true;
  p.forEach((_, key) => {
    if (!['test', 'gun', 'tier', 'path', 'setup', 'v'].includes(key) || p.getAll(key).length !== 1)
      valid = false;
  });
  const gun = p.get('gun') ?? 'pistol',
    tier = p.get('tier') ?? 'standard',
    path = p.get('path');
  if (
    !valid ||
    !isStartingGun(gun) ||
    !isGauntletTier(tier) ||
    (path !== null && path !== '1' && path !== '2') ||
    (p.has('setup') && p.get('setup') !== '1') ||
    (p.has('setup') && p.has('path')) ||
    (p.has('v') && p.get('v') !== '1')
  )
    return null;
  return {
    gun,
    mode: 'remix',
    tier,
    ...(path ? { path: Number(path) as 1 | 2 } : {}),
    ...(p.has('setup') ? { setup: true as const } : {}),
  };
}
export function gauntletCommendations(record: GauntletRecord) {
  if (!validGauntletRecord(record)) return [];
  return [
    'gauntlet-cleared' as const,
    ...(record.mode === 'remix'
      ? [
          'remix-gauntlet-cleared' as const,
          ...(record.repairs === 0 ? ['remix-gauntlet-unserviced' as const] : []),
        ]
      : []),
  ];
}
