import Matter from 'matter-js';
import type { Game } from './game.ts';
import { airflowExposed, airflowReach, type FlowLane } from './airflow.ts';
import { clamp } from './rules.ts';

export interface FanPlacement extends FlowLane {
  offset: number;
}
export interface CrosswindFan extends FanPlacement {
  phase: 'rest' | 'warn' | 'gust';
  timer: number;
  rotation: number;
}
export const CROSSWIND = {
  rest: 3.8,
  warn: 1.25,
  gust: 3.6,
  ramp: 0.4,
  lift: 0.7,
  drift: 0.23,
  liftCap: 7.5,
  driftCap: 8,
};
const LIGHT_ENEMIES = new Set(['runner', 'hopper', 'flyer', 'skimmer', 'sifter']);

export class CrosswindSystem {
  items: CrosswindFan[] = [];
  game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  clear() {
    this.items = [];
  }
  reset() {
    this.items = (this.game.level.fans ?? []).map((p) => ({
      ...p,
      dir: { ...p.dir },
      phase: 'rest',
      timer: 2.5 + p.offset,
      rotation: 0,
    }));
  }
  strength(f: CrosswindFan) {
    return f.phase === 'gust'
      ? Math.min(1, (CROSSWIND.gust - f.timer) / CROSSWIND.ramp, f.timer / CROSSWIND.ramp)
      : 0;
  }
  reach(f: FanPlacement, across = 0, ignore?: Matter.Body) {
    return airflowReach(this.game, f, across, ignore);
  }
  beforeStep(dt: number) {
    const g = this.game;
    if (g.mode !== 'playing' || !(dt > 0)) return;
    if (g.clear) {
      for (const f of this.items) {
        f.phase = 'rest';
        f.timer = CROSSWIND.rest;
      }
      return;
    }
    for (const f of this.items) {
      const spin =
        f.phase === 'warn'
          ? 1 - f.timer / CROSSWIND.warn
          : f.phase === 'gust'
            ? this.strength(f)
            : 0;
      f.rotation = (f.rotation + dt * (1.8 + spin * 13)) % (Math.PI * 2);
      f.timer = Math.max(0, f.timer - dt);
      // Keep each complete warning even after a delayed frame.
      if (f.timer <= 1e-8) {
        if (f.phase === 'rest') {
          f.phase = 'warn';
          f.timer = CROSSWIND.warn;
          g.onSound('fan-warn');
        } else if (f.phase === 'warn') {
          f.phase = 'gust';
          f.timer = CROSSWIND.gust;
          g.onSound('fan-gust');
        } else {
          f.phase = 'rest';
          f.timer = CROSSWIND.rest;
        }
      }
    }
    const active = this.items.filter((f) => this.strength(f) > 0);
    if (!active.length) return;
    const actors: { body: Matter.Body; scale: number }[] = [];
    // Walking and aiming stay familiar. A deliberate jump enters the airflow.
    if (!g.grounded) actors.push({ body: g.player, scale: 1 });
    for (const e of g.enemies) {
      if (
        e.hp <= 0 ||
        e.spawn > 0 ||
        !LIGHT_ENEMIES.has(e.kind) ||
        (e.elite === 'volatile' && e.state === 'windup') ||
        g.enemyGrounded(e) ||
        g.ballistics.pinned(e) ||
        g.salvageEvolutions.carried(e)
      )
        continue;
      actors.push({ body: e.body, scale: 0.65 });
    }
    for (const p of g.props.items) {
      if (
        !['crate', 'rubble'].includes(p.kind) ||
        g.enemies.some((e) => e.scrapper?.held === p) ||
        g.magnets.items.some((m) => m.held === p)
      )
        continue;
      actors.push({ body: p.body, scale: 0.85 });
    }
    // Aggregate before moving: overlapping fans cannot multiply the acceleration,
    // and a loose crate shields everyone consistently for this physics step.
    const forces = actors
      .filter(({ body }) => !body.isStatic)
      .map(({ body, scale }) => {
        let x = 0,
          y = 0;
        for (const f of active) {
          if (!airflowExposed(g, f, body)) continue;
          const amount = this.strength(f) * scale;
          x += f.dir.x * CROSSWIND.drift * amount;
          y += f.dir.y * CROSSWIND.lift * amount;
        }
        return {
          body,
          x: clamp(x, -CROSSWIND.drift, CROSSWIND.drift),
          y: clamp(y, -CROSSWIND.lift, CROSSWIND.lift),
        };
      });
    for (const { body, x, y } of forces) {
      // Only cap the extra wind velocity: never erase a stronger recoil impulse.
      const add = (speed: number, a: number, cap: number) =>
        speed +
        Math.sign(a) * Math.max(0, Math.min(Math.abs(a) * dt * 60, cap - speed * Math.sign(a)));
      if (x || y)
        Matter.Body.setVelocity(body, {
          x: add(body.velocity.x, x, CROSSWIND.driftCap),
          y: add(body.velocity.y, y, CROSSWIND.liftCap),
        });
    }
  }
}
