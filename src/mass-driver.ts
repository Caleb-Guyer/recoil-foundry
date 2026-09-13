import Matter from 'matter-js';
import type { Enemy, Game, Shot } from './game.ts';
import type { Prop } from './props.ts';
import { clamp, type Vec } from './rules.ts';
import { isBoss } from './enemies.ts';
import { breakSquad } from './squads.ts';
import { dropWallcrawler } from './wallcrawler.ts';

const { Body } = Matter;
export const MASS_DRIVER = { radius: 7, life: 3.2, mass: 2.4, limit: 48, maxSpeed: 40 };
export interface MassFlight {
  age: number;
  spin: number;
  mass: number;
  struck: Set<number>;
  penetrating: Set<number>;
  surfaces: Set<number>;
}

// Swept projectiles exchange momentum with Matter bodies without adding rigid
// bodies to the solver. A ball cannot become a constraint under a train or lift.
export class MassDriverSystem {
  game: Game;
  private kicked = new Map<Enemy, number>();
  private airborne = new Map<Enemy, number>();
  private movingSurfaces = new Map<Matter.Body, Vec>();
  private frameScale = 1;
  private soundAt = -1;
  constructor(game: Game) {
    this.game = game;
  }
  get equipped() {
    return this.game.mods.includes('mass-driver');
  }
  reset() {
    this.kicked.clear();
    this.airborne.clear();
    this.movingSurfaces.clear();
    this.soundAt = -1;
    this.game.shots = this.game.shots.filter((s) => !s.massDriver);
  }
  prepare(s: Shot) {
    if (!this.equipped || !s.friendly || s.fragment || s.reflected || s.rail) return;
    s.massDriver = {
      age: 0,
      spin: 0,
      mass: MASS_DRIVER.mass / (this.game.gun.pellets * this.game.gun.lanes),
      struck: new Set(),
      penetrating: new Set(),
      surfaces: new Set(),
    };
    s.radius = MASS_DRIVER.radius;
    s.life = MASS_DRIVER.life;
    s.trace ??= { bank: true, pierce: s.pierce > 0, points: [{ ...s.pos }] };
  }
  staggered(e: Enemy) {
    return (this.airborne.get(e) ?? 0) > this.game.time;
  }
  beforeStep(dt: number) {
    this.movingSurfaces.clear();
    if (!this.equipped) return;
    this.frameScale = Math.max(0.001, dt * 60);
    for (const body of [...this.game.hazards.bodies, ...this.game.crossing.bodies])
      if (body.isStatic) this.movingSurfaces.set(body, { ...body.position });
  }
  private surfaceVelocity(body: Matter.Body | undefined, point: Vec): Vec {
    if (!body) return { x: 0, y: 0 };
    const previous = this.movingSurfaces.get(body);
    if (previous)
      return {
        x: (body.position.x - previous.x) / this.frameScale,
        y: (body.position.y - previous.y) / this.frameScale,
      };
    return {
      x: body.velocity.x - body.angularVelocity * (point.y - body.position.y),
      y: body.velocity.y + body.angularVelocity * (point.x - body.position.x),
    };
  }
  update(dt: number) {
    const g = this.game;
    const balls = g.shots.filter((s) => s.massDriver && s.life > 0);
    for (const s of balls.slice(0, Math.max(0, balls.length - MASS_DRIVER.limit)))
      this.finish(s, false);
    for (const s of balls) {
      if (s.life <= 0) continue;
      const m = s.massDriver!;
      for (const id of m.penetrating) {
        const e = g.enemies.find((e) => e.id === id);
        if (
          !e ||
          s.pos.x < Math.min(...e.body.vertices.map((v) => v.x)) - s.radius ||
          s.pos.x > Math.max(...e.body.vertices.map((v) => v.x)) + s.radius ||
          s.pos.y < Math.min(...e.body.vertices.map((v) => v.y)) - s.radius ||
          s.pos.y > Math.max(...e.body.vertices.map((v) => v.y)) + s.radius
        )
          m.penetrating.delete(id);
      }
      m.age += dt;
      if (m.age >= MASS_DRIVER.life || s.life <= dt) {
        this.finish(s);
        if (g.mode !== 'playing') return;
        continue;
      }
      const gravity = g.engine.gravity.scale * (1000 / 60) ** 2 * dt * 60;
      s.vel.x += g.engine.gravity.x * gravity;
      s.vel.y += g.engine.gravity.y * gravity;
      const speed = Math.hypot(s.vel.x, s.vel.y);
      if (speed > MASS_DRIVER.maxSpeed) {
        s.vel.x *= MASS_DRIVER.maxSpeed / speed;
        s.vel.y *= MASS_DRIVER.maxSpeed / speed;
      }
      m.spin += s.vel.x * dt * 2;
    }
    for (const [e, at] of this.kicked) if (e.hp <= 0 || at <= g.time) this.kicked.delete(e);
    for (const [e, at] of this.airborne) if (e.hp <= 0 || at <= g.time) this.airborne.delete(e);
  }
  private push(s: Shot, body: Matter.Body, normal: Vec, lift: boolean) {
    if (body.isStatic) return;
    const v = { ...body.velocity };
    const closing = Math.max(0, -((s.vel.x - v.x) * normal.x + (s.vel.y - v.y) * normal.y));
    const mass = s.massDriver!.mass;
    const impulse = Math.min(15, (closing * 2 * mass) / (mass + body.mass));
    Body.setVelocity(body, {
      x: clamp(v.x - normal.x * impulse, -18, 18),
      y: clamp(
        v.y - normal.y * impulse - (lift ? Math.abs(normal.x) * impulse * 0.22 : 0),
        -18,
        18,
      ),
    });
    return impulse;
  }
  hitProp(s: Shot, prop: Prop, normal: Vec) {
    const g = this.game;
    const before = { ...prop.body.velocity };
    // Loose machinery takes less structural damage so a deliberate bank can
    // launch it into another target. Anchored cover retains its normal durability.
    g.props.hit(prop, s.damage * (prop.body.isStatic || prop.charge ? 1 : 0.3), s.vel);
    if (prop.charge || prop.body.isStatic || !g.props.items.includes(prop)) return;
    Body.setVelocity(prop.body, before);
    const impulse = this.push(s, prop.body, normal, true) ?? 0;
    if (prop.kind !== 'cargo')
      Body.setAngularVelocity(
        prop.body,
        clamp(prop.body.angularVelocity - normal.x * impulse * 0.009, -0.18, 0.18),
      );
  }
  hitEnemy(s: Shot, e: Enemy, normal: Vec) {
    const g = this.game;
    if (
      e.hp <= 0 ||
      isBoss(e.kind) ||
      ['charger', 'scrapper', 'harpooner', 'borer'].includes(e.kind) ||
      (e.elite === 'volatile' && e.state === 'windup') ||
      (this.kicked.get(e) ?? -1) > g.time ||
      g.ballistics.pinned(e) ||
      g.salvageEvolutions.carried(e)
    )
      return;
    if (e.body.isStatic && !['shooter', 'sniper'].includes(e.kind)) return;
    this.kicked.set(e, g.time + 0.7);
    this.airborne.set(e, g.time + 0.24);
    breakSquad(g, e);
    dropWallcrawler(g, e);
    g.harpoons.disrupt(e.body);
    g.sappers.disrupt(e.body);
    if (e.angler) e.angler.plan = undefined;
    if (e.body.isStatic) Body.setStatic(e.body, false);
    e.state = 'recover';
    e.timer = Math.max(e.timer, 0.35);
    this.push(s, e.body, normal, true);
  }
  bounce(s: Shot, normal: Vec, body?: Matter.Body, bank = true) {
    if (s.bounces <= 0 || Math.hypot(s.vel.x, s.vel.y) < 2.2) {
      this.finish(s, true, body);
      return false;
    }
    const surface = this.surfaceVelocity(body, s.pos);
    const vx = s.vel.x - surface.x,
      vy = s.vel.y - surface.y;
    const dot = vx * normal.x + vy * normal.y;
    s.vel = {
      x: (vx - 1.82 * dot * normal.x) * 0.98 + surface.x,
      y: (vy - 1.82 * dot * normal.y) * 0.98 + surface.y,
    };
    const speed = Math.hypot(s.vel.x, s.vel.y);
    if (speed > MASS_DRIVER.maxSpeed) {
      s.vel.x *= MASS_DRIVER.maxSpeed / speed;
      s.vel.y *= MASS_DRIVER.maxSpeed / speed;
    }
    s.bounces--;
    if (bank) {
      s.banks++;
      s.damage *= 1 + s.bankGrowth;
      if (s.shell) s.shell.damage *= 1 + s.bankGrowth;
    }
    s.pos.x += normal.x * 0.75;
    s.pos.y += normal.y * 0.75;
    this.clang(s);
    return true;
  }
  private clang(s: Shot) {
    const g = this.game;
    g.burst(s.pos, 3, '#c7d0c8', 2);
    if (g.time >= this.soundAt) {
      g.onSound('mass-impact');
      this.soundAt = g.time + 0.08;
    }
  }
  finish(s: Shot, payload = true, body?: Matter.Body) {
    if (s.life <= 0) return;
    s.life = 0;
    this.game.burst(s.pos, 5, '#a4b2b3', 2.8);
    if (payload) this.game.demolition.impact(s, body);
    else s.shell = undefined;
  }
}
