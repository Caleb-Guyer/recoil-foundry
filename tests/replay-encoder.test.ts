import test from 'node:test';
import assert from 'node:assert/strict';
import { ReplayEncoder } from '../src/replay-encoder.ts';

function fixture(t: test.TestContext) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'createImageBitmap', original);
    else Reflect.deleteProperty(globalThis, 'createImageBitmap');
  });
  const jobs: { id: number; bitmap: ImageBitmap }[] = [];
  let stopped = 0,
    closed = 0,
    fallback = 0,
    snapshots = 0;
  const worker = {
    onmessage: null as unknown as (event: { data: { id: number; blob: Blob | null } }) => void,
    onerror: null as unknown as (event: { preventDefault(): void }) => void,
    onmessageerror: null as unknown as () => void,
    postMessage(data: (typeof jobs)[number], transfer: ImageBitmap[]) {
      assert.deepEqual(transfer, [data.bitmap]);
      jobs.push(data);
    },
    terminate() {
      stopped++;
    },
  };
  const bitmap = {
    close() {
      closed++;
    },
  } as ImageBitmap;
  Object.defineProperty(globalThis, 'createImageBitmap', {
    configurable: true,
    writable: true,
    value: () => {
      snapshots++;
      return Promise.resolve(bitmap);
    },
  });
  const canvas = {
    width: 854,
    height: 480,
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toBlob: (done: (blob: Blob | null) => void) => {
      fallback++;
      done(new Blob(['fallback']));
    },
  } as unknown as HTMLCanvasElement;
  return {
    worker,
    bitmap,
    canvas,
    jobs,
    counts: () => ({ stopped, closed, fallback, snapshots }),
    encoder: new ReplayEncoder(canvas, () => worker as unknown as Worker),
  };
}

test('worker capture snapshots immediately and correlates out-of-order replies without main-thread JPEG work', async (t) => {
  const f = fixture(t);
  const received: string[] = [];
  f.encoder.encode(f.canvas, (blob) => {
    assert(blob);
    received.push('first');
  });
  assert.equal(
    f.counts().snapshots,
    1,
    'snapshot starts before later rendering can overwrite the source',
  );
  f.encoder.encode(f.canvas, (blob) => {
    assert(blob);
    received.push('last');
  });
  await Promise.resolve();
  assert.equal(f.jobs.length, 2);
  f.worker.onmessage({ data: { id: f.jobs[1].id, blob: new Blob(['last']) } });
  f.worker.onmessage({ data: { id: f.jobs[0].id, blob: new Blob(['first']) } });
  f.worker.onmessage({ data: { id: f.jobs[0].id, blob: new Blob(['duplicate']) } });
  assert.deepEqual(received, ['last', 'first']);
  assert.equal(f.counts().fallback, 0);
});

test('worker startup failure resolves pending jobs, closes late snapshots and falls back for future captures', async (t) => {
  const f = fixture(t);
  const received: (Blob | null)[] = [];
  f.encoder.encode(f.canvas, (blob) => received.push(blob));
  f.worker.onerror({ preventDefault() {} });
  await Promise.resolve();
  assert.deepEqual(received, [null]);
  assert.equal(f.jobs.length, 0);
  assert.equal(f.counts().closed, 1);
  f.encoder.encode(f.canvas, (blob) => received.push(blob));
  assert(received[1] instanceof Blob);
  assert.deepEqual(f.counts(), { stopped: 1, closed: 1, fallback: 1, snapshots: 1 });
});

test('failed bitmap transfer closes the bitmap and releases the encoder budget', async (t) => {
  const f = fixture(t);
  f.worker.postMessage = () => {
    throw new Error('transfer unavailable');
  };
  const received: (Blob | null)[] = [];
  f.encoder.encode(f.canvas, (blob) => received.push(blob));
  await Promise.resolve();
  assert.deepEqual(received, [null]);
  assert.equal(f.counts().closed, 1);
  f.encoder.encode(f.canvas, (blob) => received.push(blob));
  assert(received[1] instanceof Blob);
});

test('unsupported worker JPEG encoding drains pending work and preserves fallback capture', async (t) => {
  const f = fixture(t);
  const received: (Blob | null)[] = [];
  f.encoder.encode(f.canvas, (blob) => received.push(blob));
  f.encoder.encode(f.canvas, (blob) => received.push(blob));
  await Promise.resolve();
  f.worker.onmessage({ data: { id: f.jobs[0].id, blob: null } });
  assert.deepEqual(received, [null, null]);
  f.encoder.encode(f.canvas, (blob) => received.push(blob));
  assert(received[2] instanceof Blob);
  assert.equal(f.counts().stopped, 1);
});
