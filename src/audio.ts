import { Music } from './music.ts';
import type { MusicScene } from './music-score.ts';

export class Sound {
  private audioEnabled = true;
  private scoreEnabled = true;
  music: Music | null = null;
  get enabled() {
    return this.audioEnabled;
  }
  set enabled(value: boolean) {
    this.audioEnabled = value;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(value ? 0.34 : 0, this.context.currentTime, 0.012);
    if (!value) this.silenceMusic();
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
  noise: AudioBuffer | null = null;
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
        master.gain.value = this.enabled ? 0.34 : 0;
        const compressor = c.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.ratio.value = 8;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.12;
        master.connect(compressor);
        compressor.connect(c.destination);
        const noise = c.createBuffer(1, Math.ceil(c.sampleRate * 0.3), c.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.music = new Music(c, master);
        this.context = c;
        this.master = master;
        this.noise = noise;
      } catch {
        if (c) void c.close().catch(() => {});
        return;
      }
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }
  updateMusic(scene: MusicScene, active = true) {
    this.music?.update(scene, this.enabled && this.musicEnabled, active);
  }
  resetMusic() {
    this.music?.reset();
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
    const c = this.context!;
    if (this.voices > 30) return;
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
    gain.connect(this.master!);
    osc.onended = () => {
      this.voices--;
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + length + 0.01);
  }
  crack(length: number, volume: number, frequency: number) {
    const c = this.context!;
    if (this.voices > 30) return;
    this.voices++;
    const now = c.currentTime,
      source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    source.buffer = this.noise;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.6;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    source.onended = () => {
      this.voices--;
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start(now);
    source.stop(now + length + 0.01);
  }
  play(kind: string) {
    const c = this.context;
    if (!this.enabled || !c || c.state !== 'running') return;
    const previous = this.played.get(kind) ?? -10;
    if (c.currentTime - previous < (kind === 'hit' ? 0.04 : 0.015)) return;
    this.played.set(kind, c.currentTime);
    if (
      [
        'lock',
        'charge',
        'machine',
        'reinforce',
        'crane-wind',
        'crane-hit',
        'kiln-wind',
        'kiln-impact',
        'strain',
        'arm',
        'hurt',
        'phase',
        'loader',
        'press',
        'slam',
      ].includes(kind)
    )
      this.music?.duck(kind === 'phase' ? 0.8 : 0.65);
    if (['shot', 'scatter', 'heavy', 'charged'].includes(kind)) {
      const heavy = kind === 'heavy' || kind === 'charged',
        scatter = kind === 'scatter';
      this.tone(heavy ? 110 : 180, 40, heavy ? 0.15 : 0.09, 0.25);
      this.crack(scatter ? 0.12 : 0.065, scatter ? 0.22 : 0.16, heavy ? 850 : 1800);
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
  }
}
