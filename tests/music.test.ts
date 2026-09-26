import test from 'node:test';
import assert from 'node:assert/strict';
import { Music, MUSIC_LOOKAHEAD, MUSIC_VOICES } from '../src/music.ts';
import { Sound, volumeLevel } from '../src/audio.ts';
import type { MusicScene } from '../src/music-score.ts';

type Automation = { kind: string; value?: number; time: number };

class AudioParamMock {
  value = 1;
  events: Automation[] = [];
  setValueAtTime(value: number, time: number) {
    this.events.push({ kind: 'set', value, time });
    this.value = value;
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ kind: 'linear', value, time });
    this.value = value;
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.events.push({ kind: 'exponential', value, time });
    this.value = value;
    return this;
  }
  setTargetAtTime(value: number, time: number, _constant: number) {
    this.events.push({ kind: 'target', value, time });
    this.value = value;
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

class AudioNodeMock {
  connections: AudioNodeMock[] = [];
  disconnected = false;
  context: AudioContextMock;
  kind: string;
  constructor(context: AudioContextMock, kind: string) {
    this.context = context;
    this.kind = kind;
    context.nodes.push(this);
  }
  connect(node: AudioNodeMock) {
    this.connections.push(node);
    return node;
  }
  disconnect() {
    this.connections = [];
    this.disconnected = true;
  }
}

class GainNodeMock extends AudioNodeMock {
  gain = new AudioParamMock();
  constructor(context: AudioContextMock) {
    super(context, 'gain');
  }
}

class SourceNodeMock extends AudioNodeMock {
  type = 'sine';
  frequency = new AudioParamMock();
  detune = new AudioParamMock();
  playbackRate = new AudioParamMock();
  buffer: unknown = null;
  startTime: number | undefined;
  stopTime = Infinity;
  stopCalls: number[] = [];
  ended = false;
  onended: (() => void) | null = null;
  start(time = this.context.currentTime) {
    assert.equal(this.startTime, undefined, 'A source was started more than once');
    this.startTime = time;
  }
  stop(time = this.context.currentTime) {
    this.stopCalls.push(time);
    this.stopTime = Math.max(time, this.context.currentTime);
  }
}

class AudioContextMock {
  static instances: AudioContextMock[] = [];
  currentTime = 0;
  sampleRate = 44100;
  state: AudioContextState = 'running';
  nodes: AudioNodeMock[] = [];
  destination = new AudioNodeMock(this, 'destination');
  resumeCalls = 0;
  rejectResume = false;
  deliverEnded = true;
  pendingEnded: (() => void)[] = [];
  constructor() {
    AudioContextMock.instances.push(this);
  }
  createGain() {
    return new GainNodeMock(this);
  }
  createOscillator() {
    return new SourceNodeMock(this, 'oscillator');
  }
  createBufferSource() {
    return new SourceNodeMock(this, 'buffer');
  }
  createBiquadFilter() {
    return Object.assign(new AudioNodeMock(this, 'filter'), {
      type: 'lowpass',
      frequency: new AudioParamMock(),
      Q: new AudioParamMock(),
      gain: new AudioParamMock(),
    });
  }
  createStereoPanner() {
    return Object.assign(new AudioNodeMock(this, 'panner'), { pan: new AudioParamMock() });
  }
  createDynamicsCompressor() {
    return Object.assign(new AudioNodeMock(this, 'compressor'), {
      threshold: new AudioParamMock(),
      knee: new AudioParamMock(),
      ratio: new AudioParamMock(),
      attack: new AudioParamMock(),
      release: new AudioParamMock(),
    });
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
    this.resumeCalls++;
    if (this.rejectResume) return Promise.reject(new Error('Audio access denied'));
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
  advance(seconds: number) {
    if (this.state !== 'running') return;
    this.currentTime += seconds;
    for (const source of this.sources) {
      if (source.ended || source.stopTime > this.currentTime) continue;
      source.ended = true;
      const onended = source.onended;
      if (onended) {
        if (this.deliverEnded) onended();
        else this.pendingEnded.push(onended);
      }
    }
  }
  get sources() {
    return this.nodes.filter((node): node is SourceNodeMock => node instanceof SourceNodeMock);
  }
}

const scene = (overrides: Partial<MusicScene> = {}): MusicScene => ({
  area: 'docks',
  room: 'test-run:0',
  mode: 'playing',
  intensity: 0.8,
  boss: false,
  clear: false,
  ...overrides,
});

function fixture() {
  const context = new AudioContextMock();
  const destination = context.createGain();
  const music = new Music(context as unknown as AudioContext, destination as unknown as AudioNode);
  return { context, music, destination };
}

function installContext(t: { after(fn: () => void): void }, value: unknown = AudioContextMock) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'AudioContext', original);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  });
}

function assertCancelled(context: AudioContextMock, sources: SourceNodeMock[]) {
  assert(sources.length > 0, 'The fixture must have scheduled music voices');
  for (const source of sources) {
    assert(source.stopTime <= context.currentTime + 0.06, 'A queued note survived cancellation');
    assert(source.disconnected, 'A cancelled source stayed connected to the audio graph');
  }
}

test('separate volumes apply before unlock, scale warning sounds, and survive ducking and master mute', (t) => {
  installContext(t);
  const sound = new Sound();
  sound.effectsVolume = 0.4;
  sound.musicVolume = 0.25;
  sound.unlock();
  const context = sound.context as unknown as AudioContextMock;
  assert.equal(sound.effectsOutput!.gain.value, 0.4);
  assert.equal(sound.musicOutput!.gain.value, 0.25);
  sound.play('interceptor-lock');
  const reaches = (node: AudioNodeMock, target: unknown): boolean =>
    node === target || node.connections.some((next) => reaches(next, target));
  assert(
    context.sources.every((node) => reaches(node, sound.effectsOutput)),
    'warnings must obey the effects volume',
  );
  assert(context.sources.every((node) => !reaches(node, sound.musicOutput)));
  assert.equal(
    sound.effectsOutput!.gain.value,
    0.4,
    'warning ducking cannot reset the user volume',
  );
  const beforeMusic = context.sources.length;
  sound.updateMusic(scene());
  const notes = context.sources.slice(beforeMusic);
  assert(notes.length > 0);
  assert(notes.every((node) => reaches(node, sound.musicOutput)));
  assert(notes.every((node) => !reaches(node, sound.effectsOutput)));
  sound.enabled = false;
  assert.equal(sound.master!.gain.value, 0);
  sound.enabled = true;
  assert.equal(sound.effectsVolume, 0.4);
  assert.equal(sound.musicVolume, 0.25);
  sound.musicVolume = 0;
  const beforeMuted = context.sources.length;
  sound.updateMusic(scene());
  assert.equal(context.sources.length, beforeMuted);
  sound.effectsVolume = 0;
  sound.play('shoot');
  sound.play('loader');
  sound.updateTorch(true, 1);
  assert.equal(
    context.sources.length,
    beforeMuted,
    'zero effects includes priority warnings and sustained weapons',
  );
  sound.musicVolume = 0.7;
  sound.updateMusic(scene());
  assert(context.sources.length > beforeMuted, 'music remains independent of effects mute');
  assert.equal(sound.musicOutput!.gain.value, 0.7);
});

test('invalid volumes cannot inject non-finite or excessive gains', () => {
  for (const raw of [undefined, null, '0', NaN, Infinity, -Infinity, {}])
    assert.equal(volumeLevel(raw), 1);
  assert.equal(volumeLevel(-1), 0);
  assert.equal(volumeLevel(5), 1);
  assert.equal(volumeLevel(0), 0);
  assert.equal(volumeLevel(0.5), 0.5);
});

test('attack warnings stay audible when gunfire fills the effect voice budget', (t) => {
  installContext(t);
  const sound = new Sound();
  sound.unlock();
  const context = sound.context as unknown as AudioContextMock;
  for (let i = 0; i < 50; i++) sound.tone(180, 40, 0.15, 0.1);
  assert.equal(sound.voices, 24);
  const before = context.sources.length;
  sound.play('interceptor-lock');
  assert(context.sources.length > before, 'Critical tell must have reserved voices');
  assert(sound.voices <= 32);
  const warningVoices = context.sources.slice(before);
  const reaches = (node: AudioNodeMock, target: unknown): boolean =>
    node === target || node.connections.some((next) => reaches(next, target));
  assert(warningVoices.every((node) => reaches(node, sound.master)));
  assert(
    warningVoices.every((node) => !reaches(node, sound.effects)),
    'Warnings bypass the ducked effects bus',
  );
  const automation = sound.effects!.gain as unknown as AudioParamMock;
  assert(automation.events.some((event) => event.kind === 'target' && event.value === 0.35));
  assert(
    automation.events.some(
      (event) => event.kind === 'target' && event.value === 1 && event.time > context.currentTime,
    ),
  );
  const warned = context.sources.length;
  sound.play('interceptor-lock');
  assert.equal(context.sources.length, warned, 'A volley should not duplicate its warning sound');
  sound.play('story-found');
  sound.play('story-cold');
  assert.equal(
    context.sources.length,
    warned,
    'Story cues must not borrow reserved warning voices',
  );
  context.advance(1);
  assert.equal(sound.voices, 0);
  assert(context.sources.every((source) => source.disconnected));
});

test('armor, impact and kill cues use different voices and rapid hits are bounded', (t) => {
  installContext(t);
  const sound = new Sound();
  sound.unlock();
  const context = sound.context as unknown as AudioContextMock;
  const signatures: number[][] = [];
  for (const kind of ['armor', 'hit', 'kill']) {
    const first = context.sources.length;
    sound.play(kind);
    const sources = context.sources.slice(first);
    assert(sources.length > 0);
    signatures.push(
      sources.filter((node) => node.kind === 'oscillator').map((node) => node.frequency.value),
    );
    const count = context.sources.length;
    for (let i = 0; i < 30; i++) sound.play(kind);
    assert.equal(context.sources.length, count);
    context.advance(0.4);
  }
  assert.notDeepEqual(signatures[0], signatures[1]);
  assert.notDeepEqual(signatures[1], signatures[2]);
  assert.equal(sound.voices, 0);
});

test('torch sound reuses one voice, follows heat, and releases its entire graph on stop or mute', (t) => {
  installContext(t);
  const sound = new Sound();
  sound.updateTorch(true);
  assert.equal(sound.context, null, 'Firing cannot bypass audio unlock');
  sound.unlock();
  const context = sound.context as unknown as AudioContextMock;
  const initial = context.nodes.length;
  for (let i = 0; i < 600; i++) sound.updateTorch(true);
  assert.equal(context.sources.length, 1);
  const first = context.sources[0];
  assert.equal(first.frequency.value, 92);
  assert.equal(
    first.frequency.events.length,
    1,
    'Steady heat should not queue repeated automation',
  );
  sound.updateTorch(true, 1);
  assert.equal(first.frequency.value, 140);
  sound.updateTorch(false);
  context.advance(0.2);
  assert(context.nodes.slice(initial).every((node) => node.disconnected));
  assert.equal(first.stopCalls.length, 1);
  sound.updateTorch(true);
  const second = context.sources[1];
  sound.enabled = false;
  context.advance(0.2);
  assert(second.disconnected);
  sound.updateTorch(true);
  assert.equal(context.sources.length, 2, 'Muted firing created a voice');
  sound.enabled = true;
  sound.updateTorch(true);
  const third = context.sources[2];
  context.state = 'suspended';
  sound.updateTorch(true);
  assert(third.stopTime < Infinity);
  context.state = 'running';
  context.advance(0.2);
  assert(third.disconnected);
});

test('music schedules a short future window without duplicating notes on repeated frames', () => {
  const { context, music } = fixture();
  music.update(scene());
  assert(music.voiceCount > 0);
  const count = context.sources.length,
    step = music.step;
  for (const source of context.sources) {
    assert(source.startTime! > context.currentTime);
    assert(source.startTime! <= context.currentTime + MUSIC_LOOKAHEAD);
    assert(source.stopTime > source.startTime!);
  }
  for (let i = 0; i < 100; i++) music.update(scene());
  assert.equal(context.sources.length, count);
  assert.equal(music.step, step);
  context.advance(0.17);
  music.update(scene());
  assert(music.step > step);
});

test('a long frame stall skips missed beats instead of emitting an audio backlog', () => {
  const { context, music } = fixture();
  music.update(scene());
  const firstStep = music.step;
  context.advance(60);
  const before = context.sources.length;
  music.update(scene());
  const fresh = context.sources.slice(before);
  assert(music.step > firstStep + 100, 'The transport must advance across the stalled minute');
  assert(fresh.length <= 8, 'A stalled frame released many old beats at once');
  for (const source of fresh) {
    assert(source.startTime! >= context.currentTime);
    assert(source.startTime! <= context.currentTime + MUSIC_LOOKAHEAD);
  }
  assert(music.nextTime > context.currentTime);
});

test('a rooftop beat running 220ms late skips overdue steps instead of collapsing them onto one instant', () => {
  const { context, music } = fixture();
  const combat = scene({ area: 'rooftops', boss: true, intensity: 1 });
  music.update(combat);
  for (let i = 0; i < 400 && music.step < 10; i++) {
    context.advance(1 / 120);
    music.update(combat);
  }
  assert.equal(music.step, 10);
  const scheduled = new Map<number, number>();
  const note = music.note.bind(music);
  music.note = (...args) => {
    scheduled.set(music.step, args[1]);
    note(...args);
  };
  context.advance(music.nextTime - context.currentTime + 0.22);
  music.update(combat);
  assert(scheduled.size > 0, 'The resumed score must actually schedule a sounded beat');
  assert.equal(
    new Set(scheduled.values()).size,
    scheduled.size,
    'Different overdue sixteenths were scheduled at the same instant',
  );
  assert([...scheduled.values()].every((at) => at > context.currentTime));
  assert(music.nextTime > context.currentTime);
});

test('title, pause, results, hidden pages, and disabled music cancel queued sources and stay silent', () => {
  const states: [Partial<MusicScene>, boolean, boolean][] = [
    [{ mode: 'title' }, true, true],
    [{ mode: 'paused' }, true, true],
    [{ mode: 'dead' }, true, true],
    [{ mode: 'won' }, true, true],
    [{}, true, false],
    [{}, false, true],
  ];
  for (const [change, enabled, active] of states) {
    const { context, music } = fixture();
    music.update(scene());
    const sources = [...context.sources];
    music.update(scene(change), enabled, active);
    assert.equal(music.running, false);
    assert.equal(music.targetGain, 0);
    context.advance(0.05);
    assertCancelled(context, sources);
    assert.equal(music.voiceCount, 0);
    const step = music.step;
    context.advance(10);
    music.update(scene(change), enabled, active);
    assert.equal(context.sources.length, sources.length);
    assert.equal(music.step, step);
  }
});

test('suspended contexts and resumed gameplay restart cleanly without reviving queued notes', () => {
  const { context, music } = fixture();
  music.update(scene());
  const previous = [...context.sources];
  context.state = 'suspended';
  music.update(scene());
  assert.equal(music.running, false);
  assert.equal(music.targetGain, 0);
  for (const source of previous) assert(source.stopTime <= context.currentTime + 0.05);
  const step = music.step;
  music.update(scene());
  assert.equal(music.step, step);
  context.state = 'running';
  context.advance(0.1);
  music.update(scene());
  assertCancelled(context, previous);
  assert(music.running);
  const fresh = context.sources.filter((source) => !previous.includes(source));
  assert(fresh.length > 0);
  assert(fresh.every((source) => source.startTime! >= context.currentTime));
});

test('clear rooms and upgrade screens replace combat voices with quiet percussion-free music', () => {
  for (const calm of [{ clear: true }, { mode: 'upgrade' as const }]) {
    const { context, music } = fixture();
    music.update(scene({ area: 'furnace', boss: true, intensity: 1 }));
    const combatGain = music.targetGain;
    const combat = [...context.sources];
    const before = context.sources.length;
    music.update(scene({ area: 'furnace', boss: true, intensity: 1, ...calm }));
    for (let i = 0; i < 300; i++) {
      context.advance(1 / 60);
      music.update(scene({ area: 'furnace', boss: true, intensity: 1, ...calm }));
    }
    const ambient = context.sources.slice(before);
    assertCancelled(context, combat);
    assert(ambient.length > 0);
    assert(ambient.every((source) => source.kind === 'oscillator' && source.type === 'sine'));
    assert(
      ambient.every(
        (source) => !source.frequency.events.some((event) => event.kind === 'exponential'),
      ),
      'A percussion pitch sweep survived in the calm arrangement',
    );
    assert(music.targetGain > 0 && music.targetGain < combatGain);
  }
});

test('room or area changes and run resets cancel the previous arrangement and restart its transport', () => {
  for (const change of [{ room: 'test-run:1' }, { area: 'rooftops' as const }]) {
    const { context, music } = fixture();
    music.update(scene());
    context.advance(0.5);
    music.update(scene());
    const previous = context.sources.filter((source) => !source.ended);
    music.update(scene(change));
    assert.equal(music.step, 1);
    context.advance(0.05);
    assertCancelled(context, previous);
    const current = context.sources.filter((source) => !source.ended);
    assert(current.length > 0);
    music.reset();
    assert.equal(music.step, 0);
    assert.equal(music.scene, null);
    assert.equal(music.targetGain, 0);
    context.advance(0.05);
    assertCancelled(context, current);
    assert.equal(music.voiceCount, 0);
  }
});

test('ended nodes are disconnected even when the browser delays source-ended callbacks', () => {
  const { context, music } = fixture();
  context.deliverEnded = false;
  music.update(scene());
  const voices = [...music.voices];
  context.advance(5);
  music.update(scene());
  for (const voice of voices) {
    assert(!music.voices.has(voice));
    for (const node of voice.nodes) assert((node as unknown as AudioNodeMock).disconnected);
  }
  const count = music.voiceCount;
  for (const onended of context.pendingEnded) onended();
  assert.equal(music.voiceCount, count, 'Late callbacks removed replacement voices');
});

test('dense scheduling cannot exceed the music voice cap and stopping releases every node', () => {
  const { context, music } = fixture();
  for (let i = 0; i < 100; i++)
    music.note({ part: 'pad', midi: 60 + (i % 12), duration: 4, velocity: 0.5 }, 0.025, 88);
  assert.equal(music.voiceCount, MUSIC_VOICES);
  assert.equal(context.sources.length, MUSIC_VOICES);
  const voices = [...music.voices];
  music.stop();
  context.advance(0.05);
  assert.equal(music.voiceCount, 0);
  for (const voice of voices)
    for (const node of voice.nodes) assert((node as unknown as AudioNodeMock).disconnected);
});

test('warning ducking lowers the mix, recovers after its deadline, and cannot unmute stopped music', () => {
  const { context, music } = fixture();
  music.update(scene());
  context.advance(0.1);
  music.update(scene());
  const normal = music.targetGain;
  music.duck();
  assert(music.targetGain < normal * 0.4);
  const ducked = music.targetGain;
  context.advance(0.1);
  music.update(scene());
  assert(music.targetGain <= ducked + 0.01);
  context.advance(music.duckUntil - context.currentTime + 0.1);
  music.update(scene());
  assert(music.targetGain > normal * 0.9);
  music.stop();
  music.duck();
  assert.equal(music.targetGain, 0);
  assert.equal(music.running, false);
});

test('sound creates one context only on unlock and routes effects and music through the same compressor', (t) => {
  installContext(t);
  const before = AudioContextMock.instances.length;
  const sound = new Sound();
  sound.updateMusic(scene());
  sound.play('shot');
  assert.equal(sound.context, null);
  assert.equal(AudioContextMock.instances.length, before);
  sound.unlock();
  sound.unlock();
  assert.equal(AudioContextMock.instances.length, before + 1);
  assert(sound.context && sound.music && sound.master);
  assert.equal(sound.music.context, sound.context);
  const context = sound.context as unknown as AudioContextMock;
  const compressors = context.nodes.filter((node) => node.kind === 'compressor');
  assert.equal(compressors.length, 1);
  const reaches = (node: AudioNodeMock, target: AudioNodeMock): boolean =>
    node === target || node.connections.some((next) => reaches(next, target));
  assert(reaches(sound.master as unknown as AudioNodeMock, compressors[0]));
  assert(reaches(sound.music.bus as unknown as AudioNodeMock, compressors[0]));
  assert(reaches(compressors[0], context.destination));
  sound.updateMusic(scene());
  const musicVoices = sound.music.voiceCount;
  sound.play('shot');
  assert(sound.voices > 0);
  assert.equal(sound.music.voiceCount, musicVoices);
  assert.equal(AudioContextMock.instances.length, before + 1);
});

test('music can be muted separately while the master switch suppresses both music and effects', (t) => {
  installContext(t);
  const sound = new Sound();
  sound.unlock();
  const context = sound.context as unknown as AudioContextMock;
  const music = sound.music!;
  sound.updateMusic(scene());
  assert(music.running);
  sound.musicEnabled = false;
  context.advance(0.05);
  assert.equal(music.voiceCount, 0);
  assert.equal(music.targetGain, 0);
  const beforeEffect = context.sources.length;
  sound.play('shot');
  assert(context.sources.length > beforeEffect);
  assert(sound.master!.gain.value > 0);
  sound.enabled = false;
  assert.equal(sound.master!.gain.value, 0);
  sound.musicEnabled = true;
  const mutedCount = context.sources.length;
  sound.updateMusic(scene());
  sound.play('hurt');
  assert.equal(context.sources.length, mutedCount);
  assert.equal(music.running, false);
  sound.enabled = true;
  sound.updateMusic(scene());
  assert(music.running);
  assert(music.voiceCount > 0);
  assert(sound.master!.gain.value > 0);
  sound.resetMusic();
  assert.equal(music.scene, null);
  assert.equal(music.step, 0);
  sound.updateMusic(scene());
  sound.silenceMusic();
  context.advance(0.05);
  assert.equal(music.voiceCount, 0);
  assert.equal(music.running, false);
});

test('unsupported audio, initialization errors, and denied resume leave the game usable', async (t) => {
  installContext(t);
  const use = (value: unknown) =>
    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value });
  use(undefined);
  const unsupported = new Sound();
  assert.doesNotThrow(() => {
    unsupported.unlock();
    unsupported.updateMusic(scene());
    unsupported.play('shot');
    unsupported.silenceMusic();
    unsupported.resetMusic();
  });
  assert.equal(unsupported.context, null);
  class BrokenContext extends AudioContextMock {
    createDynamicsCompressor(): never {
      throw new Error('Audio initialization failed');
    }
  }
  use(BrokenContext);
  const broken = new Sound();
  assert.doesNotThrow(() => broken.unlock());
  assert.equal(broken.context, null);
  assert.equal(broken.music, null);
  assert.equal(AudioContextMock.instances.at(-1)!.state, 'closed');
  use(AudioContextMock);
  const denied = new Sound();
  denied.unlock();
  const context = denied.context as unknown as AudioContextMock;
  context.state = 'suspended';
  context.rejectResume = true;
  denied.unlock();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(context.resumeCalls, 1);
  assert.equal(context.state, 'suspended');
  denied.updateMusic(scene());
  assert.equal(denied.music!.running, false);
  context.rejectResume = false;
  denied.unlock();
  assert.equal(context.resumeCalls, 2);
  assert.equal(context.state, 'running');
  assert.equal(denied.context, context);
});

test('combat warning effects duck music, while muted audio cannot restart the mix', (t) => {
  installContext(t);
  const sound = new Sound();
  sound.unlock();
  const context = sound.context as unknown as AudioContextMock,
    music = sound.music!;
  const warnings = [
    'lock',
    'charge',
    'machine',
    'strain',
    'arm',
    'hurt',
    'phase',
    'loader',
    'press',
    'slam',
    'reinforce',
  ];
  for (const kind of warnings) {
    context.advance(1);
    sound.updateMusic(scene());
    const normal = music.targetGain;
    sound.play(kind);
    assert(music.duckUntil >= context.currentTime + 0.6, `${kind} did not duck the soundtrack`);
    assert(music.targetGain < normal * 0.4);
  }
  sound.musicEnabled = false;
  context.advance(1);
  sound.play('lock');
  assert.equal(music.targetGain, 0);
  assert.equal(music.running, false);
  sound.enabled = false;
  const until = music.duckUntil;
  context.advance(1);
  sound.play('hurt');
  assert.equal(music.duckUntil, until);
});

test('new threat cues survive saturated gunfire, keep their full warning window, and release voices', (t) => {
  installContext(t);
  const reaches = (node: AudioNodeMock, target: unknown): boolean =>
    node === target || node.connections.some((next) => reaches(next, target));
  const sound = new Sound();
  sound.unlock();
  const context = sound.context as unknown as AudioContextMock;
  for (const kind of [
    'signal-charge',
    'signal-lock',
    'caller-record',
    'caller-lock',
    'audit-tell',
    'audit-recall',
    'sapper-tick',
    'train-near',
    'crane-wind',
    'kiln-wind',
    'machine',
    'loader',
    'phase',
    'harpoon-lock',
    'train-horn',
  ]) {
    sound.updateMusic(scene());
    for (let i = 0; i < 30; i++) sound.tone(180, 40, 0.15, 0.1);
    const before = context.sources.length;
    sound.play(kind);
    const cues = context.sources.slice(before);
    assert.ok(cues.length, kind + ' must be audible when ordinary voices are exhausted');
    assert(cues.every((node) => reaches(node, sound.effectsOutput)));
    assert(cues.every((node) => !reaches(node, sound.effects)));
    const hold = (sound.effects!.gain as unknown as AudioParamMock).events.at(-1)!.time;
    assert(
      hold >= Math.max(...cues.map((node) => node.stopTime)) - 0.011,
      kind + ' must stay clear for its entire cue',
    );
    assert(sound.music!.duckUntil >= context.currentTime + 0.65);
    context.advance(3);
    assert.equal(sound.voices, 0);
  }
  sound.play('audit-recall');
  const until = context.currentTime + 1.1;
  context.advance(0.15);
  sound.play('sapper-tick');
  const automation = sound.effects!.gain as unknown as AudioParamMock;
  assert.equal(
    automation.events.at(-1)!.time,
    until,
    'A short warning cannot cancel a longer duck',
  );
});

test('Crosswind spin-up remains audible under gunfire, cleans up and respects effects mute', (t) => {
  installContext(t);
  const sound = new Sound();
  sound.unlock();
  const context = sound.context as unknown as AudioContextMock;
  sound.updateMusic(scene({ area: 'cooling' }));
  for (let i = 0; i < 30; i++) sound.tone(180, 40, 0.15, 0.1);
  const first = context.sources.length;
  sound.play('fan-warn');
  const cue = context.sources.slice(first);
  assert.equal(cue.length, 2);
  assert(sound.music!.duckUntil >= context.currentTime + 1.25);
  assert(cue.every((s) => s.stopTime < context.currentTime + 1.3));
  assert(sound.voices <= 32);
  context.advance(1.4);
  assert(cue.every((s) => s.disconnected));
  assert.equal(sound.voices, 0);
  sound.play('fan-gust');
  assert(sound.voices > 0);
  context.advance(0.8);
  assert.equal(sound.voices, 0);
  sound.effectsVolume = 0;
  const beforeMute = context.sources.length;
  sound.play('fan-warn');
  sound.play('fan-gust');
  assert.equal(context.sources.length, beforeMute);
});

test('completion and defeat cues have reserved voices after a dense fight', (t) => {
  installContext(t);
  const sound = new Sound();
  sound.unlock();
  const context = sound.context as unknown as AudioContextMock;
  for (const kind of ['win', 'dead', 'shutdown-stop']) {
    for (let i = 0; i < 30; i++) sound.tone(180, 40, 0.15, 0.1);
    const before = context.sources.length;
    sound.play(kind);
    assert.ok(context.sources.length > before, kind);
    assert.ok(sound.voices <= 32);
    context.advance(4);
    assert.equal(sound.voices, 0);
  }
});

test('Annex transport preserves the beat at boss escalation, fades on clear and changes theme independently of area', () => {
  const { context, music } = fixture();
  const annex = scene({ area: 'cooling', theme: 'annex', boss: true });
  const played: { part: string; at: number }[] = [];
  const note = music.note.bind(music);
  music.note = (n, at, bpm) => {
    played.push({ part: n.part, at });
    note(n, at, bpm);
  };
  for (let i = 0; i < 900; i++) {
    music.update(annex);
    context.advance(1 / 60);
  }
  assert(played.some((n) => n.part === 'lead'));
  const step = music.step,
    next = music.nextTime;
  music.update({ ...annex, bossPhase: 1 });
  assert.equal(music.step, step, 'Phase changes must not restart the melody');
  assert.equal(music.nextTime, next);
  const previous = [...music.voices];
  music.update({ ...annex, clear: true });
  for (const voice of previous) assert(voice.ends <= context.currentTime + 0.24);
  context.advance(0.3);
  const afterClear = played.length;
  for (let i = 0; i < 300; i++) {
    music.update({ ...annex, clear: true });
    context.advance(1 / 60);
  }
  assert(played.slice(afterClear).length > 0);
  assert(played.slice(afterClear).every((n) => ['pad', 'hum', 'pulse'].includes(n.part)));
  music.update({ ...annex, theme: 'cooling' });
  assert.equal(music.step, 1, 'Changing only the regional theme resets its transport');
  context.advance(0.3);
  music.stop();
  context.advance(0.05);
  assert.equal(music.voiceCount, 0);
});

test('Annex filters and sources remain bounded through loops, frame stalls, retries, mute and focus loss', () => {
  const { context, music } = fixture();
  const annex = scene({ theme: 'annex', boss: true, bossPhase: 1 });
  let peak = 0;
  for (let i = 0; i < 3600; i++) {
    if (i % 300 === 0) music.reset();
    music.update(annex);
    peak = Math.max(peak, music.voiceCount);
    context.advance(i === 1200 ? 60 : 1 / 60);
  }
  assert(peak <= MUSIC_VOICES);
  for (const [change, enabled, active] of [
    [{ mode: 'paused' }, true, true],
    [{ mode: 'dead' }, true, true],
    [{ mode: 'title' }, true, true],
    [{}, false, true],
    [{}, true, false],
  ] as [Partial<MusicScene>, boolean, boolean][]) {
    music.update(annex);
    const voices = [...music.voices];
    assert(voices.length);
    music.update({ ...annex, ...change }, enabled, active);
    context.advance(0.05);
    assert.equal(music.voiceCount, 0);
    assert.equal(music.targetGain, 0);
    for (const voice of voices)
      for (const node of voice.nodes) assert((node as unknown as AudioNodeMock).disconnected);
  }
});

test('friendly and success signals stay distinct from warning cues and respect effects mute', (t) => {
  installContext(t);
  const sound = new Sound();
  sound.unlock();
  const context = sound.context as unknown as AudioContextMock;
  const signatures: number[][] = [];
  for (const kind of ['signal-friendly', 'signal-reboot', 'signal-cut', 'signal-fire']) {
    sound.updateMusic(scene({ theme: 'annex' }));
    const duckUntil = sound.music!.duckUntil;
    const first = context.sources.length;
    sound.play(kind);
    assert.equal(
      sound.music!.duckUntil,
      duckUntil,
      'Friendly cues must not suppress the soundtrack',
    );
    const cues = context.sources.slice(first);
    assert(cues.length > 0);
    signatures.push(cues.filter((s) => s.kind === 'oscillator').map((s) => s.frequency.value));
    context.advance(0.5);
    assert(cues.every((s) => s.disconnected));
  }
  assert.equal(new Set(signatures.map((s) => JSON.stringify(s))).size, 4);
  sound.effectsVolume = 0;
  const first = context.sources.length;
  for (const kind of [
    'signal-friendly',
    'signal-reboot',
    'signal-cut',
    'signal-fire',
    'signal-charge',
    'signal-lock',
    'caller-record',
    'caller-lock',
  ])
    sound.play(kind);
  assert.equal(context.sources.length, first);
});
