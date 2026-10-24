// One weather source supplies the entire scene. No droplet timers or queued
// voices: pausing, muting, leaving the room or hiding the page ends it outright.
export class RainAmbience {
  private buffer: AudioBuffer | null = null;
  private voice: {
    source: AudioBufferSourceNode;
    gain: GainNode;
    nodes: AudioNode[];
  } | null = null;
  private level = -1;
  private context: AudioContext;
  private destination: AudioNode;
  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.destination = destination;
  }
  get active() {
    return this.voice !== null;
  }
  private makeBuffer() {
    const c = this.context;
    const length = Math.ceil(c.sampleRate * 3.2);
    const buffer = c.createBuffer(2, length, c.sampleRate);
    // A local generator avoids changing the gameplay/audio variation RNG stream.
    let seed = 197309;
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let low = 0;
      let droplet = 0;
      for (let i = 0; i < length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const random = seed / 4294967296;
        const white = random * 2 - 1;
        low = low * 0.96 + white * 0.04;
        droplet *= 0.987;
        if (random > 0.9996) droplet = 0.38;
        const gust = 0.9 + 0.1 * Math.sin((i / length) * Math.PI * 4 + channel);
        data[i] = (white * 0.36 + low * 1.8 + white * droplet) * gust;
      }
      // Fold a short tail onto the start so the repeating storm has no seam.
      const seam = Math.ceil(c.sampleRate * 0.05);
      for (let i = 0; i < seam; i++) {
        const t = i / seam;
        data[i] = data[length - seam + i] * (1 - t) + data[i] * t;
      }
    }
    return buffer;
  }
  update(active: boolean, intensity = 1) {
    const c = this.context;
    if (!active || c.state !== 'running') {
      this.stop();
      return;
    }
    if (!this.voice) {
      this.buffer ??= this.makeBuffer();
      const source = c.createBufferSource();
      const highpass = c.createBiquadFilter();
      const lowpass = c.createBiquadFilter();
      const gain = c.createGain();
      source.buffer = this.buffer;
      source.loop = true;
      highpass.type = 'highpass';
      highpass.frequency.value = 150;
      highpass.Q.value = 0.5;
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 5200;
      lowpass.Q.value = 0.5;
      gain.gain.value = 0;
      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(this.destination);
      const voice = { source, gain, nodes: [source, highpass, lowpass, gain] };
      source.onended = () => {
        for (const node of voice.nodes) node.disconnect();
        if (this.voice === voice) this.voice = null;
      };
      this.voice = voice;
      this.level = -1;
      source.start();
    }
    const level = 0.085 * Math.max(0, Math.min(1.5, Number.isFinite(intensity) ? intensity : 1));
    if (Math.abs(level - this.level) > 0.001) {
      this.voice.gain.gain.setTargetAtTime(level, c.currentTime, 0.3);
      this.level = level;
    }
  }
  stop() {
    const voice = this.voice;
    if (!voice) return;
    this.voice = null;
    voice.gain.gain.cancelScheduledValues(this.context.currentTime);
    voice.gain.gain.setValueAtTime(0, this.context.currentTime);
    voice.source.onended = null;
    voice.source.stop(this.context.currentTime);
    for (const node of voice.nodes) node.disconnect();
    this.level = -1;
  }
}
