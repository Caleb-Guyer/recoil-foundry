import { Sound } from '../src/audio.ts';
import { seeded } from '../src/rules.ts';
import { introAudio } from './trailer-intro.ts';
import type { EndingTiming } from './trailer-ending.ts';

export interface SoundCue {
  frame: number;
  kind: string;
}
export interface BeamFrame {
  frame: number;
  heat: number;
}
export const INTRO_FOLEY_GAIN = 1.35;
const weapons = new Set(['shot', 'scatter', 'heavy', 'charged', 'shell-shot', 'mass-shot']);
const impacts = new Set([
  'explode',
  'kill',
  'break',
  'slam',
  'crash',
  'cargo-impact',
  'breach',
  'shell-blast',
  'aftershock',
  'sapper-blast',
]);
const peakFor = (kind: string) =>
  weapons.has(kind)
    ? 0.52
    : impacts.has(kind)
      ? 0.56
      : kind === 'hit' || kind === 'armor'
        ? 0.19
        : kind === 'hurt'
          ? 0.3
          : kind === 'enemy' || kind === 'bank'
            ? 0.085
            : 0.14;

export function trailerSound(
  cues: SoundCue[],
  beams: BeamFrame[],
  duration: number,
  ending: EndingTiming,
  footsteps: readonly Float32Array[],
) {
  const rate = 48000;
  const channels = [
    new Float32Array(Math.ceil(duration * rate)),
    new Float32Array(Math.ceil(duration * rate)),
  ];
  const banks = new Map<string, Float32Array[]>();
  const audit: { kind: string; events: number; originalPeak: number; mixedPeak: number }[] = [];
  const previousRandom = Math.random;
  function bank(kind: string) {
    if (banks.has(kind)) return banks.get(kind)!;
    Math.random = seeded(`RF-TRAILER-SFX-${kind}`);
    const s = new Sound();
    s.unlock();
    s.musicEnabled = false;
    if (!s.context) throw new Error('Cannot synthesize trailer effects');
    const c = s.context as AudioContext & {
      processTo(time: number): void;
      exportAsAudioData(): { channelData: Float32Array[] };
    };
    s.master!.gain.value = 1;
    // Keep the entire effects bus active, not just the master output.
    const keeper = c.createOscillator(),
      zero = c.createGain();
    zero.gain.value = 0;
    keeper.connect(zero);
    zero.connect(s.effects!);
    keeper.start();
    if (kind === 'beam') s.updateTorch(true, 0.65);
    else s.play(kind);
    c.processTo(kind === 'beam' ? 3 : 1.1);
    const raw = c.exportAsAudioData().channelData;
    const peak = raw.reduce((max, ch) => ch.reduce((m, v) => Math.max(m, Math.abs(v)), max), 0);
    if (!Number.isFinite(peak) || peak < 1e-6)
      throw new Error(`Silent/invalid game sound: ${kind}`);
    const target = kind === 'beam' ? 0.2 : peakFor(kind);
    const data = raw.map((channel) =>
      Float32Array.from(channel, (v) => (target * Math.tanh((v / peak) * 1.4)) / Math.tanh(1.4)),
    );
    banks.set(kind, data);
    audit.push({ kind, events: 0, originalPeak: peak, mixedPeak: target });
    return data;
  }
  function mix(data: Float32Array[], at: number, length = data[0].length, fade = false) {
    const start = Math.round(at * rate);
    for (let ch = 0; ch < 2; ch++)
      for (let i = 0; i < length && start + i < channels[ch].length; i++) {
        const envelope = fade ? Math.min(1, i / 240, (length - i) / 480) : 1;
        channels[ch][start + i] += (data[ch] ?? data[0])[i % data[0].length] * envelope;
      }
  }
  // The intro is mixed directly, without a loudness normalizer lifting its room tone.
  mix(
    introAudio(footsteps, rate).map((ch) => Float32Array.from(ch, (v) => v * INTRO_FOLEY_GAIN)),
    0,
  );
  const last = new Map<string, number>();
  for (const cue of cues) {
    const cooldown =
      cue.kind === 'hit' || cue.kind === 'armor' || cue.kind === 'kill' ? 0.055 : 0.015;
    if (cue.frame / 60 - (last.get(cue.kind) ?? -10) < cooldown) continue;
    last.set(cue.kind, cue.frame / 60);
    mix(bank(cue.kind), cue.frame / 60);
    audit.find((a) => a.kind === cue.kind)!.events++;
  }
  let first = 0;
  while (first < beams.length) {
    let end = first + 1;
    while (end < beams.length && beams[end].frame === beams[end - 1].frame + 1) end++;
    mix(
      bank('beam'),
      beams[first].frame / 60,
      Math.round(((beams[end - 1].frame - beams[first].frame + 1) / 60) * rate),
      true,
    );
    audit.find((a) => a.kind === 'beam')!.events++;
    first = end;
  }
  Math.random = previousRandom;
  // Give the recorded closing fill room, then clear the effects for its two title hits.
  const impact = ending.impactFrame / 60;
  const fadeStart = impact - 2.4;
  for (const channel of channels)
    for (let i = Math.round(fadeStart * rate); i < channel.length; i++) {
      const x = Math.max(0, Math.min(1, (i / rate - fadeStart) / 2.4));
      const release = Math.max(0, Math.min(1, (impact + 0.04 - i / rate) / 0.04));
      channel[i] *= (1 - 0.55 * x * x * (3 - 2 * x)) * release;
    }
  // Gentle bus saturation controls overlapping blast peaks before the final mix.
  for (const channel of channels)
    for (let i = 0; i < channel.length; i++) channel[i] = Math.tanh(channel[i] * 1.15) * 0.8;
  return {
    sampleRate: rate,
    channelData: channels,
    numberOfChannels: 2,
    length: channels[0].length,
    audit,
  };
}
