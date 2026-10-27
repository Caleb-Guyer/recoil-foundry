import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Sound } from '../src/audio.ts';
import { seeded } from '../src/rules.ts';
import { OPERATOR_SURFACE_SOUNDS } from '../src/operator-surface-audio.ts';
const audio = createRequire(resolve('.media-tools/audio/package.json'));
const { RenderingAudioContext } = audio('web-audio-engine');
class CaptureAudio extends RenderingAudioContext {
  constructor() {
    super({ sampleRate: 48000, numberOfChannels: 2, blockSize: 128 });
  }
  get state() {
    return 'running';
  }
}
Object.defineProperty(globalThis, 'AudioContext', { value: CaptureAudio, configurable: true });
const out = resolve(process.argv[2] ?? '../../The Operator 5.33.0');
mkdirSync(out, { recursive: true });
const before = Math.random;
const result: object[] = [];
try {
  for (const kind of OPERATOR_SURFACE_SOUNDS) {
    // Reproduce the procedural source buffer; no speaker or browser audio is used.
    Math.random = seeded('OPERATOR-OFFLINE-533');
    const sound = new Sound();
    sound.musicEnabled = false;
    sound.unlock();
    if (!sound.context || !sound.effects) throw Error('Offline context unavailable');
    const c = sound.context as AudioContext & {
      processTo(n: number): void;
      exportAsAudioData(): { channelData: Float32Array[] };
    };
    const keep = c.createOscillator(),
      zero = c.createGain();
    zero.gain.value = 0;
    keep.connect(zero);
    zero.connect(sound.effects);
    keep.start();
    sound.play(kind);
    c.processTo(0.5);
    const data = c.exportAsAudioData().channelData;
    let peak = 0,
      energy = 0,
      invalid = 0;
    for (const ch of data)
      for (const v of ch) {
        peak = Math.max(peak, Math.abs(v));
        energy += v * v;
        if (!Number.isFinite(v)) invalid++;
      }
    const hash = createHash('sha256').update(Buffer.from(data[0].buffer)).digest('hex');
    if (invalid || peak < 1e-6 || peak > 1) throw Error(`Invalid or silent cue ${kind}: ${peak}`);
    result.push({
      kind,
      peak,
      rms: Math.sqrt(energy / data.reduce((n, ch) => n + ch.length, 0)),
      sha256: hash,
    });
    sound.enabled = false;
    await c.close();
  }
} finally {
  Math.random = before;
}
const hashes = new Set(result.map((r) => (r as { sha256: string }).sha256));
if (hashes.size !== OPERATOR_SURFACE_SOUNDS.length) throw Error('Surface cues are not distinct');
writeFileSync(
  resolve(out, 'surface-audio-audit.json'),
  JSON.stringify(
    {
      scope: 'Offline 48kHz procedural render with no audible playback; not a listening test.',
      cues: result,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    cues: result.length,
    distinct: hashes.size,
    maxPeak: Math.max(...result.map((r) => (r as { peak: number }).peak)),
    offline: true,
  }),
);
