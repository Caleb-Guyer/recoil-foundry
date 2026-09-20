import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ReplayBuffer,
  REPLAY_BYTES,
  replayFrameIndex,
  replayTiming,
  replayTestFromUrl,
} from '../src/death-replay.ts';
import { DeathReplay, ReplayView } from '../src/death-replay-view.ts';
import { Game, type Input } from '../src/game.ts';

test('replay retains only five seconds, with strict byte and frame bounds', () => {
  const buffer = new ReplayBuffer<number>();
  for (let i = 0; i < 100_000; i++) buffer.add({ at: i / 24, data: i, bytes: 1024 });
  assert.ok(buffer.frames.at(-1)!.at - buffer.frames[0].at <= 5);
  assert.ok(buffer.frames.length <= 122);
  assert.equal(buffer.bytes, buffer.frames.length * 1024);
  for (let i = 0; i < 1000; i++) buffer.add({ at: 5000, data: i, bytes: 1024 * 1024 });
  assert.equal(buffer.bytes, REPLAY_BYTES);
  assert.equal(buffer.frames.length, 16);
  buffer.add({ at: 5001, data: -1, bytes: REPLAY_BYTES + 1 });
  buffer.add({ at: NaN, data: -1, bytes: 1 });
  buffer.add({ at: 5001, data: -1, bytes: NaN });
  assert.equal(buffer.frames.length, 16);
});

test('out-of-order final encoding preserves the newest impact frame', () => {
  const buffer = new ReplayBuffer<string>();
  buffer.add({ at: 9, data: 'impact', bytes: 3 });
  buffer.add({ at: 8.96, data: 'before', bytes: 2 });
  buffer.add({ at: 1, data: 'expired', bytes: 8 });
  assert.deepEqual(
    buffer.frames.map((f) => f.data),
    ['before', 'impact'],
  );
  assert.equal(buffer.bytes, 5);
  assert.equal(replayFrameIndex(buffer.frames, 8.99), 0);
  assert.equal(replayFrameIndex(buffer.frames, 9), 1);
});

test('playback slows only the finish and holds the lethal frame, including very short deaths', () => {
  assert.deepEqual(replayTiming(5, 4), { at: 4, done: false });
  assert.ok(Math.abs(replayTiming(5, 5).at - 4.6) < 1e-9);
  assert.deepEqual(replayTiming(5, 6.3), { at: 5, done: false });
  assert.deepEqual(replayTiming(5, 7.1), { at: 5, done: true });
  assert.deepEqual(replayTiming(0, 0), { at: 0, done: false });
  assert.deepEqual(replayTiming(0, 0.81), { at: 0, done: true });
  assert.ok(Math.abs(replayTiming(0.3, 0.6).at - 0.2) < 1e-9);
});

test('capture throttles encoders, freezes after death, and ignores callbacks from a reset run', async () => {
  const callbacks: Array<(b: Blob | null) => void> = [];
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toBlob: (done: (b: Blob | null) => void) => callbacks.push(done),
  };
  const source = { width: 1920, height: 1080 } as HTMLCanvasElement;
  const replay = new DeathReplay(fakeCanvas as unknown as HTMLCanvasElement);
  replay.capture(source, 0);
  replay.capture(source, 1);
  assert.equal(callbacks.length, 1, 'one ordinary encode in flight');
  replay.reset();
  callbacks.shift()!(new Blob(['stale']));
  await Promise.resolve();
  assert.equal(replay.buffer.frames.length, 0);
  replay.capture(source, 4.9);
  replay.finish(source, 5, { player: { x: 960, y: 540 }, label: 'Collision' });
  replay.capture(source, 6);
  assert.equal(
    callbacks.length,
    2,
    'death allows one extra final encode; later frames are refused',
  );
  callbacks[1](new Blob(['lethal']));
  callbacks[0](new Blob(['before']));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(replay.ready);
  assert.deepEqual(
    replay.buffer.frames.map((f) => f.at),
    [4.9, 5],
  );
  assert.deepEqual(replay.impact?.player, { x: 427, y: 240 });
  replay.reset();
  assert.equal(replay.ready, false);
  assert.equal(replay.buffer.bytes, 0);
});

test('failed image encoding and restarting during the final encode do not expose stale clips', async () => {
  const callbacks: Array<(b: Blob | null) => void> = [];
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toBlob: (done: (b: Blob | null) => void) => callbacks.push(done),
  };
  const replay = new DeathReplay(fakeCanvas as unknown as HTMLCanvasElement);
  const source = { width: 1000, height: 500 } as HTMLCanvasElement;
  replay.finish(source, 5, { player: { x: 500, y: 250 }, label: 'Fall' });
  callbacks.shift()!(null);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(replay.ready, false);
  replay.reset();
  replay.finish(source, 1, { player: { x: 500, y: 250 }, label: 'Fall' });
  replay.reset();
  callbacks.shift()!(new Blob(['old death']));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(replay.ready, false);
  assert.equal(replay.buffer.frames.length, 0);
});

test('lethal hook captures cause and origin before cleanup and runs exactly once', () => {
  const g = new Game();
  g.start('replay-lifecycle');
  const origin = { x: 400, y: 600 };
  const calls: unknown[] = [];
  let removed = false;
  const clear = g.fabricators.clear.bind(g.fabricators);
  g.fabricators.clear = () => {
    removed = true;
    clear();
  };
  g.onDeath = (point) => {
    calls.push(point);
    assert.equal(g.mode, 'playing');
    assert.equal(g.hp, 0);
    assert.deepEqual(g.deathCause, { type: 'contact', enemy: 'runner' });
    assert.equal(removed, false);
  };
  g.damagePlayer(1, origin);
  assert.equal(calls.length, 0);
  g.hurtAt = -Infinity;
  g.damagePlayer(999, origin, { type: 'contact', enemy: 'runner' });
  assert.equal(g.mode, 'dead');
  assert.equal(removed, true);
  origin.x = 999;
  assert.deepEqual(calls, [{ x: 400, y: 600 }]);
  g.die();
  assert.equal(calls.length, 1);
});

test('a fall has no invented attacker; Workshop does not create death clips', () => {
  const g = new Game();
  g.start('replay-fall');
  let calls = 0;
  g.onDeath = (origin) => {
    calls++;
    assert.equal(origin, undefined);
  };
  g.die({ type: 'fall' });
  assert.equal(calls, 1);
  g.startWorkshop([], []);
  g.die();
  assert.equal(calls, 1);
});

test('quick test dies through ordinary combat and preserves progression hooks', () => {
  const save = replayTestFromUrl(new URL('https://test/?test=replay&v=2.86.0'))!;
  const g = new Game();
  const saves: unknown[] = [],
    victories: unknown[] = [];
  g.onCheckpoint = (s) => saves.push(s);
  g.onBossDefeated = (kind) => victories.push(kind);
  g.startTest(save);
  const input: Input = {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: false,
    aim: { x: 600, y: 500 },
  };
  for (let i = 0; i < 60 * 45 && g.mode === 'playing'; i++) g.tick(1 / 60, input);
  assert.equal(g.mode, 'dead', 'standing still eventually dies to the real room enemies');
  assert.deepEqual(saves, []);
  assert.deepEqual(victories, []);
  assert.ok(g.deathCause && g.deathCause.type !== 'unknown');
  for (const query of ['test=replay&test=replay', 'test=replay&build=beam', 'test=replay&daily=1'])
    assert.equal(replayTestFromUrl(new URL('https://test/?' + query)), null);
});

function viewerFixture(t: test.TestContext) {
  function global(name: string, value: unknown) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  const callbacks = new Map<number, (now: number) => void>();
  let next = 0,
    trackStops = 0,
    recorderStops = 0,
    starts = 0;
  const events = new Map<string, () => void>();
  const doc = {
    hidden: false,
    addEventListener: (name: string, fn: () => void) => events.set(name, fn),
    removeEventListener: (name: string) => events.delete(name),
  };
  global('document', doc);
  global('window', globalThis);
  global('requestAnimationFrame', (fn: (now: number) => void) => {
    callbacks.set(++next, fn);
    return next;
  });
  global('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  global(
    'MediaRecorder',
    class {
      static isTypeSupported() {
        return true;
      }
      state = 'inactive';
      start() {
        this.state = 'recording';
        starts++;
      }
      stop() {
        this.state = 'inactive';
        recorderStops++;
      }
    },
  );
  const context = {
    drawImage() {},
    fillRect() {},
    beginPath() {},
    arc() {},
    stroke() {},
    fillText() {},
  };
  const surface = {
    width: 854,
    height: 480,
    setAttribute() {},
    getContext: () => context,
    captureStream: () => ({ getTracks: () => [{ stop: () => trackStops++ }] }),
  };
  const elements = new Map(
    ['#replay-play', '#replay-save', '#replay-status', '#replay-download'].map((id) => [
      id,
      { disabled: false, hidden: false, textContent: '', onclick: () => {} },
    ]),
  );
  const root = {
    innerHTML: '',
    querySelector: (s: string) => (s === 'canvas' ? surface : elements.get(s)),
  };
  const replay = new DeathReplay(surface as unknown as HTMLCanvasElement);
  replay.buffer.add({ at: 0, data: new Blob(['first']), bytes: 5 });
  replay.buffer.add({ at: 5, data: new Blob(['last']), bytes: 4 });
  replay.impact = { player: { x: 1, y: 1 }, label: 'Collision' };
  const step = async (now: number) => {
    const batch = [...callbacks.values()];
    callbacks.clear();
    batch.forEach((fn) => fn(now));
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return {
    global,
    events,
    doc,
    elements,
    step,
    callbacks,
    view: () => new ReplayView(replay, root as unknown as HTMLElement),
    counts: () => ({ trackStops, recorderStops, starts }),
  };
}

test('closing playback releases late decoded images and its animation/listeners', async (t) => {
  const f = viewerFixture(t);
  let resolve!: (image: unknown) => void,
    closed = 0;
  f.global(
    'createImageBitmap',
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const view = f.view();
  await f.step(0);
  view.dispose();
  resolve({ close: () => closed++ });
  await new Promise((done) => setTimeout(done, 0));
  assert.equal(closed, 1);
  assert.equal(f.callbacks.size, 0);
  assert.equal(f.events.size, 0);
});

test('rapid retries bound native image work even before old callbacks finish', async () => {
  const callbacks: Array<(b: Blob | null) => void> = [];
  const canvas = {
    width: 854,
    height: 480,
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toBlob: (done: (b: Blob | null) => void) => callbacks.push(done),
  } as unknown as HTMLCanvasElement;
  const replay = new DeathReplay(canvas);
  for (let retry = 0; retry < 100; retry++) {
    replay.reset();
    replay.capture(canvas, 1);
    replay.finish(canvas, 2, { player: { x: 0, y: 0 }, label: 'Collision' });
  }
  assert.equal(
    callbacks.length,
    2,
    'at most one ordinary encode and one death encode across all runs',
  );
  callbacks.splice(0).forEach((done) => done(new Blob(['stale'])));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(replay.buffer.frames.length, 0);
  replay.reset();
  replay.capture(canvas, 3);
  callbacks.shift()!(new Blob(['fresh']));
  await Promise.resolve();
  assert.equal(replay.buffer.frames.length, 1, 'encoding resumes once old native work is done');
});

test('a throwing image encoder releases its budget for the next capture', async () => {
  let attempts = 0;
  const canvas = {
    width: 854,
    height: 480,
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toBlob: (done: (b: Blob | null) => void) => {
      if (++attempts === 1) throw new Error('encoder unavailable');
      done(new Blob(['fresh']));
    },
  } as unknown as HTMLCanvasElement;
  const replay = new DeathReplay(canvas);
  replay.capture(canvas, 1);
  replay.capture(canvas, 2);
  await Promise.resolve();
  assert.equal(replay.buffer.frames.length, 1);
});

test('missing or throwing video capability probes leave replay viewing usable', async (t) => {
  const f = viewerFixture(t);
  f.global('createImageBitmap', async () => ({ close() {} }));
  for (const recorder of [
    {},
    {
      isTypeSupported: () => {
        throw new Error('blocked');
      },
    },
  ]) {
    f.global('MediaRecorder', recorder);
    const view = f.view();
    assert.equal(f.elements.get('#replay-save')!.hidden, true);
    assert.match(f.elements.get('#replay-status')!.textContent, /unavailable/);
    await f.step(1000);
    assert.equal(f.elements.get('#replay-play')!.disabled, false);
    view.dispose();
  }
});

test('a failed recorder stop still releases tracks, decoded images and animation', async (t) => {
  const f = viewerFixture(t);
  let closed = 0;
  f.global('createImageBitmap', async () => ({
    close() {
      closed++;
    },
  }));
  f.global(
    'MediaRecorder',
    class {
      static isTypeSupported() {
        return true;
      }
      state = 'inactive';
      start() {
        this.state = 'recording';
      }
      stop() {
        throw new Error('recorder failed');
      }
    },
  );
  const view = f.view();
  f.elements.get('#replay-save')!.onclick();
  await f.step(1000);
  view.dispose();
  assert.equal(f.counts().trackStops, 1);
  assert.equal(closed, 1);
  assert.equal(f.callbacks.size, 0);
  assert.equal(f.events.size, 0);
});

test('export waits for a decoded first frame and stops every track when hidden or retried', async (t) => {
  const f = viewerFixture(t);
  f.global('createImageBitmap', async () => ({ close() {} }));
  const view = f.view();
  f.elements.get('#replay-save')!.onclick();
  assert.equal(f.counts().starts, 0, 'never encode a blank or previous lethal frame first');
  await f.step(0);
  assert.equal(f.counts().starts, 1);
  f.doc.hidden = true;
  f.events.get('visibilitychange')!();
  assert.deepEqual(f.counts(), { starts: 1, recorderStops: 1, trackStops: 1 });
  assert.match(f.elements.get('#replay-status')!.textContent, /visible/);
  assert.equal(f.elements.get('#replay-save')!.disabled, false);
  f.doc.hidden = false;
  f.elements.get('#replay-save')!.onclick();
  await f.step(50);
  view.dispose();
  assert.deepEqual(f.counts(), { starts: 2, recorderStops: 2, trackStops: 2 });
  assert.equal(f.callbacks.size, 0);
});

test('decode failure disables replay controls instead of retrying the failing frame forever', async (t) => {
  const f = viewerFixture(t);
  let attempts = 0;
  f.global('createImageBitmap', async () => {
    attempts++;
    throw new Error('decode unavailable');
  });
  const view = f.view();
  await f.step(0);
  await f.step(50);
  assert.equal(attempts, 1);
  assert.equal(f.elements.get('#replay-play')!.disabled, true);
  assert.match(f.elements.get('#replay-status')!.textContent, /could not decode/);
  view.dispose();
});

test('a slow rendering frame cannot stretch the exported playback timeline', async (t) => {
  const f = viewerFixture(t);
  f.global('createImageBitmap', async () => ({ close() {} }));
  const view = f.view();
  f.elements.get('#replay-save')!.onclick();
  await f.step(1000);
  await f.step(9000);
  await f.step(9050);
  assert.equal(f.elements.get('#replay-play')!.textContent, 'Replay again');
  view.dispose();
  assert.equal(f.counts().recorderStops, 1);
});
