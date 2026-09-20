import {
  ReplayBuffer,
  REPLAY_FPS,
  REPLAY_WIDTH,
  REPLAY_HEIGHT,
  replayFrameIndex,
  replayTiming,
} from './death-replay.ts';
import type { ReplayImpact } from './death-replay.ts';
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

function recorderType() {
  try {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function')
      return null;
    return (
      ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      ) ?? null
    );
  } catch {
    return null;
  }
}

export class ReplayView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private playing = true;
  private played = 0;
  private last = 0;
  private frame = -1;
  private raf = 0;
  private closed = false;
  private failed = false;
  private decoding = false;
  private decodeRevision = 0;
  private bitmap: ImageBitmap | null = null;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private download: string | null = null;
  private stopTimer = 0;
  private exportTimeout = 0;
  private playButton: HTMLButtonElement;
  private saveButton: HTMLButtonElement;
  private status: HTMLElement;
  private duration: number;
  private onVisibility = () => {
    this.last = 0;
    if (document.hidden && this.recorder)
      this.cancelExport('Keep this tab visible to save a clip.');
  };
  private replay: DeathReplay;
  private root: HTMLElement;
  constructor(replay: DeathReplay, root: HTMLElement) {
    this.replay = replay;
    this.root = root;
    root.innerHTML =
      '<h2 id="dialog-title">Last moments.</h2>' +
      '<canvas class="replay-canvas" role="img" aria-label="Replay of the final seconds before death"></canvas>' +
      '<div class="replay-controls"><button id="replay-play" class="quiet">Pause</button>' +
      '<button id="replay-save" class="quiet">Save clip</button>' +
      '<a id="replay-download" class="quiet" hidden>Download clip</a>' +
      '<span id="replay-status" role="status"></span></div>' +
      '<div class="actions"><button id="retry" class="primary">Again ↗</button>' +
      '<button id="back" class="quiet">Back</button></div>';
    this.canvas = root.querySelector('canvas')!;
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.canvas.setAttribute('aria-label', 'Death replay · ' + replay.impact?.label);
    this.ctx = this.canvas.getContext('2d')!;
    this.playButton = root.querySelector('#replay-play')!;
    this.saveButton = root.querySelector('#replay-save')!;
    this.status = root.querySelector('#replay-status')!;
    this.duration = replay.buffer.frames.at(-1)!.at - replay.buffer.frames[0].at;
    this.playButton.onclick = () => {
      if (replayTiming(this.duration, this.played).done) this.played = 0;
      this.playing = !this.playing;
      this.playButton.textContent = this.playing ? 'Pause' : 'Play';
    };
    this.saveButton.hidden = !recorderType() || typeof this.canvas.captureStream !== 'function';
    if (this.saveButton.hidden)
      this.status.textContent = 'Clip export unavailable in this browser.';
    this.saveButton.onclick = () => this.save();
    document.addEventListener('visibilitychange', this.onVisibility);
    this.raf = requestAnimationFrame((now) => this.tick(now));
  }
  private tick(now: number) {
    if (this.closed || this.failed) return;
    // Playback uses wall time so a low frame rate cannot stretch a five-second clip.
    const dt = this.last ? Math.max((now - this.last) / 1000, 0) : 0;
    this.last = now;
    // A hidden tab must not produce a truncated download. Viewing resumes where it paused.
    if (document.hidden && this.recorder)
      this.cancelExport('Keep this tab visible to save a clip.');
    if (!document.hidden && this.playing && this.bitmap) this.played += dt;
    const timing = replayTiming(this.duration, this.played);
    const frames = this.replay.buffer.frames;
    const index = replayFrameIndex(frames, frames[0].at + timing.at);
    if (index !== this.frame && !this.decoding) {
      this.decoding = true;
      const revision = this.decodeRevision;
      void Promise.resolve()
        .then(() => createImageBitmap(frames[index].data))
        .then((bitmap) => {
          if (this.closed || revision !== this.decodeRevision) {
            bitmap.close();
            return;
          }
          this.bitmap?.close();
          this.bitmap = bitmap;
          this.frame = index;
          this.ctx.drawImage(bitmap, 0, 0);
          if (this.recorder?.state === 'inactive') {
            try {
              this.recorder.start();
            } catch {
              this.cancelExport('Could not save the clip. Try again.');
            }
          }
        })
        .catch(() => {
          if (this.closed || revision !== this.decodeRevision) return;
          this.failed = true;
          this.playing = false;
          this.cancelExport('This browser could not decode the replay.');
          this.playButton.disabled = this.saveButton.disabled = true;
        })
        .finally(() => {
          this.decoding = false;
        });
    }
    if (this.bitmap) {
      this.ctx.drawImage(this.bitmap, 0, 0);
      if (this.frame === frames.length - 1) this.drawImpact();
    }
    if (timing.done && this.frame === frames.length - 1) {
      this.playing = false;
      this.playButton.textContent = 'Replay again';
      if (this.recorder?.state === 'recording' && !this.stopTimer)
        this.stopTimer = window.setTimeout(() => {
          try {
            if (this.recorder?.state === 'recording') this.recorder.stop();
          } catch {
            this.cancelExport('Could not save the clip. Try again.');
          }
        }, 100);
    }
    this.raf = requestAnimationFrame((next) => this.tick(next));
  }
  private drawImpact() {
    const impact = this.replay.impact;
    if (!impact) return;
    const c = this.ctx;
    const mark = (point: { x: number; y: number }, color: string, radius: number) => {
      const x = Math.max(14, Math.min(WIDTH - 14, point.x));
      const y = Math.max(14, Math.min(HEIGHT - 48, point.y));
      c.beginPath();
      c.arc(x, y, radius, 0, Math.PI * 2);
      c.strokeStyle = '#14181a';
      c.lineWidth = 5;
      c.stroke();
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.stroke();
    };
    if (impact.origin) mark(impact.origin, '#f28a72', 15);
    mark(impact.player, '#eee9d9', 21);
    c.fillStyle = '#14181ae8';
    c.fillRect(0, HEIGHT - 36, WIDTH, 36);
    c.font = '14px system-ui, sans-serif';
    c.fillStyle = '#eee9d9';
    c.fillText(impact.label, 16, HEIGHT - 13);
  }
  private save() {
    const type = recorderType();
    if (!type || this.closed || this.recorder) return;
    try {
      this.stream = this.canvas.captureStream(REPLAY_FPS);
      const recorder = new MediaRecorder(this.stream, {
        mimeType: type,
        videoBitsPerSecond: 3_000_000,
      });
      this.recorder = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onerror = () => this.cancelExport('Could not save the clip. Try again.');
      recorder.onstop = () => {
        if (this.closed || this.recorder !== recorder) return;
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = this.recorder = null;
        clearTimeout(this.exportTimeout);
        this.exportTimeout = 0;
        this.stopTimer = 0;
        this.playButton.disabled = false;
        this.saveButton.disabled = false;
        if (!chunks.length) {
          this.status.textContent = 'Could not save the clip. Try again.';
          return;
        }
        if (this.download) URL.revokeObjectURL(this.download);
        const blob = new Blob(chunks, { type: recorder.mimeType });
        this.download = URL.createObjectURL(blob);
        const link = this.root.querySelector<HTMLAnchorElement>('#replay-download')!;
        link.href = this.download;
        link.download =
          'recoil-foundry-last-moments.' + (blob.type.includes('mp4') ? 'mp4' : 'webm');
        link.hidden = false;
        this.status.textContent = 'Clip ready.';
        link.click();
      };
      this.played = 0;
      this.decodeRevision++;
      this.frame = -1;
      this.bitmap?.close();
      this.bitmap = null;
      this.playing = true;
      this.playButton.disabled = this.saveButton.disabled = true;
      this.playButton.textContent = 'Playing';
      this.status.textContent = 'Saving clip…';
      this.exportTimeout = window.setTimeout(
        () => this.cancelExport('Recording interrupted. Try saving again.'),
        20_000,
      );
      // Clear the previous impact before the stream captures its first frame.
      this.ctx.fillStyle = '#14181a';
      this.ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } catch {
      this.cancelExport('Could not save the clip. Try again.');
    }
  }
  private cancelExport(message: string) {
    const recorder = this.recorder;
    this.recorder = null;
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    } catch {
      // Failed browser encoders must still release their tracks and UI below.
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    clearTimeout(this.stopTimer);
    this.stopTimer = 0;
    clearTimeout(this.exportTimeout);
    this.exportTimeout = 0;
    this.playButton.disabled = this.saveButton.disabled = false;
    this.status.textContent = message;
  }
  dispose() {
    this.closed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    cancelAnimationFrame(this.raf);
    this.cancelExport('');
    this.bitmap?.close();
    this.bitmap = null;
    if (this.download) URL.revokeObjectURL(this.download);
  }
}
