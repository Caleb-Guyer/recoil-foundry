// Diagnostic-page only. Records the work *before* a delayed callback, not the
// simulation catch-up that the delay itself triggers. All histories are bounded.
export type FrameWork = {
  at: number;
  start: number;
  end: number;
  scenario: string;
  measured: boolean;
  simulationMs: number;
  audioMs: number;
  renderMs: number;
  captureMs: number;
  housekeepingMs: number;
  transitionMs: number;
};
type BrowserEntry = {
  entryType: string;
  startTime: number;
  duration: number;
  blockingDuration?: number;
  renderStart?: number;
  styleAndLayoutStart?: number;
  scripts?: { duration: number; forcedStyleAndLayoutDuration?: number }[];
};
type Observer = {
  observe(options: { type: string }): void;
  takeRecords(): BrowserEntry[];
  disconnect(): void;
};
export type ObserverFactory = {
  supportedEntryTypes: readonly string[];
  new (callback: (list: { getEntries(): BrowserEntry[] }) => void): Observer;
};
const round = (n: number) => Math.round(n * 100) / 100;
const duration = (n: number | undefined) =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 ? round(n) : null;
const LIMIT = 120;
type SlowFrame = {
  startMs: number;
  endMs: number;
  intervalMs: number;
  callbackSpacingMs: number;
  scenario: string;
  measured: boolean;
  previous: Omit<FrameWork, 'at' | 'start' | 'end'> & { callbackMs: number };
};
type WorkEntry = {
  type: string;
  startMs: number;
  durationMs: number;
  blockingMs: number | null;
  renderPhaseMs: number | null;
  styleAndLayoutMs: number | null;
  scriptMs: number;
  forcedStyleAndLayoutMs: number;
};
export class FrameDiagnostics {
  private previous: FrameWork | null = null;
  private origin = 0;
  private segmentStart = 0;
  private observers: Observer[] = [];
  private slow: SlowFrame[] = [];
  private browserWork: WorkEntry[] = [];
  private slowCount = 0;
  private browserCount = 0;
  private supported: string[] = [];
  private unavailable: string[] = [];
  reset(now: number) {
    this.stop();
    this.origin = now;
    this.previous = null;
    this.slow = [];
    this.browserWork = [];
    this.slowCount = this.browserCount = 0;
    this.supported = [];
    this.unavailable = [];
  }
  start(now: number, factory: ObserverFactory | undefined = globalThis.PerformanceObserver) {
    this.stop();
    this.previous = null;
    this.segmentStart = now;
    for (const type of ['longtask', 'long-animation-frame']) {
      let observer: Observer | undefined;
      try {
        if (!factory?.supportedEntryTypes?.includes(type)) throw new Error('unsupported');
        observer = new factory((list) => this.addEntries(list.getEntries()));
        // No buffered entries from earlier navigation, tests or pauses.
        observer.observe({ type });
        this.observers.push(observer);
        if (!this.supported.includes(type)) this.supported.push(type);
      } catch {
        observer?.disconnect();
        if (!this.unavailable.includes(type)) this.unavailable.push(type);
      }
    }
  }
  stop() {
    for (const observer of this.observers) {
      this.addEntries(observer.takeRecords());
      observer.disconnect();
    }
    this.observers = [];
    this.previous = null;
  }
  private addEntries(entries: BrowserEntry[]) {
    for (const entry of entries) {
      if (
        !['longtask', 'long-animation-frame'].includes(entry.entryType) ||
        !Number.isFinite(entry.startTime) ||
        entry.startTime < this.segmentStart ||
        !Number.isFinite(entry.duration) ||
        entry.duration < 0
      )
        continue;
      const end = entry.startTime + entry.duration;
      const phase = (start: number | undefined) =>
        start && start >= entry.startTime && start <= end ? round(end - start) : null;
      const scripts = entry.scripts ?? [];
      // Do not retain script URLs, DOM containers, function names or page text.
      this.browserWork.push({
        type: entry.entryType,
        startMs: round(entry.startTime - this.origin),
        durationMs: round(entry.duration),
        blockingMs: duration(entry.blockingDuration),
        renderPhaseMs: phase(entry.renderStart),
        styleAndLayoutMs: phase(entry.styleAndLayoutStart),
        scriptMs: round(scripts.reduce((sum, s) => sum + (duration(s.duration) ?? 0), 0)),
        forcedStyleAndLayoutMs: round(
          scripts.reduce((sum, s) => sum + (duration(s.forcedStyleAndLayoutDuration) ?? 0), 0),
        ),
      });
      this.browserCount++;
      if (this.browserWork.length > LIMIT) this.browserWork.shift();
    }
  }
  frame(work: FrameWork) {
    const previous = this.previous;
    if (previous && work.at - previous.at > 50) {
      const { at: _at, start, end, ...components } = previous;
      this.slow.push({
        startMs: round(start - this.origin),
        endMs: round(work.start - this.origin),
        intervalMs: round(work.at - previous.at),
        callbackSpacingMs: round(work.start - start),
        scenario: work.scenario,
        measured: work.measured,
        previous: { ...components, callbackMs: round(end - start) },
      });
      this.slowCount++;
      if (this.slow.length > LIMIT) this.slow.shift();
    }
    this.previous = work;
  }
  report(detailed = true) {
    for (const observer of this.observers) this.addEntries(observer.takeRecords());
    return {
      limitPerHistory: LIMIT,
      slowFrameCount: this.slowCount,
      browserEntryCount: this.browserCount,
      discardedSlowFrames: Math.max(0, this.slowCount - this.slow.length),
      discardedBrowserEntries: Math.max(0, this.browserCount - this.browserWork.length),
      supportedObservers: [...this.supported],
      unavailableObservers: [...this.unavailable],
      slowFrames: (detailed ? this.slow : []).map((frame) => {
        const overlapping = this.browserWork.filter(
          (entry) =>
            entry.startMs < frame.endMs && entry.startMs + entry.durationMs > frame.startMs,
        );
        return {
          ...frame,
          overlappingBrowserEntries: overlapping.length,
          browserWork: overlapping.slice(0, 8),
        };
      }),
      browserWork: detailed ? [...this.browserWork] : [],
      interpretation:
        'Times are milliseconds since test start. Delayed intervals include warm-up; measured marks intervals included in scenario histograms. Previous callback work precedes the gap; current catch-up work is not its cause. Browser entries overlap in time, not necessarily causally. Unobserved time can include rendering, scheduling, other tasks or native work. Missing/unsupported entries do not prove browser idleness. Histories retain the latest 120 items and report discarded counts.',
    };
  }
}
