import type { Game } from './game.ts';
import type { Level } from './levels.ts';
import { courierEligible } from './courier-layout.ts';
import { floodgateLevel, planFloodgate } from './floodgate-layout.ts';
import { segmentBox, type Checkpoint, type Vec } from './rules.ts';

export const FLOOD = {
  floor: 740,
  ceiling: 500,
  rise: 11,
  drain: 70,
  relief: 4,
  radius: 16,
  exposure: 0.6,
  damage: 9,
  interval: 0.9,
};
export interface FloodValve extends Vec {
  used: boolean;
  flash: number;
}
export class FloodgateSystem {
  game: Game;
  stage: number | null = null;
  active = false;
  phase: 'idle' | 'warning' | 'rising' | 'draining' | 'done' = 'idle';
  surface = FLOOD.floor;
  relief = 0;
  exposure = 0;
  hurtAt = -100;
  valves: FloodValve[] = [];
  constructor(game: Game) {
    this.game = game;
  }
  start(save?: Checkpoint) {
    this.stage = save
      ? (save.floodgate ?? null)
      : planFloodgate(this.game.seed, this.game.areaEvents.state, this.game.courier.state);
  }
  clear() {
    this.active = false;
    this.phase = 'idle';
    this.surface = FLOOD.floor;
    this.relief = this.exposure = 0;
    this.hurtAt = -100;
    this.valves = [];
  }
  level(source: Level) {
    const g = this.game;
    if (
      this.stage !== g.stage ||
      g.practice ||
      g.workshop.active ||
      g.detour ||
      g.escape ||
      g.overtime ||
      source.courier ||
      g.areaEvents.state?.area === 2 ||
      (g.testRun && !g.seed.startsWith('FLOODGATE-')) ||
      (!g.testRun && !courierEligible(source))
    )
      return source;
    return floodgateLevel(g.seed);
  }
  reset(cleared: boolean) {
    this.clear();
    if (!this.game.level.floodgate) return;
    this.active = true;
    this.phase = cleared ? 'done' : 'idle';
    this.valves = [570, 1500].map((x) => ({
      x: this.game.level.mirrored ? 2000 - x : x,
      y: 399,
      used: cleared,
      flash: 0,
    }));
  }
  trigger(v: FloodValve) {
    const g = this.game;
    if (!this.active || g.mode !== 'playing' || g.clear || v.used || !this.valves.includes(v))
      return false;
    v.used = true;
    v.flash = 0.3;
    // A second valve opens the same drain: firing both at once does not bank
    // another reprieve for later. Spent wheels stay visibly broken.
    this.relief = FLOOD.relief;
    g.onSound('flood-valve');
    g.burst(v, 12, '#9bc9bd', 3);
    return true;
  }
  trace(from: Vec, to: Vec, radius = 0) {
    if (!this.active || this.game.clear) return;
    let nearest: { t: number; normal: Vec; valve: FloodValve } | undefined;
    for (const v of this.valves) {
      if (v.used) continue;
      const r = FLOOD.radius + radius;
      const h = segmentBox(from, to, { x: v.x - r, y: v.y - r }, { x: v.x + r, y: v.y + r });
      if (h && (!nearest || h.t < nearest.t)) nearest = { ...h, valve: v };
    }
    return nearest;
  }
  update(dt: number) {
    const g = this.game;
    if (!this.active || g.mode !== 'playing' || !(dt > 0)) return;
    for (const v of this.valves) v.flash = Math.max(0, v.flash - dt);
    const finished =
      g.clear || (!g.combatEnemyCount && !g.waves.pending && !g.mutations.pending.length);
    if (finished && this.phase !== 'draining' && this.phase !== 'done') {
      this.phase = 'draining';
      this.exposure = 0;
      g.onSound('flood-drain');
    }
    if (this.phase === 'idle' && g.waves.phase === 'warning') {
      this.phase = 'warning';
      g.onSound('flood-warn');
    }
    if (
      (this.phase === 'idle' || this.phase === 'warning') &&
      (g.waves.phase === 'final' ||
        g.waves.doors.some((d) => d.state === 'open' || d.state === 'spent'))
    ) {
      this.phase = 'rising';
      g.onSound('flood-rise');
    }
    if (this.phase === 'draining') {
      this.surface = Math.min(FLOOD.floor, this.surface + FLOOD.drain * dt);
      if (this.surface >= FLOOD.floor) this.phase = 'done';
    } else if (this.phase === 'rising') {
      const draining = Math.min(dt, this.relief);
      this.surface = Math.max(
        FLOOD.ceiling,
        Math.min(FLOOD.floor, this.surface + FLOOD.drain * draining) - FLOOD.rise * (dt - draining),
      );
    }
    this.relief = Math.max(0, this.relief - dt);
    // No drag, jump suppression or constant knockback: a late player can
    // still climb out. Only sustained immersion hurts, with ordinary i-frames.
    if (!finished && this.surface < FLOOD.floor - 10 && g.player.bounds.max.y > this.surface + 10) {
      this.exposure += dt;
      if (
        this.exposure >= FLOOD.exposure &&
        g.time - this.hurtAt >= FLOOD.interval &&
        g.time - g.hurtAt >= 0.75
      ) {
        this.hurtAt = g.time;
        g.damagePlayer(FLOOD.damage, undefined, { type: 'coolant' });
      }
    } else this.exposure = 0;
  }
}
