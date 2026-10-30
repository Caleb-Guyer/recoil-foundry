import { MODS, rewardMods, seeded, validBuild, type Mod } from './rules.ts';
import { LONGEVITY_IDS } from './longevity.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';
import type { CombatFlowRoom } from './combat-flow-rooms.ts';

// Bump the rules and seed prefix when room selection, draft gates or the
// standard pool changes. A shared seed must never silently become a new shift.
export const QUICK_SHIFT_RULES = 2 as const;
export const SUPPORTED_QUICK_SHIFT_RULES = [1, 2] as const;
export type QuickShiftRules = (typeof SUPPORTED_QUICK_SHIFT_RULES)[number];
export const QUICK_SHIFT_POOL = 'standard-v1' as const;
export const QUICK_SHIFT_RECORDS_KEY = 'rf-quick-shift-records-v1';
export const QUICK_SHIFT_RECORD_LIMIT = 40;
export const QUICK_SHIFT_ROOMS = 5;
export const QUICK_SHIFT_MAX_MODS = 11;
export const QUICK_SHIFT_DRAFT_STAGES = [0, 4, 6, 8, 11] as const;
export type QuickShiftRoute = 'low' | 'high';
export type QuickShiftJobChoice = 'accept' | 'skip';
export interface QuickShiftChallenge {
  rules: QuickShiftRules;
  code: string;
  seed: string;
}
export interface QuickShiftPlan {
  patrol: 'overpass' | 'switchyard';
  tactical: [CombatFlowRoom, CombatFlowRoom];
  variants: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2];
  mirrored: boolean;
  boss: 'loader' | 'crane' | 'press' | 'kiln';
  job: 'clean' | 'rush';
}
export interface QuickShiftRecord {
  version: 1;
  rules: QuickShiftRules;
  seed: string;
  gun: StartingGun;
  route: QuickShiftRoute;
  job: QuickShiftJobChoice;
  jobWon: boolean;
  outcome: 'won' | 'dead';
  /** Completed rooms, not the number of the room where the player died. */
  rooms: number;
  timeMs: number;
  hits: number;
  shots: number;
  kills: number;
  mods: string[];
}
const integer = (value: unknown, min: number, max: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Full seeds preserve their rules; an editable short code starts the current revision. */
export function quickShiftInput(value: string): QuickShiftChallenge | null {
  if (typeof value !== 'string' || value.length > 64) return null;
  const raw = value.trim();
  if (!/^[A-Za-z0-9-]+$/.test(raw)) return null;
  const input = raw.toUpperCase();
  const match = /^(?:RF-Q([12])-)?([A-Z0-9]{1,12})$/.exec(input);
  if (!match) return null;
  return quickShiftFromSeed(`RF-Q${match[1] ?? QUICK_SHIFT_RULES}-${match[2]}`);
}
export function quickShiftCode(value: string): string | null {
  return quickShiftInput(value)?.code ?? null;
}

/** Stored identities and links are canonical, unlike the editable seed field. */
export function quickShiftFromSeed(value: string): QuickShiftChallenge | null {
  if (typeof value !== 'string') return null;
  const match = /^RF-Q([12])-([A-Z0-9]{1,12})$/.exec(value);
  return match ? { rules: Number(match[1]) as QuickShiftRules, code: match[2], seed: value } : null;
}
export function validQuickShiftChallenge(value: unknown): value is QuickShiftChallenge {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const challenge = value as QuickShiftChallenge;
  const parsed = quickShiftFromSeed(challenge.seed);
  return (
    Object.keys(value).length === 3 &&
    Object.keys(value).every((key) => ['rules', 'code', 'seed'].includes(key)) &&
    !!parsed &&
    challenge.rules === parsed.rules &&
    parsed.code === challenge.code
  );
}

/** Real share links cannot opt into tests, Daily, Workshop or a second parser. */
export function quickShiftFromUrl(
  url: URL,
): { challenge: QuickShiftChallenge; gun: StartingGun } | null {
  const params = url.searchParams;
  let valid = !url.hash;
  params.forEach((_, key) => {
    if (!['quick', 'qv', 'gun'].includes(key) || params.getAll(key).length !== 1) valid = false;
  });
  const code = params.get('quick');
  const gun = params.get('gun') ?? 'pistol';
  if (
    !valid ||
    !SUPPORTED_QUICK_SHIFT_RULES.some((v) => String(v) === params.get('qv')) ||
    code === null ||
    !/^[A-Z0-9]{1,12}$/.test(code) ||
    !isStartingGun(gun)
  )
    return null;
  const challenge = quickShiftFromSeed('RF-Q' + params.get('qv') + '-' + code);
  return challenge ? { challenge, gun } : null;
}
export function quickShiftLink(
  challenge: QuickShiftChallenge,
  base: string,
  gun: StartingGun = 'pistol',
): string {
  if (!validQuickShiftChallenge(challenge) || !isStartingGun(gun))
    throw new Error('Choose a supported Quick Shift seed and earned tool.');
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('quick', challenge.code);
  url.searchParams.set('qv', String(challenge.rules));
  url.searchParams.set('gun', gun);
  return url.href;
}

/** Q1 retains native C108; Q2 owns the Seed Lock combat revision. */
export function quickShiftRuntimeSeed(challenge: QuickShiftChallenge): string {
  if (!validQuickShiftChallenge(challenge)) throw new Error('Unsupported Quick Shift seed.');
  return (challenge.rules === 1 ? 'RF-C108-Q' : 'RF-C111-Q') + challenge.code;
}
const tacticalRooms: readonly CombatFlowRoom[] = [
  'warm-exchange',
  'upper-return',
  'inspection-lane',
  'scrap-bridge',
];
export function planQuickShift(challenge: QuickShiftChallenge): QuickShiftPlan {
  const rng = seeded(quickShiftRuntimeSeed(challenge) + ':plan:1');
  const pool = [...tacticalRooms];
  const takeTactical = () => pool.splice(Math.floor(rng() * pool.length), 1)[0];
  const tactical: [CombatFlowRoom, CombatFlowRoom] = [takeTactical(), takeTactical()];
  const variant = () => Math.floor(rng() * 3) as 0 | 1 | 2;
  return {
    patrol: rng() < 0.5 ? 'overpass' : 'switchyard',
    tactical,
    variants: [variant(), variant(), variant(), variant()],
    mirrored: rng() < 0.5,
    boss: (['loader', 'crane', 'press', 'kiln'] as const)[Math.floor(rng() * 4)],
    job: rng() < 0.5 ? 'clean' : 'rush',
  };
}
export const isQuickShiftRoute = (value: unknown): value is QuickShiftRoute =>
  value === 'low' || value === 'high';
export const isQuickShiftJobChoice = (value: unknown): value is QuickShiftJobChoice =>
  value === 'accept' || value === 'skip';

function draftContext(challenge: QuickShiftChallenge, completed: number, gun: StartingGun) {
  return {
    stage: QUICK_SHIFT_DRAFT_STAGES[completed],
    seed: quickShiftRuntimeSeed(challenge),
    startingGun: gun,
    unlocks: [],
  };
}
function standardId(id: string) {
  return !LONGEVITY_IDS.some((locked) => locked === id);
}
/** A fixed standard pool preserves earned fitting licenses on every profile. */
export function quickShiftLegalMods(
  challenge: QuickShiftChallenge,
  mods: readonly string[],
  completed: number,
  gun: StartingGun = 'pistol',
): Mod[] {
  if (
    !validQuickShiftChallenge(challenge) ||
    !integer(completed, 0, 4) ||
    !isStartingGun(gun) ||
    !validQuickShiftBuild(mods)
  )
    return [];
  return rewardMods(
    mods,
    MODS.length,
    seeded(challenge.seed + ':legal:' + completed),
    draftContext(challenge, completed, gun),
    LONGEVITY_IDS,
  );
}
/** Three initial picks, then two picks after each of the first four clears. */
export function quickShiftOffers(
  challenge: QuickShiftChallenge,
  mods: readonly string[],
  completed: number,
  gun: StartingGun = 'pistol',
  pick = 0,
): string[] {
  if (
    !validQuickShiftChallenge(challenge) ||
    !integer(completed, 0, 4) ||
    !integer(pick, 0, completed === 0 ? 2 : 1) ||
    !isStartingGun(gun) ||
    !validQuickShiftBuild(mods) ||
    mods.length !== (completed === 0 ? pick : 3 + 2 * (completed - 1) + pick)
  )
    return [];
  const legal = quickShiftLegalMods(challenge, mods, completed, gun);
  const excluded = MODS.filter((mod) => !legal.some((candidate) => candidate.id === mod.id)).map(
    (mod) => mod.id,
  );
  return rewardMods(
    mods,
    3,
    seeded(challenge.seed + ':draft:' + gun + ':' + completed + ':' + pick + ':' + mods.join(',')),
    draftContext(challenge, completed, gun),
    excluded,
  ).map((mod) => mod.id);
}
// Records often repeat the same build. Cache only bounded boolean results,
// keyed by copied string values, never caller-owned arrays or live gun state.
const buildValidation = new Map<string, boolean>();
const BUILD_VALIDATION_LIMIT = 256;
function rememberBuild(key: string, valid: boolean) {
  if (buildValidation.size >= BUILD_VALIDATION_LIMIT)
    buildValidation.delete(buildValidation.keys().next().value!);
  buildValidation.set(key, valid);
  return valid;
}
/** Acquisition order matters: no child fitting can manufacture its parent. */
export function validQuickShiftBuild(value: unknown): value is string[] {
  if (
    !Array.isArray(value) ||
    value.length > QUICK_SHIFT_MAX_MODS ||
    value.some((id) => typeof id !== 'string' || !standardId(id)) ||
    !validBuild(value)
  )
    return false;
  const key = value.join(',');
  const cached = buildValidation.get(key);
  if (cached !== undefined) return cached;
  const acquired: string[] = [];
  for (const id of value) {
    const completed = acquired.length < 3 ? 0 : 1 + Math.floor((acquired.length - 3) / 2);
    const legal = rewardMods(
      acquired,
      MODS.length,
      seeded('QUICK-SHIFT-BUILD-1'),
      { stage: QUICK_SHIFT_DRAFT_STAGES[completed], seed: 'RF-C108-QVALIDATE', unlocks: [] },
      LONGEVITY_IDS,
    );
    if (!legal.some((mod) => mod.id === id)) return rememberBuild(key, false);
    acquired.push(id);
  }
  return rememberBuild(key, true);
}
export function quickShiftRecordKey(
  record: Pick<QuickShiftRecord, 'seed' | 'gun' | 'route' | 'job'>,
): string {
  return JSON.stringify([
    quickShiftFromSeed(record.seed)?.rules ?? QUICK_SHIFT_RULES,
    record.seed,
    record.gun,
    record.route,
    record.job,
  ]);
}
export function validQuickShiftRecord(value: unknown): value is QuickShiftRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as QuickShiftRecord;
  const keys = [
    'version',
    'rules',
    'seed',
    'gun',
    'route',
    'job',
    'jobWon',
    'outcome',
    'rooms',
    'timeMs',
    'hits',
    'shots',
    'kills',
    'mods',
  ];
  return (
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key)) &&
    record.version === 1 &&
    !!quickShiftFromSeed(record.seed) &&
    record.rules === quickShiftFromSeed(record.seed)?.rules &&
    isStartingGun(record.gun) &&
    isQuickShiftRoute(record.route) &&
    isQuickShiftJobChoice(record.job) &&
    typeof record.jobWon === 'boolean' &&
    (!record.jobWon || (record.job === 'accept' && record.rooms >= 4)) &&
    (record.outcome === 'won' || record.outcome === 'dead') &&
    integer(record.rooms, 0, QUICK_SHIFT_ROOMS) &&
    (record.outcome === 'won' ? record.rooms === 5 : record.rooms < 5) &&
    integer(record.timeMs, record.outcome === 'won' ? 1 : 0, 86400000) &&
    integer(record.hits, 0, 100000) &&
    integer(record.shots, 0, 1000000) &&
    integer(record.kills, 0, 100000) &&
    validQuickShiftBuild(record.mods) &&
    record.mods.length === 3 + 2 * Math.min(record.rooms, 4)
  );
}
function better(a: QuickShiftRecord, b: QuickShiftRecord) {
  return (
    a.timeMs < b.timeMs ||
    (a.timeMs === b.timeMs && (a.hits < b.hits || (a.hits === b.hits && a.shots < b.shots)))
  );
}
/** One best clear and one latest failure per seed/tool/path, at most 40 entries. */
export function loadQuickShiftRecords(value: unknown): QuickShiftRecord[] {
  if (!Array.isArray(value)) return [];
  const records: QuickShiftRecord[] = [];
  for (const record of value.slice(0, QUICK_SHIFT_RECORD_LIMIT * 4)) {
    if (!validQuickShiftRecord(record)) continue;
    const key = quickShiftRecordKey(record);
    const index = records.findIndex(
      (candidate) => quickShiftRecordKey(candidate) === key && candidate.outcome === record.outcome,
    );
    if (index >= 0) {
      if (record.outcome === 'won' && better(record, records[index]))
        records[index] = structuredClone(record);
      continue;
    }
    if (records.length < QUICK_SHIFT_RECORD_LIMIT) records.push(structuredClone(record));
  }
  return records;
}
export function validQuickShiftRecords(value: unknown): value is QuickShiftRecord[] {
  if (!Array.isArray(value) || value.length > QUICK_SHIFT_RECORD_LIMIT) return false;
  const seen = new Set<string>();
  return value.every((record) => {
    if (!validQuickShiftRecord(record)) return false;
    const key = quickShiftRecordKey(record) + ':' + record.outcome;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function quickShiftBest(
  value: unknown,
  seed: string,
  gun: StartingGun,
  route: QuickShiftRoute = 'low',
  job: QuickShiftJobChoice = 'skip',
): QuickShiftRecord | null {
  if (
    !quickShiftFromSeed(seed) ||
    !isStartingGun(gun) ||
    !isQuickShiftRoute(route) ||
    !isQuickShiftJobChoice(job)
  )
    return null;
  const key = quickShiftRecordKey({ seed, gun, route, job });
  return (
    loadQuickShiftRecords(value).find(
      (record) => record.outcome === 'won' && quickShiftRecordKey(record) === key,
    ) ?? null
  );
}
export function recordQuickShift(value: unknown, record: QuickShiftRecord) {
  if (!validQuickShiftRecord(record)) throw new Error('Invalid Quick Shift result.');
  const records = loadQuickShiftRecords(value);
  const previous = quickShiftBest(records, record.seed, record.gun, record.route, record.job);
  const newBest = record.outcome === 'won' && (!previous || better(record, previous));
  const key = quickShiftRecordKey(record);
  const next =
    record.outcome === 'dead' || newBest
      ? [
          structuredClone(record),
          ...records.filter(
            (candidate) =>
              candidate.outcome !== record.outcome || quickShiftRecordKey(candidate) !== key,
          ),
        ].slice(0, QUICK_SHIFT_RECORD_LIMIT)
      : records;
  return {
    records: next,
    newBest,
    best: quickShiftBest(next, record.seed, record.gun, record.route, record.job),
  };
}
