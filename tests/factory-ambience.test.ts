import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Mode } from '../src/game.ts';
import type { AreaId } from '../src/areas.ts';
import { FactoryAmbience, FACTORY_AUDIO_PROFILES } from '../src/factory-ambience.ts';
import { factoryAudioScene, type FactoryAudioScene } from '../src/factory-audio-scene.ts';
import { eventTestFromUrl } from '../src/area-events.ts';
import { shutdownTestFromUrl } from '../src/shutdown-layout.ts';
import { uprisingTestFromUrl } from '../src/uprising-test.ts';
import { Sound } from '../src/audio.ts';

const areas: AreaId[] = ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'];
const scene = (area: AreaId = 'docks', power = 1, activity = 0): FactoryAudioScene => ({
  area,
  room: 'sound-test:0',
  power,
  activity,
});
const run = (stage = 0) => {
  const g = new Game();
  g.start('factory-audio-world', {
    version: 6,
    seed: 'factory-audio-world',
    stage,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
  });
  return g;
};

class Param {
  value = 1;
  events: { type: string; value?: number; time: number; constant?: number }[] = [];
  setTargetAtTime(value: number, time: number, constant: number) {
    assert(Number.isFinite(value));
    assert(constant > 0);
    this.value = value;
    this.events.push({ type: 'target', value, time, constant });
    return this;
  }
  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: 'set', value, time });
    return this;
  }
  cancelScheduledValues(time: number) {
    this.events.push({ type: 'cancel', time });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    return this.setValueAtTime(value, time);
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    return this.setValueAtTime(value, time);
  }
}
class Node {
  context: Context;
  kind: string;
  disconnected = false;
  connections: Node[] = [];
  constructor(c: Context, kind: string) {
    this.context = c;
    this.kind = kind;
    c.nodes.push(this);
  }
  connect(n: Node) {
    this.connections.push(n);
    return n;
  }
  disconnect() {
    this.disconnected = true;
    this.connections = [];
  }
}
class Source extends Node {
  frequency = new Param();
  playbackRate = new Param();
  type = 'sine';
  buffer: unknown = null;
  loop = false;
  starts = 0;
  startedFrequency = 0;
  stops = 0;
  onended: (() => void) | null = null;
  start() {
    this.startedFrequency = this.frequency.value;
    this.starts++;
    assert.equal(this.starts, 1);
  }
  stop() {
    this.stops++;
  }
}
class Context {
  state: AudioContextState = 'running';
  sampleRate = 8000;
  currentTime = 0;
  nodes: Node[] = [];
  buffers: {
    numberOfChannels: number;
    data: Float32Array[];
    length: number;
    duration: number;
    getChannelData(i: number): Float32Array;
  }[] = [];
  destination = new Node(this, 'destination');
  createGain() {
    return Object.assign(new Node(this, 'gain'), { gain: new Param() });
  }
  createBiquadFilter() {
    return Object.assign(new Node(this, 'filter'), {
      type: 'lowpass',
      frequency: new Param(),
      Q: new Param(),
    });
  }
  createOscillator() {
    return new Source(this, 'oscillator');
  }
  createBufferSource() {
    return new Source(this, 'buffer');
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    const buffer = {
      numberOfChannels: channels,
      data,
      length,
      duration: length / sampleRate,
      getChannelData: (i: number) => data[i],
    };
    this.buffers.push(buffer);
    return buffer;
  }
  get sources() {
    return this.nodes.filter((n): n is Source => n instanceof Source);
  }
}
const ambience = () => {
  const c = new Context(),
    output = c.createGain();
  const a = new FactoryAmbience(c as unknown as AudioContext, output as unknown as AudioNode);
  return { c, output, a };
};

test('live factory scenes follow actual area and room identity without using RNG or writing progress', () => {
  const g = run();
  let writes = 0;
  g.onCheckpoint = () => writes++;
  for (const [index, stage] of [0, 5, 9, 13, 17].entries()) {
    g.stage = stage;
    g.loadRoom();
    const expected = factoryAudioScene(g)!;
    assert.equal(expected.area, areas[index]);
    assert(expected.room.endsWith(':' + stage + ':' + g.level.id));
    assert.equal(expected.power, 1);
    const before = JSON.stringify([g.level, g.areaEvents.state, g.shutdown.state, g.mods]);
    const random = Math.random;
    const rng = g.rng;
    Math.random = g.rng = () => {
      throw Error('Ambience consumed randomness');
    };
    try {
      for (let i = 0; i < 100; i++) assert.deepEqual(factoryAudioScene(g), expected);
    } finally {
      Math.random = random;
      g.rng = rng;
    }
    assert.equal(JSON.stringify([g.level, g.areaEvents.state, g.shutdown.state, g.mods]), before);
  }
  assert.equal(writes, 0);
  for (const mode of ['title', 'paused', 'upgrade', 'dead', 'won'] as Mode[]) {
    g.mode = mode;
    assert.equal(factoryAudioScene(g), null);
  }
  assert.equal(factoryAudioScene(new Game()), null);
  g.startWorkshop([]);
  assert.equal(factoryAudioScene(g), null);
});

test('blackout stays powerless until the real persistent fuse is shot; enemy clearance is not a power switch', () => {
  const g = new Game();
  g.startTest(eventTestFromUrl(new URL('https://test/?test=events&event=blackout'))!);
  const fuse = g.areaEvents.fuseBox!;
  assert(fuse);
  assert(g.areaEvents.dark);
  assert.equal(factoryAudioScene(g)!.power, 0);
  assert.equal(factoryAudioScene(g)!.activity, 0);
  g.areaEvents.hitFuse(fuse, 1, false);
  assert.equal(factoryAudioScene(g)!.power, 0, 'Enemy fire must not restore power');
  g.areaEvents.hitFuse(fuse, 1, true);
  assert.equal(factoryAudioScene(g)!.power, 1);
  assert(g.props.items.includes(fuse), 'The physical fuse remains after restoration');
  g.enemies = [];
  g.clear = true;
  assert.equal(factoryAudioScene(g)!.power, 1);
  g.stage = 0;
  g.loadRoom();
  assert.equal(factoryAudioScene(g)!.power, 1, 'Opening room never inherits a blackout');
});

test('actual shutdown cabinets and completed core sabotage change power only in the active world', () => {
  const g = new Game();
  g.startTest(shutdownTestFromUrl(new URL('https://test/?test=shutdown&scene=relay'))!);
  assert.equal(factoryAudioScene(g)!.power, 1);
  Matter.Body.setPosition(g.player, { x: 76, y: 592 });
  assert(g.shutdown.trigger());
  assert.equal(factoryAudioScene(g)!.power, 0);
  const saved = g.checkpointSnapshot();
  const resumed = new Game();
  resumed.startTest(saved);
  assert.equal(factoryAudioScene(resumed)!.power, 0);
  g.startTest(shutdownTestFromUrl(new URL('https://test/?test=shutdown&scene=finale'))!);
  for (let cycle = 0; cycle < 3; cycle++) {
    g.shutdown.state!.cycle = cycle;
    assert.equal(factoryAudioScene(g)!.power, 1 - cycle / 3);
  }
  g.shutdown.state!.cycle = 3;
  assert.equal(factoryAudioScene(g), null);

  g.startTest(uprisingTestFromUrl(new URL('https://test/?test=uprising&route=core-sabotage&v=1'))!);
  assert.equal(factoryAudioScene(g)!.power, 1);
  g.uprising.resolve(true);
  assert.equal(factoryAudioScene(g)!.power, 0);
  g.stage = 8;
  g.loadRoom();
  assert.equal(factoryAudioScene(g)!.power, 0, 'Successful sabotage persists into later rooms');
  assert.equal(g.pressure.items.length, 0, 'Same outcome removed real machinery');
  g.overtime = { cycle: 1, repairs: 0 } as typeof g.overtime;
  assert.equal(factoryAudioScene(g)!.power, 1, 'An inactive Campaign job does not switch NG+ off');
});

test('activity comes from nearby moving machinery and current vent/fan phases, not enemy counts', () => {
  const g = run();
  g.conveyors.clear();
  g.hazards.clear();
  g.pressure.clear();
  g.crosswind.clear();
  assert.equal(factoryAudioScene(g)!.activity, 0);
  const p = g.player.position;
  const vent = g.pressure.spawn({
    x: p.x + 150,
    y: p.y,
    dir: { x: 0, y: -1 },
    valve: { x: p.x + 100, y: p.y },
    offset: 0,
    length: 300,
    width: 80,
  });
  assert.equal(factoryAudioScene(g)!.activity, 0);
  vent.phase = 'warn';
  assert.equal(factoryAudioScene(g)!.activity, 0, 'No fabricated vent warning');
  vent.phase = 'burst';
  assert(factoryAudioScene(g)!.activity > 0);
  vent.phase = 'recharge';
  g.conveyors.items = [{ x: p.x, y: p.y, w: 250, speed: 2 }];
  const nearby = factoryAudioScene(g)!.activity;
  assert(nearby > 0);
  g.spawnEnemy('runner', p.x + 300, p.y);
  assert.equal(factoryAudioScene(g)!.activity, nearby);
  Matter.Body.setPosition(g.player, { x: p.x + 1800, y: p.y });
  assert.equal(factoryAudioScene(g)!.activity, 0);
});

test('cinematic rain and the quiet finale/Clock Out keep their existing space', () => {
  const g = new Game();
  g.start('RF-C99-factory-finale', {
    version: 6,
    seed: 'RF-C99-factory-finale',
    stage: 19,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
  });
  assert(g.finale.active);
  assert.equal(factoryAudioScene(g), null);
  for (const state of [
    'approach',
    'boarding',
    'duel',
    'siege',
    'rupture',
    'destruction',
    'complete',
  ]) {
    Object.assign(g.finale.cinema, { active: true, state, clock: 5 });
    assert.equal(factoryAudioScene(g), null, state);
  }
  const ordinary = run(17);
  ordinary.clockOut.active = true;
  assert.equal(factoryAudioScene(ordinary), null);
});

test('five quiet profiles retune exactly three reusable centered voices without frame allocations', () => {
  const { c, output, a } = ambience();
  assert.equal(a.voiceCount, 0);
  const random = Math.random;
  Math.random = () => {
    throw Error('Procedural texture touched gameplay randomness');
  };
  try {
    a.update(scene());
  } finally {
    Math.random = random;
  }
  assert(a.active);
  assert.equal(a.voiceCount, 3);
  assert.equal(c.sources.length, 3);
  assert.equal(c.buffers.length, 2);
  assert(
    c.sources.filter((s) => s.kind === 'oscillator').every((s) => s.startedFrequency <= 80),
    'No default 440Hz oscillator sweep at entry',
  );
  assert(c.buffers.every((b) => b.numberOfChannels === 1));
  const initialNodes = c.nodes.length;
  const profiles: string[] = [];
  for (const area of areas) {
    a.update(scene(area, 1, 1));
    const signature = c.nodes
      .filter((n) => 'frequency' in n)
      .map((n) => (n as Node & { frequency: Param }).frequency.value);
    profiles.push(JSON.stringify(signature));
    for (let i = 0; i < 400; i++) a.update(scene(area, 1, 1), true, i % 2 === 0);
  }
  assert.equal(new Set(profiles).size, 5);
  assert.equal(c.nodes.length, initialNodes);
  assert.equal(c.sources.length, 3);
  assert.equal(c.buffers.length, 2);
  assert(c.sources.every((s) => s.starts === 1 && s.stops === 0));
  assert(!c.nodes.some((n) => n.kind === 'panner'));
  const gainNodes = c.nodes.filter((n) => 'gain' in n && n !== output) as (Node & {
    gain: Param;
  })[];
  assert(gainNodes.every((n) => n.gain.events.filter((e) => e.type === 'target').length <= 6));
  assert(
    Object.values(FACTORY_AUDIO_PROFILES).every(
      (p) => p.bed < 0.06 && p.motor < 0.03 && p.texture < 0.03,
    ),
  );
  for (const b of c.buffers) {
    assert(b.length <= c.sampleRate * 6.4);
    let peak = 0,
      mean = 0;
    for (const value of b.data[0]) {
      assert(Number.isFinite(value));
      peak = Math.max(peak, Math.abs(value));
      mean += value;
    }
    assert(peak < 1 && peak > 0.1);
    assert(Math.abs(mean / b.length) < 0.02);
  }
});

test('power loss smoothly removes both powered layers while rooftop wind and room tone remain', () => {
  const { c, output, a } = ambience();
  a.update(scene('cooling', 1, 1));
  const gains = c.nodes.filter((n) => 'gain' in n && n !== output) as (Node & { gain: Param })[];
  const poweredBed = gains[0].gain.value;
  a.update(scene('cooling', 0, 1));
  assert.equal(gains[1].gain.value, 0);
  assert.equal(gains[2].gain.value, 0);
  assert(gains[0].gain.value > 0 && gains[0].gain.value < poweredBed);
  assert(gains.every((g) => g.gain.events.at(-1)?.type === 'target'));
  a.update(scene('rooftops', 1));
  const wind = gains[0].gain.value;
  a.update(scene('rooftops', 0));
  assert.equal(gains[0].gain.value, wind);
  for (const power of [NaN, Infinity, -1, 100])
    for (const activity of [NaN, Infinity, -2, 4]) a.update(scene('furnace', power, activity));
  assert(
    gains.every((g) => Number.isFinite(g.gain.value) && g.gain.value >= 0 && g.gain.value <= 0.06),
  );
});

test('pause, mute, suspension, scene removal and repeated restarts disconnect every voice immediately', () => {
  const { c, output, a } = ambience();
  for (let cycle = 0; cycle < 50; cycle++) {
    a.update(scene());
    const sources = c.sources.slice(-3);
    const nodes = c.nodes.filter((n) => n !== output && n !== c.destination && !n.disconnected);
    if (cycle % 3 === 0) a.update(scene(), false);
    else if (cycle % 3 === 1) a.update(null);
    else {
      c.state = 'suspended';
      a.update(scene());
      c.state = 'running';
    }
    assert(!a.active);
    assert.equal(a.voiceCount, 0);
    assert(sources.every((s) => s.stops === 1 && s.onended === null));
    assert(nodes.every((n) => n.disconnected));
    a.stop();
    assert(sources.every((s) => s.stops === 1));
  }
  assert.equal(c.buffers.length, 2, 'Pause/resume must reuse procedural samples');
  assert(!c.nodes.some((n) => n !== output && n !== c.destination && !n.disconnected));
  const silent = new FactoryAmbience(null, null);
  assert.doesNotThrow(() => {
    silent.update(scene());
    silent.stop();
  });
  assert.equal(silent.voiceCount, 0);
});

test('partial Web Audio failures disconnect allocations and retry only after deactivation', () => {
  const { c, a } = ambience();
  const original = c.createBiquadFilter;
  c.createBiquadFilter = () => {
    throw Error('Audio driver unavailable');
  };
  a.update(scene());
  assert(!a.active);
  const count = c.nodes.length;
  for (let i = 0; i < 100; i++) a.update(scene());
  assert.equal(c.nodes.length, count);
  assert(c.sources.every((s) => s.disconnected));
  c.createBiquadFilter = original;
  a.update(null);
  a.update(scene());
  assert.equal(a.voiceCount, 3);
  c.sources.at(-1)!.onended!();
  assert.equal(a.voiceCount, 0);
});

test('Sound uses its effects bus and releases factory voices on actual mute and effects-volume controls', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  // Sound only needs the real unlocked construction path; supplement the mock
  // for the shared output graph, leaving all ambience sources observable.
  class SoundContext extends Context {
    createDynamicsCompressor() {
      return Object.assign(new Node(this, 'compressor'), {
        threshold: new Param(),
        knee: new Param(),
        ratio: new Param(),
        attack: new Param(),
        release: new Param(),
      });
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      this.state = 'closed';
      return Promise.resolve();
    }
  }
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: SoundContext });
  try {
    const sound = new Sound();
    sound.unlock();
    sound.updateWorld(scene());
    assert.equal(sound.factory?.voiceCount, 3);
    sound.effectsVolume = 0;
    assert.equal(sound.factory?.voiceCount, 0);
    sound.updateWorld(scene());
    assert.equal(sound.factory?.voiceCount, 0);
    sound.effectsVolume = 1;
    sound.updateWorld(scene());
    assert.equal(sound.factory?.voiceCount, 3);
    sound.enabled = false;
    assert.equal(sound.factory?.voiceCount, 0);
    sound.enabled = true;
    sound.updateWorld(scene());
    assert.equal(sound.factory?.voiceCount, 3);
    sound.updateWorld(scene(), false);
    assert.equal(sound.factory?.voiceCount, 0);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'AudioContext', descriptor);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  }
});
