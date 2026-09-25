import type { Game } from './game.ts';
import { validBlueprintMods } from './blueprints.ts';
import { loadEncounters, practiceCheckpoint, PRACTICE_BOSSES, type Encounter } from './practice.ts';

export const PRACTICE_RECORDS_KEY = 'rf-practice-records-v1';
// Bump whenever physics, boss AI, arenas, presets or upgrade balance changes.
// Previous records remain readable, but never compete with a new ruleset.
export const PRACTICE_RULESET = 1;
export const PRACTICE_RECORD_LIMIT = 200;
export const CHALLENGE_CODE_LIMIT = 8192;
export interface PracticeBuild extends Encounter {
  rules: number;
  mods: string[];
}
export interface PracticeScore {
  timeMs: number;
  hits: number;
  finishedAt: number;
}
export interface PracticeRecord extends PracticeBuild {
  fastest: PracticeScore;
  cleanest: PracticeScore;
}
export interface PracticeChallenge extends PracticeBuild {
  timeMs: number;
  hits: number;
}
export interface PracticeWin extends PracticeBuild, PracticeScore {}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: string[]) =>
  Object.keys(value).length === expected.length &&
  expected.every((key) => Object.hasOwn(value, key));
const integer = (n: unknown, min: number, max: number): n is number =>
  Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
function validIdentity(value: Record<string, unknown>): boolean {
  if (
    !integer(value.rules, 1, 1000000) ||
    typeof value.kind !== 'string' ||
    !Object.hasOwn(PRACTICE_BOSSES, value.kind) ||
    typeof value.seed !== 'string' ||
    !value.seed.length ||
    value.seed.length > 40 ||
    /[\u0000-\u001f\u007f-\u009f]/.test(value.seed) ||
    !Array.isArray(value.mods) ||
    value.mods.length > PRACTICE_BOSSES[value.kind as Encounter['kind']].stage ||
    value.mods.some((id) => typeof id !== 'string' || !/^[a-z0-9-]{1,48}$/.test(id)) ||
    new Set(value.mods).size !== value.mods.length
  )
    return false;
  // Old balance rules may contain retired upgrades or changed arena selection.
  return (
    value.rules !== PRACTICE_RULESET ||
    (validBlueprintMods(value.mods) && loadEncounters([value]).length === 1)
  );
}
function validScore(value: unknown): value is PracticeScore {
  return (
    object(value) &&
    keys(value, ['timeMs', 'hits', 'finishedAt']) &&
    integer(value.timeMs, 1, 86400000) &&
    integer(value.hits, 0, 100000) &&
    integer(value.finishedAt, 0, 8.64e15)
  );
}
export function validPracticeRecord(value: unknown): value is PracticeRecord {
  return (
    object(value) &&
    keys(value, ['rules', 'kind', 'seed', 'mods', 'fastest', 'cleanest']) &&
    validIdentity(value) &&
    validScore(value.fastest) &&
    validScore(value.cleanest) &&
    value.fastest.timeMs <= value.cleanest.timeMs &&
    value.cleanest.hits <= value.fastest.hits
  );
}
export function practiceBuildKey(build: PracticeBuild): string {
  return JSON.stringify([build.rules, build.kind, build.seed, build.mods]);
}
export function loadPracticeRecords(value: unknown): PracticeRecord[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .slice(0, PRACTICE_RECORD_LIMIT)
    .filter((item): item is PracticeRecord => {
      if (!validPracticeRecord(item)) return false;
      const key = practiceBuildKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => structuredClone(item));
}
export function validPracticeRecords(value: unknown): value is PracticeRecord[] {
  return (
    Array.isArray(value) &&
    value.length <= PRACTICE_RECORD_LIMIT &&
    loadPracticeRecords(value).length === value.length
  );
}
export function snapshotPracticeWin(
  game: Game,
  eligible: boolean,
  now = Date.now(),
): PracticeWin | null {
  if (
    !eligible ||
    !game.practice ||
    game.testRun ||
    game.workshop.active ||
    game.mode !== 'won' ||
    !game.clear ||
    game.hp <= 0 ||
    game.combatEnemyCount ||
    game.seed !== game.practice.seed ||
    game.stage !== PRACTICE_BOSSES[game.practice.kind].stage
  )
    return null;
  const expected = practiceCheckpoint(game.practice, game.practice.build ?? null, game.mods);
  if (!expected || JSON.stringify(expected.mods) !== JSON.stringify(game.mods)) return null;
  const win: PracticeWin = {
    rules: PRACTICE_RULESET,
    kind: game.practice.kind,
    seed: game.seed,
    mods: [...game.mods],
    timeMs: Math.round(game.elapsed * 100) * 10,
    hits: game.practiceHits,
    finishedAt: now,
  };
  return validPracticeRecord({
    rules: win.rules,
    kind: win.kind,
    seed: win.seed,
    mods: win.mods,
    fastest: { timeMs: win.timeMs, hits: win.hits, finishedAt: now },
    cleanest: { timeMs: win.timeMs, hits: win.hits, finishedAt: now },
  })
    ? win
    : null;
}
export function recordPracticeWin(value: unknown, win: PracticeWin) {
  const identity = { rules: win.rules, kind: win.kind, seed: win.seed, mods: [...win.mods] };
  const score = { timeMs: win.timeMs, hits: win.hits, finishedAt: win.finishedAt };
  const fresh = { ...identity, fastest: score, cleanest: score };
  if (win.rules !== PRACTICE_RULESET || !validPracticeRecord(fresh))
    throw new Error('Invalid practice result.');
  const records = loadPracticeRecords(value),
    key = practiceBuildKey(identity);
  const previous = records.find((item) => practiceBuildKey(item) === key);
  const newFastest =
    !previous ||
    score.timeMs < previous.fastest.timeMs ||
    (score.timeMs === previous.fastest.timeMs && score.hits < previous.fastest.hits);
  const newCleanest =
    !previous ||
    score.hits < previous.cleanest.hits ||
    (score.hits === previous.cleanest.hits && score.timeMs < previous.cleanest.timeMs);
  const record = structuredClone({
    ...identity,
    fastest: { ...(newFastest ? score : previous!.fastest) },
    cleanest: { ...(newCleanest ? score : previous!.cleanest) },
  });
  const next = [...records.filter((item) => practiceBuildKey(item) !== key), record]
    .sort(
      (a, b) =>
        Math.max(b.fastest.finishedAt, b.cleanest.finishedAt) -
        Math.max(a.fastest.finishedAt, a.cleanest.finishedAt),
    )
    .slice(0, PRACTICE_RECORD_LIMIT);
  return { records: next, record, newFastest, newCleanest, first: !previous };
}
export function challengeFromRecord(record: PracticeRecord): PracticeChallenge {
  return {
    rules: record.rules,
    kind: record.kind,
    seed: record.seed,
    mods: [...record.mods],
    timeMs: record.fastest.timeMs,
    hits: record.fastest.hits,
  };
}
export function validPracticeChallenge(value: unknown): value is PracticeChallenge {
  return (
    object(value) &&
    keys(value, ['rules', 'kind', 'seed', 'mods', 'timeMs', 'hits']) &&
    validIdentity(value) &&
    integer(value.timeMs, 1, 86400000) &&
    integer(value.hits, 0, 100000)
  );
}
export function challengeCode(challenge: PracticeChallenge): string {
  if (!validPracticeChallenge(challenge)) throw new Error('This challenge is not supported.');
  const bytes = new TextEncoder().encode(
    JSON.stringify([
      challenge.rules,
      challenge.kind,
      challenge.seed,
      challenge.mods,
      challenge.timeMs,
      challenge.hits,
    ]),
  );
  return (
    'RFC1.' +
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  );
}
export function parseChallengeCode(text: string): PracticeChallenge {
  const code = text.trim();
  if (code.length > CHALLENGE_CODE_LIMIT || !/^RFC1\.[A-Za-z0-9_-]+$/.test(code))
    throw new Error('Enter a valid RFC1 challenge code.');
  try {
    const binary = atob(code.slice(5).replace(/-/g, '+').replace(/_/g, '/'));
    const data: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        Uint8Array.from(binary, (c) => c.charCodeAt(0)),
      ),
    );
    if (!Array.isArray(data) || data.length !== 6) throw new Error();
    const challenge = {
      rules: data[0],
      kind: data[1],
      seed: data[2],
      mods: data[3],
      timeMs: data[4],
      hits: data[5],
    };
    if (!validPracticeChallenge(challenge) || challengeCode(challenge) !== code) throw new Error();
    return challenge;
  } catch {
    throw new Error('This challenge code is damaged or unsupported.');
  }
}
export function challengeAccess(
  challenge: PracticeChallenge,
  victories: readonly Encounter[],
  known: readonly string[],
) {
  const earned = victories.some((item) => item.kind === challenge.kind);
  const current = challenge.rules === PRACTICE_RULESET;
  const missing = challenge.mods.filter((id) => !known.includes(id)).length;
  return {
    earned,
    current,
    missing,
    allowed: earned && current && !missing && validPracticeChallenge(challenge),
  };
}
export function practiceTime(ms: number): string {
  const total = Math.round(ms / 10);
  return (
    Math.floor(total / 6000) +
    ':' +
    String(Math.floor(total / 100) % 60).padStart(2, '0') +
    '.' +
    String(total % 100).padStart(2, '0')
  );
}
