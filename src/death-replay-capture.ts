import {
  ReplayBuffer,
  REPLAY_FPS,
  REPLAY_WIDTH,
  REPLAY_HEIGHT,
  type ReplayImpact,
} from './death-replay.ts';
import { ReplayEncoder } from './replay-encoder.ts';
const WIDTH = REPLAY_WIDTH,
  HEIGHT = REPLAY_HEIGHT;
export class DeathReplay {
  buffer = new ReplayBuffer<Blob>();
  impact: ReplayImpact | null = null;
  ready = false;
  onReady = () => {};
  private generation = 0;
  private sealed = false;
  private last = -Infinity;
  private pending = new Set<Promise<void>>();
  // Native encodes cannot be cancelled by resetting the run. Keep their budget
  // across generations so rapid retries cannot enqueue unlimited image work.
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
    this.impact = null;
    this.ready = this.sealed = false;
    this.last = -Infinity;
  }
  capture(source: HTMLCanvasElement, at: number, force = false) {
    if (
      this.sealed ||
      this.encodes >= (force ? 2 : 1) ||
      (!force && at - this.last < 1 / REPLAY_FPS)
    )
      return;
    if (!source.width || !source.height) return;
    const generation = this.generation;
    this.last = at;
    this.encodes++;
    const pending = new Promise<void>((resolve) => {
      this.encoder.encode(source, (blob) => {
        this.encodes--;
        if (blob && generation === this.generation)
          this.buffer.add({ at, data: blob, bytes: blob.size });
        resolve();
      });
    });
    this.pending.add(pending);
    void pending.then(() => this.pending.delete(pending));
  }
  finish(source: HTMLCanvasElement, at: number, impact: ReplayImpact) {
    this.capture(source, at, true);
    this.sealed = true;
    const fit = Math.min(WIDTH / source.width, HEIGHT / source.height);
    const point = (p: { x: number; y: number }) => ({
      x: p.x * fit + (WIDTH - source.width * fit) / 2,
      y: p.y * fit + (HEIGHT - source.height * fit) / 2,
    });
    this.impact = {
      label: impact.label,
      ...(impact.guidance ? { guidance: impact.guidance } : {}),
      player: point(impact.player),
      ...(impact.origin ? { origin: point(impact.origin) } : {}),
    };
    const generation = this.generation;
    void Promise.all([...this.pending]).then(() => {
      if (generation !== this.generation) return;
      this.ready = this.buffer.frames.length > 0;
      this.onReady();
    });
  }
}
