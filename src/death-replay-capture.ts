import {
  ReplayBuffer,
  REPLAY_FPS,
  REPLAY_WIDTH,
  REPLAY_HEIGHT,
  REPLAY_SECONDS,
  REPLAY_HITS,
  validReplayHit,
  replayHitsInBuffer,
  type ReplayImpact,
  type ReplayHit,
} from './death-replay.ts';
import { ReplayEncoder } from './replay-encoder.ts';
const WIDTH = REPLAY_WIDTH,
  HEIGHT = REPLAY_HEIGHT;
const validSize = (source: { width: number; height: number }) =>
  Number.isFinite(source.width) &&
  Number.isFinite(source.height) &&
  source.width > 0 &&
  source.height > 0;
export class DeathReplay {
  buffer = new ReplayBuffer<Blob>();
  impact: ReplayImpact | null = null;
  ready = false;
  onReady = () => {};
  private hitLog: ReplayHit[] = [];
  private timeline: readonly Readonly<ReplayHit>[] = Object.freeze([]);
  get hits() {
    return this.timeline;
  }
  private size = { width: WIDTH, height: HEIGHT };
  private generation = 0;
  private sealed = false;
  private last = -Infinity;
  private pending = new Set<Promise<void>>();
  // Native work keeps its budget across resets, including the extra death frame.
  private encodes = 0;
  private canvas: HTMLCanvasElement;
  private encoder: ReplayEncoder;
  constructor(canvas = document.createElement('canvas')) {
    this.canvas = canvas;
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.encoder = new ReplayEncoder(canvas);
  }
  reset() {
    this.generation++;
    this.buffer = new ReplayBuffer();
    this.pending.clear();
    this.hitLog = [];
    this.timeline = Object.freeze([]);
    this.impact = null;
    this.ready = this.sealed = false;
    this.last = -Infinity;
    this.size = { width: WIDTH, height: HEIGHT };
  }
  private point(p: { x: number; y: number }, source = this.size) {
    const fit = Math.min(WIDTH / source.width, HEIGHT / source.height);
    return {
      x: p.x * fit + (WIDTH - source.width * fit) / 2,
      y: p.y * fit + (HEIGHT - source.height * fit) / 2,
    };
  }
  recordHit(hit: ReplayHit, source?: HTMLCanvasElement) {
    if (this.sealed || !validReplayHit(hit) || this.hitLog.some((old) => old.id === hit.id)) return;
    if (source && !validSize(source)) return;
    const size = source ?? this.size;
    this.hitLog.push({
      ...hit,
      label: hit.label
        .trim()
        .replace(/[\u0000-\u001f]/g, ' ')
        .slice(0, 120),
      player: this.point(hit.player, size),
      ...(hit.origin ? { origin: this.point(hit.origin, size) } : {}),
    });
    this.hitLog.sort((a, b) => a.at - b.at || a.id - b.id);
    this.pruneHits();
  }
  private pruneHits() {
    // A final encode can arrive before the preceding frame. Trim by the five
    // second window here, then by exact successful bounds only after settling.
    const end = Math.max(this.buffer.frames.at(-1)?.at ?? 0, this.hitLog.at(-1)?.at ?? 0);
    this.hitLog = this.hitLog.filter((hit) => hit.at >= end - REPLAY_SECONDS).slice(-REPLAY_HITS);
  }
  capture(source: HTMLCanvasElement, at: number, force = false) {
    if (!validSize(source) || !Number.isFinite(at) || at < 0) return;
    this.size = { width: source.width, height: source.height };
    if (
      this.sealed ||
      this.encodes >= (force ? 2 : 1) ||
      (!force && at - this.last < 1 / REPLAY_FPS)
    )
      return;
    const generation = this.generation;
    this.last = at;
    this.encodes++;
    const pending = new Promise<void>((resolve) => {
      this.encoder.encode(source, (blob) => {
        this.encodes--;
        if (blob && generation === this.generation) {
          this.buffer.add({ at, data: blob, bytes: blob.size });
          this.pruneHits();
        }
        resolve();
      });
    });
    this.pending.add(pending);
    void pending.then(() => this.pending.delete(pending));
  }
  finish(source: HTMLCanvasElement, at: number, impact: ReplayImpact) {
    if (this.sealed) return;
    this.capture(source, at, true);
    this.sealed = true;
    if (validSize(source))
      this.impact = {
        label: impact.label,
        ...(impact.guidance ? { guidance: impact.guidance } : {}),
        player: this.point(impact.player, source),
        ...(impact.origin ? { origin: this.point(impact.origin, source) } : {}),
      };
    const generation = this.generation;
    void Promise.all([...this.pending]).then(() => {
      if (generation !== this.generation) return;
      this.ready = this.buffer.frames.length > 0;
      this.timeline = replayHitsInBuffer(this.buffer.frames, this.hitLog);
      this.hitLog = [];
      this.onReady();
    });
  }
}
