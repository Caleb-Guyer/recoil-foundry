import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../src/audio.ts';
import type { MusicScene } from '../src/music-score.ts';

class Param {
  value = 1;
  events: { kind: string; value?: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: 'set', value, time });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: 'linear', value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: 'exp', value, time });
    return this;
  }
  setTargetAtTime(value: number, time: number, _constant: number) {
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
  connections: Node[] = [];
  disconnected = false;
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
    this.connections = [];
    this.disconnected = true;
  }
}

class Source extends Node {
  startTime: number | null = null;
  stopTime = Infinity;
  loop = false;
  buffer: unknown;
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
  deliverEnded = true;
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
  advance(seconds: number) {
    this.currentTime += seconds;
    for (const s of this.sources)
      if (!s.ended && s.stopTime <= this.currentTime) {
        s.ended = true;
        if (this.deliverEnded) s.onended?.();
      }
  }
  get sources() {
    return this.nodes.filter((n): n is Source => n instanceof Source);
  }
  get panners() {
    return this.nodes.filter((n) => n.kind === 'panner');
  }
}

function fixture(t: { after(fn: () => void): void }, ContextType = Context, mono = false) {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: ContextType });
  t.after(() => {
    if (before) Object.defineProperty(globalThis, 'AudioContext', before);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  });
  const sound = new Sound();
  sound.mono = mono;
  sound.unlock();
  sound.setListener({ x: 0, y: 0 });
  return { sound, c: sound.context as unknown as Context };
}

const scene = (overrides: Partial<MusicScene> = {}): MusicScene => ({
  area: 'docks',
  room: 'audio:0',
  mode: 'playing',
  intensity: 0,
  boss: false,
  clear: false,
  ...overrides,
});
const reaches = (node: Node, destination: unknown): boolean =>
  node === destination || node.connections.some((other) => reaches(other, destination));
const chain = (node: Node): Node[] => [node, ...node.connections.flatMap(chain)];

const gunKinds = ['carbine-shot', 'twinbore-shot', 'repeater-shot'] as const;
const frequencies = (sources: Source[]) =>
  sources
    .filter((s) => s.kind === 'oscillator')
    .map((s) => s.frequency.events.find((e) => e.kind === 'set')!.value!);

test('coil and paired-bores have distinct finite reports and quiet mechanical recovery cues', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const { sound, c } = fixture(t);
  sound.play('carbine-shot');
  const coil = [...c.sources];
  assert.equal(coil.length, 5);
  assert.deepEqual(frequencies(coil), [920, 130, 1300, 500]);
  assert(
    coil.some((s) => s.startTime! >= 0.12),
    'the real report includes a delayed bolt return',
  );
  assert(coil.every((s) => Number.isFinite(s.stopTime) && s.stopTime <= 0.16 && !s.loop));
  const late = coil.filter((s) => s.startTime! > 0);
  assert(
    late.every((s) =>
      s.connections[0].gain.events.some((e) => e.kind === 'linear' && e.value! <= 0.025),
    ),
  );
  c.advance(0.6);
  const first = c.sources.length;
  sound.play('twinbore-shot');
  const paired = c.sources.slice(first);
  assert.equal(paired.length, 5);
  assert.deepEqual(frequencies(paired), [145, 210, 320, 190]);
  assert.equal(paired[0].startTime, 0.6);
  assert.equal(paired[1].startTime, 0.618, 'paired bores are close, not a hidden firing burst');
  assert(paired.filter((s) => s.startTime! >= 0.7).length === 2);
  c.advance(1);
  assert.equal(sound.voices, 0);
  assert(c.sources.every((s) => s.disconnected));
});

test('repeater pressure rises only on real accepted discharges, then releases once', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const { sound, c } = fixture(t);
  const rise: number[] = [];
  for (let shot = 0; shot < 10; shot++) {
    const first = c.sources.length;
    sound.play('repeater-shot');
    const emitted = c.sources.slice(first);
    assert.equal(emitted.length, 3);
    rise.push(frequencies(emitted)[0]);
    const before = c.sources.length;
    for (let frame = 0; frame < 8; frame++) sound.updateToolAudio(true);
    sound.play('repeater-shot');
    assert.equal(
      c.sources.length,
      before,
      'frame updates and rejected duplicate events never synthesize shots',
    );
    c.advance(0.121);
  }
  assert.equal(rise[0], 390);
  assert.equal(rise.at(-1), 520);
  assert(rise.every((n, i) => i === 0 || n >= rise[i - 1]));
  const before = c.sources.length;
  sound.updateToolAudio(false);
  const released = c.sources.slice(before);
  assert.equal(released.length, 2);
  assert.equal(frequencies(released)[0], 260);
  assert(released.every((s) => s.stopTime <= c.currentTime + 0.11 && !s.loop));
  for (let frame = 0; frame < 180; frame++) sound.updateToolAudio(false);
  assert.equal(c.sources.length, before + 2, 'release is a one-shot tail, never a frame loop');
  c.advance(0.3);
  const again = c.sources.length;
  sound.play('repeater-shot');
  assert.equal(frequencies(c.sources.slice(again))[0], 390, 'a new pull begins at low pressure');
});

test('cadence gaps reset pressure and a missing future frame cannot leave an audio loop', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const { sound, c } = fixture(t);
  sound.play('repeater-shot');
  c.advance(0.08);
  sound.play('repeater-shot');
  c.advance(0.5);
  const before = c.sources.length;
  sound.updateToolAudio(true);
  sound.updateToolAudio(false);
  assert.equal(c.sources.length, before, 'an expired pressure train cannot replay its old release');
  sound.play('repeater-shot');
  assert.equal(frequencies(c.sources.slice(before))[0], 390);
  assert(c.sources.every((s) => Number.isFinite(s.stopTime) && !s.loop));
  c.advance(5);
  assert.equal(sound.voices, 0);
  assert(c.sources.every((s) => s.disconnected));
});

test('converted ammunition keeps its existing signature and cannot inherit repeater rise or release', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const { sound, c } = fixture(t);
  for (const kind of ['heavy', 'charged', 'mass-shot', 'shell-shot']) {
    sound.play('repeater-shot');
    c.advance(0.08);
    sound.play('repeater-shot');
    c.advance(0.08);
    const first = c.sources.length;
    sound.play(kind);
    const converted = c.sources.slice(first);
    const signature = frequencies(converted);
    const before = c.sources.length;
    sound.updateToolAudio(false);
    assert.equal(c.sources.length, before, kind + ' must not add an unrelated pressure release');
    c.advance(0.8);
    const next = c.sources.length;
    sound.play(kind);
    assert.deepEqual(frequencies(c.sources.slice(next)), signature);
    c.advance(0.8);
  }
});

test('pause, focus loss, mute, suspended context, cinema and reset cancel every delayed tool cue silently', (t) => {
  for (const stop of [
    'pause',
    'hidden',
    'world-hidden',
    'effects',
    'master',
    'reset',
    'suspended',
    'cinema',
  ] as const) {
    const { sound, c } = fixture(t);
    sound.musicEnabled = false;
    sound.updateMusic(scene());
    for (const kind of gunKinds) sound.play(kind);
    assert(c.sources.some((s) => s.startTime! > c.currentTime));
    const playing = [...c.sources];
    c.deliverEnded = false;
    if (stop === 'pause') sound.updateMusic(scene({ mode: 'paused' }));
    if (stop === 'hidden') sound.updateMusic(scene(), false);
    if (stop === 'world-hidden') sound.updateWorld(null, false);
    if (stop === 'effects') sound.effectsVolume = 0;
    if (stop === 'master') sound.enabled = false;
    if (stop === 'reset') sound.resetMusic();
    if (stop === 'suspended') {
      c.state = 'suspended';
      sound.updateMusic(scene());
    }
    if (stop === 'cinema') sound.updateMusic(scene({ effectsSilent: true, musicSilent: true }));
    assert(
      playing.every((s) => s.disconnected && s.stopTime <= c.currentTime),
      stop,
    );
    assert.equal(sound.voices, 0, stop);
    const before = c.sources.length;
    sound.updateToolAudio(false);
    assert.equal(c.sources.length, before, stop + ' cannot make a release noise');
    // Even a late callback must not double-decrement the voice budget.
    for (const s of playing) s.onended?.();
    assert.equal(sound.voices, 0, stop);
  }
});

test('native tool layers stay on the ducked effects bus and never consume reserved threat voices', (t) => {
  const { sound, c } = fixture(t);
  sound.musicEnabled = false;
  for (let shot = 0; shot < 90; shot++) {
    sound.play(gunKinds[shot % 3]);
    c.currentTime += 0.016;
    assert(sound.voices <= 24);
  }
  assert.equal(sound.voices, 24);
  const tools = [...c.sources];
  assert(tools.every((s) => reaches(s, sound.effects) && reaches(s, sound.effectsOutput)));
  const before = c.sources.length;
  sound.play('finale-aim-lock');
  const warning = c.sources.slice(before);
  assert(warning.length > 0 && sound.voices <= 32);
  assert(warning.every((s) => !reaches(s, sound.effects) && reaches(s, sound.effectsOutput)));
  assert(
    (sound.effects!.gain as unknown as Param).events.some(
      (e) => e.kind === 'target' && e.value === 0.35,
    ),
  );
  c.advance(3);
  assert.equal(sound.voices, 0);
});

test('effects volume and live mono control all delayed tool layers and pressure release', (t) => {
  const { sound, c } = fixture(t);
  sound.effectsVolume = 0.37;
  for (const kind of gunKinds) sound.play(kind, { x: 420, y: 0, source: 'player' });
  assert(c.panners.some((p) => p.pan.value > 0));
  sound.mono = true;
  assert(c.panners.every((p) => p.pan.value === 0));
  const before = c.sources.length;
  sound.updateToolAudio(false);
  assert(c.sources.length > before);
  assert(c.panners.every((p) => p.pan.value === 0));
  assert(c.sources.every((s) => reaches(s, sound.effectsOutput)));
  assert.equal(sound.effectsOutput!.gain.value, 0.37);
  sound.effectsVolume = 0;
  assert.equal(sound.voices, 0);
  const muted = c.sources.length;
  for (const kind of gunKinds) sound.play(kind);
  sound.updateToolAudio(true);
  sound.updateToolAudio(false);
  assert.equal(c.sources.length, muted);
});

test('unlock and frame updates cannot manufacture a shot or bypass unavailable audio', (t) => {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Reflect.deleteProperty(globalThis, 'AudioContext');
  const sound = new Sound();
  sound.updateToolAudio(true);
  sound.updateToolAudio(false);
  sound.play('repeater-shot');
  assert.equal(sound.context, null);
  if (before) Object.defineProperty(globalThis, 'AudioContext', before);
  const f = fixture(t);
  for (let frame = 0; frame < 100; frame++) {
    f.sound.updateToolAudio(true);
    f.sound.updateToolAudio(false);
  }
  assert.equal(f.c.sources.length, 0);
});
