import { isRecoilTrial, loadRecoilProfile, type RecoilTrialKind } from './recoil-trial-rules.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';
import { trialEntry, trialExit } from './recoil-trial-layouts.ts';

export const RECOIL_GHOSTS_KEY = 'rf-recoil-ghosts-v1';
export const RECOIL_RACE_RULES = 1;
export const GHOST_DURATION = 180000;
export const GHOST_FRAME_LIMIT = 2048;
export const RECOIL_CODE_LIMIT = 512;
export const RECOIL_SPLITS = { launch: 6, cargo: 5, airborne: 3 } as const;
// Simulation milliseconds, world position, aim in degrees, airborne/left/firing/reset bits.
export type GhostFrame = [number, number, number, number, number];
export interface RecoilChallenge {
  rules: number;
  kind: RecoilTrialKind;
  gun: StartingGun;
  timeMs: number;
  shots: number;
  splits: number[];
}
export interface RecoilGhost extends RecoilChallenge {
  frames: GhostFrame[];
}
export interface StoredRecoilGhost extends RecoilChallenge {
  frames: string;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: string[]) =>
  Object.keys(v).length === names.length && names.every((name) => Object.hasOwn(v, name));
const integer = (v: unknown, min: number, max: number): v is number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function identity(v: Record<string, unknown>) {
  return (
    v.rules === RECOIL_RACE_RULES &&
    isRecoilTrial(v.kind) &&
    isStartingGun(v.gun) &&
    integer(v.timeMs, 1, 86400000) &&
    integer(v.shots, 0, 1000000) &&
    Array.isArray(v.splits) &&
    v.splits.length === RECOIL_SPLITS[v.kind] &&
    v.splits.every((ms, i, all) => integer(ms, 0, v.timeMs as number) && (!i || ms >= all[i - 1]))
  );
}
export function validRecoilChallenge(v: unknown): v is RecoilChallenge {
  return object(v) && keys(v, ['rules', 'kind', 'gun', 'timeMs', 'shots', 'splits']) && identity(v);
}
export function validRecoilGhost(v: unknown): v is RecoilGhost {
  if (
    !object(v) ||
    !keys(v, ['rules', 'kind', 'gun', 'timeMs', 'shots', 'splits', 'frames']) ||
    !identity(v) ||
    !integer(v.timeMs, 1, GHOST_DURATION) ||
    !Array.isArray(v.frames) ||
    v.frames.length < 2 ||
    v.frames.length > GHOST_FRAME_LIMIT
  )
    return false;
  const frames = v.frames as unknown[];
  if (
    !frames.every(
      (f, i) =>
        Array.isArray(f) &&
        f.length === 5 &&
        integer(f[0], 0, v.timeMs as number) &&
        (!i || f[0] > (frames[i - 1] as number[])[0]) &&
        integer(f[1], 13, 1987) &&
        integer(f[2], -602, 722) &&
        integer(f[3], -180, 180) &&
        integer(f[4], 0, 15),
    )
  )
    return false;
  const first = frames[0] as GhostFrame,
    last = frames.at(-1) as GhostFrame,
    entry = trialEntry(v.kind as RecoilTrialKind),
    exit = trialExit(v.kind as RecoilTrialKind);
  return (
    first[0] === 0 &&
    last[0] === v.timeMs &&
    Math.abs(first[1] - entry.x) <= 2 &&
    Math.abs(first[2] - entry.y) <= 2 &&
    Math.abs(last[1] - exit.x) < 75 &&
    Math.abs(last[2] - (exit.floor - 18)) < 10
  );
}
export function recoilGhostKey(v: Pick<RecoilChallenge, 'kind' | 'gun'>) {
  return v.kind + ':' + v.gun;
}
export function loadRecoilGhosts(raw: unknown): RecoilGhost[] {
  const seen = new Set<string>();
  return (Array.isArray(raw) ? raw.slice(0, 9) : [])
    .map((v: unknown) => {
      if (!object(v) || typeof v.frames !== 'string') return v;
      if (v.frames.length > 65536) return null;
      try {
        return { ...v, frames: JSON.parse(v.frames) as unknown };
      } catch {
        return null;
      }
    })
    .filter((v): v is RecoilGhost => {
      if (!validRecoilGhost(v) || seen.has(recoilGhostKey(v))) return false;
      seen.add(recoilGhostKey(v));
      return true;
    })
    .map((v) => structuredClone(v));
}
export function validRecoilGhosts(raw: unknown) {
  return Array.isArray(raw) && raw.length <= 9 && loadRecoilGhosts(raw).length === raw.length;
}
export function serializeRecoilGhosts(raw: unknown): StoredRecoilGhost[] {
  return loadRecoilGhosts(raw).map((v) => ({ ...v, frames: JSON.stringify(v.frames) }));
}
export function recordRecoilGhost(raw: unknown, ghost: RecoilGhost) {
  if (!validRecoilGhost(ghost)) throw new Error('Invalid trial recording.');
  const records = loadRecoilGhosts(raw),
    key = recoilGhostKey(ghost),
    old = records.find((r) => recoilGhostKey(r) === key);
  if (
    old &&
    (old.timeMs < ghost.timeMs || (old.timeMs === ghost.timeMs && old.shots <= ghost.shots))
  )
    return serializeRecoilGhosts(records);
  return serializeRecoilGhosts([ghost, ...records.filter((r) => recoilGhostKey(r) !== key)]);
}
export function recoilChallenge(ghost: RecoilGhost): RecoilChallenge {
  const { frames: _, ...challenge } = ghost;
  return structuredClone(challenge);
}
export function recoilChallengeAccess(
  challenge: RecoilChallenge,
  profile: unknown,
  guns: readonly StartingGun[],
) {
  return (
    validRecoilChallenge(challenge) &&
    loadRecoilProfile(profile).clears.includes(challenge.kind) &&
    guns.includes(challenge.gun)
  );
}
export function recoilChallengeCode(challenge: RecoilChallenge) {
  if (!validRecoilChallenge(challenge)) throw new Error('Invalid trial challenge.');
  return (
    'RFT1.' +
    btoa(
      JSON.stringify([
        challenge.rules,
        challenge.kind,
        challenge.gun,
        challenge.timeMs,
        challenge.shots,
        challenge.splits,
      ]),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  );
}
export function parseRecoilChallenge(text: string): RecoilChallenge {
  let code = text.trim();
  if (code.length > RECOIL_CODE_LIMIT) throw new Error('This trial challenge is too long.');
  if (/^https?:\/\//.test(code)) {
    const url = new URL(code);
    let other = false;
    url.searchParams.forEach((_, k) => {
      if (k !== 'recoil') other = true;
    });
    if (other || url.searchParams.getAll('recoil').length !== 1 || url.hash)
      throw new Error('Use a Recoil Trial challenge code or its share link.');
    code = url.searchParams.get('recoil') ?? '';
  }
  if (!/^RFT1\.[A-Za-z0-9_-]+$/.test(code))
    throw new Error('Use a Recoil Trial code beginning RFT1.');
  let v: unknown;
  try {
    v = JSON.parse(atob(code.slice(5).replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    throw new Error('This trial challenge could not be read.');
  }
  if (!Array.isArray(v) || v.length !== 6)
    throw new Error('This trial challenge could not be read.');
  if (v[0] !== RECOIL_RACE_RULES)
    throw new Error('This challenge uses a different course rules version.');
  const challenge = { rules: v[0], kind: v[1], gun: v[2], timeMs: v[3], shots: v[4], splits: v[5] };
  if (!validRecoilChallenge(challenge))
    throw new Error('This trial challenge has invalid course or timing data.');
  if (recoilChallengeCode(challenge) !== code)
    throw new Error('This trial challenge could not be read.');
  return structuredClone(challenge);
}
export function recoilChallengeLink(challenge: RecoilChallenge) {
  const url = new URL('https://caleb-guyer.github.io/recoil-foundry/');
  url.searchParams.set('recoil', recoilChallengeCode(challenge));
  return url.href;
}
export function recoilChallengeFromUrl(url: URL) {
  if (!url.searchParams.has('recoil')) return null;
  const input = new URL(url.href);
  if (
    input.searchParams.getAll('progress').length === 1 &&
    input.searchParams.get('progress') === '1'
  )
    input.searchParams.delete('progress');
  try {
    return parseRecoilChallenge(input.href);
  } catch {
    return null;
  }
}
export function ghostFrameAt(ghost: RecoilGhost, ms: number): GhostFrame | null {
  if (!Number.isFinite(ms) || ms < 0 || ms > ghost.timeMs + 800) return null;
  const frames = ghost.frames;
  if (ms >= ghost.timeMs) return [...frames.at(-1)!];
  let low = 0,
    high = frames.length - 1;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    if (frames[mid][0] <= ms) low = mid;
    else high = mid;
  }
  const a = frames[low],
    b = frames[high];
  if (b[4] & 8) return [...a];
  const f = Math.min(1, Math.max(0, (ms - a[0]) / (b[0] - a[0]))),
    angle = ((b[3] - a[3] + 540) % 360) - 180;
  return [ms, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + angle * f, a[4]];
}
export function recoilDelta(ms: number) {
  return Math.abs(ms) < 10
    ? 'Level with target'
    : (Math.abs(ms) / 1000).toFixed(2) + 's ' + (ms < 0 ? 'ahead' : 'behind');
}
