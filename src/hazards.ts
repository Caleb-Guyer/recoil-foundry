import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level } from './levels.ts';
import { hazardPlacement } from './hazard-layouts.ts';
import type { HazardKind, HazardPlacement } from './hazard-layouts.ts';

const { Bodies, Body, Composite } = Matter;
export const LIFT_PERIOD = 8;
export const CRUSHER_TELL = 1.1;
export const CRUSHER_REST = 0.8;
export const CRUSHER_SPEED = 1050;
export const CRUSHER_RETURN_SPEED = 130;
export const CRUMBLE_TELL = 0.7;
export const CRUMBLE_RESET = 3.5;
export interface Hazard {
  kind: HazardKind;
  placement: HazardPlacement;
  body: Matter.Body;
  state: 'idle' | 'warning' | 'falling' | 'rest' | 'returning' | 'gone';
  timer: number;
  phase: number;
  visible: boolean;
  hits: Set<number>;
  permanent?: boolean;
}

// Read actual hulls: Matter's cached bounds can include velocity padding.
function hull(body: Matter.Body) {
  return {
    left: Math.min(...body.vertices.map((v) => v.x)),
    right: Math.max(...body.vertices.map((v) => v.x)),
    top: Math.min(...body.vertices.map((v) => v.y)),
    bottom: Math.max(...body.vertices.map((v) => v.y)),
  };
}
function overlaps(a: ReturnType<typeof hull>, b: ReturnType<typeof hull>, pad = 0) {
  return (
    a.right + pad > b.left &&
    a.left - pad < b.right &&
    a.bottom + pad > b.top &&
    a.top - pad < b.bottom
  );
}

export class HazardSystem {
  game: Game;
  items: Hazard[] = [];
  constructor(game: Game) {
    this.game = game;
  }
  get bodies() {
    return this.items.filter((h) => h.visible).map((h) => h.body);
  }
  clear() {
    for (const h of this.items) Composite.remove(this.game.engine.world, h.body);
    this.items = [];
  }
  reset(level: Level, seed: string, stage: number) {
    this.clear();
    if (level.detour) {
      for (const placement of level.hazards ?? []) this.spawn(placement);
      return;
    }
    const placement = hazardPlacement(level, seed, stage);
    if (placement) this.spawn(placement);
  }
  spawn(placement: HazardPlacement): Hazard {
    const { kind, x, y, w, h } = placement;
    const body = Bodies.rectangle(x, y + h / 2, w, h, {
      isStatic: true,
      friction: 0.5,
      label: 'hazard',
    });
    const hazard: Hazard = {
      kind,
      placement: { ...placement },
      body,
      state: 'idle',
      timer: 0,
      phase: 0,
      visible: true,
      hits: new Set(),
    };
    this.items.push(hazard);
    Composite.add(this.game.engine.world, body);
    return hazard;
  }
  actors() {
    return [this.game.player, ...this.game.enemies.map((e) => e.body), ...this.game.props.bodies];
  }
  supported(actor: Matter.Body, platform: Matter.Body) {
    const a = hull(actor),
      b = hull(platform);
    return (
      actor.velocity.y >= -0.1 &&
      Math.abs(a.bottom - b.top) < 4 &&
      a.right > b.left + 3 &&
      a.left < b.right - 3
    );
  }
  movePlatform(h: Hazard, top: number) {
    const dy = top - (h.body.position.y - h.placement.h / 2);
    const actors = this.actors().filter((b) => !b.isStatic);
    const riders = actors.filter((b) => this.supported(b, h.body));
    // Carry the whole supported stack, including a player standing on a crate.
    for (let i = 0; i < riders.length; i++)
      for (const actor of actors)
        if (!riders.includes(actor) && this.supported(actor, riders[i])) riders.push(actor);
    // A moved crate or a fixture ceiling must never squeeze a rider through solid cover.
    if (
      riders.some((rider) => {
        const b = hull(rider),
          moved = { ...b, top: b.top + dy, bottom: b.bottom + dy };
        return this.game.solidBodies.some(
          (solid) =>
            solid !== h.body &&
            solid !== rider &&
            !riders.includes(solid) &&
            overlaps(moved, hull(solid), -0.5),
        );
      })
    )
      return false;
    for (const rider of riders)
      Body.setPosition(rider, { x: rider.position.x, y: rider.position.y + dy });
    Body.setPosition(h.body, { x: h.placement.x, y: top + h.placement.h / 2 });
    return true;
  }
  beforeStep(dt: number) {
    const g = this.game;
    if (g.mode !== 'playing') return;
    for (const h of this.items) {
      if (h.kind === 'lift') {
        const phase = (h.phase + dt) % LIFT_PERIOD;
        const top =
          h.placement.y -
          (h.placement.travel * (1 - Math.cos((phase * Math.PI * 2) / LIFT_PERIOD))) / 2;
        if (this.movePlatform(h, top)) h.phase = phase;
      } else if (h.kind === 'crumble') this.updateCrumble(h, dt);
      else this.updateCrusher(h, dt);
      if (g.mode !== 'playing') return;
    }
  }
  afterStep(_dt: number) {
    if (this.game.mode !== 'playing') return;
    for (const h of this.items) {
      if (h.kind === 'crumble' && h.state === 'idle' && this.supported(this.game.player, h.body)) {
        h.state = 'warning';
        h.timer = CRUMBLE_TELL;
        this.game.onSound('strain');
      }
    }
  }
  updateCrumble(h: Hazard, dt: number) {
    if (h.state === 'warning') {
      h.timer = Math.max(0, h.timer - dt);
      if (h.timer <= 0) {
        h.state = 'gone';
        h.timer = CRUMBLE_RESET;
        h.visible = false;
        Composite.remove(this.game.engine.world, h.body);
        this.game.burst(h.body.position, 10, '#9eaaa8', 2.5);
        this.game.onSound('break');
      }
    } else if (h.state === 'gone' && !h.permanent) {
      h.timer = Math.max(0, h.timer - dt);
      if (h.timer <= 0 && !this.actors().some((actor) => overlaps(hull(actor), hull(h.body), 6))) {
        h.visible = true;
        h.state = 'idle';
        Composite.add(this.game.engine.world, h.body);
        this.game.onSound('prop');
      }
    }
  }
  updateCrusher(h: Hazard, dt: number) {
    const g = this.game,
      p = h.placement;
    const top = h.body.position.y - p.h / 2;
    if (h.state === 'idle') {
      const player = hull(g.player);
      if (
        Math.abs(g.player.position.x - p.x) < p.w / 2 + 72 &&
        player.bottom > p.y + p.h &&
        player.top < p.y + p.h + p.travel
      ) {
        h.state = 'warning';
        h.timer = CRUSHER_TELL;
        h.hits.clear();
        g.onSound('machine');
      }
    } else if (h.state === 'warning') {
      h.timer = Math.max(0, h.timer - dt);
      if (h.timer <= 0) {
        h.state = 'falling';
        g.onSound('press');
      }
    } else if (h.state === 'falling') {
      let next = Math.min(p.y + p.travel, top + CRUSHER_SPEED * dt);
      // Runtime cover may be introduced by a fixture or later room editing.
      // The slab stops on it, keeping actors under that cover protected.
      for (const solid of g.terrain) {
        const b = hull(solid);
        if (b.left < p.x + p.w / 2 && b.right > p.x - p.w / 2 && b.top >= top + p.h - 0.5)
          next = Math.min(next, b.top - p.h);
      }
      next = this.crush(h, top + p.h, next + p.h) - p.h;
      if (g.mode !== 'playing') return;
      this.movePlatform(h, next);
      if (next >= p.y + p.travel - 0.1 || next < top + CRUSHER_SPEED * dt - 0.1) {
        h.state = 'rest';
        h.timer = CRUSHER_REST;
        g.feedback(5);
        g.burst({ x: p.x, y: next + p.h }, 16, '#bfa185', 3.5);
        g.onSound('slam');
      }
    } else if (h.state === 'rest') {
      h.timer = Math.max(0, h.timer - dt);
      if (h.timer <= 0) h.state = 'returning';
    } else if (h.state === 'returning') {
      const next = Math.max(p.y, top - CRUSHER_RETURN_SPEED * dt);
      if (this.movePlatform(h, next) && next <= p.y) {
        h.state = 'idle';
        h.timer = 0;
      }
    }
  }
  crush(h: Hazard, oldBottom: number, newBottom: number) {
    const g = this.game,
      p = h.placement;
    const swept = {
      left: p.x - p.w / 2,
      right: p.x + p.w / 2,
      top: oldBottom - 0.5,
      bottom: newBottom,
    };
    let stopAt = newBottom;
    const hit = (b: Matter.Body) =>
      !h.hits.has(b.id) && overlaps(hull(b), { ...swept, bottom: stopAt });
    const blocked = (b: Matter.Body) => {
      stopAt = Math.min(stopAt, Math.max(oldBottom, hull(b).top));
    };
    if (hit(g.player)) {
      h.hits.add(g.player.id);
      g.damagePlayer(24, h.body.position);
      if (g.mode !== 'playing') return oldBottom;
      if (!this.pushAside(h, g.player)) blocked(g.player);
    }
    for (const e of [...g.enemies]) {
      if (e.spawn > 0 || e.hp <= 0 || !hit(e.body)) continue;
      h.hits.add(e.body.id);
      g.hitEnemy(e, 60);
      if (e.hp > 0 && (e.body.isStatic || !this.pushAside(h, e.body))) blocked(e.body);
    }
    for (const prop of [...g.props.items]) {
      if (!hit(prop.body)) continue;
      h.hits.add(prop.body.id);
      if (prop.kind === 'canister') g.props.explode(prop);
      else {
        g.props.hit(prop, 90, { x: 0, y: 1 });
        if (g.props.items.includes(prop) && (prop.body.isStatic || !this.pushAside(h, prop.body)))
          blocked(prop.body);
      }
      if (g.mode !== 'playing') return oldBottom;
    }
    return stopAt;
  }
  pushAside(h: Hazard, actor: Matter.Body) {
    const b = hull(actor),
      p = h.placement;
    const first = Math.sign(actor.position.x - p.x) || Math.sign(actor.velocity.x) || 1;
    for (const sign of [first, -first]) {
      const x = p.x + sign * (p.w / 2 + (b.right - b.left) / 2 + 4),
        dx = x - actor.position.x;
      const moved = { ...b, left: b.left + dx, right: b.right + dx };
      const path = {
        ...moved,
        left: Math.min(b.left, moved.left),
        right: Math.max(b.right, moved.right),
      };
      if (
        this.game.solidBodies.some(
          (solid) => solid !== h.body && solid !== actor && overlaps(path, hull(solid), -0.5),
        )
      )
        continue;
      Body.setPosition(actor, { x, y: actor.position.y });
      Body.setVelocity(actor, { x: sign * 6, y: Math.min(-3, actor.velocity.y) });
      return true;
    }
    return false;
  }
}
