import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../src/audio.ts';
import { spatialMix, soundCooldownKey } from '../src/sound-event.ts';
import type { SoundMaterial } from '../src/sound-event.ts';
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

test('spatial mixing is finite, mirrored, gently attenuated and warning-safe', () => {
  const left = spatialMix({ x: -420, y: 0 }, { x: 0, y: 0 });
  const right = spatialMix({ x: 420, y: 0 }, { x: 0, y: 0 });
  assert.equal(left.pan, -right.pan);
  assert.equal(left.gain, right.gain);
  assert(left.pan < 0 && right.pan > 0 && right.pan < 1);
  assert(right.gain > 0.85 && right.gain < 1);
  assert.deepEqual(spatialMix(undefined, { x: 0, y: 0 }), { pan: 0, gain: 1 });
  assert.deepEqual(spatialMix({ x: NaN, y: 0 }, { x: 0, y: 0 }), { pan: 0, gain: 1 });
  for (const x of [-Number.MAX_VALUE, -10000, -420, 0, 420, 10000, Number.MAX_VALUE]) {
    const warning = spatialMix({ x, y: 100 }, { x: 0, y: 0 }, false, true);
    const impact = spatialMix({ x, y: 100 }, { x: 0, y: 0 });
    assert(Number.isFinite(warning.pan) && Number.isFinite(warning.gain));
    assert(warning.gain >= 0.7 && warning.gain <= 1);
    assert(impact.gain >= 0.24 && impact.gain <= 1);
    assert.equal(spatialMix({ x, y: 100 }, { x: 0, y: 0 }, true, true).pan, 0);
  }
});

test('simultaneous identical warning cues retain independent emitter positions and cooldowns', (t) => {
  const { sound, c } = fixture(t);
  sound.play('lock', { x: -420, y: 0, source: 'enemy:1' });
  sound.play('lock', { x: 420, y: 0, source: 'enemy:2' });
  assert.equal(c.sources.length, 2);
  assert.equal(c.panners.length, 2);
  assert(c.panners[0].pan.value < 0 && c.panners[1].pan.value > 0);
  assert(c.sources.every((s) => reaches(s, sound.effectsOutput) && !reaches(s, sound.effects)));
  sound.play('lock', { x: -350, y: 50, source: 'enemy:1' });
  assert.equal(c.sources.length, 2, 'A moving emitter keeps its own cooldown');
  c.advance(0.121);
  sound.play('lock', { x: -350, y: 50, source: 'enemy:1' });
  assert.equal(c.sources.length, 3);
  assert.notEqual(
    soundCooldownKey('hit', { x: -420, y: 0 }),
    soundCooldownKey('hit', { x: 420, y: 0 }),
  );
});

test('listener updates and mono changes center every live and delayed spatial layer', (t) => {
  const { sound, c } = fixture(t);
  sound.play('harpoon-lock', { x: 420, y: 0, source: 'harpoon' });
  const panners = [...c.panners];
  assert.equal(panners.length, 2);
  assert(c.sources.some((s) => s.startTime! > c.currentTime));
  sound.setListener({ x: 840, y: 0 });
  assert(panners.every((p) => p.pan.value < 0));
  sound.mono = true;
  assert(panners.every((p) => p.pan.value === 0));
  const count = c.nodes.length;
  for (let i = 0; i < 300; i++) sound.setListener({ x: 840, y: 0 });
  assert.equal(c.nodes.length, count, 'Moving the listener must reuse the voice graph');
  sound.mono = false;
  assert(panners.every((p) => p.pan.value < 0));
  sound.setListener(null);
  assert(panners.every((p) => p.pan.value === 0));
  c.advance(1);
  assert.equal(sound.voices, 0);
  assert(panners.every((p) => p.disconnected));
});

test('quiet listener motion accumulates and does not leave active panners stuck', (t) => {
  const { sound, c } = fixture(t);
  sound.play('cinema-plane', { x: 420, y: 0 });
  const pan = c.panners[0].pan;
  const initial = pan.value;
  for (let i = 1; i <= 40; i++) sound.setListener({ x: i * 0.2, y: 0 });
  assert(pan.value < initial - 0.008);
  assert(pan.events.length < 40, 'Small motion should not schedule automation each frame');
});

test('material impact layers vary by material while preserving the native base cue', (t) => {
  const { sound, c } = fixture(t);
  for (const kind of ['hit', 'break', 'kill']) {
    const start = c.sources.length;
    sound.play(kind);
    const base = c.sources.slice(start).map((s) => [s.kind, s.frequency.value]);
    c.advance(1);
    const signatures = new Set<string>();
    for (const material of ['armor', 'casing', 'cover', 'power', 'terrain'] as SoundMaterial[]) {
      const first = c.sources.length;
      sound.play(kind, { x: 420, y: 0, source: material, material });
      const voices = c.sources.slice(first);
      assert(voices.length > base.length);
      assert.deepEqual(
        voices.slice(0, base.length).map((s) => [s.kind, s.frequency.value]),
        base,
      );
      assert(voices.every((s) => chain(s).some((n) => n.kind === 'panner')));
      signatures.add(
        JSON.stringify(
          voices
            .slice(base.length)
            .map((s) => [s.kind, s.frequency.value, s.stopTime - c.currentTime]),
        ),
      );
      c.advance(1);
    }
    assert.equal(signatures.size, 5);
  }
});

test('unsupported stereo panners retain the positional gain path without disabling sound', (t) => {
  class OldContext extends Context {
    constructor() {
      super();
      Object.defineProperty(this, 'createStereoPanner', { value: undefined });
    }
  }
  const { sound, c } = fixture(t, OldContext);
  sound.play('lock', { x: 10000, y: 0 });
  assert.equal(c.sources.length, 1);
  assert.equal(c.panners.length, 0);
  const gains = chain(c.sources[0]).filter((n) => n.kind === 'gain');
  assert(gains.some((n) => n.gain.value === 0.7));
  c.advance(1);
  assert.equal(sound.voices, 0);
});

test('ordinary and priority budgets, emitter cooldown records and delayed cleanup remain bounded', (t) => {
  const { sound, c } = fixture(t);
  c.deliverEnded = false;
  for (let i = 0; i < 2000; i++)
    sound.play('hit', { x: i, y: 0, source: `enemy:${i}`, material: 'power' });
  assert.equal(sound.voices, 24);
  assert(sound.played.size <= 384);
  const first = c.sources.length;
  sound.play('harpoon-lock', { x: -420, y: 0, source: 'warning:1' });
  sound.play('harpoon-lock', { x: 420, y: 0, source: 'warning:2' });
  assert(c.sources.length > first);
  assert(sound.voices <= 32);
  const panners = [...c.panners];
  c.advance(1);
  sound.setListener({ x: 10, y: 0 });
  assert.equal(sound.voices, 0, 'Audio-clock pruning cannot depend on delivered onended events');
  assert(panners.every((p) => p.disconnected));
  sound.play('shot', { x: 0, y: 0, source: 'player' });
  assert.equal(sound.voices, 2, 'Pruning makes ordinary voice capacity available immediately');
});

test('mute, pause, hidden page, reset and room change disconnect future positional notes', (t) => {
  const { sound, c } = fixture(t);
  sound.musicEnabled = false;
  for (const stop of [
    'effects',
    'master',
    'pause',
    'hidden',
    'reset',
    'room',
    'suspended',
    'world',
  ] as const) {
    sound.enabled = true;
    sound.effectsVolume = 1;
    c.state = 'running';
    sound.updateMusic(scene());
    sound.updateWorld(null, true);
    sound.play('harpoon-lock', { x: 420, y: 0, source: stop });
    const voices = c.sources.filter((s) => !s.disconnected);
    assert(voices.length > 0 && voices.some((s) => s.startTime! > c.currentTime));
    if (stop === 'effects') sound.effectsVolume = 0;
    if (stop === 'master') sound.enabled = false;
    if (stop === 'pause') sound.updateMusic(scene({ mode: 'paused' }));
    if (stop === 'hidden') sound.updateMusic(scene(), false);
    if (stop === 'reset') sound.resetMusic();
    if (stop === 'room') sound.updateMusic(scene({ room: 'audio:next' }));
    if (stop === 'suspended') {
      c.state = 'suspended';
      sound.updateMusic(scene());
    }
    if (stop === 'world') sound.updateWorld(null, false);
    assert.equal(sound.voices, 0, stop);
    assert(
      voices.every((s) => s.disconnected && s.stopTime <= c.currentTime),
      stop,
    );
    const after = c.sources.length;
    c.advance(2);
    c.state = 'running';
    sound.enabled = true;
    sound.effectsVolume = 1;
    sound.updateMusic(scene());
    sound.updateWorld(null, true);
    assert.equal(c.sources.length, after, stop + ' must not replay missed effects');
  }
});

test('factory ambience obeys effects lifecycle, ducking, cinematic silence and independent music settings', (t) => {
  const { sound, c } = fixture(t);
  sound.musicEnabled = false;
  sound.musicVolume = 0;
  const world = { area: 'furnace' as const, room: 'audio:0', power: 1, activity: 1 };
  sound.updateMusic(scene());
  sound.updateWorld(world);
  assert(sound.factory!.active);
  assert(sound.factory!.voiceCount > 0 && sound.factory!.voiceCount <= 3);
  const loops = c.sources.filter((s) => !s.disconnected);
  assert(loops.every((s) => reaches(s, sound.effects)));
  const initial = c.sources.length;
  for (let i = 0; i < 200; i++) sound.updateWorld({ ...world, power: i / 200 });
  assert.equal(c.sources.length, initial);
  sound.play('lock', { x: 420, y: 0 });
  assert(
    (sound.effects!.gain as unknown as Param).events.some(
      (e) => e.kind === 'target' && e.value === 0.35,
    ),
  );
  sound.mono = true;
  assert(sound.factory!.active);
  sound.updateMusic(
    scene({ effectsSilent: true, rain: true, cinema: 'approach', musicSilent: true }),
  );
  assert(!sound.factory!.active);
  sound.updateWorld(world);
  assert(!sound.factory!.active, 'World updates must not break silent finale approach');
  sound.resetMusic();
  assert(!sound.factory!.active);
  sound.updateMusic(scene());
  for (const stop of ['effects', 'master', 'pause', 'hidden', 'null', 'reset'] as const) {
    sound.enabled = true;
    sound.effectsVolume = 1;
    sound.updateMusic(scene());
    sound.updateWorld(world);
    assert(sound.factory!.active);
    if (stop === 'effects') sound.effectsVolume = 0;
    if (stop === 'master') sound.enabled = false;
    if (stop === 'pause') sound.updateMusic(scene({ mode: 'paused' }));
    if (stop === 'hidden') sound.updateWorld(world, false);
    if (stop === 'null') sound.updateWorld(null);
    if (stop === 'reset') sound.resetMusic();
    assert(!sound.factory!.active, stop);
  }
});

test('world-only room updates release old positional effects while preserving centered UI and cinema', (t) => {
  const { sound, c } = fixture(t);
  const world = { area: 'docks' as const, room: 'one', power: 1, activity: 0 };
  sound.updateWorld(world);
  const first = c.sources.length;
  sound.play('harpoon-lock', { x: 420, y: 0, source: 'old-enemy' });
  const attack = c.sources.slice(first);
  sound.play('upgrade');
  const ui = c.sources.slice(first + attack.length);
  sound.play('cinema-plane', { x: -420, y: 0 });
  const cinema = c.sources.slice(first + attack.length + ui.length);
  sound.updateWorld({ ...world, room: 'two' });
  assert(attack.every((s) => s.disconnected));
  assert(ui.every((s) => !s.disconnected));
  assert(cinema.every((s) => !s.disconnected));
  sound.play('lock', { x: 420, y: 0, source: 'next-enemy' });
  const next = c.sources.at(-1)!;
  sound.updateWorld(null);
  assert(next.disconnected);
  assert(cinema.every((s) => !s.disconnected));
  sound.resetMusic();
  assert.equal(sound.voices, 0);
});

test('mono set before unlock persists and resetting a paused scene permits a fresh run', (t) => {
  const { sound, c } = fixture(t, Context, true);
  sound.updateMusic(scene({ mode: 'paused' }));
  sound.updateWorld(null, false);
  sound.play('lock', { x: 420, y: 0 });
  assert.equal(c.sources.length, 0);
  sound.resetMusic();
  sound.play('lock', { x: 420, y: 0 });
  assert.equal(c.sources.length, 1);
  assert.equal(c.panners[0].pan.value, 0);
  assert.equal(sound.mono, true);
});

test('mono downmix includes both rain channels, score and positioned effects and restores stereo live', (t) => {
  const { sound, c } = fixture(t, Context, true);
  assert.equal(sound.master!.channelCount, 1);
  assert.equal(sound.master!.channelCountMode, 'explicit');
  assert.equal(sound.master!.channelInterpretation, 'speakers');
  sound.updateMusic(scene({ rain: true }));
  sound.play('lock', { x: 420, y: 0, source: 'enemy:right' });
  const rain = c.sources.find((s) => s.loop)!;
  assert.equal((rain.buffer as { numberOfChannels: number }).numberOfChannels, 2);
  const score = c.sources.filter((s) => reaches(s, sound.musicOutput));
  const warning = c.sources.find((s) => chain(s).some((n) => n.kind === 'panner'))!;
  assert(rain && warning && score.length > 0);
  assert(c.sources.every((s) => reaches(s, sound.master)));
  assert(c.sources.every((s) => reaches(s, c.destination)));
  assert(c.panners.every((p) => p.pan.value === 0));
  const count = c.nodes.length;
  sound.mono = false;
  assert.equal(sound.master!.channelCount, 2);
  assert.equal(sound.master!.channelCountMode, 'explicit');
  assert(c.panners.every((p) => p.pan.value > 0));
  assert.equal(c.nodes.length, count, 'Changing channels must reuse the complete graph');
  assert(
    c.sources.every((s) => !s.disconnected),
    'Downmix must preserve every source',
  );
  sound.mono = true;
  assert.equal(sound.master!.channelCount, 1);
  assert(c.panners.every((p) => p.pan.value === 0));
});

test('legacy channel configuration failures keep centered effects and the audio graph usable', (t) => {
  class LegacyChannels extends Context {
    createGain() {
      const node = super.createGain();
      Object.defineProperty(node, 'channelCountMode', {
        set() {
          throw Error('Unsupported channel mode');
        },
      });
      return node;
    }
  }
  const { sound, c } = fixture(t, LegacyChannels, true);
  assert(sound.context && sound.master);
  sound.play('lock', { x: -420, y: 0 });
  assert.equal(c.sources.length, 1);
  assert.equal(c.panners[0].pan.value, 0);
  assert(reaches(c.sources[0], c.destination));
  sound.mono = false;
  assert(c.panners[0].pan.value < 0);
});
