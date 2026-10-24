import {
  REPLAY_FPS,
  REPLAY_WIDTH,
  REPLAY_HEIGHT,
  REPLAY_BYTES,
  replayFrameIndex,
  replayTiming,
  replayPlayedAt,
  type ReplayHit,
} from './death-replay.ts';
import { DeathReplay } from './death-replay-capture.ts';
export { DeathReplay } from './death-replay-capture.ts';
// Keep this stylesheet with the optional viewer, outside the first-run bundle.
// @ts-expect-error Vite bundles this optional stylesheet; Node tests have no DOM.
if (typeof document !== 'undefined') void import('./death-replay.css').catch(() => {});
const WIDTH = REPLAY_WIDTH,
  HEIGHT = REPLAY_HEIGHT;
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const amount = (n: number) =>
  n > 0 && n < 0.1 ? '<0.1' : Number.isInteger(n) ? String(n) : n.toFixed(1);
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
  private decodeRevision = 0;
  private decoding: object | null = null;
  private bitmap: ImageBitmap | null = null;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private download: string | null = null;
  private stopTimer = 0;
  private exportTimeout = 0;
  private playButton: HTMLButtonElement;
  private saveButton: HTMLButtonElement;
  private status: HTMLElement;
  private scrub: HTMLInputElement | null;
  private time: HTMLOutputElement | null;
  private detail: HTMLElement | null;
  private hitButtons: HTMLButtonElement[] = [];
  private duration: number;
  private replay: DeathReplay;
  private recording: DeathReplay['buffer'];
  private root: HTMLElement;
  private onVisibility = () => {
    this.last = 0;
    if (document.hidden) {
      this.decodeRevision++;
      if (this.recorder) this.cancelExport('Keep this tab visible to save a clip.');
    }
  };
  constructor(replay: DeathReplay, root: HTMLElement) {
    this.replay = replay;
    this.recording = replay.buffer;
    this.root = root;
    const frames = replay.buffer.frames;
    this.duration = frames.length ? Math.max(0, frames.at(-1)!.at - frames[0].at) : 0;
    const recent = replay.hits.slice(-3);
    root.innerHTML =
      '<h2 id="dialog-title">Last moments.</h2>' +
      '<canvas class="replay-canvas" role="img" aria-label="Replay of the final seconds before death"></canvas>' +
      '<p class="replay-guidance" data-replay-guidance hidden></p>' +
      '<div class="replay-timeline"><label for="replay-scrub">Timeline</label>' +
      '<output id="replay-time" for="replay-scrub"></output>' +
      '<div class="replay-track"><input id="replay-scrub" type="range" min="0" max="' +
      this.duration +
      '" step="any" value="0" aria-label="Replay timeline">' +
      '<div class="replay-hit-marks" aria-hidden="true">' +
      replay.hits
        .map(
          (hit) =>
            '<span style="left:' +
            (this.duration ? (hit.at / this.duration) * 100 : 100) +
            '%"></span>',
        )
        .join('') +
      '</div></div></div>' +
      (recent.length
        ? '<div class="replay-hit-jumps" aria-label="Recent recorded damage">' +
          recent
            .map(
              (hit, i) =>
                '<button id="replay-hit-' +
                i +
                '" class="quiet" type="button">−' +
                escape(amount(hit.damage)) +
                ' HP · ' +
                escape(hit.label) +
                ' · ' +
                hit.at.toFixed(1) +
                's</button>',
            )
            .join('') +
          '</div>'
        : '') +
      '<p id="replay-hit-detail" class="replay-hit-detail"></p>' +
      '<div class="replay-controls"><button id="replay-play" class="quiet">Pause</button>' +
      '<button id="replay-save" class="quiet">Save clip</button>' +
      '<a id="replay-download" class="quiet" hidden>Download clip</a>' +
      '<span id="replay-status" role="status"></span></div>' +
      '<div class="actions"><button id="retry" class="primary">Again ↗</button>' +
      '<button id="back" class="quiet">Back</button></div>';
    this.canvas = root.querySelector('canvas')!;
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.canvas.setAttribute(
      'aria-label',
      'Death replay · ' + (replay.impact?.label ?? 'Recorded final seconds'),
    );
    this.ctx = this.canvas.getContext('2d')!;
    const guidance = root.querySelector<HTMLElement>('[data-replay-guidance]');
    if (guidance && replay.impact?.guidance) {
      guidance.textContent = 'Try this: ' + replay.impact.guidance;
      guidance.hidden = false;
    }
    this.playButton = root.querySelector('#replay-play')!;
    this.saveButton = root.querySelector('#replay-save')!;
    this.status = root.querySelector('#replay-status')!;
    this.scrub = root.querySelector('#replay-scrub');
    this.time = root.querySelector('#replay-time');
    this.detail = root.querySelector('#replay-hit-detail');
    if (this.scrub) this.scrub.oninput = () => this.seek(Number(this.scrub!.value));
    recent.forEach((hit, i) => {
      const button = root.querySelector<HTMLButtonElement>('#replay-hit-' + i);
      if (!button) return;
      this.hitButtons.push(button);
      button.onclick = () => {
        // Select a real frame at/after the event, never annotate a preceding image.
        const frame = frames.find((frame) => frame.at >= frames[0].at + hit.at);
        this.seek(frame ? frame.at - frames[0].at : this.duration);
      };
    });
    this.playButton.onclick = () => {
      if (this.closed || this.failed || this.recorder) return;
      if (replayTiming(this.duration, this.played).at >= this.duration) this.restart();
      this.playing = !this.playing;
      this.last = 0;
      this.playButton.textContent = this.playing ? 'Pause' : 'Play';
    };
    this.saveButton.hidden = !recorderType() || typeof this.canvas.captureStream !== 'function';
    if (this.saveButton.hidden)
      this.status.textContent = 'Clip export unavailable in this browser.';
    this.saveButton.onclick = () => this.save();
    if (!frames.length || !this.ctx) {
      this.failed = true;
      this.status.textContent = 'No replay frames are available.';
    }
    this.controls();
    this.timeline();
    document.addEventListener('visibilitychange', this.onVisibility);
    if (!this.failed) this.raf = requestAnimationFrame((now) => this.tick(now));
  }
  private controls() {
    const disabled = this.failed || this.closed || !!this.recorder;
    this.playButton.disabled = this.saveButton.disabled = disabled;
    if (this.scrub) this.scrub.disabled = disabled || this.duration === 0;
    this.hitButtons.forEach((button) => (button.disabled = disabled));
  }
  private timeline() {
    const at = replayTiming(this.duration, this.played).at;
    if (this.scrub) {
      this.scrub.value = String(at);
      this.scrub.setAttribute(
        'aria-valuetext',
        at.toFixed(1) + ' of ' + this.duration.toFixed(1) + ' seconds',
      );
    }
    if (this.time) this.time.textContent = at.toFixed(1) + ' / ' + this.duration.toFixed(1) + 's';
  }
  private seek(at: number) {
    if (this.closed || this.failed || this.recorder) return;
    this.played = replayPlayedAt(this.duration, at);
    this.playing = false;
    this.last = 0;
    this.decodeRevision++;
    this.playButton.textContent = 'Play';
    this.timeline();
  }
  private restart() {
    this.played = 0;
    this.last = 0;
    this.frame = -1;
    this.decodeRevision++;
    this.bitmap?.close();
    this.bitmap = null;
    this.playing = false;
  }
  private tick(now: number) {
    if (this.closed || this.failed) return;
    if (this.replay.buffer !== this.recording || !this.replay.buffer.frames.length) {
      this.failed = true;
      this.playing = false;
      this.decodeRevision++;
      this.cancelExport('This replay was reset.');
      this.bitmap?.close();
      this.bitmap = null;
      this.controls();
      return;
    }
    const dt = this.last ? Math.max((now - this.last) / 1000, 0) : 0;
    this.last = now;
    if (document.hidden && this.recorder)
      this.cancelExport('Keep this tab visible to save a clip.');
    if (!document.hidden && this.playing && this.bitmap) this.played += dt;
    const timing = replayTiming(this.duration, this.played);
    const frames = this.replay.buffer.frames;
    const index =
      timing.at >= this.duration
        ? frames.length - 1
        : replayFrameIndex(frames, frames[0].at + timing.at);
    if (!document.hidden && index !== this.frame && !this.decoding) {
      const work = {};
      this.decoding = work;
      const revision = this.decodeRevision;
      void Promise.resolve()
        .then(() => createImageBitmap(frames[index].data))
        .then((bitmap) => {
          if (
            this.closed ||
            this.replay.buffer !== this.recording ||
            revision !== this.decodeRevision
          ) {
            bitmap.close();
            return;
          }
          this.bitmap?.close();
          this.bitmap = bitmap;
          this.frame = index;
          this.paint();
          if (this.recorder?.state === 'inactive') {
            try {
              this.recorder.start();
            } catch {
              this.cancelExport('Could not save the clip. Try again.');
            }
          }
        })
        .catch(() => {
          if (
            this.closed ||
            this.replay.buffer !== this.recording ||
            revision !== this.decodeRevision
          )
            return;
          this.failed = true;
          this.playing = false;
          this.cancelExport('This browser could not decode the replay.');
          this.controls();
        })
        .finally(() => {
          if (this.decoding === work) this.decoding = null;
        });
    }
    this.paint();
    this.timeline();
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
  private paint() {
    if (!this.bitmap) return;
    this.ctx.drawImage(this.bitmap, 0, 0);
    const frames = this.replay.buffer.frames;
    const at = frames[this.frame].at - frames[0].at;
    let hit: Readonly<ReplayHit> | undefined;
    for (let i = this.replay.hits.length - 1; i >= 0; i--) {
      const candidate = this.replay.hits[i];
      if (candidate.at <= at + 1e-7 && at - candidate.at <= 0.18) {
        hit = candidate;
        break;
      }
    }
    if (this.detail)
      this.detail.textContent = hit
        ? amount(hit.hpBefore) +
          ' → ' +
          amount(hit.hpAfter) +
          ' HP · −' +
          amount(hit.damage) +
          ' · ' +
          hit.label +
          ' · ' +
          hit.at.toFixed(1) +
          's'
        : '';
    if (hit) this.drawHit(hit);
    else if (this.frame === frames.length - 1) this.drawImpact();
  }
  private annotation(
    player: { x: number; y: number },
    origin: { x: number; y: number } | undefined,
    label: string,
  ) {
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
    if (origin) mark(origin, '#f28a72', 15);
    mark(player, '#eee9d9', 21);
    c.fillStyle = '#14181ae8';
    c.fillRect(0, HEIGHT - 36, WIDTH, 36);
    c.font = '14px system-ui, sans-serif';
    c.fillStyle = '#eee9d9';
    c.fillText(label, 16, HEIGHT - 13, WIDTH - 32);
  }
  private drawHit(hit: Readonly<ReplayHit>) {
    this.annotation(hit.player, hit.origin, '−' + amount(hit.damage) + ' HP · ' + hit.label);
  }
  private drawImpact() {
    const impact = this.replay.impact;
    if (impact) this.annotation(impact.player, impact.origin, impact.label);
  }
  private save() {
    const type = recorderType();
    if (!type || this.closed || this.failed || this.recorder) return;
    if (document.hidden) {
      this.status.textContent = 'Keep this tab visible to save a clip.';
      return;
    }
    try {
      this.stream = this.canvas.captureStream(REPLAY_FPS);
      const recorder = new MediaRecorder(this.stream, {
        mimeType: type,
        videoBitsPerSecond: 3_000_000,
      });
      this.recorder = recorder;
      const chunks: Blob[] = [];
      let bytes = 0;
      recorder.ondataavailable = (e) => {
        if (this.recorder !== recorder || this.closed) return;
        bytes += e.data.size;
        if (bytes > REPLAY_BYTES) {
          this.cancelExport('The clip exceeded the export limit. Try again.');
          return;
        }
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onerror = () => {
        if (this.recorder === recorder) this.cancelExport('Could not save the clip. Try again.');
      };
      recorder.onstop = () => {
        if (this.closed || this.recorder !== recorder) return;
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = this.recorder = null;
        recorder.ondataavailable = recorder.onerror = recorder.onstop = null;
        clearTimeout(this.exportTimeout);
        this.exportTimeout = 0;
        clearTimeout(this.stopTimer);
        this.stopTimer = 0;
        this.controls();
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
      const oldLink = this.root.querySelector<HTMLAnchorElement>('#replay-download');
      if (oldLink) oldLink.hidden = true;
      this.restart();
      this.playing = true;
      this.controls();
      this.timeline();
      this.playButton.textContent = 'Playing';
      this.status.textContent = 'Saving clip…';
      this.exportTimeout = window.setTimeout(
        () => this.cancelExport('Recording interrupted. Try saving again.'),
        20_000,
      );
      this.ctx.fillStyle = '#14181a';
      this.ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } catch {
      this.cancelExport('Could not save the clip. Try again.');
    }
  }
  private cancelExport(message: string) {
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder) {
      recorder.ondataavailable = recorder.onerror = recorder.onstop = null;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {}
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    clearTimeout(this.stopTimer);
    this.stopTimer = 0;
    clearTimeout(this.exportTimeout);
    this.exportTimeout = 0;
    this.decodeRevision++;
    this.controls();
    this.status.textContent = message;
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.decodeRevision++;
    document.removeEventListener('visibilitychange', this.onVisibility);
    cancelAnimationFrame(this.raf);
    this.cancelExport('');
    this.bitmap?.close();
    this.bitmap = null;
    if (this.download) URL.revokeObjectURL(this.download);
  }
}
