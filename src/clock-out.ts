// Presentation time is deliberately separate from simulation and the run timer.
export const CLOCK_OUT_DURATION = 12;
export const CLOCK_OUT_ENTRY = { x: 6500, y: 680 };

export class ClockOut {
  active = false;
  ready = false;
  time = 0;
  private skipRequested = false;
  begin() {
    this.active = true;
  }
  release() {
    this.ready = true;
    return this.skipRequested && this.finish();
  }
  skip() {
    if (!this.active) return false;
    this.skipRequested = true;
    return this.ready && this.finish();
  }
  update(dt: number, foreground: boolean) {
    if (!this.active || !this.ready || !foreground || !Number.isFinite(dt)) return false;
    this.time = Math.min(CLOCK_OUT_DURATION, this.time + Math.max(0, Math.min(dt, 0.1)));
    return this.time >= CLOCK_OUT_DURATION && this.finish();
  }
  private finish() {
    if (!this.active) return false;
    this.active = false;
    this.time = CLOCK_OUT_DURATION;
    return true;
  }
}
