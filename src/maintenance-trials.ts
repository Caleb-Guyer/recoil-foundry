import type { Game } from './game.ts';
import type { Checkpoint } from './rules.ts';
import type { MaintenanceKind } from './maintenance.ts';

export const SHAFT_PROFILE_KEY = 'rf-maintenance-trials-v1';
// Layout revision and physics rules are separate parts of a record's identity.
export const TRIAL_RULES = 1;
export const TRIAL_LIMIT = 100;
export interface TrialRoute {
  kind: MaintenanceKind;
  seed: string;
  revision: 1 | 2;
  rules: number;
}
export interface ShaftUnlock {
  kind: MaintenanceKind;
  seed: string;
  revision: 1 | 2;
  clean: boolean;
}
export interface TrialScore {
  timeMs: number;
  shots: number;
  hits: number;
  finishedAt: number;
}
export interface TrialRecord extends TrialRoute {
  fastest: TrialScore;
  efficient: TrialScore;
}
export interface TrialChallenge extends TrialRoute {
  timeMs: number;
  shots: number;
}
export interface ShaftProfile {
  unlocks: ShaftUnlock[];
  records: TrialRecord[];
}
export interface TrialSession {
  route: TrialRoute;
  preview: boolean;
  hits: number;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: string[]) =>
  Object.keys(v).length === names.length && names.every((k) => Object.hasOwn(v, k));
const integer = (v: unknown, min: number, max: number): v is number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const kind = (v: unknown): v is MaintenanceKind => v === 'piston' || v === 'lift';
const seed = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length > 0 &&
  v.length <= 40 &&
  !/[\u0000-\u001f\u007f-\u009f]/.test(v) &&
  !/^RF-D\d+-/.test(v);
function unmixed(p: URLSearchParams, allowed: string[]) {
  let valid = true;
  p.forEach((_, key) => {
    if (!allowed.includes(key) || p.getAll(key).length !== 1) valid = false;
  });
  return valid;
}
function identity(v: Record<string, unknown>) {
  return (
    kind(v.kind) &&
    seed(v.seed) &&
    (v.revision === 1 || v.revision === 2) &&
    integer(v.rules, 1, 1000000)
  );
}
export function validTrialRoute(v: unknown): v is TrialRoute {
  return object(v) && keys(v, ['kind', 'seed', 'revision', 'rules']) && identity(v);
}
function validUnlock(v: unknown): v is ShaftUnlock {
  return (
    object(v) &&
    keys(v, ['kind', 'seed', 'revision', 'clean']) &&
    kind(v.kind) &&
    seed(v.seed) &&
    (v.revision === 1 || v.revision === 2) &&
    typeof v.clean === 'boolean'
  );
}
function score(v: unknown): v is TrialScore {
  return (
    object(v) &&
    keys(v, ['timeMs', 'shots', 'hits', 'finishedAt']) &&
    integer(v.timeMs, 1, 86400000) &&
    integer(v.shots, 0, 1000000) &&
    integer(v.hits, 0, 100000) &&
    integer(v.finishedAt, 0, 8.64e15)
  );
}
function record(v: unknown): v is TrialRecord {
  return (
    object(v) &&
    keys(v, ['kind', 'seed', 'revision', 'rules', 'fastest', 'efficient']) &&
    identity(v) &&
    score(v.fastest) &&
    score(v.efficient) &&
    v.fastest.timeMs <= v.efficient.timeMs &&
    v.efficient.shots <= v.fastest.shots
  );
}
export function trialKey(v: TrialRoute) {
  return JSON.stringify([v.kind, v.seed, v.revision, v.rules]);
}
export function loadShaftProfile(raw: unknown): ShaftProfile {
  if (!object(raw)) return { unlocks: [], records: [] };
  const unlocks: ShaftUnlock[] = [],
    records: TrialRecord[] = [];
  if (Array.isArray(raw.unlocks))
    for (const v of raw.unlocks.slice(0, 2))
      if (validUnlock(v) && !unlocks.some((u) => u.kind === v.kind)) unlocks.push({ ...v });
  if (Array.isArray(raw.records))
    for (const v of raw.records.slice(0, TRIAL_LIMIT))
      if (
        record(v) &&
        unlocks.some((u) => u.kind === v.kind) &&
        !records.some((r) => trialKey(r) === trialKey(v))
      )
        records.push(structuredClone(v));
  return { unlocks, records };
}
export function validShaftProfile(raw: unknown): raw is ShaftProfile {
  if (
    !object(raw) ||
    !keys(raw, ['unlocks', 'records']) ||
    !Array.isArray(raw.unlocks) ||
    !Array.isArray(raw.records) ||
    raw.unlocks.length > 2 ||
    raw.records.length > TRIAL_LIMIT
  )
    return false;
  const clean = loadShaftProfile(raw);
  return clean.unlocks.length === raw.unlocks.length && clean.records.length === raw.records.length;
}
export function recordShaftClear(raw: unknown, clear: ShaftUnlock): ShaftProfile {
  if (!validUnlock(clear)) throw new Error('Invalid shaft completion.');
  const profile = loadShaftProfile(raw),
    previous = profile.unlocks.find((u) => u.kind === clear.kind);
  if (previous) previous.clean ||= clear.clean;
  else profile.unlocks.push({ ...clear });
  return profile;
}
export function maintenanceCertified(profile: ShaftProfile) {
  return ['piston', 'lift'].every((k) => profile.unlocks.some((u) => u.kind === k && u.clean));
}
export function trialAccess(route: TrialRoute, raw: unknown) {
  return (
    validTrialRoute(route) &&
    route.rules === TRIAL_RULES &&
    loadShaftProfile(raw).unlocks.some((u) => u.kind === route.kind)
  );
}
export function trialCheckpoint(route: TrialRoute): Checkpoint | null {
  if (!validTrialRoute(route) || route.rules !== TRIAL_RULES) return null;
  return {
    version: 6,
    seed: route.seed,
    stage: 2,
    hp: 100,
    mods: [],
    missedUpgrades: 3,
    kills: 0,
    elapsed: 0,
    detour: true,
    maintenance: { stage: 2, kind: route.kind, ...(route.revision === 2 ? { revision: 2 } : {}) },
  };
}
export function snapshotTrial(
  game: Game,
  raw: unknown,
  now = Date.now(),
): { route: TrialRoute; score: TrialScore } | null {
  const session = game.maintenance.trial;
  if (
    !session ||
    session.preview ||
    !trialAccess(session.route, raw) ||
    game.mode !== 'won' ||
    !game.clear ||
    !game.maintenance.active ||
    !game.maintenance.atExit ||
    game.hp <= 0 ||
    game.mods.length ||
    game.practice ||
    game.workshop.active ||
    !game.testRun ||
    game.seed !== session.route.seed ||
    game.level.maintenance !== session.route.kind ||
    (game.maintenance.state?.revision ?? 1) !== session.route.revision
  )
    return null;
  const result = {
    timeMs: Math.max(1, Math.round(game.elapsed * 100) * 10),
    shots: game.shotCount,
    hits: session.hits,
    finishedAt: now,
  };
  return score(result) ? { route: { ...session.route }, score: result } : null;
}
export function recordTrial(raw: unknown, route: TrialRoute, result: TrialScore) {
  if (!trialAccess(route, raw) || !score(result)) throw new Error('Invalid trial result.');
  const profile = loadShaftProfile(raw),
    key = trialKey(route),
    previous = profile.records.find((r) => trialKey(r) === key);
  const faster =
    !previous ||
    result.timeMs < previous.fastest.timeMs ||
    (result.timeMs === previous.fastest.timeMs && result.shots < previous.fastest.shots);
  const efficient =
    !previous ||
    result.shots < previous.efficient.shots ||
    (result.shots === previous.efficient.shots && result.timeMs < previous.efficient.timeMs);
  const next = {
    ...route,
    fastest: { ...(faster ? result : previous!.fastest) },
    efficient: { ...(efficient ? result : previous!.efficient) },
  };
  profile.records = [...profile.records.filter((r) => trialKey(r) !== key), next]
    .sort(
      (a, b) =>
        Math.max(b.fastest.finishedAt, b.efficient.finishedAt) -
        Math.max(a.fastest.finishedAt, a.efficient.finishedAt),
    )
    .slice(0, TRIAL_LIMIT);
  if (result.hits === 0) profile.unlocks.find((u) => u.kind === route.kind)!.clean = true;
  return { profile, record: next, faster, efficient, first: !previous };
}
export function trialChallenge(
  route: TrialRoute,
  score: Pick<TrialScore, 'timeMs' | 'shots'>,
): TrialChallenge {
  return {
    kind: route.kind,
    seed: route.seed,
    revision: route.revision,
    rules: route.rules,
    timeMs: score.timeMs,
    shots: score.shots,
  };
}
export function trialLink(
  challenge: TrialChallenge,
  base = 'https://caleb-guyer.github.io/recoil-foundry/',
) {
  const data = [
    challenge.kind,
    challenge.seed,
    challenge.revision,
    challenge.rules,
    challenge.timeMs,
    challenge.shots,
  ];
  const code =
    'MTC1.' +
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(data))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  parseTrialChallenge(code);
  const url = new URL(base);
  if (url.hostname.endsWith('.itch.zone') || url.hostname.endsWith('.itch.io'))
    return trialLink(challenge);
  url.search = '';
  url.hash = '';
  url.searchParams.set('shaft', code);
  return url.href;
}
export function parseTrialChallenge(text: string): TrialChallenge {
  if (text.length > 2048) throw new Error('This challenge link is too long.');
  let code = text.trim();
  if (/^https?:\/\//.test(code)) {
    const url = new URL(code);
    if (!unmixed(url.searchParams, ['shaft', 'v']) || url.hash)
      throw new Error('Use an unmixed Maintenance Trial link.');
    code = url.searchParams.get('shaft') ?? '';
  }
  try {
    if (!/^MTC1\.[A-Za-z0-9_-]+$/.test(code)) throw new Error();
    const binary = atob(code.slice(5).replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        Uint8Array.from(binary, (c) => c.charCodeAt(0)),
      ),
    );
    if (!Array.isArray(data) || data.length !== 6) throw new Error();
    const [kind, seed, revision, rules, timeMs, shots] = data;
    const route = { kind, seed, revision, rules };
    if (!validTrialRoute(route) || !integer(timeMs, 1, 86400000) || !integer(shots, 0, 1000000))
      throw new Error();
    return { ...route, timeMs, shots };
  } catch {
    throw new Error('Enter a valid Maintenance Trial link or MTC1 code.');
  }
}
export function trialFromUrl(
  url: URL,
): { route: TrialRoute; challenge?: TrialChallenge; preview: boolean } | null {
  if (url.searchParams.has('shaft')) {
    try {
      const challenge = parseTrialChallenge(url.href);
      return {
        route: {
          kind: challenge.kind,
          seed: challenge.seed,
          revision: challenge.revision,
          rules: challenge.rules,
        },
        challenge,
        preview: false,
      };
    } catch {
      return null;
    }
  }
  const p = url.searchParams;
  if (
    p.get('test') !== 'maintenance-trial' ||
    !unmixed(p, ['test', 'layout', 'variant', 'v']) ||
    url.hash
  )
    return null;
  const layout = p.get('layout') ?? 'piston',
    variant = p.get('variant') ?? '3';
  if (!kind(layout) || !/^[1-9]\d{0,2}$/.test(variant)) return null;
  return {
    route: {
      kind: layout,
      seed: 'MAINTENANCE-' + layout + '-' + variant,
      revision: 2,
      rules: TRIAL_RULES,
    },
    preview: true,
  };
}
