import Matter from 'matter-js';
import type { Game, Enemy, Shot } from './game.ts';
import type { Prop } from './props.ts';
import { firstSolid } from './collisions.ts';
import { portalVector } from './portals.ts';
import { clamp, direction, distance, segmentBox, type Vec } from './rules.ts';
import { isBoss } from './enemies.ts';
import { POCKET, pocketDirection } from './corner-pocket.ts';
import type { PressureVent } from './pressure.ts';

export const TORCH = {
  range: 1100,
  radius: 1.5,
  scatterRadius: 5,
  burstSpacing: 0.7,
  burstWidth: 0.35,
  burstCycle: 3.1,
  output: 0.78,
  thrust: 1.2,
  heatTime: 1.5,
  heatBonus: 0.75,
  segments: 12,
};
export interface TorchSegment {
  portalExit?: TorchOrigin;
  a: Vec;
  b: Vec;
  dir: Vec;
  gain: number;
  body?: Matter.Body;
  normal?: Vec;
  enemy?: Enemy;
  prop?: Prop;
  cable?: Prop;
  anchor?: Enemy;
  valve?: PressureVent;
  ray?: number;
  muzzle?: boolean;
}
export interface TorchOrigin {
  pocketSpent?: boolean;
  from: Vec;
  dir: Vec;
  remaining: number;
  banks: number;
  pierce: number;
  gain: number;
  radius: number;
}
const add = (p: Vec, d: Vec, n: number): Vec => ({ x: p.x + d.x * n, y: p.y + d.y * n });
const shielded = (e: Enemy, d: Vec) => e.elite === 'shielded' && -d.x * e.facing > 0.45;
export const torchRadius = (g: Game) =>
  (g.gun.pellets > 1 ? TORCH.scatterRadius : TORCH.radius) * (g.torch?.finisher ? 0.6 : 1);

// Trace first, damage afterwards. Cutting a surface never lets the same step
// hit something that was behind it. Every segment uses actual convex hulls.
export function traceTorch(
  g: Game,
  rear = false,
  angle = 0,
  limit = TORCH.segments,
  relay = { used: false },
  start?: TorchOrigin,
): TorchSegment[] {
  let d = direction(g.player.position, g.aim);
  if (!d.x && !d.y) d = { x: 1, y: 0 };
  if (rear) d = { x: -d.x, y: -d.y };
  if (angle)
    d = {
      x: d.x * Math.cos(angle) - d.y * Math.sin(angle),
      y: d.x * Math.sin(angle) + d.y * Math.cos(angle),
    };
  let from = { x: g.player.position.x, y: g.player.position.y - 3 },
    remaining = TORCH.range,
    banks = g.gun.bounces,
    pierce = g.gun.pierce + (g.torch?.extraPierce ?? 0),
    gain = 1,
    pocketSpent = start?.pocketSpent ?? !!start;
  if (start) {
    from = { ...start.from };
    d = { ...start.dir };
    remaining = start.remaining;
    banks = start.banks;
    pierce = start.pierce;
    gain = start.gain;
  }
  const result: TorchSegment[] = [],
    visited = new Set<Matter.Body>();
  const radius = start?.radius ?? torchRadius(g),
    half = { x: radius, y: radius };
  for (let n = 0; n < limit && remaining > 1; n++) {
    const end = add(from, d, remaining),
      enemies = g.enemies.filter((e) => e.hp > 0 && e.spawn <= 0 && !visited.has(e.body)),
      hit = firstSolid(from, end, half, [
        ...g.solidBodies,
        ...enemies.map((e) => e.body),
        ...g.enemies.filter((e) => e.crane && e.spawn <= 0).map((e) => e.crane!.body),
      ]),
      cable = g.cargo.trace(from, end, radius),
      anchor = g.harpoons.trace(from, end, radius),
      valve = g.pressure.trace(from, end, radius),
      portal = g.portals.trace(from, end, half);
    const t = Math.min(hit?.t ?? 1, cable?.t ?? 1, anchor?.t ?? 1, valve?.t ?? 1),
      through = portal && portal.t <= t + 1e-6,
      point = add(from, d, remaining * (through ? portal!.t : t));
    const segment: TorchSegment = {
      a: { ...from },
      b: point,
      dir: { ...d },
      gain,
      muzzle: !start && n === 0,
    };
    result.push(segment);
    remaining -= distance(from, point);
    if (through) {
      if (!relay.used && g.mods.includes('relay-gate')) {
        relay.used = true;
        banks++;
        remaining *= 1.15;
      }
      from = { ...portal!.pos };
      d = portalVector(d, portal!.entry, portal!.exit);
      remaining -= 1;
      segment.portalExit = {
        pocketSpent,
        from: { ...from },
        dir: { ...d },
        remaining,
        banks,
        pierce,
        gain,
        radius,
      };
      continue;
    }
    if (valve && valve.t <= t && (!hit || valve.t < hit.t)) {
      segment.valve = valve.vent;
      break;
    }
    if (cable && cable.t <= t) {
      segment.cable = cable.prop;
      segment.normal = cable.normal;
      break;
    }
    if (anchor && anchor.t <= t) {
      segment.anchor = anchor.enemy;
      segment.normal = anchor.normal;
      break;
    }
    if (!hit) break;
    segment.body = hit.body;
    segment.normal = hit.normal;
    const enemy = enemies.find((e) => e.body === hit.body),
      prop = g.props.items.find((p) => p.body === hit.body);
    if (enemy) {
      segment.enemy = enemy;
      visited.add(enemy.body);
      if (shielded(enemy, d) || pierce-- <= 0) break;
      gain *= 0.8;
      from = add(point, d, 0.5);
      remaining -= 0.5;
      continue;
    }
    if (prop) {
      segment.prop = prop;
      break;
    }
    if (banks-- <= 0 || !g.terrainBodies.includes(hit.body)) break;
    const dot = d.x * hit.normal.x + d.y * hit.normal.y;
    d = { x: d.x - 2 * dot * hit.normal.x, y: d.y - 2 * dot * hit.normal.y };
    gain *= 1 + g.gun.bankGrowth;
    from = add(point, hit.normal, 0.5);
    if (g.mods.includes('corner-pocket') && !pocketSpent) {
      pocketSpent = true;
      gain /= POCKET.direct;
      d =
        pocketDirection(
          g,
          from,
          hit.normal,
          radius,
          new Set(g.enemies.filter((e) => visited.has(e.body)).map((e) => e.id)),
        ) ?? d;
    }
    remaining -= 0.5;
  }
  return result;
}

export class TorchSystem {
  game: Game;
  active = false;
  segments: TorchSegment[] = [];
  rear: TorchSegment[] = [];
  heat = 0;
  target: number | undefined;
  charging = 0;
  finisher = false;
  private chargeHeld = false;
  private focusTarget: number | undefined;
  private focus = 0;
  private lensHeat = 0;
  private lensTarget: number | undefined;
  private lensLeft = 0;
  private lensPower = 1;
  private pulseGain = 1;
  get chargeDuration() {
    return this.game.gun.interval * 3;
  }
  get chargeProgress() {
    return Math.min(1, this.charging / this.chargeDuration);
  }
  get emitting() {
    return (
      this.lensLeft > 0 ||
      (this.game.mods.includes('charge-lens') && this.game.time < this.burnUntil)
    );
  }
  get extraPierce() {
    return this.finisher ? 1 : this.game.mods.includes('charge-lens') ? 2 : 0;
  }
  private until = -1;
  private period = 0.22;
  private cycling = false;
  private burstLeft = 0;
  private restartAt = -1;
  private burnFrom = -1;
  private burnUntil = -1;
  private stepBurn = 0;
  private boost = 1;
  private recoilBoost = 1;
  private pulse: Shot | null = null;
  private processed = new Set<object>();
  private fracture = new Map<number, number>();
  private reflected = false;
  private wind = false;
  private split = false;
  private revision = -1;
  constructor(game: Game) {
    this.game = game;
  }
  get equipped() {
    return this.game.mods.includes('cutting-torch');
  }
  get discharge() {
    return this.active ? this.pulse?.discharge : undefined;
  }
  reset() {
    this.stop();
    this.until = -1;
    this.restartAt = -1;
    this.pulse = null;
    this.processed.clear();
    this.fracture.clear();
    this.revision = -1;
  }
  stop() {
    this.charging = 0;
    this.chargeHeld = false;
    this.focus = 0;
    this.focusTarget = undefined;
    this.lensHeat = 0;
    this.lensTarget = undefined;
    this.lensLeft = 0;
    this.pulseGain = 1;
    this.finisher = false;
    this.cycling = false;
    this.burstLeft = 0;
    this.burnUntil = -1;
    this.stepBurn = 0;
    this.active = false;
    this.segments = [];
    this.rear = [];
    this.heat = 0;
    this.target = undefined;
    this.boost = 1;
    this.recoilBoost = 1;
  }
  beforeStep(dt: number, held: boolean) {
    const g = this.game;
    const lens = g.mods.includes('charge-lens');
    if (
      !this.equipped ||
      (!held && !lens) ||
      g.mode !== 'playing' ||
      g.escape?.phase === 'extracting'
    ) {
      this.stop();
      return;
    }
    if (!(dt > 0) || !Number.isFinite(g.aim.x) || !Number.isFinite(g.aim.y)) {
      this.stop();
      return;
    }
    this.cycling = true;
    g.burstRemaining = 0;
    let d = direction(g.player.position, g.aim);
    if (!d.x && !d.y) d = { x: 1, y: 0 };
    const bursting = g.gun.burstCount === 3;
    let due = g.time + 1e-8 >= this.until;
    if (lens) {
      due = this.chargeStep(dt, held);
    } else if (bursting) {
      const start = g.time - dt;
      if (!this.burstLeft && g.time > this.restartAt + 1e-8) {
        this.until = Math.max(start, this.restartAt);
        this.restartAt = this.until + g.gun.interval * TORCH.burstCycle;
        this.burstLeft = 3;
      }
      due = this.burstLeft > 0 && g.time + 1e-8 >= this.until;
      if (due) {
        this.burnFrom = this.until;
        this.burnUntil = this.burnFrom + g.gun.interval * TORCH.burstWidth;
        this.burstLeft--;
        this.finisher = g.mods.includes('pulse-chamber') && this.burstLeft === 0;
        this.pulseGain = g.mods.includes('pulse-chamber') ? (this.finisher ? 1.6 : 0.7) : 1;
        if (!this.finisher && g.mods.includes('resonator')) this.pulseGain *= 0.75;
        this.until = this.burstLeft
          ? this.burnFrom + g.gun.interval * TORCH.burstSpacing
          : Infinity;
      }
      // Integrate the lit part of the fixed step, including fractional edges.
      // A pulse delivers one discharge's damage and recoil, independent of FPS.
      this.stepBurn = Math.max(
        0,
        Math.min(g.time, this.burnUntil) - Math.max(start, this.burnFrom),
      );
    } else this.stepBurn = dt;
    this.active = this.stepBurn > 1e-8;
    // Pay shot-based charges at the gun's ordinary cadence, never each frame.
    if (due) {
      this.pulse = null;
      g.evolutions.settle();
      this.period = g.gun.interval * (lens ? 0.25 : bursting ? TORCH.burstWidth : 1);
      if (!bursting && !lens) this.until = g.time + this.period;
      g.shootAt = bursting || lens ? this.restartAt : this.until;
      const landing = g.gun.landing && g.landingReady,
        capacitor = g.ballistics.discharge();
      g.landingReady = false;
      g.shotCount++;
      g.onHaptic('shot', g.grounded ? 0.25 : 0.45);
      const evolution = g.evolutions.discharge(g.shotCount);
      // Redline remains responsive to actual speed during continuous thrust.
      this.boost =
        ((landing ? 2 : 1) * (capacitor ? 2 : 1) * evolution) / (1 + g.evolutions.redline);
      this.recoilBoost = (landing ? 1.25 : 1) * g.mobility.shot(d);
      g.scrap.fire(d);
      g.chargedFlash = landing || capacitor || evolution / (1 + g.evolutions.redline) > 1;
      this.pulse = {
        id: ++g.id,
        pos: { ...g.player.position },
        prev: { ...g.player.position },
        vel: { x: 0, y: 0 },
        damage: 0,
        life: this.period,
        friendly: true,
        radius: torchRadius(g),
        bounces: 0,
        pierce: 0,
        fragment: false,
        split: false,
        banks: 0,
        bankGrowth: 0,
        charged: g.chargedFlash,
        hits: new Set(),
        discharge: g.shotCount,
      };
      this.processed.clear();
      this.fracture.clear();
      this.reflected = this.wind = this.split = false;
      if (g.gun.backblast) g.fireBackblast(d, this.payload() * 0.8);
      if (lens) g.onSound('charged');
    }
    if (!this.active) return;
    g.mobility.thrust(d);
    g.lastShot = g.time;
    g.muzzle = 0;
    const impulse =
      (g.gun.recoil / this.period) *
      this.stepBurn *
      TORCH.thrust *
      this.pulseGain *
      (g.grounded ? 0.21 : 1) *
      this.recoilBoost;
    Matter.Body.setVelocity(g.player, {
      x: clamp(g.player.velocity.x - d.x * impulse, -23, 23),
      y: clamp(g.player.velocity.y - d.y * impulse, -21, 20),
    });
    // Ramjet still requires fast travel; a beam renews its launch, not its hits.
    g.salvage.launch(d, g.gun.recoil * (g.grounded ? 0.21 : 1));
    g.feedback(this.stepBurn * (g.grounded ? 2 : 5), d);
  }
  private payload() {
    const g = this.game;
    return (
      g.gun.damage *
      g.gun.pellets *
      this.pulseGain *
      TORCH.output *
      this.boost *
      (g.grounded ? 1 : g.gun.airDamage) *
      (1 + g.evolutions.redline)
    );
  }
  private chargeStep(dt: number, held: boolean) {
    const g = this.game;
    const released = this.chargeHeld && !held;
    this.chargeHeld = held;
    if (!this.emitting && g.time >= this.restartAt) {
      if (held) {
        this.charging = Math.min(this.chargeDuration, this.charging + dt);
        const s = traceTorch(g).find((segment) => segment.enemy);
        const enemy = s?.enemy && !shielded(s.enemy, s.dir) ? s.enemy : undefined;
        if (enemy?.id !== this.focusTarget) this.focus = 0;
        this.focusTarget = enemy?.id;
        this.focus =
          enemy && g.mods.includes('thermal-runaway')
            ? Math.min(1, this.focus + dt / this.chargeDuration)
            : 0;
      } else if (released && this.charging >= 0.06) {
        const bursting = g.gun.burstCount === 3;
        this.lensPower = 4 * Math.pow(this.chargeProgress, 1.2) * (bursting ? 0.45 : 1);
        this.lensHeat = this.focus;
        this.lensTarget = this.focusTarget;
        this.lensLeft = bursting ? 3 : 1;
        this.until = g.time - dt;
        this.restartAt =
          this.until +
          (this.lensLeft - 1) * g.gun.interval * 0.45 +
          g.gun.interval * (0.25 + (bursting ? 1.35 : 1));
        this.charging = this.focus = 0;
      } else if (!held) this.charging = this.focus = 0;
    }
    const due = this.lensLeft > 0 && g.time + 1e-8 >= this.until;
    if (due) {
      this.burnFrom = this.until;
      this.burnUntil = this.burnFrom + g.gun.interval * 0.25;
      this.lensLeft--;
      this.until = this.lensLeft ? this.burnFrom + g.gun.interval * 0.45 : Infinity;
      this.pulseGain = this.lensPower;
    }
    this.stepBurn = Math.max(
      0,
      Math.min(g.time, this.burnUntil) - Math.max(g.time - dt, this.burnFrom),
    );
    if (!this.stepBurn) {
      this.segments = [];
      this.rear = [];
    }
    return due;
  }
  private paths(rear = false, relay = { used: false }) {
    const g = this.game;
    if (!g.mods.includes('prism-array')) return traceTorch(g, rear, 0, TORCH.segments, relay);
    const limit = Math.floor(TORCH.segments / (g.gun.rearVolley ? 4 : 2));
    return [-0.09, 0.09].flatMap((angle, ray) =>
      traceTorch(g, rear, angle, limit, relay).map((s) => ({
        ...s,
        gain: s.gain * 0.6,
        ray: ray + (rear ? 2 : 0),
      })),
    );
  }
  afterStep(dt: number) {
    const g = this.game;
    if (!this.cycling || !this.equipped || g.mode !== 'playing' || !(dt > 0)) return;
    if (this.revision !== g.portals.revision) {
      this.heat = 0;
      this.target = undefined;
      this.revision = g.portals.revision;
    }
    const relay = { used: false };
    this.segments = this.paths(false, relay);
    this.rear = g.gun.rearVolley ? this.paths(true, relay) : [];
    const target = this.segments.find((s) => (s.ray ?? 0) === 0 && s.enemy)?.enemy,
      eligible = target && !shielded(target, this.segments.find((s) => s.enemy === target)!.dir);
    if (!eligible || target.id !== this.target) {
      this.heat = 0;
      this.target = eligible ? target.id : undefined;
    }
    // Intentional gaps preserve heat only while the aim still tracks the same
    // exposed target. They deal no damage, thrust, contact procs or deflections.
    if (!this.active) return;
    const burn = this.stepBurn;
    const old = this.heat;
    if (g.mods.includes('charge-lens'))
      this.heat = eligible && target.id === this.lensTarget ? this.lensHeat : 0;
    else if (eligible && g.mods.includes('thermal-runaway'))
      this.heat = Math.min(1, this.heat + burn / TORCH.heatTime);
    const hot =
      1 + (g.mods.includes('charge-lens') ? this.heat : (old + this.heat) * 0.5) * TORCH.heatBonus;
    const all = [...this.segments, ...this.rear],
      damaged = new Set<string>();
    if (this.finisher && g.mods.includes('resonator')) {
      const exit = all.find((s) => s.portalExit)?.portalExit;
      if (exit)
        g.fusions.resonator.record(
          this.pulse!.id,
          exit,
          (this.payload() * burn) / this.period,
          this.target,
          hot,
          this.burnUntil,
        );
    }
    for (const segment of all) {
      if (g.mode !== 'playing') {
        this.stop();
        return;
      }
      const s = this.pulse!;
      if (segment.valve) g.pressure.trigger(segment.valve);
      s.pos = { ...segment.b };
      s.prev = { ...segment.a };
      s.vel = {
        x: segment.dir.x * g.gun.projectileSpeed,
        y: segment.dir.y * g.gun.projectileSpeed,
      };
      s.damage =
        this.payload() *
        segment.gain *
        (segment.enemy?.id === this.target && (segment.ray ?? 0) === 0 ? hot : 1);
      const object = segment.body ?? segment.cable ?? segment.anchor;
      const first = object && !this.processed.has(object);
      if (first) this.processed.add(object!);
      const hitKey = `${segment.enemy?.id}:${segment.ray ?? 0}`;
      if (segment.enemy && !damaged.has(hitKey)) {
        const e = segment.enemy;
        damaged.add(hitKey);
        if (e.hp <= 0 || !g.enemies.includes(e)) continue;
        if (first) {
          this.fracture.set(e.id, g.ballistics.fracture(e, s));
          g.ballistics.consumeFracture(e, s);
        }
        const damage =
          ((s.damage * burn) / this.period) *
          (this.fracture.get(e.id) ?? 1) *
          (g.gun.execute && e.hp < e.maxHp * 0.3 ? 1.6 : 1);
        const blocked = g.hitEnemy(e, damage, add(e.body.position, segment.dir, -30), !!first);
        if (!blocked) {
          g.evolutions.hit(s);
          if (first) {
            g.ballistics.rivet(e, s);
            g.tethers.hit(e, s);
            g.arcs.hit(e, s);
            g.salvage.impact(s);
          }
          if (e.hp > 0 && !e.body.isStatic) {
            const force = (burn / this.period) * (isBoss(e.kind) ? 0.08 : 1);
            Matter.Body.setVelocity(e.body, {
              x: e.body.velocity.x + s.vel.x * 0.12 * force,
              y: e.body.velocity.y + s.vel.y * 0.09 * force,
            });
          }
        }
      } else if (first) {
        if (segment.cable) g.cargo.cut(segment.cable, s.damage);
        else if (segment.anchor) g.harpoons.hitAnchor(segment.anchor, s.damage);
        else if (segment.prop) g.props.hit(segment.prop, s.damage, s.vel, s);
        else if (segment.body) {
          g.counterweights.hit(segment.body, segment.b, s.vel, s.damage);
          g.grapnel.impact(s, segment.body, segment.normal);
          g.breaches.hitBody(segment.body, s.damage, s.vel, s);
          g.destruction.hitBody(segment.body, s.damage, s.vel, s);
        }
      }
      if (first && !this.split) {
        g.splitShot(s, segment.normal);
        this.split = s.split;
      }
      if (first && !segment.enemy) g.salvage.impact(s, segment.body, segment.normal);
      if (!this.wind) g.salvage.trace(s, segment.a, segment.b);
      // Beam pulses share Countershot's recovery with all other rounds.
      // Traced segments still stop at solids/cables/portals before interception.
      if (!this.reflected && g.mods.includes('countershot') && g.ballistics.counterReady) {
        const hits = g.shots
          .filter((b) => !b.friendly && !b.allied && b.life > 0 && !b.blade && b.radius <= 5)
          .flatMap((b) => {
            const r = b.radius + torchRadius(g),
              h = segmentBox(
                segment.a,
                segment.b,
                { x: b.pos.x - r, y: b.pos.y - r },
                { x: b.pos.x + r, y: b.pos.y + r },
              );
            const point = h
              ? add(segment.a, segment.dir, distance(segment.a, segment.b) * h.t)
              : segment.a;
            return h &&
              h.t < 1 - 1e-6 &&
              !firstSolid(point, b.pos, { x: 0, y: 0 }, [
                ...g.solidBodies,
                ...g.enemies.filter((e) => e.spawn <= 0).map((e) => e.body),
              ])
              ? [{ b, t: h.t }]
              : [];
          })
          .sort((a, b) => a.t - b.t);
        if (hits[0]) {
          this.reflected = g.ballistics.reflectRound(hits[0].b, { ...hits[0].b.pos });
        }
      }
    }
    this.wind = true;
    g.evolutions.settle();
  }
}
