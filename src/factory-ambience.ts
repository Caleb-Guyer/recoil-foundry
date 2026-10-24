import type { AreaId } from './areas.ts';
import type { FactoryAudioScene } from './factory-audio-scene.ts';

// Deliberately below the attack cues: these are distant continuous textures,
// never fake warning sounds. All three sources are mono and centered, so the
// mono preference cannot cancel a layer or imply a direction.
export const FACTORY_AUDIO_PROFILES = {
  docks: { bed: 0.034, low: 240, motor: 0.021, hz: 43, texture: 0.016, band: 370, rate: 0.7 },
  furnace: { bed: 0.042, low: 1150, motor: 0.016, hz: 58, texture: 0.014, band: 1050, rate: 0.54 },
  cooling: { bed: 0.029, low: 410, motor: 0.024, hz: 49, texture: 0.024, band: 260, rate: 0.8 },
  reclamation: {
    bed: 0.029,
    low: 590,
    motor: 0.019,
    hz: 67,
    texture: 0.024,
    band: 680,
    rate: 1.45,
  },
  rooftops: { bed: 0.052, low: 1850, motor: 0.007, hz: 36, texture: 0.006, band: 330, rate: 0.42 },
} satisfies Record<
  AreaId,
  {
    bed: number;
    low: number;
    motor: number;
    hz: number;
    texture: number;
    band: number;
    rate: number;
  }
>;

type Source = AudioBufferSourceNode | OscillatorNode;
interface Voice {
  sources: Source[];
  nodes: AudioNode[];
  gains: GainNode[];
  low: BiquadFilterNode;
  band: BiquadFilterNode;
  motor: OscillatorNode;
  texture: AudioBufferSourceNode;
}
const unit = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

export class FactoryAmbience {
  private voice: Voice | null = null;
  private buffers: AudioBuffer[] | null = null;
  private targets = new Map<AudioParam, number>();
  private failed = false;
  private context: AudioContext | null;
  private destination: AudioNode | null;
  constructor(context: AudioContext | null, destination: AudioNode | null) {
    this.context = context;
    this.destination = destination;
  }
  get active() {
    return this.voice !== null;
  }
  get voiceCount() {
    return this.voice?.sources.length ?? 0;
  }

  private makeBuffer(texture: boolean) {
    const c = this.context!;
    const length = Math.ceil(c.sampleRate * (texture ? 4.8 : 6.4));
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = texture ? 571907 : 105179;
    let low = 0;
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = seed / 2147483648 - 1;
      low = low * 0.97 + white * 0.03;
      const phase = (i / length) * Math.PI * 2;
      // Long air swells and a rounded pump/belt cycle, with no sharp rhythmic
      // transients that could be mistaken for an enemy tell or impact.
      const envelope = texture
        ? 0.18 + 0.62 * Math.pow(0.5 + 0.5 * Math.cos(phase * 8), 3)
        : 0.65 + Math.sin(phase) * 0.18 + Math.sin(phase * 3) * 0.1;
      data[i] = (white * (texture ? 0.45 : 0.38) + low * 1.7) * envelope;
    }
    const seam = Math.min(Math.ceil(c.sampleRate * 0.08), Math.floor(length / 4));
    for (let i = 0; i < seam; i++) {
      const t = i / seam;
      data[i] = data[length - seam + i] * (1 - t) + data[i] * t;
    }
    return buffer;
  }

  private start() {
    const c = this.context!;
    const nodes: AudioNode[] = [];
    const sources: Source[] = [];
    const add = <T extends AudioNode>(node: T) => {
      nodes.push(node);
      return node;
    };
    try {
      this.buffers ??= [this.makeBuffer(false), this.makeBuffer(true)];
      const bed = add(c.createBufferSource());
      sources.push(bed);
      const low = add(c.createBiquadFilter());
      low.type = 'lowpass';
      low.Q.value = 0.45;
      const high = add(c.createBiquadFilter());
      high.type = 'highpass';
      high.frequency.value = 55;
      high.Q.value = 0.4;
      const motor = add(c.createOscillator());
      sources.push(motor);
      motor.type = 'sine';
      // An oscillator defaults to 440 Hz. Start in the motor register before
      // the fade-in so a fresh room never makes an audible downward siren.
      motor.frequency.value = 43;
      const texture = add(c.createBufferSource());
      sources.push(texture);
      const band = add(c.createBiquadFilter());
      band.type = 'bandpass';
      band.Q.value = 0.55;
      const gains = [add(c.createGain()), add(c.createGain()), add(c.createGain())];
      for (const gain of gains) {
        gain.gain.value = 0;
        gain.connect(this.destination!);
      }
      bed.buffer = this.buffers[0];
      bed.loop = true;
      texture.buffer = this.buffers[1];
      texture.loop = true;
      bed.connect(high);
      high.connect(low);
      low.connect(gains[0]);
      motor.connect(gains[1]);
      texture.connect(band);
      band.connect(gains[2]);
      const voice = { nodes, sources, gains, low, band, motor, texture };
      this.voice = voice;
      for (const source of sources) {
        source.onended = () => {
          if (this.voice === voice) this.stop();
        };
        source.start();
      }
    } catch {
      this.voice = null;
      for (const source of sources) {
        source.onended = null;
        try {
          source.stop();
        } catch {}
      }
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {}
      }
      this.failed = true;
    }
  }

  private target(param: AudioParam, value: number, constant = 0.7) {
    if (this.targets.get(param) === value) return;
    param.setTargetAtTime(value, this.context!.currentTime, constant);
    this.targets.set(param, value);
  }

  update(scene: FactoryAudioScene | null, active = true, _mono = false) {
    if (
      !active ||
      !scene ||
      !this.context ||
      !this.destination ||
      this.context.state !== 'running' ||
      !Object.hasOwn(FACTORY_AUDIO_PROFILES, scene.area)
    ) {
      this.stop();
      return;
    }
    if (this.failed) return;
    if (!this.voice) this.start();
    if (!this.voice) return;
    const v = this.voice;
    const p = FACTORY_AUDIO_PROFILES[scene.area];
    const power = unit(scene.power),
      activity = unit(scene.activity);
    // Room identity changes timbre slightly without restarting or stacking
    // sources. Changing areas retunes the existing graph with a soft ramp.
    let hash = 0;
    for (let i = 0; i < scene.room.length; i++)
      hash = (Math.imul(hash, 31) + scene.room.charCodeAt(i)) | 0;
    const variation = 0.98 + ((hash >>> 0) % 41) / 1000;
    this.target(v.low.frequency, p.low * variation);
    this.target(v.band.frequency, p.band * variation);
    this.target(v.motor.frequency, p.hz * variation, 0.9);
    this.target(v.texture.playbackRate, p.rate * variation, 0.9);
    // Air/room tone remains after power loss; all electrical and mechanical
    // layers disappear. Outdoor wind is unaffected by a fuse or cut circuit.
    this.target(v.gains[0].gain, p.bed * (scene.area === 'rooftops' ? 1 : 0.45 + power * 0.55));
    this.target(v.gains[1].gain, p.motor * power * (0.7 + activity * 0.3));
    this.target(v.gains[2].gain, p.texture * power * (0.55 + activity * 0.45));
  }

  stop() {
    const voice = this.voice;
    this.voice = null;
    this.targets.clear();
    this.failed = false;
    if (!voice) return;
    const now = this.context!.currentTime;
    for (const gain of voice.gains) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
    }
    for (const source of voice.sources) {
      source.onended = null;
      try {
        source.stop(now);
      } catch {}
    }
    for (const node of voice.nodes) {
      try {
        node.disconnect();
      } catch {}
    }
  }
}
