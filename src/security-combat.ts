import type { Game, Enemy } from './game.ts';
import { isBoss } from './enemies.ts';
import { direction } from './rules.ts';
import type { Vec } from './rules.ts';

export const SECURITY_TELL = 1.05;
export const SECURITY_LOCK = 0.45;
interface Counter {
  age: number;
  aim: Vec;
  offsets: number[];
  fired: boolean;
}
// Use part of a primary attack's recovery for a warned counter-volley. Preserve
// an explicit opening afterward, without adding a second full recovery cycle.
export class SecurityCombat {
  counters = new Map<Enemy, Counter>();
  private previous = new Map<Enemy, string>();
  private cycles = new Map<Enemy, number>();
  readonly game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.counters.clear();
    this.previous.clear();
    this.cycles.clear();
  }
  update(e: Enemy, dt: number) {
    const g = this.game;
    if (
      (g.security?.level ?? 0) < 2 ||
      !isBoss(e.kind) ||
      e.allied ||
      e.kind === 'welder' ||
      e.kind === 'auditor'
    )
      return false;
    for (const other of this.previous.keys())
      if (!g.enemies.includes(other)) {
        this.previous.delete(other);
        this.cycles.delete(other);
        this.counters.delete(other);
      }
    const before = this.previous.get(e);
    this.previous.set(e, e.state);
    let c = this.counters.get(e);
    if (e.state !== 'recover') {
      this.counters.delete(e);
      return false;
    }
    if (!c && before && before !== 'recover') {
      const n = (this.cycles.get(e) ?? 0) + 1;
      this.cycles.set(e, n);
      // Every other primary attack keeps an uninterrupted recovery.
      if (n % 2 === 0) return false;
      const fan = ['crane', 'kiln', 'condenser', 'boss', 'switchboard'].includes(e.kind);
      c = {
        age: 0,
        aim: direction(e.body.position, g.player.position),
        offsets: fan ? [-0.3, 0, 0.3] : [-0.17, 0.17],
        fired: false,
      };
      this.counters.set(e, c);
      g.onSound('lock');
    }
    if (!c) return false;
    c.age += dt;
    if (c.age < SECURITY_TELL - SECURITY_LOCK)
      c.aim = direction(e.body.position, g.player.position);
    if (!c.fired && c.age >= SECURITY_TELL) {
      c.fired = true;
      for (const offset of c.offsets) g.enemyShot(e, Math.atan2(c.aim.y, c.aim.x) + offset);
      g.onSound('enemy');
    }
    if (c.age >= SECURITY_TELL + 0.12) {
      this.counters.delete(e);
      e.timer = Math.max(e.timer, 0.55 * (g.overtime ? 1.12 : 1));
      return false;
    }
    // Preserve movement/gravity handling in the original AI while holding only
    // its recovery clock. This also keeps vulnerability and arena interactions.
    e.timer = Math.max(e.timer, dt * (g.overtime ? 1.12 : 1) + 0.001);
    return false;
  }
  draw(c: CanvasRenderingContext2D) {
    const g = this.game;
    for (const [e, warning] of this.counters) {
      if (warning.fired || e.hp <= 0 || !g.enemies.includes(e)) continue;
      c.save();
      c.strokeStyle = '#ffc88c';
      c.lineWidth = warning.age >= SECURITY_TELL - SECURITY_LOCK ? 2 : 1;
      c.globalAlpha = 0.6;
      c.setLineDash(warning.age >= SECURITY_TELL - SECURITY_LOCK ? [] : [7, 8]);
      for (const offset of warning.offsets) {
        const a = Math.atan2(warning.aim.y, warning.aim.x) + offset;
        const origin = e.body.position;
        const end = g.lineEnd(
          origin,
          { x: origin.x + Math.cos(a) * 1600, y: origin.y + Math.sin(a) * 1600 },
          5,
        );
        c.beginPath();
        c.moveTo(origin.x, origin.y);
        c.lineTo(end.x, end.y);
        c.stroke();
      }
      c.setLineDash([]);
      c.beginPath();
      c.arc(
        e.body.position.x,
        e.body.position.y,
        34,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * Math.min(1, warning.age / SECURITY_TELL),
      );
      c.stroke();
      c.restore();
    }
  }
}
