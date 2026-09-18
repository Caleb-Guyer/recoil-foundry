import type { Checkpoint, Vec } from './rules.ts';

export const REPLAY_SECONDS = 5;
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
    at: Math.min(duration, played <= slowAt ? Math.max(0, played) : slowAt + (played - slowAt) / 3),
    done: played >= end + 0.8,
  };
}

export function replayFrameIndex(frames: readonly { at: number }[], at: number) {
  let index = 0;
  while (index + 1 < frames.length && frames[index + 1].at <= at) index++;
  return index;
}

export interface ReplayImpact {
  player: Vec;
  origin?: Vec;
  label: string;
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
