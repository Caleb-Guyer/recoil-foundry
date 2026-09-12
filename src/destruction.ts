import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Solid } from './levels.ts';
import type { Vec } from './rules.ts';
import { clamp, direction, distance, seeded, segmentBox } from './rules.ts';
import { breakableSolids } from './destruction-layout.ts';
import { closestBlastPoint } from './demolition.ts';

const { Body, Composite, Events, Query } = Matter;
export const WALL_HP = 110;
export const LEDGE_HP = 66;
export const RUBBLE_LIMIT = 12;
export const RUBBLE_LIFE = 2.4;
export interface Breakable {
  body: Matter.Body;
  rect: Solid;
  hp: number;
  maxHp: number;
  flash: number;
  hits: Map<number, number>;
}

export class DestructionSystem {
  game: Game;
  pieces: Breakable[] = [];
  broken: Solid[] = [];
  private contacts: { piece: Breakable; actor: Matter.Body; normal: Vec }[] = [];
  private velocities = new Map<Matter.Body, Vec>();
  constructor(game: Game) {
    this.game = game;
    Events.on(game.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const piece = this.pieces.find((p) => p.body === pair.bodyA || p.body === pair.bodyB);
        if (piece)
          this.contacts.push({
            piece,
            actor: pair.bodyA === piece.body ? pair.bodyB : pair.bodyA,
            normal: pair.collision.normal,
          });
      }
    });
  }
  clear() {
    this.pieces = [];
    this.broken = [];
    this.contacts = [];
    this.velocities.clear();
  }
  reset() {
    this.clear();
    const g = this.game;
    if (g.escape) return;
    for (const rect of breakableSolids(g.level, g.layoutSeed, g.stage)) {
      // Keep any shelf that holds a belt, hanging load, or hidden passage.
      if (
        g.conveyors.items.some((b) => b.y === rect.y && b.x < rect.x + rect.w && b.x + b.w > rect.x)
      )
        continue;
      if (
        g.cargo.items.some(
          (p) =>
            p.cargo &&
            Math.abs(p.cargo.anchor.y - rect.y - rect.h) < 2 &&
            p.body.position.x >= rect.x &&
            p.body.position.x <= rect.x + rect.w,
        )
      )
        continue;
      if (
        g.breaches.bodies.some(
          (b) =>
            b.bounds.max.x > rect.x &&
            b.bounds.min.x < rect.x + rect.w &&
            Math.abs(b.bounds.max.y - rect.y) < 18,
        )
      )
        continue;
      const body = g.terrain.find(
        (b) =>
          Math.abs(b.bounds.min.x - rect.x) < 0.1 &&
          Math.abs(b.bounds.min.y - rect.y) < 0.1 &&
          Math.abs(b.bounds.max.x - rect.x - rect.w) < 0.1,
      );
      if (body) this.register(body, rect);
    }
  }
  register(body: Matter.Body, rect: Solid) {
    const hp = rect.h <= 28 ? LEDGE_HP : WALL_HP;
    const piece: Breakable = { body, rect: { ...rect }, hp, maxHp: hp, flash: 0, hits: new Map() };
    this.pieces.push(piece);
    return piece;
  }
  hitBody(body: Matter.Body | undefined, damage: number, velocity: Vec) {
    const piece = this.pieces.find((p) => p.body === body);
    if (!piece || this.game.mode !== 'playing' || !Number.isFinite(damage) || damage <= 0) return;
    piece.hp -= damage;
    piece.flash = 0.07;
    this.game.onSound('prop');
    if (piece.hp <= 0) this.break(piece, velocity);
  }
  hitAlong(start: Vec, end: Vec, impact: Vec, damage: number, velocity: Vec, padding = 0) {
    for (const p of this.pieces) {
      const { min, max } = p.body.bounds;
      const hit = segmentBox(
        start,
        end,
        { x: min.x - padding, y: min.y - padding },
        { x: max.x + padding, y: max.y + padding },
      );
      if (hit && Math.abs(distance(start, impact) - distance(start, end) * hit.t) < 0.1) {
        this.hitBody(p.body, damage, velocity);
        return;
      }
    }
  }
  targets(origin: Vec, radius: number, accept: (point: Vec) => boolean = () => true) {
    return this.pieces.filter((p) => {
      const point = closestBlastPoint(origin, p.body);
      return (
        distance(origin, point) <= radius &&
        accept(point) &&
        distance(this.game.lineEnd(origin, point, 0, p.body), point) < 0.1
      );
    });
  }
  break(piece: Breakable, velocity: Vec) {
    const g = this.game;
    if (g.mode !== 'playing' || !this.pieces.includes(piece)) return;
    const rect = piece.rect;
    Composite.remove(g.engine.world, piece.body);
    g.sappers.disrupt(piece.body);
    g.terrain = g.terrain.filter((b) => b !== piece.body);
    this.pieces = this.pieces.filter((p) => p !== piece);
    this.broken.push(rect);
    g.level.solids = g.level.solids.filter(
      (s) => !(s.x === rect.x && s.y === rect.y && s.w === rect.w && s.h === rect.h),
    );
    g.level.route = g.level.route.map((p) => {
      if (p.x < rect.x || p.x > rect.x + rect.w || Math.abs(p.y + 20 - rect.y) > 12) return p;
      const floor = Math.min(
        740,
        ...g.level.solids
          .filter((s) => s.x <= p.x && s.x + s.w >= p.x && s.y >= rect.y)
          .map((s) => s.y),
      );
      return { ...p, y: floor - 20 };
    });
    // A destroyed portal host must disappear without refunding placement uses.
    g.portals.pair = g.portals.pair.map((p) =>
      p?.body === piece.body ? null : p,
    ) as typeof g.portals.pair;
    for (const [id, pin] of g.ballistics.pins)
      if (pin.surface === piece.body) g.ballistics.pins.delete(id);
    for (const shell of g.ballistics.shells) if (shell.body === piece.body) shell.body = undefined;
    this.releaseUnsupported();
    const d = direction({ x: 0, y: 0 }, velocity);
    const rng = seeded(g.roomSeed + ':rubble:' + rect.x + ':' + rect.y);
    for (let i = 0; i < 3; i++) {
      const x = rect.x + (rect.w * (i + 1)) / 4,
        y = rect.y + Math.min(rect.h / 2, 35);
      const hull = { min: { x: x - 14, y: y - 10 }, max: { x: x + 14, y: y + 10 } };
      if (Query.region([...g.solidBodies, g.player, ...g.enemies.map((e) => e.body)], hull).length)
        continue;
      const rubble = g.props.items.filter((p) => p.kind === 'rubble');
      if (rubble.length >= RUBBLE_LIMIT) g.props.remove(rubble[0]);
      const chunk = g.props.spawn('rubble', x, y);
      chunk.expires = g.time + RUBBLE_LIFE;
      Body.setVelocity(chunk.body, {
        x: d.x * 2 + (rng() - 0.5) * 2,
        y: Math.max(0, d.y) * 2 + rng(),
      });
      Body.setAngularVelocity(chunk.body, (rng() - 0.5) * 0.1);
    }
    g.burst(piece.body.position, 9, '#9dabaa', 3);
    g.feedback(2.5);
    g.onSound('break');
  }
  releaseUnsupported() {
    const g = this.game;
    const removedFooting = (body: Matter.Body) =>
      this.broken.some(
        (r) =>
          body.bounds.max.x > r.x &&
          body.bounds.min.x < r.x + r.w &&
          Math.abs(body.bounds.max.y - r.y) < 6,
      );
    for (const e of g.enemies) {
      if (
        (e.kind === 'shooter' || e.kind === 'sniper') &&
        e.body.isStatic &&
        removedFooting(e.body)
      )
        Body.setStatic(e.body, false);
    }
    for (const p of g.props.items)
      if (p.kind === 'cover' && p.body.isStatic && removedFooting(p.body))
        Body.setStatic(p.body, false);
  }
  beforeStep() {
    this.contacts = [];
    this.velocities.clear();
    for (const e of this.game.enemies)
      if (e.spawn <= 0) {
        this.velocities.set(e.body, { ...e.body.velocity });
        if (e.crane) this.velocities.set(e.crane.body, { ...e.crane.body.velocity });
      }
    // Suspended cargo owns its impact damage and cooldown in CargoSystem.
    for (const p of this.game.props.items)
      if (p.kind === 'crate') this.velocities.set(p.body, { ...p.body.velocity });
  }
  afterStep(dt: number) {
    const g = this.game;
    for (const p of this.pieces) p.flash = Math.max(0, p.flash - dt);
    for (const { piece, actor, normal } of this.contacts) {
      const v = this.velocities.get(actor);
      if (!v || !this.pieces.includes(piece)) continue;
      const speed = Math.abs(v.x * normal.x + v.y * normal.y);
      if (speed < 7 || g.time - (piece.hits.get(actor.id) ?? -10) < 0.4) continue;
      piece.hits.set(actor.id, g.time);
      this.hitBody(piece.body, clamp(speed * 10, 70, 160), v);
    }
    this.contacts = [];
    this.releaseUnsupported();
  }
}
