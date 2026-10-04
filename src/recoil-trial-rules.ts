import { seeded, validBuild, type Checkpoint } from './rules.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';

export const RECOIL_TRIALS_KEY = 'rf-recoil-trials-v1';
export const RECOIL_TRIALS = {
  launch: {
    name: 'Launch shaft',
    instruction: 'Fire down to climb. Reach each lit landing.',
    mastery: 35000,
    commendation: 'launch-certified',
  },
  cargo: {
    name: 'Cargo crossing',
    instruction:
      'Land on each moving load, then reach the far dock. The floor returns you to the start.',
    mastery: 30000,
    commendation: 'cargo-certified',
  },
  airborne: {
    name: 'Airborne targets',
    instruction:
      'Break all three targets in one flight, then land at the exit. Landing early resets them.',
    mastery: 12000,
    commendation: 'flight-certified',
  },
} as const;
export type RecoilTrialKind = keyof typeof RECOIL_TRIALS;
export interface RecoilTrialSave {
  kind: RecoilTrialKind;
  stage: 6 | 18;
  rules: 1;
  spent?: number;
  shots?: number;
  clean?: boolean;
}
export interface RecoilTrialResult {
  kind: RecoilTrialKind;
  gun: StartingGun;
  mods: string[];
  timeMs: number;
  shots: number;
  clean: boolean;
}
export interface RecoilTrialProfile {
  clears: RecoilTrialKind[];
  mastered: RecoilTrialKind[];
  records: RecoilTrialResult[];
}
export const isRecoilTrial = (v: unknown): v is RecoilTrialKind =>
  typeof v === 'string' && Object.hasOwn(RECOIL_TRIALS, v);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, max: number) =>
  Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;
export function planRecoilTrial(seed: string, maintenanceStage?: number): RecoilTrialSave | null {
  if (/^RF-D\d+-/.test(seed)) return null;
  const rng = seeded(seed + ':recoil-trial:1');
  const stages = ([6, 18] as const).filter((stage) => stage !== maintenanceStage);
  return {
    kind: (Object.keys(RECOIL_TRIALS) as RecoilTrialKind[])[Math.floor(rng() * 3)],
    stage: stages[Math.floor(rng() * stages.length)],
    rules: 1,
  };
}
export function validRecoilTrialSave(d: Checkpoint) {
  const s = d.recoilTrial;
  return (
    s === undefined ||
    (object(s) &&
      d.version === 6 &&
      !/^RF-D\d+-/.test(d.seed) &&
      isRecoilTrial(s.kind) &&
      (s.stage === 6 || s.stage === 18) &&
      s.rules === 1 &&
      d.maintenance?.stage !== s.stage &&
      (s.spent === undefined || integer(s.spent, 86400000)) &&
      (s.shots === undefined || integer(s.shots, 1000000)) &&
      (s.clean === undefined || typeof s.clean === 'boolean') &&
      Object.keys(s).every((k) =>
        ['kind', 'stage', 'rules', 'spent', 'shots', 'clean'].includes(k),
      ))
  );
}
export function recoilRecordKey(r: Pick<RecoilTrialResult, 'kind' | 'gun' | 'mods'>) {
  return JSON.stringify([r.kind, r.gun, [...r.mods].sort()]);
}
export function validRecoilResult(r: unknown): r is RecoilTrialResult {
  return (
    object(r) &&
    Object.keys(r).length === 6 &&
    isRecoilTrial(r.kind) &&
    isStartingGun(r.gun) &&
    Array.isArray(r.mods) &&
    validBuild(r.mods) &&
    integer(r.timeMs, 86400000) &&
    (r.timeMs as number) > 0 &&
    integer(r.shots, 1000000) &&
    typeof r.clean === 'boolean'
  );
}
export function loadRecoilProfile(raw: unknown): RecoilTrialProfile {
  const p = object(raw) ? raw : {};
  const clears = (Object.keys(RECOIL_TRIALS) as RecoilTrialKind[]).filter(
    (k) => Array.isArray(p.clears) && p.clears.includes(k),
  );
  const mastered = clears.filter((k) => Array.isArray(p.mastered) && p.mastered.includes(k));
  const records: RecoilTrialResult[] = [];
  if (Array.isArray(p.records))
    for (const r of p.records.slice(0, 100)) {
      if (
        validRecoilResult(r) &&
        clears.includes(r.kind) &&
        !records.some((old) => recoilRecordKey(old) === recoilRecordKey(r))
      )
        records.push(structuredClone(r));
    }
  return { clears, mastered, records };
}
export function validRecoilProfile(raw: unknown) {
  if (
    !object(raw) ||
    Object.keys(raw).length !== 3 ||
    !Array.isArray(raw.clears) ||
    !Array.isArray(raw.mastered) ||
    !Array.isArray(raw.records) ||
    raw.records.length > 100
  )
    return false;
  const p = loadRecoilProfile(raw);
  return (
    p.clears.length === raw.clears.length &&
    p.mastered.length === raw.mastered.length &&
    p.records.length === raw.records.length
  );
}
export function recordRecoilTrial(raw: unknown, result: RecoilTrialResult) {
  if (!validRecoilResult(result)) throw new Error('Invalid recoil trial completion.');
  const profile = loadRecoilProfile(raw);
  if (!profile.clears.includes(result.kind)) profile.clears.push(result.kind);
  const mastered = result.clean && result.timeMs <= RECOIL_TRIALS[result.kind].mastery;
  const newMastery = mastered && !profile.mastered.includes(result.kind);
  if (newMastery) profile.mastered.push(result.kind);
  const key = recoilRecordKey(result),
    index = profile.records.findIndex((r) => recoilRecordKey(r) === key);
  const best =
    index < 0 ||
    result.timeMs < profile.records[index].timeMs ||
    (result.timeMs === profile.records[index].timeMs &&
      result.shots < profile.records[index].shots);
  if (best) {
    if (index >= 0) profile.records.splice(index, 1);
    profile.records.unshift(structuredClone(result));
    profile.records = profile.records.slice(0, 100);
  }
  return { profile: loadRecoilProfile(profile), best, newMastery };
}
export function recoilTrialCheckpoint(
  kind: RecoilTrialKind,
  gun: StartingGun = 'pistol',
): Checkpoint {
  return {
    version: 6,
    seed: 'RECOIL-TRIAL-' + kind.toUpperCase(),
    stage: 6,
    mods: [],
    missedUpgrades: 7,
    hp: 100,
    kills: 0,
    elapsed: 0,
    detour: true,
    startingGun: gun,
    recoilTrial: { kind, stage: 6, rules: 1 },
  };
}
export function recoilTrialFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'recoil-trial' || !isRecoilTrial(p.get('course'))) return null;
  let valid = true;
  p.forEach((_, k) => {
    if (!['test', 'course', 'gun', 'v'].includes(k) || p.getAll(k).length !== 1) valid = false;
  });
  const gun = p.get('gun') ?? 'pistol';
  if (!valid || !isStartingGun(gun) || (p.has('v') && p.get('v') !== '1')) return null;
  return recoilTrialCheckpoint(p.get('course') as RecoilTrialKind, gun);
}
