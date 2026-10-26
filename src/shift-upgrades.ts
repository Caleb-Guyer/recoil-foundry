import Matter from 'matter-js';
import type { Enemy, Game, Input, Shot } from './game.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';
import { firstSolid, sweepBox } from './collisions.ts';
import { isBoss } from './enemies.ts';
import { primaryGunShot } from './spoof.ts';

const { Body } = Matter;
export const SHIFT = {
  polarityTime: 3,
  polarityRange: 220,
  polarityCap: 16,
  rivetTime: 8,
  rivetCap: 2,
  rivetLaunch: 16,
  slipTime: 2,
  wireTime: 1.4,
  wireLength: 320,
  wirePoints: 12,
  silhouetteTime: 1.2,
  nozzleTime: 3,
  nozzleRange: 700,
  batteryCap: 7,
} as const;
interface Lineage {
  event: number;
  airborne: boolean;
  remote: boolean;
}
export interface ShiftMount {
  body: Matter.Body;
  local: Vec;
  normal: Vec;
  until: number;
}
interface Nozzle extends ShiftMount {
  installed: number;
  used?: number;
}
export interface ShiftWire {
  points: Vec[];
  until: number;
  damage: number;
  hit: Set<number>;
}
export interface PolarityMark {
  enemy: Enemy;
  pole: -1 | 1;
  until: number;
}
const copy = (p: Vec): Vec => ({ x: p.x, y: p.y });
const moveInput = (input: Input) =>
  typeof input.move === 'number' && Number.isFinite(input.move)
    ? clamp(input.move, -1, 1)
    : Number(input.right) - Number(input.left);
const unit = (v: Vec): Vec => {
  const length = Math.hypot(v.x, v.y);
  return length > 1e-8 && Number.isFinite(length)
    ? { x: v.x / length, y: v.y / length }
    : { x: 0, y: -1 };
};
export function mountPoint(m: ShiftMount): Vec {
  const c = Math.cos(m.body.angle),
    s = Math.sin(m.body.angle);
  return {
    x: m.body.position.x + m.local.x * c - m.local.y * s,
    y: m.body.position.y + m.local.x * s + m.local.y * c,
  };
}
export function mountNormal(m: ShiftMount): Vec {
  const c = Math.cos(m.body.angle),
    s = Math.sin(m.body.angle);
  return { x: m.normal.x * c - m.normal.y * s, y: m.normal.x * s + m.normal.y * c };
}
const localPoint = (body: Matter.Body, p: Vec): Vec => {
  const c = Math.cos(body.angle),
    s = Math.sin(body.angle),
    x = p.x - body.position.x,
    y = p.y - body.position.y;
  return { x: x * c + y * s, y: -x * s + y * c };
};
const localNormal = (body: Matter.Body, n: Vec): Vec => {
  const c = Math.cos(body.angle),
    s = Math.sin(body.angle);
  return { x: n.x * c + n.y * s, y: -n.x * s + n.y * c };
};
const closest = (p: Vec, a: Vec, b: Vec) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = dx * dx + dy * dy;
  const t = length > 0 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / length, 0, 1) : 0;
  return { x: a.x + dx * t, y: a.y + dy * t };
};

/** One bounded state machine for the new base fittings, with native collision and damage. */
export class ShiftUpgrades {
  readonly game: Game;
  readonly polarity = new Map<number, PolarityMark>();
  rivets: ShiftMount[] = [];
  wire: ShiftWire | null = null;
  silhouette: { pos: Vec; until: number; facing: number } | null = null;
  nozzle: Nozzle | null = null;
  slipUntil = -1;
  battery = 0;
  flash = 0;
  flashPoint: Vec | null = null;
  recoilAt = -10;
  private input: Input | null = null;
  private lineage = new WeakMap<Shot, Lineage>();
  private events = new Map<number, Lineage>();
  private marked = new Map<number, Set<number>>();
  private exchanged = new Set<number>();
  private grazed = new WeakSet<Shot>();
  private beforePos: Vec | null = null;
  private beforeVelocity: Vec | null = null;
  private recoilVelocity: Vec | null = null;
  private recoilBefore: Vec | null = null;
  private reboundEvent = -1;
  private rebounds = 0;
  private rivetPlaced = false;
  private silhouetteUsed = false;
  private exchangeAt = 0;
  private exchangePush = new Map<Enemy, Vec>();
  private extraSlipUntil = -1;
  private echoReadyAt = 0;
  private nozzleReadyAt = 0;
  private held = false;
  private liveTrail: Vec[] = [];
  constructor(game: Game) {
    this.game = game;
  }
  private has(id: string) {
    return this.game.mods.includes(id);
  }
  private get active() {
    return (
      this.game.mode === 'playing' &&
      this.game.hp > 0 &&
      this.game.hitStop <= 0 &&
      !this.game.finale.safe
    );
  }
  private evolved(id: string) {
    return (
      (
        this.game as Game & { shiftRun?: { hasEvolution(id: string): boolean } }
      ).shiftRun?.hasEvolution(id) ?? false
    );
  }
  private progress(kind: 'rebound' | 'pad' | 'slip') {
    (
      this.game as Game & { shiftRun?: { progress(kind: 'rebound' | 'pad' | 'slip'): void } }
    ).shiftRun?.progress(kind);
  }
  get slipCharges() {
    return Number(this.slipUntil > this.game.time) + Number(this.extraSlipUntil > this.game.time);
  }
  get slipReady() {
    return this.has('slip-gauge') && this.slipCharges > 0;
  }
  get trail() {
    return this.liveTrail;
  }
  reset() {
    this.polarity.clear();
    this.rivets = [];
    this.wire = null;
    this.silhouette = null;
    this.nozzle = null;
    this.slipUntil = this.extraSlipUntil = -1;
    this.battery = 0;
    this.flash = 0;
    this.flashPoint = null;
    this.recoilAt = -10;
    this.input = null;
    this.lineage = new WeakMap();
    this.events.clear();
    this.marked.clear();
    this.exchanged.clear();
    this.grazed = new WeakSet();
    this.beforePos = this.beforeVelocity = this.recoilVelocity = this.recoilBefore = null;
    this.reboundEvent = -1;
    this.rebounds = 0;
    this.rivetPlaced = this.silhouetteUsed = this.held = false;
    this.exchangePush.clear();
    this.echoReadyAt = 0;
    this.exchangeAt = this.nozzleReadyAt = 0;
    this.liveTrail = [];
  }
  pause() {
    this.held = false;
    this.input = null;
    this.liveTrail = [];
  }
  /** Called once for every primary shot, including every member of one volley and a beam pulse. */
  tag(shot: Shot) {
    if (!primaryGunShot(shot)) return;
    const event = this.game.shotCount;
    let lineage = this.events.get(event);
    if (!lineage) {
      lineage = { event, airborne: !this.game.grounded, remote: this.nozzle?.used === event };
      this.events.set(event, lineage);
      if (this.events.size > 256) this.events.delete(this.events.keys().next().value!);
    }
    this.lineage.set(shot, lineage);
  }
  private meta(shot: Shot): Lineage {
    return (
      this.lineage.get(shot) ??
      (shot.discharge !== undefined ? this.events.get(shot.discharge) : undefined) ?? {
        event: shot.discharge ?? shot.id,
        airborne: !this.game.grounded,
        remote: false,
      }
    );
  }
  private markOnce(event: number, enemy: number) {
    let seen = this.marked.get(event);
    if (!seen) {
      seen = new Set();
      this.marked.set(event, seen);
      if (this.marked.size > 128) this.marked.delete(this.marked.keys().next().value!);
    }
    if (seen.has(enemy)) return false;
    seen.add(enemy);
    return true;
  }
  private effect(p: Vec) {
    this.flash = 0.2;
    this.flashPoint = copy(p);
  }
  private clearLine(a: Vec, b: Vec, ignore?: Matter.Body) {
    return !firstSolid(
      a,
      b,
      { x: 1, y: 1 },
      this.game.solidBodies.filter((body) => body !== ignore),
    );
  }
  private ordinarySurface(body: Matter.Body) {
    const g = this.game;
    return (
      (g.terrain.includes(body) || g.counterweights.bodies.includes(body)) &&
      !g.hazards.bodies.includes(body) &&
      !g.crossing.bodies.includes(body) &&
      !body.isSensor
    );
  }
  private mountAlive(m: ShiftMount) {
    return m.until > this.game.time && this.game.terrainBodies.includes(m.body);
  }
  beforeStep(dt: number, input: Input) {
    if (!this.active || !Number.isFinite(dt) || dt <= 0) return;
    const g = this.game;
    this.input = { ...input, aim: copy(input.aim) };
    this.beforePos = copy(g.player.position);
    this.beforeVelocity = copy(g.player.velocity);
    this.recoilVelocity = null;
    if (this.held && !input.fire && this.has('wake-wire') && this.liveTrail.length >= 2) {
      const length = this.liveTrail
        .slice(1)
        .reduce((sum, p, i) => sum + distance(this.liveTrail[i], p), 0);
      if (length >= 60) {
        this.wire = {
          points: this.liveTrail.map(copy),
          until: g.time + SHIFT.wireTime,
          damage: clamp(g.gun.damage * g.gun.pellets * g.gun.lanes * 0.42, 12, 80),
          hit: new Set(),
        };
        this.effect(g.player.position);
      }
      this.liveTrail = [];
    }
    this.held = input.fire;
    this.flash = Math.max(0, this.flash - Math.min(dt, 0.1));
    this.rivets = this.rivets.filter((r) => this.mountAlive(r));
    if (this.nozzle && !this.mountAlive(this.nozzle)) this.nozzle = null;
    if (this.silhouette && this.silhouette.until <= g.time) this.silhouette = null;
    if (this.wire && this.wire.until <= g.time) this.wire = null;
    for (const [id, m] of this.polarity)
      if (m.until <= g.time || m.enemy.hp <= 0 || !g.enemies.includes(m.enemy))
        this.polarity.delete(id);
  }
  recoilDelta(d: Vec, impulse: number): Vec {
    const g = this.game;
    const power = Number.isFinite(impulse) ? Math.max(0, impulse) : 0;
    let delta = { x: -d.x * power, y: -d.y * power };
    if (!this.active) return delta;
    if (this.has('gimbal-mount') && this.input && Math.abs(moveInput(this.input)) > 0.15)
      delta = { x: Math.sign(moveInput(this.input)) * power, y: 0 };
    if (this.has('momentum-battery') && g.grounded)
      this.battery = Math.min(SHIFT.batteryCap, this.battery + Math.hypot(delta.x, delta.y) * 0.38);
    this.recoilAt = g.time;
    this.recoilBefore = copy(g.player.velocity);
    this.recoilVelocity = { x: g.player.velocity.x + delta.x, y: g.player.velocity.y + delta.y };
    if (this.reboundEvent !== g.shotCount) {
      this.reboundEvent = g.shotCount;
      this.rebounds = 0;
    }
    return delta;
  }
  /** Run after native jumping and Mobility.update; never consumes an owned extra jump. */
  afterGround(input: Input, wasGrounded: boolean) {
    if (!this.active) return;
    const g = this.game,
      p = g.player;
    if (g.grounded) {
      this.rivetPlaced = this.silhouetteUsed = false;
      this.liveTrail = [];
    }
    if (
      this.has('momentum-battery') &&
      wasGrounded &&
      !g.grounded &&
      input.jump &&
      this.battery > 0
    ) {
      Body.setVelocity(p, { x: p.velocity.x, y: Math.max(-21, p.velocity.y - this.battery) });
      this.effect(p.position);
      this.battery = 0;
      g.jumpCut = false;
    }
    if (!input.jump) return;
    if (this.has('spring-rivets')) {
      const pad = this.rivets.find((r) => {
        if (!this.mountAlive(r)) return false;
        const at = mountPoint(r),
          n = mountNormal(r),
          dx = p.position.x - at.x,
          dy = p.position.y - at.y;
        return (
          dx * n.x + dy * n.y >= 7 &&
          dx * n.x + dy * n.y <= 38 &&
          Math.abs(dx * -n.y + dy * n.x) < 40 &&
          firstSolid(p.position, at, { x: 8, y: 14 }, g.terrainBodies)?.body === r.body
        );
      });
      if (pad) {
        const n = mountNormal(pad),
          loaded = this.evolved('loaded-spring');
        Body.setVelocity(p, {
          x: clamp(p.velocity.x + n.x * (loaded ? 18 : 14), -23, 23),
          y:
            n.y < -0.5
              ? Math.min(p.velocity.y, -(loaded ? 19 : SHIFT.rivetLaunch))
              : Math.min(p.velocity.y + n.y * 8, loaded ? -10 : -7),
        });
        g.grounded = false;
        g.coyote = g.jumpBuffer = 0;
        g.jumpAt = g.time;
        g.jumpCut = false;
        this.rivets = this.rivets.filter((r) => r !== pad);
        this.progress('pad');
        this.effect(mountPoint(pad));
      }
    }
    if (this.slipReady && !wasGrounded && !g.grounded) {
      const lateral =
        Math.abs(moveInput(input)) > 0.15
          ? Math.sign(moveInput(input))
          : Math.sign(input.aim.x - p.position.x) || 1;
      Body.setVelocity(p, {
        x: clamp(p.velocity.x + lateral * 8, -23, 23),
        y: Math.min(p.velocity.y, -5),
      });
      this.slipUntil =
        this.slipUntil > g.time && this.extraSlipUntil > g.time ? this.extraSlipUntil : -1;
      this.extraSlipUntil = -1;
      this.progress('slip');
      if (this.evolved('counterstep')) this.counterstep(lateral);
      g.jumpBuffer = 0;
      g.jumpCut = false;
      this.effect(p.position);
    }
  }
  primaryHit(enemy: Enemy, shot: Shot) {
    const g = this.game;
    if (
      !this.active ||
      !primaryGunShot(shot) ||
      enemy.hp <= 0 ||
      enemy.allied ||
      enemy.spawn > 0 ||
      !(shot.damage > 0)
    )
      return;
    const m = this.meta(shot);
    if (!this.markOnce(m.event, enemy.id)) return;
    if (this.has('polarity-rounds')) {
      this.polarity.set(enemy.id, {
        enemy,
        pole: m.event % 2 ? 1 : -1,
        until: g.time + SHIFT.polarityTime,
      });
      if (this.polarity.size > SHIFT.polarityCap)
        this.polarity.delete(this.polarity.keys().next().value!);
    }
    if (
      this.has('momentum-exchange') &&
      m.airborne &&
      !g.grounded &&
      g.time >= this.exchangeAt &&
      !this.exchanged.has(m.event)
    ) {
      this.exchanged.add(m.event);
      if (this.exchanged.size > 128) this.exchanged.delete(this.exchanged.values().next().value!);
      this.exchangeAt = g.time + 0.75;
      const pv = copy(g.player.velocity),
        ev = copy(enemy.body.velocity);
      if (isBoss(enemy.kind)) {
        if (!enemy.body.isStatic)
          this.exchangePush.set(enemy, { x: clamp(pv.x - ev.x, -1, 1) * 0.1, y: 0 });
      } else if (!enemy.body.isStatic) {
        Body.setVelocity(g.player, {
          x: clamp(pv.x + (ev.x - pv.x) * 0.6, -23, 23),
          y: clamp(pv.y + (ev.y - pv.y) * 0.6, -21, 20),
        });
        this.exchangePush.set(enemy, {
          x: clamp((pv.x - ev.x) * 0.6, -12, 12),
          y: clamp((pv.y - ev.y) * 0.6, -10, 10),
        });
      }
      this.effect(enemy.body.position);
    }
  }
  terrainHit(shot: Shot, body: Matter.Body, normal: Vec) {
    const g = this.game;
    if (!this.active || !primaryGunShot(shot) || !(shot.damage > 0) || !this.ordinarySurface(body))
      return;
    const meta = this.meta(shot),
      n = unit(normal),
      at = { x: shot.pos.x - n.x * shot.radius, y: shot.pos.y - n.y * shot.radius };
    if (!Number.isFinite(at.x) || !Number.isFinite(at.y) || distance(at, g.player.position) > 1000)
      return;
    const mount = {
      body,
      local: localPoint(body, at),
      normal: localNormal(body, n),
      until: g.time + SHIFT.rivetTime,
    };
    if (this.has('spring-rivets') && meta.airborne && !this.rivetPlaced) {
      this.rivetPlaced = true;
      this.rivets.push(mount);
      if (this.rivets.length > (this.evolved('twin-mounts') ? 4 : SHIFT.rivetCap))
        this.rivets.shift();
      this.effect(at);
    }
    if (this.has('offset-nozzle') && !meta.remote && !this.nozzle && g.time >= this.nozzleReadyAt) {
      this.nozzle = { ...mount, installed: meta.event, until: g.time + SHIFT.nozzleTime };
      this.nozzleReadyAt = g.time + 0.4;
      this.effect(at);
    }
  }
  /** A preview ray must pass discharging=false, so inspecting a charge cannot spend a nozzle. */
  origin(base: Vec, _d: Vec, discharging = true): Vec {
    const g = this.game,
      n = this.nozzle;
    if (
      !this.active ||
      !this.has('offset-nozzle') ||
      !n ||
      !this.mountAlive(n) ||
      !discharging ||
      g.shotCount <= n.installed
    )
      return copy(base);
    if (distance(g.player.position, mountPoint(n)) > SHIFT.nozzleRange) {
      this.nozzle = null;
      return copy(base);
    }
    if (n.used === undefined) n.used = g.shotCount;
    if (n.used !== g.shotCount) {
      this.nozzle = null;
      return copy(base);
    }
    const p = mountPoint(n),
      normal = mountNormal(n),
      from = { x: p.x + normal.x * 7, y: p.y + normal.y * 7 };
    if (firstSolid(from, { x: from.x + 0.01, y: from.y + 0.01 }, { x: 3, y: 3 }, g.solidBodies)) {
      this.nozzle = null;
      return copy(base);
    }
    return from;
  }
  decoyTarget(enemy: Enemy): Vec | null {
    const g = this.game,
      d = this.silhouette;
    return this.active &&
      this.has('false-silhouette') &&
      d &&
      d.until > g.time &&
      enemy.hp > 0 &&
      enemy.spawn <= 0 &&
      !isBoss(enemy.kind) &&
      !enemy.allied &&
      !enemy.workshopTarget &&
      ['idle', 'chase'].includes(enemy.state) &&
      distance(enemy.body.position, d.pos) < 850 &&
      this.clearLine(enemy.body.position, d.pos)
      ? copy(d.pos)
      : null;
  }
  private forces(dt: number) {
    const marks = [...this.polarity.values()],
      pushes = new Map<Enemy, Vec>();
    for (let i = 0; i < marks.length; i++)
      for (let j = i + 1; j < marks.length; j++) {
        const a = marks[i],
          b = marks[j],
          span = distance(a.enemy.body.position, b.enemy.body.position);
        if (
          span < 32 ||
          span > SHIFT.polarityRange ||
          !this.clearLine(a.enemy.body.position, b.enemy.body.position)
        )
          continue;
        const d = direction(a.enemy.body.position, b.enemy.body.position),
          sign = a.pole === b.pole ? -1 : 1;
        for (const [mark, scale] of [
          [a, 1],
          [b, -1],
        ] as const) {
          if (mark.enemy.body.isStatic) continue;
          const v = pushes.get(mark.enemy) ?? { x: 0, y: 0 },
            resist = isBoss(mark.enemy.kind) ? 0.06 : 1;
          v.x += d.x * sign * scale * resist * dt * 7;
          v.y += d.y * sign * scale * resist * dt * 7;
          pushes.set(mark.enemy, v);
        }
      }
    for (const [enemy, push] of pushes)
      Body.setVelocity(enemy.body, {
        x: clamp(enemy.body.velocity.x + clamp(push.x, -0.3, 0.3), -20, 20),
        y: clamp(enemy.body.velocity.y + clamp(push.y, -0.3, 0.3), -16, 16),
      });
  }
  private harness() {
    const g = this.game;
    if (
      !this.has('ricochet-harness') ||
      g.grounded ||
      g.mobility.grip ||
      this.rebounds >= (this.evolved('double-return') ? 2 : 1) ||
      g.time - this.recoilAt > 0.32
    )
      return;
    const v = this.recoilVelocity ?? this.beforeVelocity;
    if (!v || Math.hypot(v.x, v.y) < 6) return;
    const d = unit(v),
      from = this.beforePos ?? g.player.position;
    let hit = firstSolid(
      from,
      { x: g.player.position.x + d.x * 5, y: g.player.position.y + d.y * 5 },
      { x: 12.5, y: 17 },
      g.terrain,
    );
    if (!hit)
      hit = firstSolid(
        g.player.position,
        { x: g.player.position.x + d.x * 7, y: g.player.position.y + d.y * 7 },
        { x: 12.5, y: 17 },
        g.terrain,
      );
    if (!hit || hit.normal.y < -0.7) return;
    const dot = v.x * hit.normal.x + v.y * hit.normal.y;
    if (dot > -4) return;
    this.rebounds++;
    this.progress('rebound');
    Body.setVelocity(g.player, {
      x: clamp((v.x - 2 * dot * hit.normal.x) * 0.84, -23, 23),
      y: clamp((v.y - 2 * dot * hit.normal.y) * 0.84, -21, 20),
    });
    g.grounded = false;
    g.coyote = 0;
    this.effect(g.player.position);
    this.impactEcho();
  }
  private graze() {
    if (!this.has('slip-gauge') || this.slipCharges >= (this.evolved('deep-reserve') ? 2 : 1))
      return;
    const g = this.game,
      p = g.player.position;
    for (const s of g.shots) {
      if (
        s.friendly ||
        s.allied ||
        s.shell ||
        s.blade ||
        s.enemyAmmo ||
        s.radius > 5 ||
        s.damage > 28 ||
        s.damage <= 0 ||
        s.life <= 0 ||
        this.grazed.has(s)
      )
        continue;
      const near = closest(p, s.prev, s.pos),
        dx = Math.max(0, Math.abs(near.x - p.x) - 13),
        dy = Math.max(0, Math.abs(near.y - p.y) - 18);
      const gap = Math.hypot(dx, dy) - s.radius;
      if (gap < 2 || gap > 16 || !this.clearLine(near, p)) continue;
      this.grazed.add(s);
      if (this.slipUntil <= g.time) this.slipUntil = g.time + SHIFT.slipTime;
      else this.extraSlipUntil = g.time + SHIFT.slipTime;
      this.effect(p);
      break;
    }
  }
  private flight() {
    const g = this.game,
      p = g.player.position,
      v = g.player.velocity;
    if (!this.beforePos || !this.beforeVelocity || g.grounded) return;
    const travel = distance(this.beforePos, p);
    if (travel > 90) {
      this.liveTrail = [];
      return;
    }
    if (
      this.has('wake-wire') &&
      this.held &&
      g.time - this.recoilAt < 0.35 &&
      Math.hypot(v.x, v.y) >= 5
    ) {
      const last = this.liveTrail.at(-1);
      if (!last) this.liveTrail.push(copy(this.beforePos));
      if (!last || distance(last, p) >= 14) this.liveTrail.push(copy(p));
      while (
        this.liveTrail.length > SHIFT.wirePoints ||
        this.liveTrail.slice(1).reduce((n, point, i) => n + distance(this.liveTrail[i], point), 0) >
          SHIFT.wireLength
      )
        this.liveTrail.shift();
    }
    if (this.has('false-silhouette') && !this.silhouetteUsed && g.time - this.recoilAt < 0.15) {
      const old = this.recoilBefore,
        recoil = this.recoilVelocity;
      // Scale the flight gate to this paid kick, including the smaller native tools.
      // The kick itself must reverse flight; steering or a wall cannot manufacture a decoy.
      const a = old ? Math.hypot(old.x, old.y) : 0,
        b = Math.hypot(v.x, v.y),
        kick = old && recoil ? distance(old, recoil) : 0,
        minimum = clamp(kick * 0.3, 1, 3);
      if (
        old &&
        recoil &&
        a >= minimum &&
        b >= minimum &&
        (old.x * recoil.x + old.y * recoil.y) / a <= -minimum &&
        (old.x * v.x + old.y * v.y) / (a * b) < -0.25 &&
        !Matter.Query.point(g.solidBodies, this.beforePos).length
      ) {
        this.silhouetteUsed = true;
        this.silhouette = {
          pos: copy(this.beforePos),
          until: g.time + SHIFT.silhouetteTime,
          facing: Math.sign(old.x) || 1,
        };
      }
    }
  }
  private wireHits() {
    const g = this.game,
      wire = this.wire;
    if (!wire || !this.has('wake-wire') || wire.until <= g.time) return;
    if (wire.points.slice(1).some((p, i) => !this.clearLine(wire.points[i], p))) {
      this.wire = null;
      return;
    }
    for (const e of g.enemies) {
      if (e.hp <= 0 || e.spawn > 0 || e.allied || wire.hit.has(e.id)) continue;
      for (let i = 1; i < wire.points.length; i++) {
        const a = wire.points[i - 1],
          b = wire.points[i],
          near = closest(e.body.position, a, b);
        if (!sweepBox(a, b, { x: 5, y: 5 }, e.body) || !this.clearLine(near, e.body.position))
          continue;
        wire.hit.add(e.id);
        g.hitEnemy(e, wire.damage * (isBoss(e.kind) ? 0.4 : 1), near, true, true, true);
        this.effect(near);
        break;
      }
      if (!this.active) return;
    }
  }
  /** After native AI, immediately before Matter integration, so patrol steering cannot erase the impulse. */
  beforeIntegrate(dt: number) {
    if (!this.active || !Number.isFinite(dt) || dt <= 0) return;
    if (this.has('polarity-rounds')) this.forces(Math.min(dt, 0.05));
    for (const [e, push] of this.exchangePush) {
      if (e.hp > 0 && !e.body.isStatic && this.game.enemies.includes(e))
        Body.setVelocity(e.body, {
          x: clamp(e.body.velocity.x + push.x, -20, 20),
          y: clamp(e.body.velocity.y + push.y, -16, 16),
        });
    }
    this.exchangePush.clear();
  }
  private impactEcho() {
    const g = this.game;
    if (!this.evolved('impact-echo') || g.time < this.echoReadyAt) return;
    this.echoReadyAt = g.time + 0.9;
    let budget = 80;
    for (const e of g.enemies) {
      if (
        budget <= 0 ||
        e.hp <= 0 ||
        e.spawn > 0 ||
        e.allied ||
        isBoss(e.kind) ||
        distance(e.body.position, g.player.position) > 100 ||
        !this.clearLine(g.player.position, e.body.position)
      )
        continue;
      const damage = Math.min(budget, clamp(g.gun.damage * g.gun.pellets * 0.3, 10, 32));
      g.hitEnemy(e, damage, g.player.position, true, true, true);
      budget -= damage;
    }
  }
  private counterstep(lateral: number) {
    const g = this.game,
      from = { x: g.player.position.x, y: g.player.position.y - 3 };
    const aim = direction(g.player.position, g.aim);
    if (!aim.x && !aim.y) aim.x = lateral;
    const muzzle = g.lineEnd(from, { x: from.x + aim.x * 24, y: from.y + aim.y * 24 }, 3);
    g.addShot({
      pos: muzzle,
      vel: { x: aim.x * 22, y: aim.y * 22 },
      damage: clamp(g.gun.damage * g.gun.pellets * 0.45, 12, 45),
      life: 0.22,
      friendly: true,
      radius: 3,
      bounces: 0,
      pierce: 0,
      fragment: true,
      split: true,
    });
  }
  afterStep(dt: number, _input: Input) {
    if (!this.active || !Number.isFinite(dt) || dt <= 0) return;

    this.harness();
    this.graze();
    this.flight();
    this.wireHits();
  }
}
