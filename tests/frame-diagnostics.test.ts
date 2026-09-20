import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FrameDiagnostics,
  type FrameWork,
  type ObserverFactory,
} from '../src/frame-diagnostics.ts';

const frame = (at: number, overrides: Partial<FrameWork> = {}): FrameWork => ({
  at,
  start: at + 1,
  end: at + 3,
  scenario: 'volley',
  measured: true,
  simulationMs: 0.5,
  audioMs: 0.1,
  renderMs: 0.3,
  captureMs: 0.1,
  housekeepingMs: 0.2,
  transitionMs: 0,
  ...overrides,
});

test('a slow interval retains preceding work, not the catch-up it caused', () => {
  const d = new FrameDiagnostics();
  d.reset(100);
  d.frame(frame(100));
  d.frame(frame(200, { end: 230, simulationMs: 25 }));
  const gap = d.report().slowFrames[0];
  assert.equal(gap.intervalMs, 100);
  assert.equal(gap.previous.callbackMs, 2);
  assert.equal(gap.previous.simulationMs, 0.5);
  assert.equal(gap.startMs, 1);
  assert.equal(gap.endMs, 101);
  assert.equal(d.report(false).slowFrames.length, 0);
  assert.equal(d.report(false).slowFrameCount, 1);
  assert.equal(d.report().slowFrames.length, 1, 'compact display preserves full evidence');
  d.stop();
  d.frame(frame(10_000));
  assert.equal(d.report().slowFrameCount, 1, 'paused time is not a new stall');
  d.reset(20_000);
  assert.equal(d.report().slowFrameCount, 0);
});

test('a long soak bounds histories without discarding the total stall count', () => {
  const d = new FrameDiagnostics();
  d.reset(0);
  for (let i = 0; i <= 1000; i++) d.frame(frame(i * 100, { measured: i > 20 }));
  const result = d.report();
  assert.equal(result.slowFrameCount, 1000);
  assert.equal(result.slowFrames.length, 120);
  assert.equal(result.discardedSlowFrames, 880);
});

test('browser entries correlate by interval, drain at pause, and omit source data', () => {
  const observers: { type: string; records: unknown[]; disconnected: boolean }[] = [];
  class FakeObserver {
    static supportedEntryTypes = ['longtask', 'long-animation-frame'];
    type = '';
    records: unknown[] = [];
    disconnected = false;
    constructor() {
      observers.push(this);
    }
    observe({ type }: { type: string }) {
      this.type = type;
    }
    takeRecords() {
      return this.records.splice(0);
    }
    disconnect() {
      this.disconnected = true;
    }
  }
  const d = new FrameDiagnostics();
  d.reset(100);
  d.start(100, FakeObserver as unknown as ObserverFactory);
  d.frame(frame(100));
  d.frame(frame(200, { scenario: 'beam' }));
  observers[0].records.push(
    { entryType: 'longtask', startTime: 20, duration: 70 }, // Before this test.
    { entryType: 'longtask', startTime: 130, duration: 55, containerSrc: 'private-value' },
    { entryType: 'longtask', startTime: 250, duration: 60 }, // Outside this gap.
  );
  observers[1].records.push({
    entryType: 'long-animation-frame',
    startTime: 120,
    duration: 90,
    blockingDuration: 20,
    renderStart: 160,
    styleAndLayoutStart: 180,
    scripts: [{ duration: 15, forcedStyleAndLayoutDuration: 3, sourceURL: 'private-value' }],
  });
  d.stop();
  const report = d.report();
  assert.equal(report.browserEntryCount, 3);
  assert.equal(report.slowFrames[0].browserWork.length, 2);
  assert.equal(report.slowFrames[0].previous.scenario, 'volley');
  const loaf = report.browserWork.find((e) => e.type === 'long-animation-frame')!;
  assert.equal(loaf.renderPhaseMs, 50);
  assert.equal(loaf.styleAndLayoutMs, 30);
  assert.equal(loaf.scriptMs, 15);
  assert.equal(loaf.forcedStyleAndLayoutMs, 3);
  assert(!JSON.stringify(report).includes('private-value'));
  assert(observers.every((o) => o.disconnected));
});

test('missing or rejecting performance observers leave callback diagnostics usable', () => {
  const d = new FrameDiagnostics();
  d.reset(0);
  class RejectingObserver {
    static supportedEntryTypes = ['longtask'];
    observe() {
      throw new Error('disabled');
    }
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  d.start(0, RejectingObserver);
  assert.deepEqual(d.report().unavailableObservers, ['longtask', 'long-animation-frame']);
  d.frame(frame(0));
  d.frame(frame(100));
  assert.equal(d.report().slowFrameCount, 1);
});
