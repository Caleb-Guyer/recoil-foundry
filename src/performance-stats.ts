// Bounded histograms retain an entire soak without retaining every frame.
export class TimingStats {
  private bins = new Uint32Array(4001);
  count = 0;
  sum = 0;
  max = 0;
  over20 = 0;
  over34 = 0;
  over50 = 0;
  add(ms: number) {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.count++;
    this.sum += ms;
    this.max = Math.max(this.max, ms);
    this.bins[Math.min(4000, Math.round(ms * 10))]++;
    if (ms > 20) this.over20++;
    if (ms > 1000 / 30) this.over34++;
    if (ms > 50) this.over50++;
  }
  percentile(fraction: number) {
    if (!this.count) return null;
    const rank = Math.max(1, Math.ceil(this.count * fraction));
    let seen = 0;
    for (let i = 0; i < this.bins.length; i++) {
      seen += this.bins[i];
      if (seen >= rank) return i === 4000 ? Math.max(400, this.max) : i / 10;
    }
    return this.max;
  }
  report() {
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      samples: this.count,
      meanMs: this.count ? round(this.sum / this.count) : null,
      p50Ms: this.percentile(0.5),
      p95Ms: this.percentile(0.95),
      p99Ms: this.percentile(0.99),
      maxMs: round(this.max),
      over20: this.over20,
      over34: this.over34,
      over50: this.over50,
    };
  }
}
