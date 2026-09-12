import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { Prop } from './props.ts';
import type { Vec } from './rules.ts';
import { clamp, direction, distance } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { closestBlastPoint } from './demolition.ts';
import { isBoss } from './enemies.ts';

const { Body, Query } = Matter;
export const SAPPER_TELL = 0.95;
export const SAPPER_LOCK = 0.45;
export const CHARGE_FUSE = 2.6;
export const CHARGE_RADIUS = 132;
export const CHARGE_LIMIT = 2;
export const CHARGE_HALF = 9;
export interface SapperRig {
  origin: Vec;
  anchor: Vec;
  velocity: Vec;
  arc: Vec[];
  advance: boolean;
}
export interface SapperCharge {
  owner: number;
  at: number;
  born: number;
  host?: Matter.Body;
  local: Vec;
  normal: Vec;
  hostAngle: number;
  loose: boolean;
  beep: number;
}
export const createSapper = (): SapperRig => ({
  origin: { x: 0, y: 0 },
  anchor: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  arc: [],
  advance: false,
});
export const sapperMuzzle = (e: Enemy): Vec => ({
  x: e.body.position.x + e.facing * 22,
  y: e.body.position.y - 28,
});
export class SapperSystem {
  game: Game;
  private starts = new Map<Matter.Body, Vec>();
  effects: { pos: Vec; outline: Vec[]; at: number }[] = [];
  constructor(game: Game) {
    this.game = game;
  }
  get items() {
    return this.game.props.items.filter((p) => p.charge);
  }
  clear() {
    for (const p of this.items) this.game.props.remove(p);
    this.starts.clear();
    this.effects = [];
  }
  disrupt(body: Matter.Body) {
    this.starts.delete(body);
    for (const p of this.items) if (p.charge!.host === body) this.detach(p);
    const e = this.game.enemies.find((e) => e.body === body && e.sapper);
    if (e?.sapper && e.state === 'windup') {
      e.sapper.arc = [];
      e.state = 'recover';
      e.timer = 0.65;
    }
  }
  private detach(p: Prop) {
    const charge = p.charge!;
    charge.host = undefined;
    charge.loose = true;
    Body.setStatic(p.body, false);
    p.body.isSensor = false;
    Body.setVelocity(p.body, { x: 0, y: 0 });
  }
  private aim(e: Enemy) {
    const g = this.game,
      rig = e.sapper!,
      from = sapperMuzzle(e);
    const target = {
      x: clamp(g.player.position.x + g.player.velocity.x * 5, 40, g.worldWidth - 40),
      y: g.player.position.y + 14,
    };
    const frames = Math.round(clamp(distance(from, target) / 9, 24, 55));
    const drag = 0.992,
      gravity = g.engine.gravity.y * g.engine.gravity.scale * (1000 / 60) ** 2;
    const sum = (drag * (1 - drag ** frames)) / (1 - drag);
    const velocity = {
      x: clamp((target.x - from.x) / sum, -14, 14),
      y: clamp((target.y - from.y - (gravity / (1 - drag)) * (frames - sum)) / sum, -14, 5),
    };
    rig.origin = from;
    rig.anchor = { ...e.body.position };
    rig.velocity = velocity;
    rig.arc = [{ ...from }];
    let pos = { ...from },
      v = { ...velocity };
    for (let i = 0; i < 90; i++) {
      v = { x: v.x * drag, y: v.y * drag + gravity };
      const end = { x: pos.x + v.x, y: pos.y + v.y };
      const hit = firstSolid(pos, end, { x: CHARGE_HALF, y: CHARGE_HALF }, g.solidBodies);
      if (hit) {
        rig.arc.push({ x: pos.x + (end.x - pos.x) * hit.t, y: pos.y + (end.y - pos.y) * hit.t });
        break;
      }
      pos = end;
      if (i % 4 === 3) rig.arc.push({ ...pos });
    }
    e.aim = direction({ x: 0, y: 0 }, velocity);
    const end = rig.arc.at(-1)!;
    rig.advance =
      distance(end, g.player.position) > CHARGE_RADIUS + 80 ||
      distance(g.lineEnd(end, g.player.position), g.player.position) > 1;
  }
  updateEnemy(e: Enemy) {
    const g = this.game,
      rig = e.sapper!,
      p = e.body.position;
    if (e.state === 'windup') {
      Body.setVelocity(e.body, { x: e.body.velocity.x * 0.7, y: e.body.velocity.y });
      if (distance(p, rig.anchor) > 18) {
        this.disrupt(e.body);
        return;
      }
      if (e.timer > SAPPER_LOCK) this.aim(e);
      if (e.timer <= 0) {
        if (!this.launch(e, rig.origin, rig.velocity)) rig.advance = true;
        rig.arc = [];
        e.state = 'recover';
        e.timer = g.stage >= 16 || g.overtime ? 1.8 : 2.4;
      }
      return;
    }
    if (e.state === 'recover') {
      if (e.timer <= 0) {
        e.state = 'idle';
        e.timer = 0.3;
      }
      return;
    }
    const d = direction(p, g.player.position),
      range = distance(p, g.player.position);
    e.facing = Math.sign(d.x) || e.facing;
    if (range > 620 || (rig.advance && range > 210)) g.updateRunner(e, d, range);
    else if (range < 210) g.updateRunner(e, { x: -d.x, y: d.y }, range);
    else Body.setVelocity(e.body, { x: e.body.velocity.x * 0.85, y: e.body.velocity.y });
    if (
      e.timer <= 0 &&
      range < 720 &&
      this.items.length < CHARGE_LIMIT &&
      Math.abs(e.body.velocity.y) < 1.2
    ) {
      this.aim(e);
      e.state = 'windup';
      e.timer = SAPPER_TELL;
      g.onSound('sapper-lock');
    }
  }
  launch(e: Enemy, origin: Vec, velocity: Vec) {
    const g = this.game;
    if (g.mode !== 'playing' || e.hp <= 0 || e.spawn > 0 || this.items.length >= CHARGE_LIMIT)
      return null;
    const half = CHARGE_HALF + 0.5;
    const blockers = [
      ...g.solidBodies,
      g.player,
      ...g.enemies.filter((other) => other !== e).map((other) => other.body),
    ];
    if (
      distance(g.lineEnd(e.body.position, origin, CHARGE_HALF), origin) > 0.1 ||
      Query.region(blockers, {
        min: { x: origin.x - half, y: origin.y - half },
        max: { x: origin.x + half, y: origin.y + half },
      }).length
    )
      return null;
    const p = g.props.spawn('charge', origin.x, origin.y);
    p.charge = {
      owner: e.id,
      at: g.time + CHARGE_FUSE,
      born: g.time,
      local: { x: 0, y: 0 },
      normal: { x: 0, y: -1 },
      hostAngle: 0,
      loose: false,
      beep: 0,
    };
    Body.setVelocity(p.body, velocity);
    e.attacks++;
    g.onSound('sapper-throw');
    return p;
  }
  knock(p: Prop, damage: number, velocity: Vec) {
    const g = this.game,
      charge = p.charge;
    if (!charge || g.mode !== 'playing' || !(damage > 0) || !g.props.items.includes(p)) return;
    let d = direction({ x: 0, y: 0 }, velocity);
    if (charge.host) {
      const a = charge.host.angle - charge.hostAngle,
        n = charge.normal;
      const normal = {
        x: n.x * Math.cos(a) - n.y * Math.sin(a),
        y: n.x * Math.sin(a) + n.y * Math.cos(a),
      };
      const into = d.x * normal.x + d.y * normal.y;
      if (into < 0) d = { x: d.x - 2 * into * normal.x, y: d.y - 2 * into * normal.y };
    }
    const old = p.body.isStatic ? { x: 0, y: 0 } : { ...p.body.velocity };
    this.detach(p);
    const force = clamp(8 + damage * 0.12, 9, 15);
    Body.setVelocity(p.body, {
      x: clamp(old.x * 0.25 + d.x * force, -17, 17),
      y: clamp(old.y * 0.25 + d.y * force - Math.abs(d.x) * 3.5, -17, 17),
    });
    Body.setAngularVelocity(p.body, d.x * 0.13);
    p.flash = 0.09;
    g.burst(p.body.position, 3, '#f5d394', 1.5);
    g.onSound('sapper-bat');
  }
  beforeStep() {
    this.starts.clear();
    const g = this.game;
    this.effects = this.effects.filter((f) => g.time - f.at < 0.2);
    for (const p of this.items) {
      const charge = p.charge!;
      if (charge.host) this.sync(p);
      if (!p.body.isStatic) this.starts.set(p.body, { ...p.body.position });
    }
  }
  // Run after portal travel and before Matter resolves contacts, so fast throws
  // cannot tunnel through a thin ledge or latch across the map after teleporting.
  afterIntegrate() {
    const g = this.game;
    if (g.mode !== 'playing') return;
    for (const p of this.items) {
      const charge = p.charge!,
        from = this.starts.get(p.body);
      if (!from || charge.host || charge.loose) continue;
      const blockers = g.solidBodies.filter(
        (b) => b !== p.body && !this.items.some((c) => c.body === b),
      );
      const hit = firstSolid(from, p.body.position, { x: CHARGE_HALF, y: CHARGE_HALF }, blockers);
      if (!hit) continue;
      const end = p.body.position;
      const pos = {
        x: from.x + (end.x - from.x) * hit.t + hit.normal.x * 0.2,
        y: from.y + (end.y - from.y) * hit.t + hit.normal.y * 0.2,
      };
      charge.host = hit.body;
      charge.hostAngle = hit.body.angle;
      charge.normal = hit.normal;
      const dx = pos.x - hit.body.position.x,
        dy = pos.y - hit.body.position.y,
        a = -hit.body.angle;
      charge.local = {
        x: dx * Math.cos(a) - dy * Math.sin(a),
        y: dx * Math.sin(a) + dy * Math.cos(a),
      };
      // A late landing still gets a readable warning; hitting it never refills it.
      charge.at = Math.max(charge.at, g.time + 1.2);
      Body.setPosition(p.body, pos);
      Body.setStatic(p.body, true);
      p.body.isSensor = true;
      g.onSound('sapper-stick');
    }
    this.starts.clear();
  }
  private sync(p: Prop) {
    const charge = p.charge!,
      host = charge.host;
    if (!host) return;
    if (!this.game.solidBodies.includes(host)) {
      this.detach(p);
      return;
    }
    const a = host.angle,
      l = charge.local;
    Body.setPosition(p.body, {
      x: host.position.x + l.x * Math.cos(a) - l.y * Math.sin(a),
      y: host.position.y + l.x * Math.sin(a) + l.y * Math.cos(a),
    });
    Body.setAngle(p.body, a - charge.hostAngle);
  }
  afterStep() {
    const g = this.game;
    for (const p of this.items) {
      if (g.mode !== 'playing') return;
      const charge = p.charge!;
      if (charge.host) this.sync(p);
      const left = charge.at - g.time;
      if (left <= 0) this.detonate(p);
      else if (left < 1.2 && g.time >= charge.beep) {
        charge.beep = g.time + Math.max(0.15, left * 0.3);
        g.onSound('sapper-tick');
      }
    }
  }
  detonate(p: Prop) {
    const g = this.game;
    if (!p.charge || g.mode !== 'playing' || !g.props.items.includes(p)) return;
    const pos = { ...p.body.position };
    g.props.remove(p);
    const visible = (body: Matter.Body, ignore?: Matter.Body | Prop) => {
      const near = closestBlastPoint(pos, body);
      return (
        distance(pos, near) <= CHARGE_RADIUS &&
        distance(g.lineEnd(pos, near, 0, ignore), near) < 0.1
      );
    };
    // All targets use the cover present at the start of this explosion.
    const player = visible(g.player);
    const enemies = g.enemies.filter((e) => e.spawn <= 0 && e.hp > 0 && visible(e.body));
    const props = g.props.items.filter((p) => visible(p.body, p));
    const terrain = g.destruction.targets(pos, CHARGE_RADIUS);
    const panels = g.breaches.targets(pos, CHARGE_RADIUS);
    const outline = Array.from({ length: 32 }, (_, i) =>
      g.lineEnd(pos, {
        x: pos.x + Math.cos((i * Math.PI) / 16) * CHARGE_RADIUS,
        y: pos.y + Math.sin((i * Math.PI) / 16) * CHARGE_RADIUS,
      }),
    );
    this.effects.push({ pos, outline, at: g.time });
    if (this.effects.length > 4) this.effects.shift();
    g.burst(pos, 16, '#efba76', 4);
    g.feedback(4);
    g.onSound('sapper-blast');
    if (player) g.damagePlayer(24, pos);
    if (g.mode !== 'playing') return;
    for (const e of enemies) g.hitEnemy(e, isBoss(e.kind) ? 90 : 170 + g.stage * 7, pos);
    if (g.mode !== 'playing') return;
    for (const prop of props) g.props.hit(prop, 140, direction(pos, prop.body.position));
    for (const panel of panels) g.breaches.hit(panel, 140, direction(pos, panel.body.position));
    for (const piece of terrain)
      g.destruction.hitBody(piece.body, 140, direction(pos, piece.body.position));
  }
}
