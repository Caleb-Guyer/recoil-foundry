import { REPLAY_WIDTH, REPLAY_HEIGHT } from './death-replay.ts';

// The game thread snapshots its canvas; a worker does the pixel readback/JPEG.
// A failed or unavailable worker falls back to the original canvas encoder.
export class ReplayEncoder {
  private worker: Worker | null = null;
  private attempted = false;
  private next = 0;
  private jobs = new Map<number, (blob: Blob | null) => void>();
  private canvas: HTMLCanvasElement;
  private factory: () => Worker | null;
  constructor(canvas: HTMLCanvasElement, factory = createEncoderWorker) {
    this.canvas = canvas;
    this.factory = factory;
  }
  encode(source: HTMLCanvasElement, done: (blob: Blob | null) => void) {
    if (!this.attempted) {
      this.attempted = true;
      try {
        this.worker = this.factory();
      } catch {
        this.worker = null;
      }
      if (this.worker) {
        this.worker.onmessage = (event: MessageEvent<{ id: number; blob: Blob | null }>) => {
          const callback = this.jobs.get(event.data.id);
          this.jobs.delete(event.data.id);
          callback?.(event.data.blob);
          if (!event.data.blob) this.disable();
        };
        this.worker.onerror = (event) => {
          event.preventDefault();
          this.disable();
        };
        this.worker.onmessageerror = () => this.disable();
      }
    }
    if (!this.worker) {
      this.fallback(source, done);
      return;
    }
    const id = ++this.next;
    this.jobs.set(id, done);
    let snapshot: Promise<ImageBitmap>;
    try {
      snapshot = createImageBitmap(source);
    } catch {
      this.disable();
      return;
    }
    void snapshot
      .then((bitmap) => {
        if (!this.worker || !this.jobs.has(id)) {
          bitmap.close();
          return;
        }
        try {
          this.worker.postMessage({ id, bitmap }, [bitmap]);
        } catch {
          bitmap.close();
          this.disable();
        }
      })
      .catch(() => this.disable());
  }
  private disable() {
    this.worker?.terminate();
    this.worker = null;
    const callbacks = [...this.jobs.values()];
    this.jobs.clear();
    callbacks.forEach((done) => done(null));
  }
  private fallback(source: HTMLCanvasElement, done: (blob: Blob | null) => void) {
    try {
      const ctx = this.canvas.getContext('2d');
      if (!ctx) {
        done(null);
        return;
      }
      const fit = Math.min(REPLAY_WIDTH / source.width, REPLAY_HEIGHT / source.height);
      ctx.fillStyle = '#14181a';
      ctx.fillRect(0, 0, REPLAY_WIDTH, REPLAY_HEIGHT);
      ctx.drawImage(
        source,
        (REPLAY_WIDTH - source.width * fit) / 2,
        (REPLAY_HEIGHT - source.height * fit) / 2,
        source.width * fit,
        source.height * fit,
      );
      this.canvas.toBlob(done, 'image/jpeg', 0.8);
    } catch {
      done(null);
    }
  }
}

function createEncoderWorker(): Worker | null {
  if (
    typeof Worker !== 'function' ||
    typeof createImageBitmap !== 'function' ||
    typeof OffscreenCanvas !== 'function' ||
    typeof OffscreenCanvas.prototype.convertToBlob !== 'function'
  )
    return null;
  return new Worker(new URL('./replay-encoder.worker.ts', import.meta.url), { type: 'module' });
}
