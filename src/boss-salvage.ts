import Matter from 'matter-js';
import type { Enemy, Game, Shot } from './game.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { isBoss } from './enemies.ts';

const { Body, Query, Composite } = Matter;
export const CINDER_LIFE = 1.3;
export const CINDER_LIMIT = 20;
export const WIND_LIFE = 0.18;
export const WIND_LIMIT = 40;
export interface Cinder {
  body: Matter.Body;
  local: Vec;
  normal: Vec;
  pos: Vec;
  outward: Vec;
  until: number;
}
export interface Gust {
  a: Vec;
  b: Vec;
  id: number;
  at: number;
}
const rotate = (v: Vec, a: number): Vec => ({
  x: v.x * Math.cos(a) - v.y * Math.sin(a),
  y: v.x * Math.sin(a) + v.y * Math.cos(a),
});
const primary = (s: Shot) => s.friendly && !s.fragment && !s.echo && !s.reflected;
function closest(a: Vec, b: Vec, p: Vec): Vec {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

export class BossSalvageSystem {
  game: Game;
  cinders: Cinder[] = [];
  gusts: Gust[] = [];
  ramUntil = -1;
  ramDirection: Vec = { x: 0, y: 0 };
  private ramHits = new Map<number, number>();
  private ramSeparation = new Map<number, number>();
  private bends = new Map<number, number>();
  private burnAt = 0;
  private before: { pos: Vec; velocity: Vec } | null = null;
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.cinders = [];
    this.gusts = [];
    this.ramUntil = -1;
    this.ramHits.clear();
    this.ramSeparation.clear();
    this.bends.clear();
    this.burnAt = 0;
    this.before = null;
  }
  launch(dir: Vec, impulse: number) {
    const g = this.game;
    if (g.mods.includes('ramjet') && !g.grounded && impulse >= 2) {
      this.ramUntil = g.time + 0.4;
      this.ramDirection = { x: -dir.x, y: -dir.y };
    }
  }
  get ramReady() {
    const g = this.game,
      v = g.player.velocity;
    return (
      g.mods.includes('ramjet') &&
      g.time <= this.ramUntil &&
      Math.hypot(v.x, v.y) >= 10 &&
      v.x * this.ramDirection.x + v.y * this.ramDirection.y >= 8
    );
  }
  // Returns true only when this impact replaces ordinary small-enemy contact.
  ram(e: Enemy, velocity = this.game.player.velocity, from = this.game.player.position) {
    const g = this.game;
    const away = direction(g.player.position, e.body.position);
    // Matter can retain a shallow contact for a frame after the bounce. Only
    // that same ordinary enemy is safe while the player is separating.
    if (
      (this.ramSeparation.get(e.id) ?? -1) >= g.time &&
      !isBoss(e.kind) &&
      e.state !== 'rush' &&
      velocity.x * away.x + velocity.y * away.y <= 0
    )
      return true;
    if (
      !g.mods.includes('ramjet') ||
      g.time > this.ramUntil ||
      e.spawn > 0 ||
      e.hp <= 0 ||
      (this.ramHits.get(e.id) ?? -1) > g.time ||
      Math.hypot(velocity.x, velocity.y) < 10 ||
      velocity.x * this.ramDirection.x + velocity.y * this.ramDirection.y < 8
    )
      return false;
    const d = direction(from, e.body.position);
    const closing = velocity.x * d.x + velocity.y * d.y;
    if (closing < 8 || firstSolid(from, e.body.position, { x: 0, y: 0 }, g.solidBodies))
      return false;
    this.ramHits.set(e.id, g.time + 0.65);
    const boss = isBoss(e.kind);
    const blocked = g.hitEnemy(e, clamp((closing - 7) * 7, 18, 90) * (boss ? 0.2 : 1), from);
    const protectedImpact = !boss && !blocked && e.elite !== 'volatile' && e.state !== 'rush';
    if (protectedImpact) {
      this.ramSeparation.set(e.id, g.time + 0.12);
      Body.setVelocity(g.player, {
        x: velocity.x - d.x * (closing + 4),
        y: velocity.y - d.y * (closing + 4),
      });
      if (e.hp > 0 && !e.body.isStatic)
        Body.setVelocity(e.body, { x: d.x * 7, y: Math.min(-2, d.y * 7) });
    }
    g.feedback(3, d);
    g.onSound('ram');
    return protectedImpact;
  }
  beforeStep(dt: number) {
    const g = this.game;
    if (!g.mods.some((id) => ['ramjet', 'cinder', 'crosswind'].includes(id))) return;
    this.before = { pos: { ...g.player.position }, velocity: { ...g.player.velocity } };
    this.gusts = this.gusts.filter((f) => g.time - f.at < WIND_LIFE);
    const bodies = new Set(Composite.allBodies(g.engine.world));
    this.cinders = this.cinders.filter((f) => f.until > g.time && bodies.has(f.body));
    for (const f of this.cinders) {
      const offset = rotate(f.local, f.body.angle);
      f.pos = { x: f.body.position.x + offset.x, y: f.body.position.y + offset.y };
      f.outward = rotate(f.normal, f.body.angle);
    }
    for (const [id, until] of this.ramHits) if (until <= g.time) this.ramHits.delete(id);
    for (const [id, until] of this.ramSeparation)
      if (until <= g.time) this.ramSeparation.delete(id);
    const live = new Set(g.shots.map((s) => s.id));
    for (const id of this.bends.keys()) if (!live.has(id)) this.bends.delete(id);
    this.wind(dt);
    if (g.time < this.burnAt || !this.cinders.length) return;
    this.burnAt = g.time + 0.2;
    // A target takes one burn tick, however many patches touch it.
    for (const e of [...g.enemies]) {
      if (e.spawn > 0 || e.hp <= 0) continue;
      const patch = this.cinders.find((f) => this.touches(f, e.body));
      if (patch) g.hitEnemy(e, 4.8, patch.pos);
      if (g.mode !== 'playing') return;
    }
    for (const p of [...g.props.items]) {
      if (p.kind !== 'canister' || !this.cinders.some((f) => this.touches(f, p.body))) continue;
      g.props.hit(p, 0, { x: 0, y: 0 });
      p.detonateAt = Math.min(p.detonateAt, g.time + 0.5);
    }
  }
  afterStep() {
    const g = this.game,
      before = this.before;
    this.before = null;
    if (!before || g.time > this.ramUntil || distance(before.pos, g.player.position) > 64) return;
    const half = {
      x: (g.player.bounds.max.x - g.player.bounds.min.x) / 2,
      y: (g.player.bounds.max.y - g.player.bounds.min.y) / 2,
    };
    const hit = firstSolid(before.pos, g.player.position, half, [
      ...g.solidBodies,
      ...g.enemies.filter((e) => e.spawn <= 0).map((e) => e.body),
    ]);
    const enemy = hit && g.enemies.find((e) => e.body === hit.body);
    if (enemy) this.ram(enemy, before.velocity, before.pos);
    else
      for (const e of [...g.enemies])
        if (Query.collides(g.player, [e.body]).length && this.ram(e, before.velocity, before.pos))
          break;
  }
  impact(s: Shot, body?: Matter.Body, normal?: Vec) {
    const g = this.game;
    if (!g.mods.includes('cinder') || !primary(s)) return;
    let pos = { ...s.pos };
    if (!body || !normal) {
      // Airborne hits shed embers only onto nearby actual support.
      const hit = firstSolid(pos, { x: pos.x, y: pos.y + 120 }, { x: 0, y: 0 }, g.solidBodies);
      if (!hit) return;
      body = hit.body;
      normal = hit.normal;
      pos.y += hit.t * 120;
    }
    pos = { x: pos.x + normal.x * 3, y: pos.y + normal.y * 3 };
    const existing = this.cinders.find((f) => f.body === body && distance(f.pos, pos) < 28);
    if (existing) {
      existing.until = g.time + CINDER_LIFE;
      return;
    }
    this.cinders.push({
      body,
      pos,
      outward: { ...normal },
      local: rotate({ x: pos.x - body.position.x, y: pos.y - body.position.y }, -body.angle),
      normal: rotate(normal, -body.angle),
      until: g.time + CINDER_LIFE,
    });
    if (this.cinders.length > CINDER_LIMIT) this.cinders.shift();
  }
  trace(s: Shot, a: Vec, b: Vec) {
    const g = this.game;
    if (!g.mods.includes('crosswind') || !primary(s) || distance(a, b) < 2) return;
    const last = [...this.gusts].reverse().find((f) => f.id === s.id);
    if (last && distance(last.b, a) < 0.1 && distance(last.a, b) < 180) {
      last.b = { ...b };
      last.at = g.time;
    } else {
      this.gusts.push({ a: { ...a }, b: { ...b }, at: g.time, id: s.id });
      if (this.gusts.length > WIND_LIMIT) this.gusts.shift();
    }
  }
  private touches(f: Cinder, body: Matter.Body) {
    const p = Query.point([body], f.pos).length
      ? f.pos
      : body.vertices
          .map((v, i) => closest(v, body.vertices[(i + 1) % body.vertices.length], f.pos))
          .sort((a, b) => distance(a, f.pos) - distance(b, f.pos))[0];
    return (
      distance(f.pos, p) <= 32 &&
      (p.x - f.pos.x) * f.outward.x + (p.y - f.pos.y) * f.outward.y >= -1 &&
      !firstSolid(
        f.pos,
        p,
        { x: 0, y: 0 },
        this.game.solidBodies.filter((b) => b !== f.body && b !== body),
      )
    );
  }
  private wind(dt: number) {
    const g = this.game;
    if (!this.gusts.length) return;
    const field = (pos: Vec, ignore?: Matter.Body) =>
      this.gusts.find((f) => {
        const p = closest(f.a, f.b, pos);
        return (
          distance(p, pos) < 30 &&
          !firstSolid(
            p,
            pos,
            { x: 0, y: 0 },
            g.solidBodies.filter((b) => b !== ignore),
          )
        );
      });
    for (const s of g.shots) {
      if (s.friendly || s.life <= 0 || s.enemyAmmo || s.radius > 5) continue;
      const used = this.bends.get(s.id) ?? 0;
      if (used >= 0.28) continue;
      const f = field(s.pos);
      if (!f) continue;
      const d = direction(f.a, f.b),
        p = closest(f.a, f.b, s.pos);
      const side = Math.sign(d.x * (s.pos.y - p.y) - d.y * (s.pos.x - p.x)) || 1;
      const v = direction({ x: 0, y: 0 }, s.vel);
      const turn = Math.sign(v.x * d.x * side + v.y * d.y * side) || 1;
      const amount = Math.min(0.28 - used, dt * 1.8);
      s.vel = rotate(s.vel, turn * amount);
      this.bends.set(s.id, used + amount);
    }
    for (const p of g.props.items) {
      if (p.body.isStatic || (p.cargo && p.cargo.state !== 'loose')) continue;
      const f = field(p.body.position, p.body);
      if (!f) continue;
      const d = direction(f.a, f.b),
        v = p.body.velocity;
      const push = (speed: number, impulse: number) =>
        Math.abs(speed) > 16
          ? Math.sign(speed) * impulse > 0
            ? speed
            : speed + impulse
          : clamp(speed + impulse, -16, 16);
      Body.setVelocity(p.body, {
        x: push(v.x, d.x * dt * 9),
        y: push(v.y, d.y * dt * 9),
      });
    }
  }
}
