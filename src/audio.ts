export class Sound {
  enabled = true;
  context: AudioContext | null = null;
  unlock() {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
  }
  play(kind: string) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const ctx = this.context,
      now = ctx.currentTime;
    const configs: Record<string, [number, number, number, OscillatorType]> = {
      coil: [210, 65, 0.065, 'square'],
      scatter: [105, 35, 0.12, 'sawtooth'],
      lance: [640, 380, 0.055, 'sine'],
      mortar: [90, 35, 0.14, 'triangle'],
      explosion: [70, 20, 0.3, 'sawtooth'],
      jump: [180, 380, 0.1, 'sine'],
      kill: [160, 45, 0.12, 'triangle'],
      hurt: [110, 35, 0.18, 'sawtooth'],
      pickup: [720, 1100, 0.1, 'sine'],
      clear: [400, 800, 0.35, 'sine'],
      upgrade: [500, 1300, 0.3, 'triangle'],
      winch: [120, 240, 0.15, 'sine'],
      switch: [400, 500, 0.045, 'sine'],
      boss: [80, 45, 0.25, 'sawtooth'],
      dead: [220, 30, 0.6, 'sawtooth'],
      win: [420, 1680, 0.6, 'sine'],
      enemy: [180, 100, 0.055, 'triangle'],
    };
    const [start, end, length, type] = configs[kind] ?? configs.coil;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(end, now + length);
    gain.gain.setValueAtTime(kind === 'enemy' ? 0.015 : 0.038, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + length);
  }
}
