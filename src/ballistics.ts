import Matter from 'matter-js';
import type { Enemy, Game, Shot } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp, direction, distance, segmentBox } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { isBoss } from './enemies.ts';
import { releaseScrapper } from './scrapper.ts';
import { breakSquad } from './squads.ts';
import { SHELL_RADIUS } from './demolition.ts';

export const CHARGE_TIME = 0.85;
export const RECALL_TIME = 0.24;
export const FUSE_TIME = 0.72;
export const FUSE_LIMIT = 48;
export const ECHO_DELAY = 0.42;
export const ECHO_LIMIT = 4;
export interface RecallFlight {
  age: number;
  returning: boolean;
  pierce: number;
  skip: Set<number>;
}
export interface StuckShell {
  pos: Vec;
  body?: Matter.Body;
  local: Vec;
  at: number;
  damage: number;
  launch: number;
}
interface Pin {
  pos: Vec;
  surface: Matter.Body;
  surfacePos: Vec;
  until: number;
  fractured: boolean;
}
export interface EchoVolley {
  origin: Vec;
  direction: Vec;
  at: number;
  fired: boolean;
  shots: Shot[];
}

// Only room-local state lives here. Saved builds contain upgrade IDs alone.
export class BallisticsSystem {
  game: Game;
  charges = 0;
  idle = 0;
  shells: StuckShell[] = [];
  echoes: EchoVolley[] = [];
  pins = new Map<number, Pin>();
  private rivetAt = new Map<number, number>();
  private volleys = 0;
  private reflectionAt = -1;
  private stickAt = -1;
  constructor(game: Game) {
    this.game = game;
  }
  has(id: string) {
    return this.game.mods.includes(id);
  }
  reset() {
    this.charges = this.idle = this.volleys = 0;
    this.shells = [];
    this.echoes = [];
    this.pins.clear();
    this.rivetAt.clear();
    this.reflectionAt = -1;
    this.stickAt = -1;
  }
  charge(dt: number, held: boolean) {
    if (!this.has('capacitor')) return;
    if (held || this.game.burstRemaining > 0) {
      this.idle = 0;
      return;
    }
    this.idle += dt;
    const maximum = this.has('reserve-cell') ? 2 : 1;
    if (this.idle + 1e-8 >= CHARGE_TIME && this.charges < maximum) {
      this.charges++;
      this.idle = 0;
      this.game.onSound('loaded');
    }
  }
  discharge() {
    this.idle = 0;
    if (!this.has('capacitor') || this.charges === 0) return false;
    this.charges--;
    return true;
  }
  prepare(s: Shot) {
    if (!s.friendly || s.fragment || s.reflected) return;
    if (this.has('recall'))
      s.recall = { age: 0, returning: false, pierce: s.pierce, skip: new Set() };
    if (this.has('countershot')) s.counter = 1;
  }
  turn(s: Shot, normal?: Vec) {
    const r = s.recall;
    if (!r || r.returning) return false;
    r.returning = true;
    r.skip = new Set(s.hits);
    s.hits.clear();
    s.pierce = r.pierce + (this.has('homecoming') ? 2 : 0);
    s.life = Math.max(s.life, 0.8);
    s.waypoints = undefined;
    if (normal) {
      const dot = s.vel.x * normal.x + s.vel.y * normal.y;
      s.vel.x -= 2 * dot * normal.x;
      s.vel.y -= 2 * dot * normal.y;
    } else s.vel = { x: -s.vel.x, y: -s.vel.y };
    return true;
  }
  flight(s: Shot, dt: number) {
    const r = s.recall;
    if (!r || s.life <= 0) return;
    r.age += dt;
    if (!r.returning && r.age >= RECALL_TIME) this.turn(s);
    if (!r.returning) return;
    for (const id of r.skip) {
      const e = this.game.enemies.find((e) => e.id === id);
      if (
        !e ||
        !segmentBox(
          s.pos,
          s.pos,
          { x: e.body.bounds.min.x - s.radius - 1, y: e.body.bounds.min.y - s.radius - 1 },
          { x: e.body.bounds.max.x + s.radius + 1, y: e.body.bounds.max.y + s.radius + 1 },
        )
      )
        r.skip.delete(id);
    }
    const d = direction(s.pos, this.game.player.position);
    const a = Math.atan2(s.vel.y, s.vel.x),
      target = Math.atan2(d.y, d.x);
    const delta = Math.atan2(Math.sin(target - a), Math.cos(target - a));
    const angle = a + clamp(delta, -18 * dt, 18 * dt),
      speed = Math.hypot(s.vel.x, s.vel.y);
    s.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  }
  record(afterId: number, origin: Vec, forward: Vec) {
    if (!this.has('afterimage') || ++this.volleys % 4) return;
    if (this.echoes.filter((e) => !e.fired).length >= ECHO_LIMIT) return;
    const shots = this.game.shots.filter(
      (s) => s.id > afterId && s.friendly && !s.fragment && !s.echo,
    );
    if (!shots.length) return;
    this.echoes.push({
      origin: { ...origin },
      direction: { ...forward },
      at: this.game.time + ECHO_DELAY,
      fired: false,
      shots: structuredClone(shots),
    });
  }
  stick(s: Shot, body?: Matter.Body) {
    if (!this.has('fuse') || !s.shell) return false;
    const payload = s.shell;
    s.shell = undefined;
    if (this.game.time >= this.stickAt) {
      this.game.onSound('fuse-stick');
      this.stickAt = this.game.time + 0.06;
    }
    // Spend surplus shells as ordinary blasts instead of silently dropping damage.
    if (this.shells.length >= FUSE_LIMIT) {
      this.game.demolition.detonate({
        pos: { ...s.pos },
        damage: payload.damage * 1.4,
        launch: payload.launch,
        radius: SHELL_RADIUS,
        kind: 'shell',
      });
      return true;
    }
    const a = -(body?.angle ?? 0),
      dx = s.pos.x - (body?.position.x ?? 0),
      dy = s.pos.y - (body?.position.y ?? 0);
    this.shells.push({
      pos: { ...s.pos },
      body,
      local: { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) },
      at: this.game.time + FUSE_TIME,
      damage: payload.damage * 1.4,
      launch: payload.launch,
    });
    return true;
  }
  update() {
    const g = this.game;
    if (g.mode !== 'playing') return;
    this.positionShells();
    // Removing a charge before detonation makes linked chains finite, even if
    // its explosion destroys the host or ignites several canisters at once.
    for (let i = 0; i < FUSE_LIMIT; i++) {
      const index = this.shells.findIndex((s) => s.at <= g.time);
      if (index < 0) break;
      const [s] = this.shells.splice(index, 1);
      if (this.has('linked-fuse'))
        for (const other of this.shells)
          if (
            distance(s.pos, other.pos) <= 140 &&
            distance(g.lineEnd(s.pos, other.pos), other.pos) < 0.1
          )
            other.at = Math.min(other.at, g.time + 0.06);
      g.demolition.detonate({
        pos: s.pos,
        damage: s.damage,
        launch: s.launch,
        radius: SHELL_RADIUS,
        kind: 'shell',
      });
      if (g.mode !== 'playing') return;
    }
    for (const echo of this.echoes) {
      if (echo.fired || echo.at > g.time) continue;
      echo.fired = true;
      // A moving crusher or crate may occupy an old firing position.
      if (Matter.Query.point(g.solidBodies, echo.origin).length) continue;
      const target = this.has('parallax') ? direction(echo.origin, g.aim) : echo.direction;
      const angle = Math.atan2(target.y, target.x) - Math.atan2(echo.direction.y, echo.direction.x);
      const rotate = (p: Vec) => ({
        x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
        y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
      });
      const point = (p: Vec) => {
        const v = rotate({ x: p.x - echo.origin.x, y: p.y - echo.origin.y });
        return { x: v.x + echo.origin.x, y: v.y + echo.origin.y };
      };
      for (const template of echo.shots) {
        if (g.shots.length >= 180) break;
        const s = structuredClone(template);
        s.pos = g.lineEnd(echo.origin, point(s.pos), s.radius);
        s.prev = { ...s.pos };
        s.vel = rotate(s.vel);
        s.waypoints = s.waypoints?.map(point);
        s.damage *= 0.6;
        if (s.shell) s.shell.damage *= 0.6;
        s.id = ++g.id;
        s.echo = true;
        s.vector = undefined;
        s.discharge = undefined;
        s.hits.clear();
        if (s.trace) s.trace.points = [{ ...s.pos }];
        g.shots.push(s);
      }
      echo.direction = { ...target };
      g.burst(echo.origin, 3, '#afcbbc', 1.5, target);
      g.onSound('echo-shot');
    }
    this.echoes = this.echoes.filter((e) => !e.fired || g.time - e.at < 0.12);
    const living = new Set(g.enemies.map((e) => e.id));
    for (const id of this.pins.keys()) if (!living.has(id)) this.pins.delete(id);
    for (const [id, at] of this.rivetAt)
      if (!living.has(id) || at < g.time - 1) this.rivetAt.delete(id);
  }
  positionShells() {
    const bodies = new Set(
      this.shells.length ? Matter.Composite.allBodies(this.game.engine.world) : [],
    );
    for (const s of this.shells) {
      if (s.body && !bodies.has(s.body)) s.body = undefined;
      if (!s.body) continue;
      const a = s.body.angle,
        p = s.body.position;
      s.pos = {
        x: p.x + s.local.x * Math.cos(a) - s.local.y * Math.sin(a),
        y: p.y + s.local.x * Math.sin(a) + s.local.y * Math.cos(a),
      };
    }
  }
  pinned(e: Enemy) {
    const pin = this.pins.get(e.id),
      g = this.game;
    if (!pin) return false;
    if (
      g.time >= pin.until ||
      distance(e.body.position, pin.pos) > 9 ||
      distance(pin.surface.position, pin.surfacePos) > 3 ||
      !g.solidBodies.includes(pin.surface)
    ) {
      this.pins.delete(e.id);
      return false;
    }
    Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
    if (!e.body.isStatic)
      Matter.Body.applyForce(e.body, e.body.position, {
        x: 0,
        y: -e.body.mass * g.engine.gravity.y * g.engine.gravity.scale,
      });
    return true;
  }
  fracture(e: Enemy, s: Shot) {
    const pin = this.pins.get(e.id);
    if (!this.has('fracture') || s.fragment || !pin || pin.fractured || this.game.time >= pin.until)
      return 1;
    if (e.elite === 'shielded' && -direction({ x: 0, y: 0 }, s.vel).x * e.facing > 0.45) return 1;
    return 1.6;
  }
  consumeFracture(e: Enemy, s: Shot) {
    const pin = this.pins.get(e.id);
    if (pin && !s.fragment && this.has('fracture')) pin.fractured = true;
  }
  rivet(e: Enemy, s: Shot) {
    const g = this.game;
    if (
      !this.has('rivet') ||
      s.fragment ||
      e.hp <= 0 ||
      isBoss(e.kind) ||
      (this.rivetAt.get(e.id) ?? 0) > g.time
    )
      return;
    this.rivetAt.set(e.id, g.time + 0.3);
    const p = { ...e.body.position },
      d = direction({ x: 0, y: 0 }, s.vel);
    const half = {
      x: Math.max(...e.body.vertices.map((v) => Math.abs(v.x - p.x))),
      y: Math.max(...e.body.vertices.map((v) => Math.abs(v.y - p.y))),
    };
    const end = { x: p.x + d.x * 64, y: p.y + d.y * 64 };
    const hit = firstSolid(p, end, half, [
      ...g.solidBodies,
      g.player,
      ...g.enemies.filter((other) => other !== e).map((other) => other.body),
    ]);
    const t = hit ? Math.max(0, hit.t - 0.012) : 1;
    Matter.Body.setPosition(e.body, { x: p.x + d.x * 64 * t, y: p.y + d.y * 64 * t });
    if (!hit || !hit.body.isStatic || !g.solidBodies.includes(hit.body)) return;
    breakSquad(g, e);
    releaseScrapper(g, e);
    g.harpoons.disrupt(e.body);
    e.state = 'recover';
    e.timer = 0.7;
    this.rivetAt.set(e.id, g.time + 2);
    this.pins.set(e.id, {
      pos: { ...e.body.position },
      surface: hit.body,
      surfacePos: { ...hit.body.position },
      until: g.time + 0.65,
      fractured: false,
    });
    g.hitEnemy(e, s.damage * 0.3, s.pos);
    g.burst(e.body.position, 4, '#c0dce1', 1.8);
  }
  reflect(dt: number) {
    const g = this.game;
    const friendly = g.shots.filter((s) => s.life > dt && s.friendly && (s.counter ?? 0) > 0);
    const hostile = g.shots.filter((s) => s.life > dt && !s.friendly && !s.blade && s.radius <= 5);
    if (!friendly.length || !hostile.length) return;
    const contacts: { a: Shot; b: Shot; t: number; point: Vec; bullet: Vec }[] = [];
    const step = dt * 60;
    for (const a of friendly)
      for (const b of hostile) {
        const r = a.radius + b.radius;
        const relative = { x: a.pos.x - b.pos.x, y: a.pos.y - b.pos.y };
        const delta = { x: (a.vel.x - b.vel.x) * step, y: (a.vel.y - b.vel.y) * step };
        const aa = delta.x ** 2 + delta.y ** 2,
          bb = 2 * (relative.x * delta.x + relative.y * delta.y),
          cc = relative.x ** 2 + relative.y ** 2 - r * r;
        const disc = bb * bb - 4 * aa * cc;
        const t = cc <= 0 ? 0 : aa > 1e-9 && disc >= 0 ? (-bb - Math.sqrt(disc)) / (2 * aa) : -1;
        if (t < 0 || t > 1) continue;
        const point = { x: a.pos.x + a.vel.x * step * t, y: a.pos.y + a.vel.y * step * t };
        const bullet = { x: b.pos.x + b.vel.x * step * t, y: b.pos.y + b.vel.y * step * t };
        // A bend, portal, enemy or solid hit earlier in the step takes precedence.
        if (a.waypoints?.[0] && distance(a.pos, a.waypoints[0]) < distance(a.pos, point)) continue;
        if (
          g.portals.trace(a.pos, point, { x: a.radius, y: a.radius }) ||
          g.portals.trace(b.pos, bullet, { x: b.radius, y: b.radius })
        )
          continue;
        const blockers = [
          ...g.solidBodies,
          ...g.enemies.filter((e) => e.spawn <= 0 && e.crane).map((e) => e.crane!.body),
        ];
        if (
          firstSolid(a.pos, point, { x: a.radius, y: a.radius }, [
            ...blockers,
            ...(a.recall?.returning ? [g.player] : []),
            ...g.enemies
              .filter((e) => e.spawn <= 0 && !a.hits.has(e.id) && !a.recall?.skip.has(e.id))
              .map((e) => e.body),
          ]) ||
          firstSolid(b.pos, bullet, { x: b.radius, y: b.radius }, [
            ...blockers,
            g.player,
            ...g.enemies
              .filter((e) => b.allyBlock !== undefined && b.allyBlock !== e.id && e.spawn <= 0)
              .map((e) => e.body),
          ])
        )
          continue;
        if (g.cargo.trace(a.pos, point, a.radius) || g.cargo.trace(b.pos, bullet, b.radius))
          continue;
        if (g.harpoons.trace(a.pos, point, a.radius)) continue;
        if (firstSolid(point, bullet, { x: 0, y: 0 }, blockers)) continue;
        contacts.push({ a, b, t, point, bullet });
      }
    contacts.sort((a, b) => a.t - b.t || a.a.id - b.a.id || a.b.id - b.b.id);
    for (const { a, b, bullet } of contacts) {
      if (!a.counter || b.friendly) continue;
      a.counter--;
      const d = b.source ? direction(bullet, b.source) : direction(b.vel, { x: 0, y: 0 });
      b.pos = bullet;
      b.prev = { ...bullet };
      b.vel = { x: d.x * 24, y: d.y * 24 };
      b.friendly = true;
      b.enemyAmmo = undefined;
      if (b.angler) {
        b.angler = undefined;
        b.bounces = 0;
      }
      b.fragment = true;
      b.reflected = true;
      b.reflectedAt = g.time;
      b.allyBlock = undefined;
      b.damage = Math.min(65, b.damage * 1.5);
      b.life = 1.4;
      b.pierce = this.has('reprisal') ? 2 : 0;
      b.hits.clear();
      if (b.pierce) b.trace = { bank: false, pierce: true, points: [{ ...bullet }] };
      g.burst(bullet, 4, '#b9e1d5', 2);
      if (g.time >= this.reflectionAt) {
        g.onSound('bank');
        this.reflectionAt = g.time + 0.06;
      }
    }
  }
}
