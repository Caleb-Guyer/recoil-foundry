import { Music } from './music.ts';
import { RainAmbience } from './rain-audio.ts';
import type { MusicScene } from './music-score.ts';
import { FactoryAmbience } from './factory-ambience.ts';
import type { FactoryAudioScene } from './factory-audio-scene.ts';
import { soundCooldownKey, spatialMix, validSoundPosition } from './sound-event.ts';
import type { SoundListener, SoundOrigin, SoundMaterial } from './sound-event.ts';

const COOLDOWN_ENTRIES = 384;
const MATERIAL_IMPACTS = new Set([
  'hit',
  'armor',
  'nail-impact',
  'mass-impact',
  'forge-impact',
  'prop',
  'break',
  'kill',
  'shutdown-break',
]);

interface SpatialVoice {
  origin: SoundOrigin;
  warning: boolean;
  gain: GainNode;
  panner: StereoPannerNode | null;
  pan: number;
  level: number;
}

const CINEMATIC_CUES = new Set([
  'cinema-start',
  'cinema-plane',
  'cinema-cable',
  'cinema-impact',
  'cinema-core',
  'cinema-rupture',
  'cinema-escape',
  'cinema-explosion',
]);

const ATTACK_WARNINGS = new Set([
  'repair-warn',
  'relay-warn',
  'sorting-warn',
  'weld-warn',
  'aim-warn',
  'lock',
  'charge',
  'machine',
  'pressure-warn',
  'fan-warn',
  'pressure-open',
  'flood-warn',
  'reinforce',
  'crane-wind',
  'kiln-wind',
  'strain',
  'cargo-release',
  'scrap-release',
  'storm-warn',
  'arm',
  'phase',
  'interceptor-lock',
  'interceptor-heavy',
  'finale-arrival',
  'finale-transform',
  'finale-fan-lock',
  'finale-field-lock',
  'finale-aim-lock',
  'finale-arena-warn',
  'arsenal-dash-warn',
  'arsenal-plane',
  'arsenal-core-warn',
  'arsenal-collapse-warn',
  'loader',
  'press',
  'scrapper-lock',
  'harpoon-lock',
  'angler-lock',
  'crawler-lock',
  'turbine-wind',
  'train-warn',
  'train-horn',
  'sapper-lock',
  'sapper-tick',
  'audit-tell',
  'audit-recall',
  'train-near',
  'signal-charge',
  'signal-lock',
  'caller-record',
  'caller-lock',
]);

// Leave space for the whole cue, including delayed notes and long wind-ups.
const WARNING_HOLD: Record<string, number> = {
  'sorting-warn': 0.85,
  'weld-warn': 1.25,
  'audit-recall': 1.1,
  'audit-tell': 0.4,
  'train-horn': 0.65,
  'turbine-wind': 0.55,
  'flood-warn': 0.65,
  'fan-warn': 1.25,
  'harpoon-lock': 0.5,
  'sapper-lock': 0.45,
  'cargo-release': 0.45,
  'scrap-release': 1.15,
  'storm-warn': 1.5,
  'interceptor-lock': 0.35,
  'finale-arrival': 1.1,
  'finale-transform': 1.3,
  'finale-fan-lock': 0.92,
  'finale-field-lock': 1.4,
  'finale-aim-lock': 0.92,
  'finale-arena-warn': 1.65,
  'arsenal-dash-warn': 1.1,
  'arsenal-plane': 2.2,
  'arsenal-core-warn': 1.8,
  'arsenal-collapse-warn': 2.5,
  'crane-wind': 0.42,
  'kiln-wind': 0.4,
  machine: 0.45,
  loader: 0.35,
  phase: 0.35,
  'signal-charge': 0.36,
  'signal-lock': 0.3,
  'caller-record': 0.23,
  'caller-lock': 0.34,
};

export function volumeLevel(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
}

export class Sound {
  private audioEnabled = true;
  private scoreEnabled = true;
  private effectLevel = 1;
  private musicLevel = 1;
  private monoEnabled = false;
  private listener: SoundListener | null = null;
  private cueOrigin: SoundOrigin | null = null;
  private cueWarning = false;
  private effectsSuspended = false;
  private audioRoom: string | null = null;
  private worldScene: FactoryAudioScene | null = null;
  private worldActive = true;
  factory: FactoryAmbience | null = null;
  get mono() {
    return this.monoEnabled;
  }
  set mono(value: boolean) {
    this.monoEnabled = !!value;
    this.updateOutputChannels();
    this.updateSpatialVoices();
    this.refreshWorld();
  }
  private updateOutputChannels(master = this.master) {
    if (!master) return;
    try {
      // Speaker downmix combines both input channels before the compressor.
      // Explicit stereo also restores the rain's width when mono is disabled.
      master.channelCount = this.mono ? 1 : 2;
      master.channelCountMode = 'explicit';
      master.channelInterpretation = 'speakers';
    } catch {
      // Legacy implementations can retain the centered per-voice fallback.
    }
  }
  setListener(listener: SoundListener | null) {
    this.listener = validSoundPosition(listener) ? { x: listener.x, y: listener.y } : null;
    this.updateSpatialVoices();
  }
  private updateSpatialVoice(voice: SpatialVoice, immediate = false) {
    const c = this.context;
    if (!c) return;
    const mix = spatialMix(voice.origin, this.listener, this.mono, voice.warning);
    if (immediate) {
      voice.gain.gain.value = mix.gain;
      if (voice.panner) voice.panner.pan.value = mix.pan;
      voice.pan = mix.pan;
      voice.level = mix.gain;
    } else {
      if (Math.abs(mix.gain - voice.level) >= 0.002) {
        voice.gain.gain.setTargetAtTime(mix.gain, c.currentTime, 0.025);
        voice.level = mix.gain;
      }
      if (voice.panner && Math.abs(mix.pan - voice.pan) >= 0.002) {
        voice.panner.pan.setTargetAtTime(mix.pan, c.currentTime, 0.025);
        voice.pan = mix.pan;
      }
    }
  }
  private updateSpatialVoices() {
    this.pruneEffects();
    for (const voice of this.effectVoices.values())
      if (voice.spatial) this.updateSpatialVoice(voice.spatial);
  }
  private connectEffect(gain: GainNode, nodes: AudioNode[]) {
    const destination = this.priorityCue
      ? (this.effectsOutput ?? this.master!)
      : (this.effects ?? this.master!);
    if (!this.cueOrigin) {
      gain.connect(destination);
      return;
    }
    const spatialGain = this.context!.createGain();
    // Older WebAudio implementations still get distance mixing in the center.
    let panner: StereoPannerNode | null = null;
    try {
      if (typeof this.context!.createStereoPanner === 'function')
        panner = this.context!.createStereoPanner();
    } catch {}
    const spatial: SpatialVoice = {
      origin: { ...this.cueOrigin },
      warning: this.cueWarning,
      gain: spatialGain,
      panner,
      pan: 0,
      level: 1,
    };
    this.updateSpatialVoice(spatial, true);
    gain.connect(spatialGain);
    nodes.push(spatialGain);
    if (panner) {
      spatialGain.connect(panner);
      panner.connect(destination);
      nodes.push(panner);
    } else spatialGain.connect(destination);
    return spatial;
  }
  private refreshWorld() {
    this.factory?.update(
      this.worldScene,
      this.worldActive &&
        !this.effectsSuspended &&
        !this.cinematicQuiet &&
        this.enabled &&
        this.effectsVolume > 0,
      this.mono,
    );
  }
  updateWorld(scene: FactoryAudioScene | null, active = true) {
    if (this.worldScene && (!scene || this.worldScene.room !== scene.room)) {
      this.resetToolCadence();
      for (const [source, voice] of [...this.effectVoices]) {
        if (!voice.spatial || voice.cinematic) continue;
        try {
          source.stop(this.context!.currentTime);
        } catch {}
        voice.dispose();
      }
    }
    this.worldScene = scene ? { ...scene } : null;
    this.worldActive = active;
    if (!active) {
      this.cancelEffects();
      this.updateTorch(false);
    }
    this.pruneEffects();
    this.refreshWorld();
  }
  effectsOutput: GainNode | null = null;
  musicOutput: GainNode | null = null;
  get effectsVolume() {
    return this.effectLevel;
  }
  set effectsVolume(value: number) {
    this.effectLevel = volumeLevel(value);
    if (this.context)
      this.effectsOutput?.gain.setTargetAtTime(this.effectLevel, this.context.currentTime, 0.012);
    if (!this.effectLevel) {
      this.updateTorch(false);
      this.rain?.stop();
      this.factory?.stop();
      this.cancelEffects();
    }
  }
  get musicVolume() {
    return this.musicLevel;
  }
  set musicVolume(value: number) {
    this.musicLevel = volumeLevel(value);
    if (this.context)
      this.musicOutput?.gain.setTargetAtTime(this.musicLevel, this.context.currentTime, 0.012);
    if (!this.musicLevel) this.silenceMusic();
  }
  music: Music | null = null;
  get enabled() {
    return this.audioEnabled;
  }
  set enabled(value: boolean) {
    this.audioEnabled = value;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(value ? 0.34 : 0, this.context.currentTime, 0.012);
    if (!value) {
      this.silenceMusic();
      this.updateTorch(false);
      this.rain?.stop();
      this.factory?.stop();
      this.cancelEffects();
    }
  }
  get musicEnabled() {
    return this.scoreEnabled;
  }
  set musicEnabled(value: boolean) {
    this.scoreEnabled = value;
    if (!value) this.silenceMusic();
  }
  context: AudioContext | null = null;
  master: GainNode | null = null;
  effects: GainNode | null = null;
  private priorityCue = false;
  private cinematicCue = false;
  private cinematicQuiet = false;
  private cinematicRoom: string | null = null;
  private effectVoices = new Map<
    AudioScheduledSourceNode,
    { dispose: () => void; cinematic: boolean; ends: number; spatial?: SpatialVoice }
  >();
  rain: RainAmbience | null = null;
  private pruneEffects() {
    if (!this.context) return;
    for (const voice of this.effectVoices.values())
      if (voice.spatial && voice.ends <= this.context.currentTime) voice.dispose();
  }
  private cancelEffects(cinematicOnly = false) {
    this.resetToolCadence();
    for (const [source, voice] of [...this.effectVoices]) {
      if (cinematicOnly && !voice.cinematic) continue;
      try {
        source.stop(this.context!.currentTime);
      } catch {}
      voice.dispose();
    }
  }
  private trackEffect(
    source: AudioScheduledSourceNode,
    nodes: AudioNode[],
    ends: number,
    spatial?: SpatialVoice,
  ) {
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      source.onended = null;
      this.voices--;
      for (const node of nodes) node.disconnect();
      this.effectVoices.delete(source);
    };
    this.effectVoices.set(source, { dispose, cinematic: this.cinematicCue, ends, spatial });
    source.onended = dispose;
  }
  private effectsDuckUntil = 0;
  private repeaterLast: number | null = null;
  private repeaterPressure = 0;
  private repeaterOrigin: SoundOrigin | null = null;
  private resetToolCadence() {
    this.repeaterLast = null;
    this.repeaterPressure = 0;
    this.repeaterOrigin = null;
  }
  /** Only real discharge events build pressure. Frame updates can release it, never start it. */
  updateToolAudio(firing: boolean) {
    const c = this.context;
    if (
      !c ||
      c.state !== 'running' ||
      !this.enabled ||
      !this.effectsVolume ||
      this.effectsSuspended ||
      !this.worldActive ||
      this.cinematicQuiet
    ) {
      this.resetToolCadence();
      return;
    }
    if (this.repeaterLast === null) return;
    const elapsed = c.currentTime - this.repeaterLast;
    if (elapsed < 0 || elapsed > 0.35) {
      this.resetToolCadence();
      return;
    }
    if (firing) return;
    this.play('repeater-release', this.repeaterOrigin ?? undefined);
    this.resetToolCadence();
  }
  noise: AudioBuffer | null = null;
  private torchVoice: { osc: OscillatorNode; gain: GainNode; frequency: number } | null = null;
  updateTorch(active: boolean, heat = 0) {
    const c = this.context;
    if (
      !active ||
      this.cinematicQuiet ||
      this.effectsSuspended ||
      !this.worldActive ||
      !this.enabled ||
      !this.effectsVolume ||
      !c ||
      c.state !== 'running'
    ) {
      const voice = this.torchVoice;
      if (voice && c) {
        voice.gain.gain.setTargetAtTime(0, c.currentTime, 0.02);
        voice.osc.stop(c.currentTime + 0.12);
      }
      this.torchVoice = null;
      return;
    }
    if (!this.torchVoice) {
      const osc = c.createOscillator(),
        gain = c.createGain();
      osc.type = 'sawtooth';
      gain.gain.value = 0;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 650;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.effects ?? this.master!);
      osc.start();
      gain.gain.setTargetAtTime(0.035, c.currentTime, 0.025);
      this.torchVoice = { osc, gain, frequency: -1 };
      // The filter is owned by this voice and disconnects with its oscillator.
      osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    }
    const frequency = 92 + Math.min(1, Math.max(0, heat)) * 48;
    if (Math.abs(frequency - this.torchVoice.frequency) >= 0.5) {
      this.torchVoice.osc.frequency.setTargetAtTime(frequency, c.currentTime, 0.08);
      this.torchVoice.frequency = frequency;
    }
  }
  voices = 0;
  played = new Map<string, number>();
  unlock() {
    if (!this.context) {
      const Context = globalThis.AudioContext;
      if (typeof Context !== 'function') return;
      let c: AudioContext | null = null;
      try {
        c = new Context();
        const master = c.createGain();
        this.updateOutputChannels(master);
        master.gain.value = this.enabled ? 0.34 : 0;
        const compressor = c.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.ratio.value = 8;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.12;
        master.connect(compressor);
        compressor.connect(c.destination);
        const effects = c.createGain();
        effects.gain.value = 1;
        const effectsOutput = c.createGain(),
          musicOutput = c.createGain();
        effectsOutput.gain.value = this.effectsVolume;
        musicOutput.gain.value = this.musicVolume;
        effects.connect(effectsOutput);
        effectsOutput.connect(master);
        musicOutput.connect(master);
        const noise = c.createBuffer(1, Math.ceil(c.sampleRate * 0.3), c.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.music = new Music(c, musicOutput);
        this.rain = new RainAmbience(c, effectsOutput);
        this.factory = new FactoryAmbience(c, effects);
        this.context = c;
        this.master = master;
        this.effects = effects;
        this.effectsOutput = effectsOutput;
        this.musicOutput = musicOutput;
        this.noise = noise;
      } catch {
        if (c) void c.close().catch(() => {});
        return;
      }
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }
  updateMusic(scene: MusicScene, active = true) {
    this.effectsSuspended = !active || scene.mode === 'paused';
    if (
      this.effectsSuspended ||
      this.context?.state !== 'running' ||
      (this.audioRoom !== null && this.audioRoom !== scene.room)
    ) {
      this.cancelEffects();
      this.updateTorch(false);
      if (this.audioRoom !== scene.room) this.played.clear();
    }
    this.audioRoom = scene.room;
    this.pruneEffects();
    const quiet =
      scene.effectsSilent ??
      (!!scene.rain &&
        !!scene.musicSilent &&
        ['approach', 'boarding'].includes(scene.cinema ?? ''));
    if (quiet && !this.cinematicQuiet) {
      this.cancelEffects();
      this.updateTorch(false);
    }
    this.cinematicQuiet = quiet;
    this.refreshWorld();
    const weatherActive =
      active && scene.mode === 'playing' && this.enabled && this.effectsVolume > 0;
    if (!weatherActive || (this.cinematicRoom !== null && this.cinematicRoom !== scene.room))
      this.cancelEffects(true);
    this.cinematicRoom = scene.rain ? scene.room : null;
    this.rain?.update(!!scene.rain && weatherActive, scene.rainIntensity);
    this.music?.update(scene, this.enabled && this.musicEnabled && this.musicVolume > 0, active);
  }
  resetMusic() {
    this.music?.reset();
    this.rain?.stop();
    this.cancelEffects();
    this.updateTorch(false);
    this.factory?.stop();
    this.worldScene = null;
    this.audioRoom = null;
    this.effectsSuspended = false;
    this.worldActive = true;
    this.played.clear();
    this.effectsDuckUntil = 0;
    if (this.context) {
      this.effects?.gain.cancelScheduledValues(this.context.currentTime);
      this.effects?.gain.setValueAtTime(1, this.context.currentTime);
    }
    this.cinematicQuiet = false;
    this.cinematicRoom = null;
  }
  silenceMusic() {
    this.music?.stop();
  }
  tone(
    start: number,
    end: number,
    length: number,
    volume: number,
    type: OscillatorType = 'triangle',
    delay = 0,
  ) {
    const c = this.context;
    if (
      !c ||
      c.state !== 'running' ||
      !this.enabled ||
      !this.effectsVolume ||
      this.effectsSuspended ||
      !this.worldActive
    )
      return;
    this.pruneEffects();
    if (this.voices >= (this.cinematicCue ? 28 : this.priorityCue ? 32 : 24)) return;
    this.voices++;
    const now = c.currentTime + delay,
      osc = c.createOscillator(),
      gain = c.createGain();
    const detune = 0.97 + Math.random() * 0.06;
    osc.type = type;
    osc.frequency.setValueAtTime(start * detune, now);
    osc.frequency.exponentialRampToValueAtTime(end, now + length);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    osc.connect(gain);
    const nodes: AudioNode[] = [osc, gain];
    const spatial = this.connectEffect(gain, nodes);
    this.trackEffect(osc, nodes, now + length + 0.01, spatial);
    osc.start(now);
    osc.stop(now + length + 0.01);
  }
  crack(length: number, volume: number, frequency: number, loop = false) {
    const c = this.context;
    if (
      !c ||
      c.state !== 'running' ||
      !this.enabled ||
      !this.effectsVolume ||
      this.effectsSuspended ||
      !this.worldActive
    )
      return;
    this.pruneEffects();
    if (this.voices >= (this.cinematicCue ? 28 : this.priorityCue ? 32 : 24)) return;
    this.voices++;
    const now = c.currentTime,
      source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    source.buffer = this.noise;
    source.loop = loop;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.6;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    source.connect(filter);
    filter.connect(gain);
    const nodes: AudioNode[] = [source, filter, gain];
    const spatial = this.connectEffect(gain, nodes);
    this.trackEffect(source, nodes, now + length + 0.01, spatial);
    source.start(now);
    source.stop(now + length + 0.01);
  }
  private materialLayer(material: SoundMaterial) {
    if (material === 'armor') this.tone(2300, 1350, 0.09, 0.018, 'sine');
    else if (material === 'casing') this.tone(450, 240, 0.075, 0.025, 'triangle');
    else if (material === 'cover') {
      this.crack(0.05, 0.026, 2600);
      this.tone(260, 120, 0.06, 0.018, 'triangle');
    } else if (material === 'power') {
      this.crack(0.065, 0.025, 3300);
      this.tone(920, 145, 0.12, 0.018, 'square');
    } else if (material === 'terrain') this.crack(0.055, 0.03, 650);
  }
  play(kind: string, origin?: SoundOrigin) {
    const c = this.context;
    if (
      !this.enabled ||
      !this.effectsVolume ||
      this.effectsSuspended ||
      !this.worldActive ||
      !c ||
      c.state !== 'running'
    )
      return;
    if (this.cinematicQuiet && !CINEMATIC_CUES.has(kind)) return;
    this.pruneEffects();
    const key = soundCooldownKey(kind, origin);
    const previous = this.played.get(key) ?? -10;
    const warning = ATTACK_WARNINGS.has(kind);
    const cooldown = warning
      ? 0.12
      : ['hit', 'armor', 'kill', 'nail-impact'].includes(kind)
        ? 0.055
        : 0.015;
    if (c.currentTime - previous < cooldown) return;
    this.played.delete(key);
    this.played.set(key, c.currentTime);
    while (this.played.size > COOLDOWN_ENTRIES)
      this.played.delete(this.played.keys().next().value!);
    this.cueOrigin = validSoundPosition(origin) ? { ...origin } : null;
    this.cueWarning = warning;
    try {
      this.playCue(kind);
      if (origin?.material && MATERIAL_IMPACTS.has(kind)) this.materialLayer(origin.material);
    } finally {
      this.cueOrigin = null;
      this.cueWarning = false;
      this.priorityCue = false;
      this.cinematicCue = false;
    }
  }
  private playCue(kind: string) {
    const c = this.context;
    if (!this.enabled || !this.effectsVolume || !c || c.state !== 'running') return;
    const cinematic = CINEMATIC_CUES.has(kind);
    if (this.cinematicQuiet && !cinematic) return;
    const warning = ATTACK_WARNINGS.has(kind);
    if (
      [
        'shot',
        'scatter',
        'heavy',
        'charged',
        'mass-shot',
        'shell-shot',
        'carbine-shot',
        'twinbore-shot',
        'shotgun-shot',
        'nail-shot',
      ].includes(kind)
    )
      this.resetToolCadence();
    this.priorityCue =
      cinematic ||
      warning ||
      ['hurt', 'win', 'dead', 'shutdown-stop', 'finale-shutdown', 'finale-release'].includes(kind);
    if (cinematic) {
      this.cinematicCue = true;
      this.music?.duck(kind === 'cinema-explosion' ? 4 : kind === 'cinema-plane' ? 2.5 : 1.25);
      if (kind === 'cinema-start') {
        this.tone(42, 82, 1.5, 0.1, 'sawtooth');
        this.tone(660, 110, 0.3, 0.05, 'triangle', 0.12);
        this.crack(0.3, 0.08, 1200);
      } else if (kind === 'cinema-plane') {
        this.tone(32, 86, 3.2, 0.09, 'sawtooth');
        this.tone(58, 104, 2.6, 0.045, 'triangle', 0.2);
        this.crack(3, 0.1, 470, true);
      } else if (kind === 'cinema-cable') {
        this.tone(140, 340, 1.8, 0.05, 'sawtooth');
        this.tone(1400, 410, 0.15, 0.045, 'triangle');
        this.crack(0.16, 0.065, 2400);
      } else if (kind === 'cinema-impact') {
        this.tone(72, 24, 1.4, 0.19, 'sine');
        this.tone(240, 65, 0.55, 0.065, 'triangle');
        this.crack(0.75, 0.16, 680, true);
      } else if (kind === 'cinema-core') {
        this.tone(36, 68, 3.4, 0.09, 'sawtooth');
        this.tone(110, 45, 1.2, 0.06, 'triangle', 0.2);
        this.crack(2.8, 0.065, 380, true);
      } else if (kind === 'cinema-rupture') {
        this.tone(48, 240, 2.3, 0.085, 'sawtooth');
        this.tone(97, 482, 2.3, 0.045, 'sine');
        this.tone(880, 132, 0.4, 0.07, 'triangle', 2.2);
        this.crack(0.25, 0.08, 1700);
      } else if (kind === 'cinema-escape') {
        this.tone(110, 720, 0.6, 0.07, 'sawtooth');
        this.crack(1.3, 0.07, 1400, true);
      } else if (kind === 'cinema-explosion') {
        this.tone(100, 22, 3.6, 0.18, 'sine');
        this.tone(210, 34, 1.4, 0.08, 'sawtooth');
        this.crack(2.8, 0.16, 620, true);
        this.tone(960, 190, 0.35, 0.035, 'triangle', 0.18);
      }
      this.cinematicCue = false;
      this.priorityCue = false;
      return;
    }
    if (kind === 'shutdown-break') {
      this.crack(0.16, 0.08, 900);
      this.tone(270, 90, 0.35, 0.06, 'triangle');
      return;
    }
    if (kind === 'shutdown-stop') {
      this.tone(110, 25, 2.6, 0.06, 'sine');
      this.crack(0.8, 0.03, 400);
      this.priorityCue = false;
      return;
    }
    if (kind === 'story-found') {
      this.tone(390, 520, 0.12, 0.035);
      this.tone(650, 780, 0.2, 0.025, 'sine', 0.09);
      return;
    }
    if (kind === 'story-cold') {
      this.crack(0.22, 0.04, 2100);
      this.tone(170, 75, 0.28, 0.025, 'sine');
      return;
    }
    if (warning && this.effects) {
      this.effectsDuckUntil = Math.max(
        this.effectsDuckUntil,
        c.currentTime + (WARNING_HOLD[kind] ?? 0.3),
      );
      const gain = this.effects.gain;
      gain.cancelScheduledValues(c.currentTime);
      gain.setTargetAtTime(0.35, c.currentTime, 0.008);
      gain.setTargetAtTime(1, this.effectsDuckUntil, 0.07);
    }
    if (
      warning ||
      ['crane-hit', 'kiln-impact', 'hurt', 'slam', 'cargo-release', 'cargo-impact'].includes(kind)
    )
      this.music?.duck(Math.max(kind === 'phase' ? 0.8 : 0.65, WARNING_HOLD[kind] ?? 0));
    if (kind === 'signal-charge') {
      this.tone(310, 620, 0.24, 0.055, 'triangle');
      this.tone(930, 1240, 0.12, 0.03, 'sine', 0.23);
    } else if (kind === 'signal-lock') {
      this.tone(1240, 1240, 0.09, 0.055, 'sine');
      this.tone(1240, 930, 0.13, 0.04, 'triangle', 0.16);
    } else if (kind === 'caller-record') {
      this.tone(420, 630, 0.08, 0.04, 'sine');
      this.tone(630, 840, 0.08, 0.035, 'sine', 0.14);
    } else if (kind === 'caller-lock') {
      // Three fixed pitches echo the three recorded positions, not the gun.
      for (const delay of [0, 0.12, 0.24]) this.tone(980, 980, 0.09, 0.045, 'triangle', delay);
    } else if (kind === 'signal-cut') {
      this.crack(0.08, 0.06, 2300);
      this.tone(820, 140, 0.22, 0.065, 'triangle');
    } else if (kind === 'signal-reboot') {
      this.tone(330, 330, 0.09, 0.04, 'triangle');
      this.tone(495, 495, 0.12, 0.035, 'triangle', 0.08);
      this.tone(660, 660, 0.16, 0.03, 'sine', 0.18);
    } else if (kind === 'signal-friendly') {
      // A quiet confirmation, with no hostile-warning duck or reserved voices.
      this.tone(330, 495, 0.13, 0.025, 'sine');
    } else if (kind === 'signal-fire') {
      this.tone(210, 95, 0.1, 0.055, 'triangle');
      this.crack(0.045, 0.04, 1400);
    } else if (kind === 'repair-warn') {
      this.tone(440, 540, 0.18, 0.035, 'sine');
      this.tone(660, 660, 0.16, 0.03, 'sine', 0.2);
    } else if (kind === 'relay-warn') {
      this.tone(150, 300, 0.28, 0.04, 'triangle');
      this.tone(600, 600, 0.12, 0.035, 'triangle', 0.3);
    } else if (kind === 'repair-pulse') {
      this.tone(520, 680, 0.09, 0.02, 'sine');
    } else if (kind === 'support-break') {
      this.tone(300, 85, 0.14, 0.03, 'triangle');
    } else if (kind === 'fabricator-build') {
      this.crack(0.2, 0.06, 2300);
      this.tone(130, 190, 0.4, 0.045, 'triangle');
    } else if (kind === 'fabricator-ready') {
      this.tone(350, 600, 0.18, 0.055, 'triangle');
      this.crack(0.06, 0.07, 1400);
    } else if (kind === 'fabricator-break' || kind === 'fabricator-down') {
      this.tone(260, 70, 0.25, 0.055, 'triangle');
      this.crack(0.09, 0.06, 2000);
    } else if (kind === 'reforge-ready') {
      this.tone(220, 440, 0.25, 0.05, 'triangle');
      this.tone(660, 660, 0.15, 0.04, 'sine', 0.2);
    } else if (kind === 'reforge') {
      this.crack(0.12, 0.09, 1600);
      this.tone(110, 55, 0.3, 0.08, 'triangle');
      this.tone(440, 880, 0.25, 0.045, 'sine', 0.12);
    } else if (kind === 'sorting-lift') {
      this.tone(55, 105, 1.3, 0.055, 'triangle');
      this.tone(110, 210, 0.9, 0.025, 'sine');
    } else if (kind === 'sorting-warn') {
      this.tone(165, 82, 0.75, 0.08, 'triangle');
      for (const delay of [0, 0.24, 0.48]) this.tone(660, 660, 0.1, 0.045, 'sine', delay);
    } else if (kind === 'sorting-drop') {
      this.crack(0.17, 0.085, 850);
      this.tone(110, 42, 0.22, 0.08, 'triangle');
    } else if (kind === 'flood-warn') {
      this.tone(180, 110, 0.65, 0.09, 'triangle');
      this.tone(520, 520, 0.18, 0.045, 'sine', 0.1);
    } else if (kind === 'flood-rise') {
      this.crack(0.6, 0.06, 380);
      this.tone(75, 110, 0.65, 0.045, 'sawtooth');
    } else if (kind === 'flood-valve' || kind === 'flood-drain') {
      this.tone(240, 65, 0.42, 0.07, 'triangle');
      this.crack(0.5, 0.07, 700);
    } else if (kind === 'audit-arrive') {
      for (const delay of [0, 0.55, 1.1]) {
        this.tone(82, 48, 0.18, 0.065, 'triangle', delay);
        this.tone(220, 150, 0.1, 0.03, 'square', delay + 0.07);
      }
    } else if (kind === 'audit-step') {
      this.tone(75, 40, 0.1, 0.032, 'triangle');
      this.crack(0.04, 0.018, 550);
    } else if (kind === 'weld-warn') {
      this.tone(160, 460, 1.1, 0.038, 'sawtooth');
      this.crack(0.65, 0.024, 2600);
    } else if (kind === 'weld-fire') {
      this.crack(0.24, 0.05, 2200);
      this.tone(210, 75, 0.22, 0.045, 'sawtooth');
    } else if (kind === 'weld-vent') {
      this.crack(0.55, 0.025, 1200);
      this.tone(290, 95, 0.4, 0.025, 'triangle');
    } else if (kind === 'welder-step') {
      this.tone(70, 42, 0.09, 0.025, 'triangle');
    } else if (kind === 'audit-tell') {
      this.tone(270, 620, 0.4, 0.055, 'triangle');
    } else if (kind === 'audit-fire') {
      this.tone(125, 65, 0.18, 0.06, 'sawtooth');
      this.crack(0.1, 0.05, 1000);
    } else if (kind === 'audit-recall') {
      this.tone(180, 720, 1.1, 0.05, 'sine');
    } else if (kind === 'audit-leave' || kind === 'audit-seal') {
      this.crack(0.18, 0.055, 700);
      this.tone(460, 95, 0.28, 0.065, 'triangle');
    } else if (kind === 'audit-defeat') {
      this.tone(260, 35, 0.7, 0.085, 'sawtooth');
      this.crack(0.4, 0.08, 500);
    } else if (kind === 'courier-start') {
      this.tone(95, 260, 0.4, 0.07, 'sawtooth');
      this.tone(520, 520, 0.1, 0.045, 'sine', 0.1);
      this.tone(780, 780, 0.1, 0.035, 'sine', 0.23);
    } else if (kind === 'courier-boost') {
      this.tone(110, 230, 0.22, 0.035, 'sawtooth');
      this.crack(0.12, 0.025, 650);
    } else if (kind === 'courier-door') {
      this.tone(190, 95, 0.6, 0.055, 'triangle');
      this.crack(0.18, 0.04, 550);
    } else if (kind === 'courier-pickup') {
      this.tone(540, 540, 0.1, 0.06, 'sine');
      this.tone(810, 810, 0.17, 0.06, 'sine', 0.1);
    } else if (kind === 'courier-drop' || kind === 'courier-exit') {
      this.tone(330, 95, 0.15, 0.06, 'triangle');
      this.crack(0.06, 0.04, 1100);
    } else if (kind === 'aim-warn') {
      this.tone(760, 1050, 0.085, 0.028, 'sine');
    } else if (kind === 'armor') {
      this.tone(1650, 950, 0.055, 0.035, 'sine');
      this.crack(0.025, 0.025, 3600);
    } else if (kind === 'mass-shot') {
      this.tone(82, 28, 0.2, 0.24);
      this.tone(240, 85, 0.085, 0.055, 'triangle');
      this.crack(0.13, 0.17, 680);
    } else if (kind === 'forge-impact') {
      this.tone(130, 38, 0.12, 0.09, 'triangle');
      this.crack(0.055, 0.06, 720);
    } else if (kind === 'mass-impact') {
      this.tone(420, 180, 0.085, 0.045, 'triangle');
      this.crack(0.035, 0.035, 1100);
    } else if (kind === 'carbine-shot') {
      // A short coil snap, solid report, then the bolt returning to battery.
      this.tone(920, 210, 0.055, 0.07, 'sine');
      this.tone(130, 38, 0.13, 0.15, 'triangle');
      this.crack(0.045, 0.1, 2200);
      this.tone(1300, 260, 0.075, 0.022, 'sine', 0.035);
      this.tone(500, 280, 0.022, 0.025, 'triangle', 0.12);
    } else if (kind === 'twinbore-shot') {
      // Two closely paired bores, followed by a quiet two-part action reset.
      this.tone(145, 48, 0.075, 0.11, 'triangle');
      this.tone(210, 62, 0.075, 0.085, 'triangle', 0.018);
      this.crack(0.055, 0.12, 1350);
      this.tone(320, 175, 0.026, 0.023, 'square', 0.115);
      this.tone(190, 360, 0.022, 0.018, 'triangle', 0.14);
    } else if (kind === 'repeater-shot') {
      const gap = this.repeaterLast === null ? Infinity : c.currentTime - this.repeaterLast;
      this.repeaterPressure =
        gap >= 0 && gap <= 0.28 ? Math.min(1, this.repeaterPressure + 0.13) : 0;
      this.repeaterLast = c.currentTime;
      this.repeaterOrigin = this.cueOrigin ? { ...this.cueOrigin } : null;
      const pressure = this.repeaterPressure;
      this.tone(390 + pressure * 130, 110 + pressure * 80, 0.035, 0.065, 'triangle');
      this.crack(0.026, 0.078 + pressure * 0.007, 2600 + pressure * 700);
      this.tone(105 + pressure * 60, 100 + pressure * 50, 0.07, 0.018, 'triangle', 0.024);
    } else if (kind === 'repeater-release') {
      this.tone(180 + this.repeaterPressure * 80, 70, 0.09, 0.022, 'triangle');
      this.crack(0.045, 0.022, 850);
    } else if (kind === 'shotgun-shot') {
      this.tone(92, 28, 0.19, 0.23);
      this.crack(0.14, 0.19, 1000);
      this.tone(185, 65, 0.065, 0.045, 'triangle');
    } else if (kind === 'shotgun-pump') {
      this.crack(0.065, 0.045, 2400);
      this.tone(330, 155, 0.055, 0.027, 'square');
      this.tone(180, 320, 0.04, 0.024, 'triangle', 0.045);
    } else if (kind === 'nail-shot') {
      this.crack(0.025, 0.09, 3500);
      this.tone(650, 210, 0.035, 0.055, 'square');
      this.tone(145, 75, 0.045, 0.09, 'triangle');
    } else if (kind === 'nail-impact') {
      this.tone(1250, 620, 0.045, 0.03, 'triangle');
      this.crack(0.02, 0.035, 3100);
    } else if (['shot', 'scatter', 'heavy', 'charged'].includes(kind)) {
      const heavy = kind === 'heavy' || kind === 'charged',
        scatter = kind === 'scatter';
      this.tone(heavy ? 110 : 180, 40, heavy ? 0.15 : 0.09, 0.25);
      this.crack(scatter ? 0.12 : 0.065, scatter ? 0.22 : 0.16, heavy ? 850 : 1800);
    } else if (kind === 'train-horn') {
      this.tone(146, 139, 0.65, 0.07, 'sawtooth');
      this.tone(196, 185, 0.65, 0.04, 'triangle');
    } else if (kind === 'train-warn' || kind === 'train-near') {
      this.tone(kind === 'train-near' ? 85 : 55, 35, 0.3, kind === 'train-near' ? 0.085 : 0.04);
      this.tone(710, 710, 0.055, 0.025, 'sine');
    } else if (kind === 'train-roll') {
      this.tone(60, 35, 0.3, 0.04);
      this.crack(0.045, 0.03, 650);
    } else if (kind === 'train-impact') {
      this.tone(105, 30, 0.18, 0.1);
      this.crack(0.07, 0.07, 1100);
    } else if (kind === 'flashpoint') {
      this.tone(260, 55, 0.14, 0.065, 'triangle');
    } else if (kind === 'ram') {
      this.tone(120, 40, 0.1, 0.07, 'triangle');
    } else if (kind === 'angler-lock') {
      this.tone(430, 610, 0.14, 0.025, 'triangle');
    } else if (kind === 'angler-fire') {
      this.tone(320, 110, 0.1, 0.035, 'triangle');
      this.crack(0.06, 0.02, 1700);
    } else if (kind === 'angler-break') {
      this.tone(260, 75, 0.18, 0.03, 'triangle');
    } else if (kind === 'crawler-lock') {
      this.tone(650, 870, 0.13, 0.025, 'triangle');
    } else if (kind === 'fan-warn') {
      this.tone(72, 145, 1.2, 0.12, 'sine');
      this.crack(1.2, 0.09, 460);
    } else if (kind === 'fan-gust') {
      this.crack(0.65, 0.13, 800);
      this.tone(110, 75, 0.65, 0.09, 'sine');
    } else if (kind === 'pressure-open') {
      this.tone(240, 560, 0.15, 0.035, 'triangle');
      this.crack(0.12, 0.025, 2800);
    } else if (kind === 'pressure-warn') {
      this.tone(145, 230, 0.24, 0.025, 'triangle');
      this.crack(0.26, 0.024, 2100);
    } else if (kind === 'pressure-burst') {
      this.crack(0.28, 0.075, 1250);
      this.tone(110, 45, 0.22, 0.04, 'triangle');
    } else if (kind === 'counterweight-stop') {
      this.tone(95, 45, 0.17, 0.028, 'triangle');
      this.crack(0.05, 0.015, 950);
    } else if (kind === 'crawler-drop') {
      this.tone(290, 85, 0.2, 0.04, 'triangle');
      this.crack(0.07, 0.025, 1500);
    } else if (kind === 'rival-grind') {
      this.tone(190, 95, 0.1, 0.035, 'sawtooth');
    } else if (kind === 'grind') {
      this.tone(240, 110, 0.1, 0.025, 'sawtooth');
      this.crack(0.05, 0.025, 1700);
    } else if (kind === 'arc') {
      this.tone(950, 260, 0.085, 0.04, 'triangle');
      this.crack(0.04, 0.035, 2600);
    } else if (kind === 'tripwire-pin') {
      this.tone(720, 460, 0.035, 0.022, 'triangle');
    } else if (kind === 'tripwire-link') {
      this.tone(480, 920, 0.08, 0.035, 'sine');
    } else if (kind === 'tether-mark') {
      this.tone(600, 430, 0.045, 0.025, 'triangle');
    } else if (kind === 'tether-link') {
      this.tone(350, 680, 0.09, 0.045, 'triangle');
    } else if (kind === 'tether-snap') {
      this.tone(520, 120, 0.12, 0.07, 'triangle');
      this.crack(0.045, 0.045, 1800);
    } else if (kind === 'sapper-lock') {
      this.tone(250, 430, 0.18, 0.04, 'triangle');
      this.tone(430, 430, 0.06, 0.035, 'sine', 0.32);
    } else if (kind === 'sapper-throw') {
      this.tone(170, 65, 0.12, 0.07);
      this.crack(0.06, 0.055, 1100);
    } else if (kind === 'sapper-stick') {
      this.crack(0.035, 0.07, 2400);
    } else if (kind === 'sapper-bat') {
      this.tone(740, 380, 0.09, 0.07, 'triangle');
    } else if (kind === 'sapper-tick') {
      this.tone(880, 880, 0.025, 0.025, 'sine');
    } else if (kind === 'sapper-blast') {
      this.tone(95, 32, 0.23, 0.16);
      this.crack(0.14, 0.15, 850);
    } else if (kind === 'harpoon-lock') {
      this.tone(190, 480, 0.32, 0.05, 'sawtooth');
      this.tone(620, 620, 0.06, 0.045, 'sine', 0.4);
    } else if (kind === 'harpoon-fire') {
      this.tone(260, 70, 0.14, 0.11);
      this.crack(0.1, 0.13, 1900);
    } else if (kind === 'harpoon-catch') {
      this.crack(0.07, 0.13, 900);
      this.tone(125, 80, 0.2, 0.065, 'sawtooth');
    } else if (kind === 'harpoon-break') {
      this.tone(510, 140, 0.14, 0.065);
      this.crack(0.06, 0.085, 3000);
    } else if (kind === 'scrapper-grab') {
      this.tone(95, 180, 0.35, 0.045, 'sawtooth');
      this.crack(0.07, 0.05, 1200);
    } else if (kind === 'scrapper-lock') {
      this.tone(320, 520, 0.16, 0.055, 'triangle');
      this.tone(520, 520, 0.07, 0.03, 'sine', 0.19);
    } else if (kind === 'scrapper-throw') {
      this.tone(130, 50, 0.16, 0.09);
      this.crack(0.12, 0.09, 1100);
    } else if (kind === 'scrapper-break') {
      this.tone(210, 65, 0.2, 0.07);
      this.crack(0.08, 0.085, 2100);
    } else if (kind === 'storm-warn') {
      for (let i = 0; i < 3; i++)
        this.tone(430 + i * 90, 620 + i * 90, 0.22, 0.045, 'triangle', i * 0.45);
    } else if (kind === 'storm-strike') {
      this.crack(0.24, 0.1, 1000);
      this.tone(95, 30, 0.38, 0.09, 'triangle');
    } else if (kind === 'scrap-release') {
      this.crack(0.13, 0.08, 2400);
      for (let i = 0; i < 3; i++)
        this.tone(280 + i * 70, 190 + i * 70, 0.17, 0.055, 'triangle', i * 0.36);
    } else if (kind === 'cargo-release') {
      this.crack(0.13, 0.1, 2500);
      this.tone(310, 170, 0.45, 0.07, 'triangle');
    } else if (kind === 'cargo-impact') {
      this.tone(75, 28, 0.23, 0.19);
      this.crack(0.16, 0.16, 700);
    } else if (kind === 'arsenal-dash-warn') {
      // A two-stage mechanical ratchet precedes the committed lane.
      this.tone(170, 280, 0.32, 0.065, 'sawtooth');
      this.tone(480, 640, 0.12, 0.045, 'triangle', 0.28);
      this.crack(0.1, 0.045, 2100);
    } else if (kind === 'arsenal-dash') {
      this.tone(150, 38, 0.32, 0.1, 'sawtooth');
      this.crack(0.28, 0.095, 1250, true);
    } else if (kind === 'arsenal-plane') {
      // The combat flyover has a shorter, directional version of the airlift roar.
      this.tone(38, 86, 1.65, 0.065, 'sawtooth');
      this.tone(77, 112, 1.4, 0.035, 'triangle', 0.15);
      this.crack(1.6, 0.06, 580, true);
    } else if (kind === 'arsenal-bomb') {
      this.tone(96, 27, 0.42, 0.12, 'sine');
      this.crack(0.28, 0.11, 900, true);
      this.tone(240, 75, 0.12, 0.035, 'triangle');
    } else if (kind === 'arsenal-armor-break') {
      this.crack(0.19, 0.095, 2300);
      this.tone(260, 86, 0.28, 0.065, 'triangle');
      this.tone(620, 830, 0.23, 0.035, 'sine', 0.12);
    } else if (kind === 'arsenal-armor-close') {
      this.crack(0.1, 0.055, 1300);
      this.tone(175, 70, 0.18, 0.055, 'triangle');
    } else if (kind === 'arsenal-core-warn') {
      for (let i = 0; i < 3; i++)
        this.tone(240 + i * 110, 310 + i * 110, 0.2, 0.045, 'triangle', i * 0.33);
      this.tone(60, 125, 1.05, 0.045, 'sawtooth');
    } else if (kind === 'arsenal-core-fire') {
      this.tone(110, 220, 0.55, 0.075, 'sawtooth');
      this.tone(440, 210, 0.33, 0.03, 'sine');
      this.crack(0.14, 0.055, 1800);
    } else if (kind === 'arsenal-collapse-warn') {
      this.tone(120, 220, 0.5, 0.055, 'triangle');
      this.crack(0.12, 0.04, 1400);
      this.tone(340, 190, 0.12, 0.035, 'triangle', 0.45);
    } else if (kind === 'arsenal-collapse') {
      this.tone(94, 26, 0.48, 0.095, 'sine');
      this.crack(0.45, 0.09, 750, true);
    } else if (kind === 'finale-arrival') {
      this.tone(66, 110, 1, 0.075, 'triangle');
      this.tone(330, 220, 0.3, 0.04, 'triangle', 0.55);
    } else if (kind === 'finale-transform') {
      this.crack(0.4, 0.085, 700);
      this.tone(55, 165, 0.85, 0.09, 'sawtooth');
      this.tone(330, 440, 0.4, 0.04, 'triangle', 0.9);
    } else if (kind === 'finale-shutdown') {
      this.tone(220, 33, 1.6, 0.09, 'sawtooth');
      this.crack(0.35, 0.07, 650);
    } else if (kind === 'finale-release') {
      for (const [i, pitch] of [294, 370, 440].entries())
        this.tone(pitch, pitch, 1, 0.035, 'triangle', i * 0.18);
    } else if (kind === 'finale-fan-lock') {
      for (let i = 0; i < 3; i++)
        this.tone(390 + i * 100, 460 + i * 100, 0.12, 0.035, 'triangle', i * 0.1);
    } else if (kind === 'finale-field-lock' || kind === 'finale-arena-warn') {
      for (let i = 0; i < 2; i++) this.tone(220, 330, 0.16, 0.05, 'square', i * 0.35);
    } else if (kind === 'finale-aim-lock') {
      this.tone(680, 880, 0.2, 0.055, 'sine');
    } else if (kind === 'finale-arena-fire') {
      this.crack(0.18, 0.1, 1100);
      this.tone(100, 35, 0.3, 0.09, 'triangle');
    } else if (kind === 'interceptor-lock') {
      this.tone(290, 540, 0.22, 0.07, 'triangle');
      this.tone(540, 540, 0.09, 0.035, 'sine', 0.25);
    } else if (kind === 'interceptor-vault') {
      this.tone(160, 65, 0.13, 0.09);
      this.crack(0.09, 0.09, 1500);
    } else if (kind === 'interceptor-heavy') {
      this.tone(95, 32, 0.22, 0.16);
      this.crack(0.15, 0.15, 950);
    } else if (kind === 'interceptor-shot') {
      this.tone(220, 65, 0.11, 0.09);
      this.crack(0.07, 0.085, 2100);
    } else if (kind === 'interceptor-open') {
      this.tone(310, 115, 0.2, 0.045, 'triangle');
    } else if (kind === 'turbine-wind') {
      this.tone(90, 260, 0.55, 0.065, 'sawtooth');
      this.tone(540, 620, 0.14, 0.025, 'sine', 0.22);
      this.crack(0.25, 0.035, 1800);
    } else if (kind === 'turbine-gust') {
      this.crack(0.3, 0.11, 1400);
      this.tone(170, 70, 0.35, 0.075, 'triangle');
    } else if (kind === 'turbine-cut') {
      this.tone(650, 160, 0.2, 0.065, 'triangle');
      this.crack(0.16, 0.065, 2900);
    } else if (kind === 'turbine-open') {
      this.tone(240, 80, 0.22, 0.045, 'triangle');
    } else if (kind === 'cooling-shot') {
      this.tone(420, 105, 0.11, 0.085, 'triangle');
      this.crack(0.09, 0.07, 2500);
    } else if (kind === 'shell-shot') {
      this.tone(105, 42, 0.13, 0.22);
      this.crack(0.08, 0.14, 1100);
    } else if (kind === 'shell-blast' || kind === 'aftershock') {
      const echo = kind === 'aftershock';
      this.tone(echo ? 110 : 85, 30, echo ? 0.12 : 0.18, echo ? 0.065 : 0.11);
      this.crack(echo ? 0.06 : 0.1, echo ? 0.045 : 0.075, 900);
    } else if (kind === 'portal-blue' || kind === 'portal-orange') {
      const f = kind === 'portal-blue' ? 280 : 390;
      this.tone(f, f * 2.4, 0.16, 0.05, 'sine');
      this.crack(0.07, 0.025, 2200);
    } else if (kind === 'portal-travel') {
      this.tone(180, 720, 0.18, 0.065, 'sine');
      this.tone(720, 260, 0.16, 0.035, 'triangle', 0.07);
    } else if (kind === 'portal-denied') {
      this.tone(160, 120, 0.065, 0.025, 'sine');
    } else if (kind === 'evacuate') {
      this.tone(440, 440, 0.2, 0.055, 'sine');
      this.tone(330, 330, 0.35, 0.055, 'sine', 0.28);
      this.crack(0.22, 0.075, 350);
      this.music?.duck(0.7);
    } else if (kind === 'collapse') {
      this.tone(65, 30, 0.22, 0.06);
      this.crack(0.18, 0.045, 600);
    } else if (kind === 'extract') {
      this.tone(100, 350, 0.85, 0.075, 'triangle');
      this.crack(0.22, 0.04, 1500);
    } else if (kind === 'machine') {
      this.tone(110, 180, 0.45, 0.05, 'sawtooth');
      this.tone(440, 440, 0.12, 0.025, 'sine', 0.12);
    } else if (kind === 'reinforce') {
      this.tone(240, 190, 0.11, 0.045, 'triangle');
      this.tone(360, 280, 0.14, 0.035, 'triangle', 0.12);
    } else if (kind === 'crane-wind') {
      this.tone(110, 220, 0.42, 0.065, 'sawtooth');
      this.tone(580, 580, 0.12, 0.025, 'sine', 0.18);
    } else if (kind === 'crane-swing') {
      this.crack(0.2, 0.07, 850);
      this.tone(160, 55, 0.18, 0.085);
    } else if (kind === 'crane-hit') {
      this.tone(85, 28, 0.24, 0.17);
      this.tone(460, 95, 0.08, 0.045);
      this.crack(0.16, 0.12, 1300);
    } else if (kind === 'kiln-wind') {
      this.crack(0.38, 0.035, 1400);
      this.tone(135, 220, 0.4, 0.06, 'triangle');
      this.tone(620, 680, 0.16, 0.02, 'sine', 0.2);
    } else if (kind === 'kiln-fire') {
      this.tone(85, 30, 0.18, 0.14);
      this.crack(0.09, 0.1, 550);
    } else if (kind === 'kiln-impact') {
      this.tone(80, 26, 0.26, 0.16);
      this.tone(400, 120, 0.05, 0.025);
      this.crack(0.18, 0.11, 950);
    } else if (kind === 'strain') {
      this.crack(0.2, 0.055, 1700);
      this.tone(280, 110, 0.25, 0.035);
    } else if (kind === 'echo-shot') {
      this.crack(0.04, 0.025, 2200);
      this.tone(400, 180, 0.05, 0.018, 'sine');
    } else if (kind === 'fuse-stick') {
      this.tone(760, 540, 0.035, 0.025, 'sine');
    } else if (kind === 'loaded') {
      this.tone(320, 620, 0.09, 0.035, 'sine');
    } else if (kind === 'prop') {
      this.tone(310, 100, 0.06, 0.06);
      this.crack(0.035, 0.06, 1600);
    } else if (kind === 'arm') {
      this.crack(0.14, 0.065, 2800);
      this.tone(420, 710, 0.11, 0.035, 'sine');
    } else if (kind === 'breach') {
      this.crack(0.18, 0.13, 2100);
      this.tone(220, 65, 0.16, 0.065);
    } else if (kind === 'mend') {
      this.tone(520, 650, 0.1, 0.035, 'sine');
      this.tone(780, 780, 0.16, 0.025, 'sine', 0.06);
    } else if (kind === 'break') {
      this.crack(0.16, 0.13, 1100);
      this.tone(140, 45, 0.13, 0.09);
    } else if (kind === 'explode') {
      this.tone(95, 24, 0.3, 0.27);
      this.crack(0.25, 0.22, 450);
    } else if (kind === 'bank') {
      this.tone(980, 1550, 0.035, 0.025, 'sine');
    } else if (kind === 'hit') {
      this.crack(0.035, 0.09, 2200);
      this.tone(520, 220, 0.035, 0.035);
    } else if (kind === 'kill') {
      this.tone(180, 42, 0.14, 0.17);
      this.crack(0.075, 0.12, 1000);
    } else if (kind === 'hurt') {
      this.tone(95, 26, 0.22, 0.23, 'sawtooth');
      this.crack(0.12, 0.15, 500);
    } else if (kind === 'jump') {
      this.crack(0.05, 0.045, 1900);
      this.tone(140, 230, 0.055, 0.04);
    } else if (kind === 'land') {
      this.tone(90, 35, 0.07, 0.065);
      this.crack(0.055, 0.035, 550);
    } else if (kind === 'charge') {
      this.tone(80, 175, 0.3, 0.045, 'sawtooth');
    } else if (kind === 'rush') {
      this.crack(0.1, 0.09, 650);
    } else if (kind === 'loader') {
      this.tone(65, 135, 0.35, 0.12, 'sawtooth');
      this.crack(0.18, 0.1, 600);
    } else if (kind === 'press') {
      this.tone(270, 55, 0.24, 0.1, 'sawtooth');
      this.crack(0.2, 0.09, 1700);
    } else if (kind === 'slam') {
      this.tone(85, 24, 0.3, 0.23);
      this.crack(0.18, 0.2, 650);
    } else if (kind === 'crash') {
      this.tone(120, 30, 0.18, 0.15);
      this.crack(0.09, 0.1, 850);
    } else if (kind === 'lock') {
      this.tone(700, 1000, 0.12, 0.025, 'sine');
    } else if (kind === 'snipe') {
      this.tone(1000, 180, 0.1, 0.065);
      this.crack(0.045, 0.08, 3000);
    } else if (kind === 'hop') {
      this.tone(160, 380, 0.085, 0.04);
      this.crack(0.05, 0.03, 1700);
    } else if (kind === 'phase' || kind === 'pulse') {
      this.tone(kind === 'phase' ? 70 : 130, 35, 0.35, 0.12, 'sawtooth');
      this.crack(0.16, 0.08, 500);
    } else if (kind === 'enemy') {
      this.tone(250, 90, 0.055, 0.06);
    } else if (kind === 'clear' || kind === 'upgrade') {
      this.tone(420, 460, 0.16, 0.07, 'sine');
      this.tone(640, 700, 0.2, 0.055, 'sine', 0.09);
    } else if (kind === 'win') {
      [320, 480, 640, 960].forEach((f, i) => this.tone(f, f, 0.28, 0.09, 'triangle', i * 0.1));
    } else if (kind === 'dead') {
      this.tone(140, 25, 0.55, 0.17, 'sawtooth');
    }
    this.priorityCue = false;
  }
}
