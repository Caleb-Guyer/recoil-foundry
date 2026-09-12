import Matter from 'matter-js';
import type { Enemy, Game, Shot } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp, direction, distance } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { isBoss } from './enemies.ts';
import { breakSquad } from './squads.ts';
import { releaseScrapper } from './scrapper.ts';

const { Body, Events } = Matter;
export const TETHER_RANGE = 400;
export const TETHER_LIFE = 4;
export const TETHER_MARK_LIFE = 3;
export interface TetherLink {
  a: Enemy;
  b: Enemy;
  length: number;
  until: number;
  tension: number;
}
interface ThrownEnemy {
  enemy: Enemy;
  until: number;
  staggerUntil: number;
}

// One cable and at most two short-lived collision payloads. No constraints or
// positions are imposed on Matter: pulls change momentum before its solver.
export class TetherSystem {
  game: Game;
  mark: { enemy: Enemy; until: number } | null = null;
  link: TetherLink | null = null;
  thrown = new Map<number, ThrownEnemy>();
  effects: { a: Vec; b: Vec; at: number; snapped: boolean }[] = [];
  private velocities = new Map<Matter.Body, Vec>();
  private impacts: { enemy: Enemy; other: Matter.Body; speed: number }[] = [];
  private readyAt = 0;
  constructor(game: Game) {
    this.game = game;
    const contacts = (event: Matter.IEventCollision<Matter.Engine>) => {
      if (game.mode !== 'playing') return;
      for (const pair of event.pairs)
        for (const { enemy } of this.thrown.values()) {
          const a = pair.bodyA === enemy.body,
            b = pair.bodyB === enemy.body;
          if (!a && !b) continue;
          const other = a ? pair.bodyB : pair.bodyA;
          if (other.isSensor || other === game.player) continue;
          // Props already have their own impact damage and fuel ignition.
          if (
            !game.terrainBodies.includes(other) &&
            !game.enemies.some((e) => e.body === other && e.spawn <= 0)
          )
            continue;
          const v = this.velocities.get(enemy.body),
            w = this.velocities.get(other) ?? other.velocity;
          if (!v) continue;
          const n = pair.collision.normal;
          const speed = ((v.x - w.x) * n.x + (v.y - w.y) * n.y) * (a ? -1 : 1);
          if (speed > 4) this.impacts.push({ enemy, other, speed });
        }
    };
    Events.on(game.engine, 'collisionStart', contacts);
    Events.on(game.engine, 'collisionActive', contacts);
  }
  reset() {
    this.mark = this.link = null;
    this.thrown.clear();
    this.effects = [];
    this.velocities.clear();
    this.impacts = [];
    this.readyAt = 0;
  }
  private alive(e: Enemy) {
    return e.hp > 0 && e.spawn <= 0 && this.game.enemies.includes(e);
  }
  private movable(e: Enemy) {
    const pin = this.game.ballistics.pins.get(e.id);
    return !isBoss(e.kind) && !e.body.isStatic && !(pin && pin.until > this.game.time);
  }
  clearPath(a: Enemy, b: Enemy) {
    return !firstSolid(a.body.position, b.body.position, { x: 1, y: 1 }, this.game.solidBodies);
  }
  hit(e: Enemy, s: Shot) {
    const g = this.game;
    if (
      g.mode !== 'playing' ||
      !g.mods.includes('tether') ||
      !(s.damage > 0) ||
      !s.friendly ||
      s.fragment ||
      s.echo ||
      s.reflected ||
      !this.alive(e)
    )
      return;
    this.validate();
    if (this.link || g.time < this.readyAt) return;
    const a = this.mark?.enemy;
    if (a === e) return;
    if (
      a &&
      distance(a.body.position, e.body.position) <= TETHER_RANGE &&
      this.clearPath(a, e) &&
      (this.movable(a) || this.movable(e))
    ) {
      this.link = {
        a,
        b: e,
        length: Math.max(70, distance(a.body.position, e.body.position)),
        until: g.time + TETHER_LIFE,
        tension: 0,
      };
      this.mark = null;
      g.onSound('tether-link');
    } else {
      this.mark = { enemy: e, until: g.time + TETHER_MARK_LIFE };
      g.onSound('tether-mark');
    }
  }
  disrupt(body: Matter.Body) {
    if (this.mark?.enemy.body === body) this.mark = null;
    if (this.link && (this.link.a.body === body || this.link.b.body === body)) this.release(false);
    for (const [id, item] of this.thrown) if (item.enemy.body === body) this.thrown.delete(id);
  }
  staggered(e: Enemy) {
    return (this.thrown.get(e.id)?.staggerUntil ?? 0) > this.game.time;
  }
  private validate() {
    const g = this.game;
    if (this.mark && (!this.alive(this.mark.enemy) || g.time >= this.mark.until)) this.mark = null;
    const l = this.link;
    if (
      l &&
      (!this.alive(l.a) ||
        !this.alive(l.b) ||
        g.time >= l.until ||
        distance(l.a.body.position, l.b.body.position) > 640 ||
        !this.clearPath(l.a, l.b))
    )
      this.release(false);
    for (const [id, item] of this.thrown)
      if (!this.alive(item.enemy) || item.until <= g.time) this.thrown.delete(id);
    this.effects = this.effects.filter((f) => g.time - f.at < 0.18);
  }
  private pull(l: TetherLink, impulse: number) {
    const a = l.a.body,
      b = l.b.body,
      d = direction(a.position, b.position);
    const ai = this.movable(l.a) ? 1 / a.mass : 0,
      bi = this.movable(l.b) ? 1 / b.mass : 0;
    if (ai + bi === 0) return;
    const momentum = impulse / (ai + bi);
    for (const [body, inv, sign] of [
      [a, ai, 1],
      [b, bi, -1],
    ] as const) {
      if (!inv) continue;
      Body.setVelocity(body, {
        x: clamp(body.velocity.x + d.x * momentum * inv * sign, -18, 18),
        y: clamp(body.velocity.y + d.y * momentum * inv * sign, -18, 18),
      });
    }
  }
  private release(snapped: boolean) {
    const l = this.link,
      g = this.game;
    if (!l) return;
    this.link = null;
    this.readyAt = g.time + (snapped ? 0.8 : 0.2);
    this.effects.push({
      a: { ...l.a.body.position },
      b: { ...l.b.body.position },
      at: g.time,
      snapped,
    });
    if (this.effects.length > 2) this.effects.shift();
    if (!snapped) return;
    const d = direction(l.a.body.position, l.b.body.position);
    const separating =
      (l.b.body.velocity.x - l.a.body.velocity.x) * d.x +
      (l.b.body.velocity.y - l.a.body.velocity.y) * d.y;
    this.pull(l, Math.max(0, separating) + 22);
    for (const e of [l.a, l.b])
      if (this.movable(e)) {
        breakSquad(g, e);
        releaseScrapper(g, e);
        g.harpoons.disrupt(e.body);
        g.sappers.disrupt(e.body);
        // A brief physical stagger prevents steering from erasing the yank on
        // the next frame. Warned volatile detonations keep their own clock.
        this.thrown.set(e.id, {
          enemy: e,
          until: g.time + 0.8,
          staggerUntil: e.elite === 'volatile' ? g.time : g.time + 0.45,
        });
        if (e.elite !== 'volatile') {
          e.state = 'recover';
          e.timer = Math.max(e.timer, 0.4);
        }
      }
    g.onSound('tether-snap');
    g.feedback(2);
  }
  beforeStep(dt: number) {
    const g = this.game;
    this.impacts = [];
    this.velocities.clear();
    if (g.mode !== 'playing' || g.hitStop > 0) return;
    this.validate();
    const l = this.link;
    if (l) {
      const span = distance(l.a.body.position, l.b.body.position),
        extension = Math.max(0, span - l.length);
      l.tension = clamp(extension / Math.max(48, l.length * 0.25), 0, 1);
      if (l.tension >= 1 && g.mods.includes('snapback')) this.release(true);
      else if (extension > 0) {
        const d = direction(l.a.body.position, l.b.body.position);
        const separating =
          (l.b.body.velocity.x - l.a.body.velocity.x) * d.x +
          (l.b.body.velocity.y - l.a.body.velocity.y) * d.y;
        this.pull(l, clamp(extension * 0.065 + Math.max(0, separating) * 0.5, 0, 8) * dt * 60);
      }
    }
    if (this.thrown.size)
      for (const b of Matter.Composite.allBodies(g.engine.world))
        this.velocities.set(b, { ...b.velocity });
  }
  afterStep() {
    const g = this.game;
    if (g.mode !== 'playing') return;
    this.validate();
    const damage = new Map<Enemy, { amount: number; from: Vec }>();
    for (const hit of this.impacts) {
      if (!this.thrown.has(hit.enemy.id)) continue;
      this.thrown.delete(hit.enemy.id);
      const other = g.enemies.find((e) => e.body === hit.other && this.alive(e));
      const amount = clamp(20 + hit.speed * 2, 28, 64);
      for (const [e, from] of [
        [hit.enemy, hit.other.position],
        [other, hit.enemy.body.position],
      ] as const) {
        if (!e || !this.alive(e)) continue;
        if ((damage.get(e)?.amount ?? 0) < amount) damage.set(e, { amount, from: { ...from } });
      }
    }
    this.impacts = [];
    for (const [e, hit] of damage) {
      if (g.mode !== 'playing') break;
      g.hitEnemy(e, hit.amount, hit.from);
    }
  }
}
