import type { Checkpoint, Vec } from './rules.ts';

export const REPLAY_SECONDS = 5;
export const REPLAY_WIDTH = 854,
  REPLAY_HEIGHT = 480;
export const REPLAY_FPS = 24;
export const REPLAY_BYTES = 16 * 1024 * 1024;
export interface ReplayFrame<T> {
  at: number;
  data: T;
  bytes: number;
}

// Compressed images, never a rolling collection of full-resolution pixel buffers.
export class ReplayBuffer<T> {
  frames: ReplayFrame<T>[] = [];
  bytes = 0;
  add(frame: ReplayFrame<T>) {
    if (
      !Number.isFinite(frame.at) ||
      !Number.isFinite(frame.bytes) ||
      frame.bytes > REPLAY_BYTES ||
      frame.bytes < 0
    )
      return;
    this.frames.push(frame);
    this.frames.sort((a, b) => a.at - b.at);
    this.bytes += frame.bytes;
    const end = this.frames.at(-1)!.at;
    while (
      this.frames.length &&
      (this.frames[0].at < end - REPLAY_SECONDS ||
        this.frames.length > REPLAY_FPS * REPLAY_SECONDS + 2 ||
        this.bytes > REPLAY_BYTES)
    )
      this.bytes -= this.frames.shift()!.bytes;
  }
}

// The last 0.6 seconds play at one-third speed, followed by a short impact hold.
export function replayTiming(duration: number, played: number) {
  const slowAt = Math.max(0, duration - 0.6);
  const end = slowAt + (duration - slowAt) * 3;
  return {
    at:
      played >= end
        ? duration
        : Math.min(
            duration,
            played <= slowAt ? Math.max(0, played) : slowAt + (played - slowAt) / 3,
          ),
    done: played >= end + 0.8,
  };
}

export function replayFrameIndex(frames: readonly { at: number }[], at: number) {
  let index = 0;
  while (index + 1 < frames.length && frames[index + 1].at <= at) index++;
  return index;
}

export const REPLAY_HITS = 32;
export interface ReplayHit {
  id: number;
  // Capture uses elapsed gameplay seconds; published timeline hits start at zero.
  at: number;
  damage: number;
  hpBefore: number;
  hpAfter: number;
  player: Vec;
  origin?: Vec;
  label: string;
}
const finitePoint = (p: Vec | undefined) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
export function validReplayHit(hit: ReplayHit) {
  return (
    Number.isSafeInteger(hit.id) &&
    hit.id >= 0 &&
    Number.isFinite(hit.at) &&
    hit.at >= 0 &&
    Number.isFinite(hit.damage) &&
    hit.damage > 0 &&
    Number.isFinite(hit.hpBefore) &&
    Number.isFinite(hit.hpAfter) &&
    hit.hpAfter >= 0 &&
    hit.hpBefore > hit.hpAfter &&
    Math.abs(hit.hpBefore - hit.hpAfter - hit.damage) <= 1e-6 * Math.max(1, hit.hpBefore) &&
    finitePoint(hit.player) &&
    (!hit.origin || finitePoint(hit.origin)) &&
    typeof hit.label === 'string' &&
    hit.label.trim().length > 0
  );
}

export function replayHitsInBuffer(
  frames: readonly { at: number }[],
  hits: readonly ReplayHit[],
): readonly Readonly<ReplayHit>[] {
  if (!frames.length) return Object.freeze([]);
  const start = frames[0].at,
    end = frames.at(-1)!.at;
  return Object.freeze(
    hits
      .filter((hit) => validReplayHit(hit) && hit.at >= start && hit.at <= end)
      .sort((a, b) => a.at - b.at || a.id - b.id)
      .slice(-REPLAY_HITS)
      .map((hit) =>
        Object.freeze({
          ...hit,
          at: hit.at - start,
          label: hit.label
            .trim()
            .replace(/[\u0000-\u001f]/g, ' ')
            .slice(0, 120),
          player: Object.freeze({ ...hit.player }),
          ...(hit.origin ? { origin: Object.freeze({ ...hit.origin }) } : {}),
        }),
      ),
  );
}

// Invert the slow-motion playback clock for a precise keyboard/range seek.
export function replayPlayedAt(duration: number, at: number) {
  const position = Math.max(0, Math.min(duration, Number.isFinite(at) ? at : 0));
  const slowAt = Math.max(0, duration - 0.6);
  // Native range controls serialize decimal values with limited precision.
  // Resolve the endpoint before the slow-motion inverse can lose another ULP.
  if (position > 0 && duration - position <= 1e-6) return slowAt + (duration - slowAt) * 3;
  return position <= slowAt ? position : slowAt + (position - slowAt) * 3;
}

export interface ReplayImpact {
  player: Vec;
  origin?: Vec;
  label: string;
  guidance?: string;
}

export function replayTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'replay' || p.getAll('test').length !== 1) return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'v'].includes(key)) invalid = true;
  });
  if (invalid) return null;
  return { version: 6, seed: 'DEATH-REPLAY-86', stage: 0, hp: 1, mods: [], kills: 0, elapsed: 0 };
}
