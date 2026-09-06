import { MUSIC_PROFILES, musicNotes } from './music-score.ts';
import type { MusicNote, MusicScene } from './music-score.ts';

export const MUSIC_VOICES = 24;
export const MUSIC_LOOKAHEAD = 0.1;
const SILENCE = 0.0001;
interface Voice {
  source: AudioScheduledSourceNode;
  gain: GainNode;
  nodes: AudioNode[];
  ends: number;
  starts: number;
  peak: number;
}

// One short scheduling horizon follows the audio clock. No background timers or
// gameplay RNG: frame stalls can skip a beat, but never release a backlog of notes.
export class Music {
  context: AudioContext;
  bus: GainNode;
  voices = new Set<Voice>();
  nextTime = 0;
  step = 0;
  scene: MusicScene | null = null;
  running = false;
  intensity = 0;
  lastTime = 0;
  duckUntil = 0;
  targetGain = 0;
  noise: AudioBuffer;
  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.bus = context.createGain();
    this.bus.gain.value = 0;
    // Keep low percussion rumble out of the mix and leave the sharp attack band
    // to the gun and warning sounds.
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 32;
    highpass.Q.value = 0.5;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3200;
    lowpass.Q.value = 0.5;
    this.bus.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(destination);
    this.noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.25), context.sampleRate);
    const data = this.noise.getChannelData(0);
    let state = 179;
    for (let i = 0; i < data.length; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      data[i] = (state / 4294967296) * 2 - 1;
    }
  }
  get voiceCount() {
    return this.voices.size;
  }
  disposeVoice(voice: Voice) {
    voice.source.onended = null;
    for (const node of voice.nodes) node.disconnect();
    this.voices.delete(voice);
  }
  stop() {
    const now = this.context.currentTime;
    this.running = false;
    this.targetGain = 0;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setTargetAtTime(0, now, 0.012);
    for (const voice of [...this.voices]) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(
        voice.starts > now
          ? SILENCE
          : Math.min(voice.peak, Math.max(SILENCE, voice.gain.gain.value)),
        now,
      );
      voice.gain.gain.setTargetAtTime(SILENCE, now, 0.008);
      // This also cancels sources scheduled ahead of a pause/mute.
      voice.source.stop(now + 0.04);
      voice.ends = Math.min(voice.ends, now + 0.04);
    }
    this.nextTime = now;
  }
  reset() {
    this.stop();
    this.step = 0;
    this.scene = null;
    this.intensity = 0;
    this.duckUntil = 0;
  }
  duck(duration = 0.65) {
    this.duckUntil = Math.max(this.duckUntil, this.context.currentTime + duration);
    if (this.running) this.setGain(this.gainForScene(), 0.012);
  }
  gainForScene() {
    const calm = this.scene?.clear || this.scene?.mode === 'upgrade';
    const volume = calm ? 0.36 : 0.58 + this.intensity * 0.06;
    return volume * (this.context.currentTime < this.duckUntil ? 0.28 : 1);
  }
  setGain(value: number, smoothing: number) {
    if (Math.abs(value - this.targetGain) < 0.002) return;
    this.targetGain = value;
    this.bus.gain.setTargetAtTime(value, this.context.currentTime, smoothing);
  }
  update(scene: MusicScene, enabled = true, active = true) {
    const now = this.context.currentTime;
    const changed = !this.scene || this.scene.room !== scene.room || this.scene.area !== scene.area;
    const calmChanged =
      !!this.scene &&
      (this.scene.clear || this.scene.mode === 'upgrade') !==
        (scene.clear || scene.mode === 'upgrade');
    if (changed) this.reset();
    else if (calmChanged) this.stop();
    this.scene = { ...scene };
    if (
      !enabled ||
      !active ||
      this.context.state !== 'running' ||
      !['playing', 'upgrade'].includes(scene.mode)
    ) {
      if (this.running || this.targetGain) this.stop();
      this.lastTime = now;
      return;
    }
    // Clean ended voices even if a browser delays onended callbacks in the background.
    for (const voice of [...this.voices]) if (voice.ends <= now) this.disposeVoice(voice);
    const dt = Math.max(0, Math.min(0.1, now - this.lastTime));
    this.lastTime = now;
    const target =
      scene.clear || scene.mode === 'upgrade' ? 0 : Math.max(0, Math.min(1, scene.intensity));
    this.intensity +=
      (target - this.intensity) * (1 - Math.exp(-dt * (target > this.intensity ? 2.5 : 1.1)));
    if (!this.running) {
      this.running = true;
      this.nextTime = now + 0.025;
      // Restart a phrase after silence; don't resume halfway through a queued fill.
      this.step = Math.ceil(this.step / 16) * 16;
    }
    this.setGain(this.gainForScene(), 0.16);
    const bpm = MUSIC_PROFILES[scene.area].bpm;
    const interval = 60 / bpm / 4;
    if (this.nextTime < now - 0.05) {
      this.step += Math.ceil((now - this.nextTime) / interval);
      this.nextTime = now + 0.025;
    }
    let scheduled = 0;
    while (this.nextTime < now + MUSIC_LOOKAHEAD && scheduled < 4) {
      const at = Math.max(now + 0.005, this.nextTime);
      for (const note of musicNotes(
        scene.area,
        this.step,
        this.intensity,
        scene.boss,
        scene.clear || scene.mode === 'upgrade',
      ))
        this.note(note, at, bpm);
      this.nextTime += interval;
      this.step++;
      scheduled++;
    }
  }
  note(note: MusicNote, at: number, bpm: number) {
    if (this.voices.size >= MUSIC_VOICES) return;
    const c = this.context;
    const gain = c.createGain();
    const length = Math.max(0.04, Math.min(3.5, (note.duration * 60) / bpm));
    const velocity = Math.max(0, Math.min(1, note.velocity));
    const pitch = 440 * Math.pow(2, ((note.midi ?? 36) - 69) / 12);
    let source: AudioScheduledSourceNode;
    let peak: number;
    let attack = 0.004;
    const nodes: AudioNode[] = [gain];
    if (note.part === 'snare' || note.part === 'tick') {
      const noise = c.createBufferSource();
      noise.buffer = this.noise;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = note.part === 'snare' ? 1300 : 2800;
      filter.Q.value = note.part === 'snare' ? 0.7 : 1.2;
      noise.connect(filter);
      filter.connect(gain);
      nodes.push(noise, filter);
      source = noise;
      peak = note.part === 'snare' ? 0.18 : 0.07;
    } else {
      const osc = c.createOscillator();
      osc.type = note.part === 'bass' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(note.part === 'kick' ? 110 : pitch, at);
      if (note.part === 'kick') osc.frequency.exponentialRampToValueAtTime(43, at + 0.11);
      if (note.part === 'pad') {
        attack = 0.25;
        osc.detune.value = (((note.midi ?? 0) % 3) - 1) * 4;
      }
      source = osc;
      nodes.push(osc);
      osc.connect(gain);
      peak =
        note.part === 'kick' ? 0.4 : note.part === 'bass' ? 0.3 : note.part === 'pad' ? 0.3 : 0.25;
    }
    const end = at + length + 0.03;
    gain.gain.setValueAtTime(SILENCE, at);
    gain.gain.linearRampToValueAtTime(
      Math.max(SILENCE, peak * velocity),
      at + Math.min(attack, length * 0.3),
    );
    gain.gain.exponentialRampToValueAtTime(SILENCE, at + length);
    gain.connect(this.bus);
    const voice = { source, gain, nodes, ends: end, starts: at, peak: peak * velocity };
    this.voices.add(voice);
    source.onended = () => this.disposeVoice(voice);
    source.start(at);
    source.stop(end);
  }
}
