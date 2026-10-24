import test from 'node:test';
import assert from 'node:assert/strict';
import { DeathReplay } from '../src/death-replay-capture.ts';
import { ReplayView } from '../src/death-replay-view.ts';
import {
  replayPlayedAt,
  replayFrameIndex,
  replayTiming,
  replayHitsInBuffer,
  REPLAY_HITS,
  REPLAY_BYTES,
  type ReplayHit,
} from '../src/death-replay.ts';
import { Game } from '../src/game.ts';
import { damageCauseText } from '../src/damage-cause.ts';

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
const hit = (id = 1, at = 1, changes: Partial<ReplayHit> = {}): ReplayHit => ({
  id,
  at,
  damage: 20,
  hpBefore: 100,
  hpAfter: 80,
  player: { x: 427, y: 240 },
  label: 'Shot from Sniper',
  ...changes,
});
function captureFixture() {
  const callbacks: ((blob: Blob | null) => void)[] = [];
  const canvas = {
    width: 854,
    height: 480,
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toBlob: (done: (blob: Blob | null) => void) => callbacks.push(done),
  } as unknown as HTMLCanvasElement;
  const replay = new DeathReplay(canvas);
  return { canvas, replay, callbacks };
}

test('accepted actual Game damage produces factual replay metadata; invulnerability and direct falls add none', async () => {
  const { canvas, replay, callbacks } = captureFixture();
  const g = new Game();
  g.start('damage-replay-real');
  replay.capture(canvas, 0);
  callbacks.shift()!(new Blob(['start']));
  g.onDamage = (damage) =>
    replay.recordHit(
      {
        id: damage.id,
        at: damage.elapsed,
        damage: damage.damage,
        hpBefore: damage.hpBefore,
        hpAfter: damage.hpAfter,
        player: damage.player,
        ...(damage.origin ? { origin: damage.origin } : {}),
        label: damageCauseText(damage.cause),
      },
      canvas,
    );
  g.time = g.elapsed = 1;
  const origin = { x: 600, y: 300 };
  g.damagePlayer(15, origin, { type: 'shot', enemy: 'sniper' });
  g.damagePlayer(99, origin, { type: 'contact', enemy: 'runner' });
  assert.equal(g.hp, 85);
  origin.x = 999;
  replay.capture(canvas, 1);
  callbacks.shift()!(new Blob(['hit']));
  g.time = g.elapsed = 2;
  g.die({ type: 'fall' });
  replay.finish(canvas, 2, { player: { x: 427, y: 240 }, label: 'Fall' });
  callbacks.shift()!(new Blob(['end']));
  await settle();
  assert.equal(replay.hits.length, 1);
  assert.equal(replay.hits[0].damage, 15);
  assert.equal(replay.hits[0].hpBefore, 100);
  assert.equal(replay.hits[0].hpAfter, 85);
  assert.equal(replay.hits[0].at, 1);
  assert.equal(replay.hits[0].label, damageCauseText({ type: 'shot', enemy: 'sniper' }));
  assert.equal(replay.hits[0].origin?.x, 600);
  assert.equal(replay.impact?.label, 'Fall');
});

test('out-of-order successful encoding aligns metadata to actual clip bounds and letterboxes coordinates', async () => {
  const { replay, callbacks } = captureFixture();
  const source = { width: 1920, height: 1080 } as HTMLCanvasElement;
  replay.capture(source, 10);
  replay.recordHit(hit(1, 9.9), source);
  const actual = hit(2, 10.4, { player: { x: 960, y: 540 }, origin: { x: 0, y: 0 } });
  replay.recordHit(actual, source);
  replay.recordHit(actual, source);
  replay.recordHit(hit(3, 11), source);
  replay.finish(source, 10.5, { player: actual.player, label: actual.label });
  callbacks[1](new Blob(['last']));
  assert.deepEqual(replay.hits, [], 'Metadata cannot publish against an incomplete interval');
  callbacks[0](new Blob(['first']));
  actual.player.x = 100;
  await settle();
  assert(replay.ready);
  assert.equal(replay.hits.length, 1);
  assert.equal(replay.hits[0].id, 2);
  assert(Math.abs(replay.hits[0].at - 0.4) < 1e-8);
  assert.deepEqual(replay.hits[0].player, { x: 427, y: 240 });
  assert(Math.abs(replay.hits[0].origin!.x - 1 / 3) < 1e-8);
  assert(
    Object.isFrozen(replay.hits) &&
      Object.isFrozen(replay.hits[0]) &&
      Object.isFrozen(replay.hits[0].player),
  );
  assert.throws(() => {
    (replay.hits as ReplayHit[]).push(hit());
  });
});

test('failed final encoding does not attach later hits to an earlier saved image; reset drops old metadata', async () => {
  const { canvas, replay, callbacks } = captureFixture();
  replay.capture(canvas, 2);
  callbacks.shift()!(new Blob(['first']));
  replay.recordHit(hit(1, 2.5), canvas);
  replay.capture(canvas, 3);
  callbacks.shift()!(new Blob(['middle']));
  replay.recordHit(hit(2, 3.5), canvas);
  replay.finish(canvas, 4, { player: { x: 0, y: 0 }, label: 'Unknown damage' });
  callbacks.shift()!(null);
  await settle();
  assert(replay.ready);
  assert.deepEqual(
    replay.hits.map((h) => [h.id, h.at]),
    [[1, 0.5]],
  );
  replay.reset();
  assert.deepEqual(replay.hits, []);
  replay.recordHit(hit(3, 10), canvas);
  replay.finish(canvas, 10, { player: { x: 0, y: 0 }, label: 'Unknown damage' });
  replay.reset();
  callbacks.shift()!(new Blob(['stale']));
  await settle();
  assert(!replay.ready);
  assert.deepEqual(replay.hits, []);
});

test('metadata stays bounded, rejects non-damage records and uses actual health loss rather than overkill', async () => {
  const { canvas, replay, callbacks } = captureFixture();
  replay.capture(canvas, 0);
  callbacks.shift()!(new Blob(['start']));
  for (let i = 0; i < 1000; i++) replay.recordHit(hit(i, i / 250), canvas);
  for (const change of [
    { id: NaN },
    { at: Infinity },
    { damage: 0 },
    { damage: 999 },
    { hpAfter: -1 },
    { hpBefore: 80 },
    { player: { x: NaN, y: 0 } },
    { label: '' },
  ])
    replay.recordHit(hit(2000, 4, change), canvas);
  replay.finish(canvas, 4, { player: { x: 0, y: 0 }, label: 'Collision' });
  callbacks.shift()!(new Blob(['last']));
  await settle();
  assert.equal(replay.hits.length, REPLAY_HITS);
  assert(replay.hits.every((h) => h.id < 1000));
  assert.equal(replay.hits.at(-1)!.id, 999);
  const trimmed = replayHitsInBuffer([{ at: 10 }, { at: 15 }], [hit(1, 9), hit(2, 12), hit(3, 16)]);
  assert.deepEqual(
    trimmed.map((h) => [h.id, h.at]),
    [[2, 2]],
  );
});

test('range seeking precisely inverts slow motion, including short and zero-duration clips', () => {
  for (const duration of [0, 0.1, 0.3, 5])
    for (let i = 0; i <= 100; i++) {
      const at = (duration * i) / 100;
      assert(Math.abs(replayTiming(duration, replayPlayedAt(duration, at)).at - at) < 1e-8);
    }
  assert.equal(replayPlayedAt(5, NaN), 0);
  assert.equal(replayTiming(5, replayPlayedAt(5, 100)).at, 5);
});

async function viewFixture(t: test.TestContext, metadata = true, duration = 5, tinyLast = false) {
  function global(name: string, value: unknown) {
    const before = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => {
      if (before) Object.defineProperty(globalThis, name, before);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  const events = new Map<string, () => void>(),
    frames = new Map<number, (now: number) => void>();
  const draws: string[] = [],
    labels: string[] = [],
    marks: number[][] = [];
  let serial = 0,
    stopped = 0,
    clicked = 0,
    released = 0;
  const doc = {
    hidden: false,
    addEventListener: (key: string, cb: () => void) => events.set(key, cb),
    removeEventListener: (key: string) => events.delete(key),
  };
  global('document', doc);
  global('window', globalThis);
  global('requestAnimationFrame', (cb: (now: number) => void) => {
    frames.set(++serial, cb);
    return serial;
  });
  global('cancelAnimationFrame', (id: number) => frames.delete(id));
  const recorders: Recorder[] = [];
  class Recorder {
    static isTypeSupported() {
      return true;
    }
    state = 'inactive';
    mimeType = 'video/webm';
    starts = 0;
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onerror: (() => void) | null = null;
    onstop: (() => void) | null = null;
    constructor() {
      recorders.push(this);
    }
    start() {
      this.state = 'recording';
      this.starts++;
    }
    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
  }
  global('MediaRecorder', Recorder);
  const url = URL.createObjectURL,
    revoke = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:replay-test';
  URL.revokeObjectURL = () => {
    released++;
  };
  t.after(() => {
    URL.createObjectURL = url;
    URL.revokeObjectURL = revoke;
  });
  const surface = {
    width: 854,
    height: 480,
    setAttribute() {},
    getContext: () => ({
      drawImage: (image: { id: string }) => draws.push(image.id),
      fillRect() {},
      beginPath() {},
      stroke() {},
      arc: (...args: number[]) => marks.push(args),
      fillText: (text: string) => labels.push(text),
    }),
    toBlob: (done: (blob: Blob) => void) => done(new Blob(['frame'])),
    captureStream: () => ({ getTracks: () => [{ stop: () => stopped++ }] }),
  } as unknown as HTMLCanvasElement;
  const replay = new DeathReplay(surface);
  for (let at = 0; at < 5; at++) {
    if (metadata && at >= 1)
      replay.recordHit(
        hit(at, at, { label: at === 3 ? '<script>bad</script>' : 'Shot from Sniper' }),
        surface,
      );
    replay.capture(surface, at);
    await settle();
  }
  if (metadata)
    replay.recordHit(
      hit(5, duration, tinyLast ? { damage: 0.04, hpBefore: 0.04, hpAfter: 0 } : {}),
      surface,
    );
  replay.finish(surface, duration, { player: { x: 427, y: 240 }, label: 'Collision' });
  await settle();
  const elements = new Map<
    string,
    {
      disabled: boolean;
      hidden: boolean;
      textContent: string;
      value: string;
      onclick: () => void;
      oninput: () => void;
      setAttribute(k: string, v: string): void;
      click(): void;
    }
  >();
  let html = '';
  const root = {
    get innerHTML() {
      return html;
    },
    set innerHTML(value: string) {
      html = value;
      for (const match of value.matchAll(/id="([^"]+)"/g))
        elements.set('#' + match[1], {
          disabled: false,
          hidden: false,
          textContent: '',
          value: '0',
          onclick() {},
          oninput() {},
          setAttribute() {},
          click() {
            clicked++;
          },
        });
      elements.set('[data-replay-guidance]', {
        disabled: false,
        hidden: true,
        textContent: '',
        value: '',
        onclick() {},
        oninput() {},
        setAttribute() {},
        click() {},
      });
    },
    querySelector: (selector: string) =>
      selector === 'canvas' ? surface : (elements.get(selector) ?? null),
  };
  const bitmaps: { id: string; closed: boolean; close(): void }[] = [];
  global('createImageBitmap', async (blob: Blob) => {
    const index = replay.buffer.frames.findIndex((frame) => frame.data === blob);
    const image = {
      id: String(index),
      closed: false,
      close() {
        this.closed = true;
      },
    };
    bitmaps.push(image);
    return image;
  });
  const view = new ReplayView(replay, root as unknown as HTMLElement);
  const step = async (now: number) => {
    const batch = [...frames.values()];
    frames.clear();
    batch.forEach((cb) => cb(now));
    await settle();
  };
  const seek = (at: number) => {
    const scrub = elements.get('#replay-scrub')!;
    scrub.value = String(at);
    scrub.oninput();
  };
  return {
    view,
    replay,
    global,
    elements,
    root,
    draws,
    labels,
    marks,
    bitmaps,
    step,
    seek,
    recorders,
    doc,
    events,
    frames,
    counts: () => ({ stopped, clicked, released }),
  };
}

test('timeline has only three latest real-hit jumps, escapes labels, and scrubs to a static factual annotation', async (t) => {
  const f = await viewFixture(t);
  assert(f.root.innerHTML.includes('&lt;script&gt;bad&lt;/script&gt;'));
  assert(!f.root.innerHTML.includes('<script>bad</script>'));
  assert.equal([...f.elements.keys()].filter((key) => /^#replay-hit-\d/.test(key)).length, 3);
  f.elements.get('#replay-hit-0')!.onclick();
  await f.step(1000);
  assert.equal(f.draws.at(-1), '3');
  assert(f.labels.at(-1)?.includes('−20 HP'));
  assert(f.labels.at(-1)?.includes('<script>bad</script>'), 'Canvas text is literal, not HTML');
  assert(f.elements.get('#replay-hit-detail')!.textContent.includes('100 → 80 HP'));
  assert.equal(f.elements.get('#replay-play')!.textContent, 'Play');
  const marks = f.marks.length;
  await f.step(1500);
  assert(f.marks.length > marks, 'Paused inspection retains the same static marker');
  assert.equal(f.draws.at(-1), '3');
  f.seek(4.5);
  await f.step(2000);
  assert.equal(f.draws.at(-1), '4');
  assert.equal(f.elements.get('#replay-time')!.textContent, '4.5 / 5.0s');
  f.view.dispose();
  assert(f.bitmaps.every((bitmap) => bitmap.closed));
});

test('rapid scrubs keep one decode in flight and discard stale images before the latest request paints', async (t) => {
  const f = await viewFixture(t);
  const pending: { id: string; resolve(image: { id: string; close(): void }): void }[] = [];
  f.global(
    'createImageBitmap',
    (blob: Blob) =>
      new Promise((resolve) => {
        const id = String(f.replay.buffer.frames.findIndex((frame) => frame.data === blob));
        pending.push({ id, resolve });
      }),
  );
  await f.step(1000);
  for (const at of [1, 4, 2, 3]) {
    f.seek(at);
    await f.step(1100 + at);
  }
  assert.equal(pending.length, 1);
  let closes = 0;
  pending[0].resolve({
    id: 'stale',
    close() {
      closes++;
    },
  });
  await settle();
  assert.equal(closes, 1);
  assert(!f.draws.includes('stale'));
  await f.step(1200);
  assert.equal(pending.length, 2);
  assert.equal(pending[1].id, '3');
  pending[1].resolve({
    id: 'latest',
    close() {
      closes++;
    },
  });
  await settle();
  assert.equal(f.draws.at(-1), 'latest');
  f.view.dispose();
  assert.equal(closes, 2);
});

test('export cancels a pending scrub revision, disables all seek controls and includes real-hit overlays', async (t) => {
  const f = await viewFixture(t);
  const pending: ((image: { id: string; close(): void }) => void)[] = [];
  f.global('createImageBitmap', () => new Promise((resolve) => pending.push(resolve)));
  f.seek(3);
  await f.step(1000);
  f.elements.get('#replay-save')!.onclick();
  assert(f.elements.get('#replay-scrub')!.disabled);
  assert(f.elements.get('#replay-hit-0')!.disabled);
  f.seek(4);
  f.elements.get('#replay-hit-2')!.onclick();
  let closed = 0;
  pending[0]({
    id: 'old-scrub',
    close() {
      closed++;
    },
  });
  await settle();
  assert.equal(closed, 1);
  assert.equal(f.recorders[0].starts, 0);
  f.global('createImageBitmap', async (blob: Blob) => ({
    id: String(f.replay.buffer.frames.findIndex((frame) => frame.data === blob)),
    close() {},
  }));
  await f.step(1100);
  assert.equal(f.draws.at(-1), '0');
  assert.equal(f.recorders[0].starts, 1);
  await f.step(2100);
  assert(f.labels.some((label) => label.includes('−20 HP')));
  f.recorders[0].ondataavailable!({ data: new Blob(['video']) });
  f.recorders[0].stop();
  assert.equal(f.elements.get('#replay-status')!.textContent, 'Clip ready.');
  assert.equal(f.elements.get('#replay-scrub')!.disabled, false);
  assert.deepEqual(f.counts(), { stopped: 1, clicked: 1, released: 0 });
  f.view.dispose();
  assert.equal(f.counts().released, 1);
});

test('hidden/error/reset lifecycles cancel exports and disable stale or missing replay data', async (t) => {
  const f = await viewFixture(t);
  f.elements.get('#replay-save')!.onclick();
  await f.step(1000);
  f.doc.hidden = true;
  f.events.get('visibilitychange')!();
  assert.equal(f.counts().stopped, 1);
  assert.match(f.elements.get('#replay-status')!.textContent, /visible/);
  f.doc.hidden = false;
  f.elements.get('#replay-save')!.onclick();
  await f.step(1100);
  f.recorders.at(-1)!.ondataavailable!({ data: { size: REPLAY_BYTES + 1 } as Blob });
  assert.match(f.elements.get('#replay-status')!.textContent, /limit/);
  assert.equal(f.counts().stopped, 2);
  f.replay.reset();
  f.replay.buffer.add({ at: 100, data: new Blob(['new run']), bytes: 7 });
  await f.step(1200);
  assert(f.elements.get('#replay-scrub')!.disabled);
  assert(f.elements.get('#replay-save')!.disabled);
  assert.match(f.elements.get('#replay-status')!.textContent, /reset/);
  assert.equal(f.frames.size, 0);
  f.view.dispose();
});

test('legacy recordings without metadata still scrub, retain lethal impact and export', async (t) => {
  const f = await viewFixture(t, false);
  assert.equal([...f.elements.keys()].filter((key) => /^#replay-hit-\d/.test(key)).length, 0);
  f.seek(5);
  await f.step(1000);
  assert.equal(f.draws.at(-1), '5');
  assert.equal(f.labels.at(-1), 'Collision');
  f.elements.get('#replay-save')!.onclick();
  await f.step(1100);
  assert.equal(f.recorders[0].starts, 1);
  f.view.dispose();
  assert.equal(f.counts().stopped, 1);
});

test('a real lethal overkill event records only the accepted remaining health', async () => {
  const { canvas, replay, callbacks } = captureFixture();
  const g = new Game();
  g.start('damage-replay-overkill');
  g.hp = 17;
  replay.capture(canvas, 0);
  callbacks.shift()!(new Blob(['start']));
  g.onDamage = (damage) =>
    replay.recordHit(
      {
        id: damage.id,
        at: damage.elapsed,
        damage: damage.damage,
        hpBefore: damage.hpBefore,
        hpAfter: damage.hpAfter,
        player: damage.player,
        label: damageCauseText(damage.cause),
      },
      canvas,
    );
  g.time = g.elapsed = 1;
  g.damagePlayer(999, undefined, { type: 'shot', enemy: 'shooter' });
  replay.finish(canvas, 1, { player: { x: 0, y: 0 }, label: damageCauseText(g.deathCause) });
  callbacks.shift()!(new Blob(['end']));
  await settle();
  assert.equal(replay.hits[0].damage, 17);
  assert.equal(replay.hits[0].hpBefore, 17);
  assert.equal(replay.hits[0].hpAfter, 0);
  assert.equal(replay.hits[0].origin, undefined);
});

test('the native range preserves a non-centisecond endpoint and seeks the actual lethal frame', async (t) => {
  const duration = 4.966666666666667;
  const f = await viewFixture(t, true, duration);
  assert.match(f.root.innerHTML, /step="any"/);
  f.seek(duration);
  await f.step(1000);
  assert.equal(f.draws.at(-1), '5');
  assert.equal(Number(f.elements.get('#replay-scrub')!.value), duration);
  assert(f.labels.at(-1)?.includes('−20 HP'));
  assert(
    f.elements.get('#replay-hit-detail')!.textContent.includes('4.9s') ||
      f.elements.get('#replay-hit-detail')!.textContent.includes('5.0s'),
  );
  f.view.dispose();
});

test('tiny positive accepted damage stays visible in hit buttons and canvas annotations', async (t) => {
  const f = await viewFixture(t, true, 5, true);
  assert(f.root.innerHTML.includes('−&lt;0.1 HP'));
  assert(!f.root.innerHTML.includes('−0.0 HP'));
  f.elements.get('#replay-hit-2')!.onclick();
  await f.step(1000);
  assert(f.labels.at(-1)?.includes('−<0.1 HP'));
  assert(f.elements.get('#replay-hit-detail')!.textContent.includes('−<0.1'));
  f.view.dispose();
});

test('native fifteen-digit End values and hit jumps resolve the exact last frame and hit details', async (t) => {
  const duration = 4.999999999999984;
  const nativeValue = Number(duration.toPrecision(15));
  assert(nativeValue < duration);
  const at = replayTiming(duration, replayPlayedAt(duration, nativeValue)).at;
  assert.equal(at, duration);
  assert.equal(replayFrameIndex([{ at: 0 }, { at: 4 }, { at: duration }], at), 2);
  const f = await viewFixture(t, true, duration);
  f.seek(nativeValue);
  await f.step(1000);
  assert.equal(f.draws.at(-1), '5');
  assert.equal(Number(f.elements.get('#replay-scrub')!.value), duration);
  assert(f.elements.get('#replay-hit-detail')!.textContent.includes('−20'));
  assert(f.elements.get('#replay-hit-detail')!.textContent.includes('Shot from Sniper'));
  f.seek(0);
  await f.step(1100);
  assert.equal(f.draws.at(-1), '0');
  f.elements.get('#replay-hit-2')!.onclick();
  await f.step(1200);
  assert.equal(f.draws.at(-1), '5');
  assert(f.elements.get('#replay-hit-detail')!.textContent.includes('−20'));
  f.view.dispose();
});
