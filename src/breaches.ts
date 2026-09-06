import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level, Solid } from './levels.ts';
import { breachPlacement } from './breach-layout.ts';
import type { BreachPlacement } from './breach-layout.ts';
import { clamp, direction, distance, seeded, segmentBox } from './rules.ts';
import type { Vec } from './rules.ts';

const { Bodies, Composite } = Matter;
export const PANEL_HP = 48;
export const PICKUP_HEAL = 18;
export const DEBRIS_LIMIT = 48;
export interface BreachPanel {
  body: Matter.Body;
  rect: Solid;
  hp: number;
  maxHp: number;
  flash: number;
}
export interface BreachDebris {
  pos: Vec;
  vel: Vec;
  angle: number;
  spin: number;
  w: number;
  h: number;
  life: number;
  max: number;
}

export class BreachSystem {
  game: Game;
  placement: BreachPlacement | null = null;
  supports: Matter.Body[] = [];
  panels: BreachPanel[] = [];
  pickup: Vec | null = null;
  debris: BreachDebris[] = [];
  constructor(game: Game) {
    this.game = game;
  }
  get bodies() {
    return [...this.supports, ...this.panels.map((p) => p.body)];
  }
  clear() {
    for (const body of this.bodies) Composite.remove(this.game.engine.world, body);
    this.supports = [];
    this.panels = [];
    this.pickup = null;
    this.debris = [];
    this.placement = null;
  }
  reset(level: Level, seed: string, stage: number) {
    this.clear();
    this.placement = breachPlacement(level, seed, stage);
    if (!this.placement) return;
    for (const s of this.placement.solids) {
      const body = Bodies.rectangle(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, {
        isStatic: true,
        friction: 0.65,
        label: 'vent-frame',
      });
      this.supports.push(body);
      Composite.add(this.game.engine.world, body);
    }
    for (const s of this.placement.panels) this.spawnPanel(s);
    this.pickup = this.placement.pickup ? { ...this.placement.pickup } : null;
  }
  spawnPanel(rect: Solid): BreachPanel {
    const body = Bodies.rectangle(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, {
      isStatic: true,
      friction: 0.65,
      label: 'cracked-panel',
    });
    const panel = { body, rect: { ...rect }, hp: PANEL_HP, maxHp: PANEL_HP, flash: 0 };
    this.panels.push(panel);
    Composite.add(this.game.engine.world, body);
    return panel;
  }
  hitBody(body: Matter.Body | undefined, damage: number, velocity: Vec) {
    const panel = this.panels.find((p) => p.body === body);
    if (panel) this.hit(panel, damage, velocity);
  }
  hit(panel: BreachPanel, damage: number, velocity: Vec) {
    const g = this.game;
    if (g.mode !== 'playing' || !this.panels.includes(panel) || !(damage > 0)) return;
    panel.hp -= damage;
    panel.flash = 0.08;
    g.onSound('prop');
    if (panel.hp > 0) return;
    Composite.remove(g.engine.world, panel.body);
    this.panels = this.panels.filter((p) => p !== panel);
    const { x, y, w, h } = panel.rect,
      horizontal = w > h,
      d = direction({ x: 0, y: 0 }, velocity),
      rng = seeded(g.seed + ':debris:' + g.stage + ':' + x + ':' + y),
      count = 7;
    for (let i = 0; i < count; i++) {
      const max = 0.8 + rng() * 0.5;
      this.debris.push({
        pos: {
          x: x + w * (horizontal ? (i + 0.5) / count : 0.5),
          y: y + h * (horizontal ? 0.5 : (i + 0.5) / count),
        },
        vel: {
          x: d.x * (3 + rng() * 4) + (rng() - 0.5) * 3,
          y: d.y * (3 + rng() * 4) - 1.5 - rng() * 2,
        },
        angle: (rng() - 0.5) * 0.4,
        spin: (rng() - 0.5) * 0.3,
        w: horizontal ? w / count - 2 : w * 0.8,
        h: horizontal ? h * 0.8 : h / count - 2,
        life: max,
        max,
      });
    }
    this.debris = this.debris.slice(-DEBRIS_LIMIT);
    g.feedback(2.2);
    g.onSound('breach');
  }
  // Select all targets before damage so one blast cannot pass through its own breach.
  targets(origin: Vec, radius: number, accept: (target: Vec) => boolean = () => true) {
    return this.panels.filter(
      ({ body }) =>
        distance(origin, body.position) <= radius &&
        accept(body.position) &&
        distance(this.game.lineEnd(origin, body.position, 0, body), body.position) < 0.1,
    );
  }
  hitAlong(start: Vec, end: Vec, impact: Vec, damage: number, velocity: Vec) {
    for (const panel of this.panels) {
      const hit = segmentBox(start, end, panel.body.bounds.min, panel.body.bounds.max);
      if (hit && Math.abs(distance(start, impact) - distance(start, end) * hit.t) < 0.1) {
        this.hit(panel, damage, velocity);
        return;
      }
    }
  }
  update(dt: number) {
    const g = this.game;
    if (g.mode !== 'playing' || g.hitStop > 0) return;
    for (const panel of this.panels) panel.flash = Math.max(0, panel.flash - dt);
    this.debris = this.debris.filter((piece) => {
      piece.life -= dt;
      piece.pos.x += piece.vel.x * dt * 60;
      piece.pos.y += piece.vel.y * dt * 60;
      piece.vel.y += dt * 17;
      piece.angle += piece.spin * dt * 60;
      return piece.life > 0;
    });
    const pickup = this.pickup;
    if (!pickup || g.hp >= 100 || g.hp <= 0) return;
    const p = g.player.position;
    if (Math.abs(p.x - pickup.x) > 23 || Math.abs(p.y - pickup.y) > 27) return;
    if (distance(g.lineEnd(p, pickup), pickup) > 0.1) return;
    this.pickup = null;
    g.hp = clamp(g.hp + PICKUP_HEAL, 0, 100);
    g.burst(pickup, 9, '#a1d6bc', 1.5);
    g.onSound('mend');
    g.onChange();
  }
}
