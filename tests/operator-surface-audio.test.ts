import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../src/audio.ts';
import { OPERATOR_SURFACE_SOUNDS, operatorSurfaceAudio } from '../src/operator-surface-audio.ts';
import type { MusicScene } from '../src/music-score.ts';
class Param {
  value = 1;
  events: { kind: string; value?: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) {
    assert(Number.isFinite(value) && Number.isFinite(time));
    this.value = value;
    this.events.push({ kind: 'set', value, time });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    assert(Number.isFinite(value) && Number.isFinite(time));
    this.value = value;
    this.events.push({ kind: 'linear', value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    assert(value > 0 && Number.isFinite(value) && Number.isFinite(time));
    this.value = value;
    this.events.push({ kind: 'exp', value, time });
    return this;
  }
  setTargetAtTime(value: number, time: number, _constant: number) {
    assert(Number.isFinite(value) && Number.isFinite(time));
    this.value = value;
    this.events.push({ kind: 'target', value, time });
    return this;
  }
  cancelScheduledValues(time: number) {
    this.events.push({ kind: 'cancel', time });
    return this;
  }
  cancelAndHoldAtTime(time: number) {
    this.events.push({ kind: 'hold', time });
    return this;
  }
}
class Node {
  gain = new Param();
  pan = new Param();
  frequency = new Param();
  Q = new Param();
  threshold = new Param();
  ratio = new Param();
  attack = new Param();
  release = new Param();
  detune = new Param();
  playbackRate = new Param();
  type = '';
  connections: Node[] = [];
  disconnected = false;
  context: Context;
  kind: string;
  constructor(context: Context, kind: string) {
    this.context = context;
    this.kind = kind;
    context.nodes.push(this);
  }
  connect(other: Node) {
    this.connections.push(other);
    return other;
  }
  disconnect() {
    this.disconnected = true;
    this.connections = [];
  }
}
class Source extends Node {
  startTime: number | null = null;
  stopTime = Infinity;
  buffer: unknown;
  loop = false;
  ended = false;
  onended: (() => void) | null = null;
  start(time = this.context.currentTime) {
    assert.equal(this.startTime, null);
    this.startTime = time;
  }
  stop(time = this.context.currentTime) {
    this.stopTime = Math.max(this.context.currentTime, time);
  }
}
class Context {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  nodes: Node[] = [];
  destination = new Node(this, 'destination');
  createGain() {
    return new Node(this, 'gain');
  }
  createOscillator() {
    return new Source(this, 'oscillator');
  }
  createBufferSource() {
    return new Source(this, 'buffer');
  }
  createBiquadFilter() {
    return new Node(this, 'filter');
  }
  createStereoPanner() {
    return new Node(this, 'panner');
  }
  createDynamicsCompressor() {
    return new Node(this, 'compressor');
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      length,
      sampleRate,
      duration: length / sampleRate,
      numberOfChannels: channels,
      getChannelData: (channel: number) => data[channel],
    };
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
  get sources() {
    return this.nodes.filter((n): n is Source => n instanceof Source);
  }
  advance(seconds: number) {
    this.currentTime += seconds;
    for (const s of this.sources)
      if (!s.ended && s.stopTime <= this.currentTime) {
        s.ended = true;
        s.onended?.();
      }
  }
}
function fixture(t: { after(fn: () => void): void }) {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  t.after(() => {
    if (before) Object.defineProperty(globalThis, 'AudioContext', before);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  });
  const sound = new Sound();
  sound.unlock();
  sound.setListener({ x: 0, y: 0 });
  return { sound, c: sound.context as unknown as Context };
}
const scene = (mode: MusicScene['mode'] = 'playing'): MusicScene => ({
  area: 'cooling',
  room: 'operator:0',
  mode,
  intensity: 0,
  boss: false,
  clear: false,
});
const reaches = (node: Node, target: unknown): boolean =>
  node === target || node.connections.some((n) => reaches(n, target));

test('nine contact recipes are finite, distinct, quiet one-shots on the existing effects bus', (t) => {
  const { sound, c } = fixture(t);
  const signatures = new Set<string>();
  for (const kind of OPERATOR_SURFACE_SOUNDS) {
    const recipe = operatorSurfaceAudio(kind);
    assert(recipe);
    assert(recipe.tones.length + Number(!!recipe.noise) <= 2);
    const first = c.sources.length;
    sound.play(kind, { x: 20, y: 740, source: 'operator' });
    const voices = c.sources.slice(first);
    assert(voices.length > 0 && voices.length <= 2);
    assert(voices.every((s) => !s.loop && s.stopTime <= c.currentTime + 0.14));
    assert(voices.every((s) => reaches(s, sound.effects) && !reaches(s, sound.musicOutput)));
    signatures.add(
      JSON.stringify(voices.map((s) => [s.kind, s.frequency.events, s.stopTime - c.currentTime])),
    );
    assert(
      c.nodes
        .filter((n) => n.kind === 'gain')
        .flatMap((n) => n.gain.events)
        .every((e) => e.value === undefined || (e.value >= 0 && Number.isFinite(e.value))),
    );
    c.advance(0.3);
    assert.equal(sound.voices, 0);
  }
  assert.equal(signatures.size, 9);
  assert.equal(operatorSurfaceAudio('operator-step-scenery'), null);
});

test('surface cues reuse the prebuilt noise and exact pitch without consuming any new randomness', (t) => {
  const { sound, c } = fixture(t);
  t.mock.method(Math, 'random', () => {
    throw new Error('contact Foley must not draw from global randomness');
  });
  for (const kind of OPERATOR_SURFACE_SOUNDS) {
    sound.play(kind, { x: 0, y: 740, source: 'operator' });
    c.advance(0.3);
  }
  assert(c.sources.length > 0);
});

test('footstep saturation reserves voice capacity and the warning bypass/ducking route remains authoritative', (t) => {
  const { sound, c } = fixture(t);
  for (let i = 0; i < 500; i++)
    sound.play(OPERATOR_SURFACE_SOUNDS[i % 9], { x: i, y: 740, source: 'foley:' + i });
  assert(sound.voices <= 16);
  assert(sound.played.size <= 384);
  const first = c.sources.length;
  sound.play('lock', { x: 300, y: 400, source: 'native-warning' });
  const warning = c.sources.slice(first);
  assert(warning.length > 0);
  assert(warning.every((s) => reaches(s, sound.effectsOutput) && !reaches(s, sound.effects)));
  assert(sound.effects!.gain instanceof Object);
  const bus = sound.effects!.gain as unknown as Param;
  assert(bus.events.some((e) => e.kind === 'target' && e.value === 0.35));
  c.advance(0.5);
  assert.equal(sound.voices, 0);
});

test('effects and master mute, pause, hidden world and unavailable context stay silent independently of Music', (t) => {
  const { sound, c } = fixture(t);
  sound.musicEnabled = false;
  sound.musicVolume = 0;
  sound.play('operator-step-grating', { x: 0, y: 740 });
  assert(c.sources.length > 0, 'Music off does not turn off steps');
  c.advance(0.3);
  for (const mode of ['effects', 'master', 'pause', 'hidden', 'context'] as const) {
    sound.enabled = true;
    sound.effectsVolume = 1;
    c.state = 'running';
    sound.updateMusic(scene());
    sound.updateWorld(null, true);
    if (mode === 'effects') sound.effectsVolume = 0;
    if (mode === 'master') sound.enabled = false;
    if (mode === 'pause') sound.updateMusic(scene('paused'));
    if (mode === 'hidden') sound.updateWorld(null, false);
    if (mode === 'context') c.state = 'suspended';
    const before = c.sources.length;
    for (const kind of OPERATOR_SURFACE_SOUNDS) sound.play(kind);
    assert.equal(c.sources.length, before, mode);
  }
  const noContext = new Sound();
  assert.doesNotThrow(() => noContext.play('operator-step-metal'));
  assert.equal(noContext.context, null);
});

test('room reset cancels contact tails and repeated same-emitter events respect cadence', (t) => {
  const { sound, c } = fixture(t);
  sound.updateMusic(scene());
  sound.play('operator-step-metal', { x: 0, y: 740, source: 'boot' });
  const first = c.sources.length;
  const contacts = c.sources.filter((s) => reaches(s, sound.effects));
  for (let i = 0; i < 100; i++) sound.play('operator-step-metal', { x: i, y: 740, source: 'boot' });
  assert.equal(c.sources.length, first);
  sound.updateMusic({ ...scene(), room: 'operator:1' });
  assert.equal(sound.voices, 0);
  assert(contacts.every((s) => s.disconnected));
  c.advance(0.2);
  const restarted = c.sources.length;
  sound.play('operator-step-metal', { x: 0, y: 740, source: 'boot' });
  assert(c.sources.length > restarted);
});
