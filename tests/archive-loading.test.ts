import test from 'node:test';
import assert from 'node:assert/strict';
import { drawArchiveImages, stopArchiveImages } from '../src/archive-images.ts';

test('archive pictures wait for visibility, yield between photos, and stop on menu replacement', (t) => {
  const jobs = new Map<number, () => void>();
  let next = 0,
    callback: IntersectionObserverCallback;
  let disconnected = false;
  const globals = (name: string, value: unknown) => {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() =>
      original
        ? Object.defineProperty(globalThis, name, original)
        : Reflect.deleteProperty(globalThis, name),
    );
  };
  globals('setTimeout', (job: () => void) => {
    jobs.set(++next, job);
    return next;
  });
  globals('clearTimeout', (id: number) => jobs.delete(id));
  globals('devicePixelRatio', 1);
  globals(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {
        disconnected = true;
      }
    },
  );
  function canvas() {
    const c = {
      width: 640,
      height: 320,
      getBoundingClientRect: () => ({ width: 640, height: 320 }),
    };
    const ctx = new Proxy(
      { canvas: c, getImageData: () => ({ data: new Uint8ClampedArray(4) }) },
      {
        get: (target, key) => (key in target ? Reflect.get(target, key) : () => {}),
      },
    );
    return Object.assign(c, { getContext: () => ctx });
  }
  globals('document', { createElement: () => canvas() });
  const painted: string[] = [];
  const targets = ['enemy:runner', 'enemy:shooter'].map((id) => ({
    ...canvas(),
    dataset: { archiveImage: id },
    isConnected: true,
    getContext: () => ({ drawImage: () => painted.push(id) }),
  }));
  const root = {
    querySelectorAll: () => targets,
    contains: (target: unknown) => targets.includes(target as (typeof targets)[number]),
  } as unknown as HTMLElement;
  drawArchiveImages(root);
  assert.equal(jobs.size, 0, 'Offscreen art does no photograph work');
  const enter = (target: unknown) =>
    callback(
      [{ target, isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
  enter(targets[0]);
  enter(targets[1]);
  assert.equal(jobs.size, 1, 'One queued task for the visible batch');
  const [id, job] = jobs.entries().next().value!;
  jobs.delete(id);
  job();
  assert.deepEqual(painted, ['enemy:runner'], 'One actual game photograph per task');
  assert.equal(jobs.size, 1);
  stopArchiveImages(root);
  assert.equal(jobs.size, 0);
  assert.equal(disconnected, true);
  enter(targets[1]);
  assert.equal(jobs.size, 0, 'A stale observer cannot revive painting after close');
  assert.deepEqual(painted, ['enemy:runner']);
});
