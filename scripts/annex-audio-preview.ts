// Development-only listening/measurement harness; not part of the production entry.
import { Sound } from '../src/audio.ts';
import type { MusicScene } from '../src/music-score.ts';

const button = document.querySelector<HTMLButtonElement>('#render')!;
const select = document.querySelector<HTMLSelectElement>('#mix')!;
const status = document.querySelector<HTMLElement>('#status')!;
const audio = document.querySelector<HTMLAudioElement>('#sample')!;
const download = document.querySelector<HTMLAnchorElement>('#download')!;
let objectUrl = '';

function wav(buffer: AudioBuffer) {
  const bytes = new ArrayBuffer(44 + buffer.length * 2),
    view = new DataView(bytes);
  const text = (at: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, bytes.byteLength - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, buffer.length * 2, true);
  buffer
    .getChannelData(0)
    .forEach((value, i) =>
      view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, value)) * 32767), true),
    );
  return new Blob([bytes], { type: 'audio/wav' });
}

button.onclick = async () => {
  button.disabled = select.disabled = true;
  audio.pause();
  status.textContent = 'Rendering the production audio graph…';
  const mix = select.value;
  try {
    const context = new OfflineAudioContext(1, 48000 * 60, 48000);
    // Offline suspend checkpoints expose the real audio clock. Only the state
    // flag is adapted so the production scheduler sees an active audio device.
    const clock = new Proxy(context, {
      get(target, key) {
        if (key === 'state') return 'running';
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')!;
    const sound = new Sound();
    try {
      Object.defineProperty(globalThis, 'AudioContext', {
        configurable: true,
        value: function () {
          return clock;
        },
      });
      sound.unlock();
    } finally {
      Object.defineProperty(globalThis, 'AudioContext', descriptor);
    }
    if (!sound.music) throw Error('Audio graph did not initialize');
    let maxMusicVoices = 0,
      maxEffectVoices = 0,
      lastShot = -1;
    const cues = [
      [8, 'signal-charge'],
      [10, 'caller-record'],
      [10.75, 'caller-lock'],
      [12, 'signal-cut'],
      [14, 'signal-reboot'],
      [23, 'signal-lock'],
      [36, 'signal-charge'],
      [37, 'signal-lock'],
      [38, 'signal-fire'],
    ] as const;
    let cue = 0;
    const update = () => {
      const t = context.currentTime;
      const scene: MusicScene = {
        area: 'cooling',
        theme: mix === 'cooling' ? 'cooling' : 'annex',
        room: t < 18 ? 'audio:room' : 'audio:boss',
        mode: t >= 58 ? 'paused' : 'playing',
        intensity: t < 2 ? 0 : 0.85,
        boss: t >= 18 && t < 50,
        bossPhase: t >= 34 ? 1 : 0,
        clear: t >= 50,
      };
      sound.updateMusic(scene);
      if (mix === 'combat') {
        if (t >= 6 && t < 16 && Math.floor(t * 8) > lastShot) {
          sound.play('shot');
          lastShot = Math.floor(t * 8);
        }
        while (cue < cues.length && t >= cues[cue][0]) sound.play(cues[cue++][1]);
      }
      maxMusicVoices = Math.max(maxMusicVoices, sound.music!.voiceCount);
      maxEffectVoices = Math.max(maxEffectVoices, sound.voices);
    };
    const checkpoints = Array.from({ length: 749 }, (_, i) => context.suspend((i + 1) * 0.08));
    update();
    const rendering = context.startRendering();
    for (const checkpoint of checkpoints) {
      await checkpoint;
      update();
      await context.resume();
    }
    const buffer = await rendering,
      samples = buffer.getChannelData(0);
    let peak = 0,
      clipped = 0,
      nonfinite = 0;
    for (const v of samples) {
      peak = Math.max(peak, Math.abs(v));
      if (Math.abs(v) >= 1) clipped++;
      if (!Number.isFinite(v)) nonfinite++;
    }
    const rms = (start: number, end: number) => {
      const segment = samples.subarray(start * buffer.sampleRate, end * buffer.sampleRate);
      return Math.sqrt(segment.reduce((sum, v) => sum + v * v, 0) / segment.length);
    };
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(wav(buffer));
    audio.src = download.href = objectUrl;
    audio.hidden = download.hidden = false;
    download.download = `dead-signal-${mix}.wav`;
    status.textContent = JSON.stringify(
      {
        mix,
        duration: buffer.duration,
        sampleRate: buffer.sampleRate,
        peak,
        clipped,
        nonfinite,
        maxMusicVoices,
        maxEffectVoices,
        rms: {
          entry: rms(0, 2),
          combat: rms(3, 18),
          boss: rms(21, 34),
          escalation: rms(34, 50),
          clear: rms(51, 58),
          pausedTail: rms(59, 60),
        },
        stopped: !sound.music.running && sound.music.targetGain === 0,
        graph:
          'Production Sound.unlock → Music.update / Sound.play → filters → master → compressor',
      },
      null,
      2,
    );
  } catch (error) {
    status.textContent = String(error);
  } finally {
    button.disabled = select.disabled = false;
  }
};
