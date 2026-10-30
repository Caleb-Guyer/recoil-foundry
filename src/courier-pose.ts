import type { Enemy, Game } from './game.ts';
import type { KillSource } from './commendations.ts';
import type { Vec } from './rules.ts';
import { clamp } from './rules.ts';
import { firstSolid } from './collisions.ts';

export const COURIER_SHUTDOWN_TIME = 0.85;
export const COURIER_WRECK_LIFE = 3.2;
export const COURIER_EVENT_LIFE = 0.7;
export const COURIER_HIT_LIFE = 0.24;
export interface CourierHullHit {
  at: number;
  healthLost: number;
  direction: Vec | null;
  local: Vec | null;
}
export interface CourierSnapshot {
  at: number;
  enemyId: number;
  position: Vec;
  velocity: Vec;
  angle: number;
  facing: number;
  hp: number;
  maxHp: number;
  spawn: number;
  running: boolean;
  resting: number;
  boost: number;
  opening: number;
  grounded: boolean;
  supportY: number | null;
  wheelDistance: number;
  landingAt: number | null;
  landingStrength: number;
  cargoHeld: boolean;
  wear: 0 | 1 | 2;
  hit: CourierHullHit | null;
}
export interface CourierPose {
  position: Vec;
  angle: number;
  facing: number;
  wheelAngle: number;
  suspension: number;
  bodyOffset: Vec;
  bodyAngle: number;
  cargoOffset: Vec;
  cargoAngle: number;
  cargoHeld: boolean;
  clampOpen: number;
  boost: number;
  wear: 0 | 1 | 2;
  energy: number;
  alpha: number;
  grounded: boolean;
  supportY: number | null;
  hitStrength: number;
  hitLocal: Vec | null;
  hitDirection: Vec | null;
  mode: 'waiting' | 'drive' | 'airborne' | 'rest' | 'hatch' | 'shutdown' | 'wreck';
}
export interface CourierLanding {
  bodyId: number;
  local: Vec;
  localNormal: Vec;
}
export interface CourierWreck {
  at: number;
  age: number;
  life: number;
  snapshot: CourierSnapshot;
  position: Vec;
  angle: number;
  velocity: Vec;
  supportY: number | null;
  grounded: boolean;
  landing: CourierLanding | null;
}
export interface CourierPresentationEvent {
  kind: 'drop' | 'pickup' | 'escape';
  at: number;
  age: number;
  life: number;
  position: Vec;
  snapshot: CourierSnapshot | null;
}
interface CourierObservation {
  enemyId: number;
  position: Vec;
  velocity: Vec;
  grounded: boolean;
  wheelDistance: number;
  landingAt: number | null;
  landingStrength: number;
}
const finite = (...values: number[]) => values.every(Number.isFinite);
const copy = (v: Vec): Vec => ({ x: v.x, y: v.y });
const rotate = (v: Vec, angle: number): Vec => ({
  x: v.x * Math.cos(angle) - v.y * Math.sin(angle),
  y: v.x * Math.sin(angle) + v.y * Math.cos(angle),
});
const localPoint = (v: Vec, center: Vec, angle: number) =>
  rotate({ x: v.x - center.x, y: v.y - center.y }, -angle);
const worldPoint = (v: Vec, center: Vec, angle: number) => {
  const r = rotate(v, angle);
  return { x: center.x + r.x, y: center.y + r.y };
};
/** Pure convex queries: no temporary Matter bodies, random draws or physics writes. */
function courierSupport(g: Game, e: Enemy) {
  if (e.body.velocity.y < -1) return null;
  const from = { x: e.body.position.x, y: e.body.bounds.max.y - 3 };
  const to = { x: from.x, y: e.body.bounds.max.y + 6 };
  const hit = firstSolid(from, to, { x: 10, y: 0 }, g.solidBodies);
  return hit && hit.normal.y < -0.45 ? { y: from.y + (to.y - from.y) * hit.t } : null;
}
function hullHit(e: Enemy, from?: Vec): Pick<CourierHullHit, 'local' | 'direction'> {
  if (!from || !finite(from.x, from.y)) return { local: null, direction: null };
  const p = e.body.position,
    dx = p.x - from.x,
    dy = p.y - from.y,
    length = Math.hypot(dx, dy);
  if (length < 0.001) return { local: null, direction: null };
  const direction = { x: dx / length, y: dy / length };
  const radius = Math.max(...e.body.vertices.map((v) => Math.hypot(v.x - p.x, v.y - p.y))) + 2;
  const outside = { x: p.x - direction.x * radius, y: p.y - direction.y * radius };
  const hit = firstSolid(outside, p, { x: 0, y: 0 }, [e.body]);
  const point = hit
    ? { x: outside.x + (p.x - outside.x) * hit.t, y: outside.y + (p.y - outside.y) * hit.t }
    : null;
  return { direction, local: point ? localPoint(point, p, e.body.angle) : null };
}
/** Detached live state; reading or drawing it never advances its observer. */
export function courierSnapshot(g: Game, e: Enemy): CourierSnapshot {
  return g.courier.presentation.snapshot(e);
}
export function courierPose(s: CourierSnapshot, time = s.at, reduced = false): CourierPose {
  const age = Math.max(0, time - (s.hit?.at ?? -100));
  const hitStrength =
    s.hit && age < COURIER_HIT_LIFE
      ? (1 - age / COURIER_HIT_LIFE) * clamp(s.hit.healthLost / 35, 0.2, 1)
      : 0;
  const landingAge = time - (s.landingAt ?? -100);
  const landing =
    landingAge >= 0 && landingAge < 0.24 ? (1 - landingAge / 0.24) * s.landingStrength : 0;
  const moving = s.grounded && Math.abs(s.velocity.x) > 0.15 && s.running && s.resting <= 0;
  const compression = reduced ? 0 : moving ? Math.sin(s.wheelDistance / 9) * 0.65 : 0;
  const suspension = (reduced ? 0 : landing * 2.5) + compression;
  const localDirection = s.hit?.direction ? rotate(s.hit.direction, -s.angle) : { x: 0, y: 0 };
  return {
    position: copy(s.position),
    angle: s.angle,
    facing: s.facing || 1,
    wheelAngle: reduced ? 0 : s.wheelDistance / 6,
    suspension,
    bodyOffset: { x: reduced ? 0 : localDirection.x * hitStrength * 2, y: suspension },
    bodyAngle: reduced
      ? 0
      : clamp(-s.velocity.y * s.velocity.x * 0.0007, -0.12, 0.12) +
        localDirection.x * hitStrength * 0.045,
    cargoOffset: { x: -1, y: -12 + suspension * 0.25 },
    cargoAngle: reduced ? 0 : clamp(s.velocity.x * s.velocity.y * 0.00045, -0.08, 0.08),
    cargoHeld: s.cargoHeld,
    clampOpen: 0,
    boost: s.boost > 0 ? 1 : 0,
    wear: s.wear,
    energy: 1,
    alpha: s.spawn > 0 ? 0.5 : 1,
    grounded: s.grounded,
    supportY: s.supportY,
    hitStrength,
    hitLocal: s.hit?.local ? copy(s.hit.local) : null,
    hitDirection: s.hit?.direction ? copy(s.hit.direction) : null,
    mode:
      s.opening > 0
        ? 'hatch'
        : !s.running
          ? 'waiting'
          : !s.grounded
            ? 'airborne'
            : s.resting > 0
              ? 'rest'
              : 'drive',
  };
}
/** A defeated rig has no captive case, energy, live health display or collision. */
export function courierShutdownPose(
  w: CourierWreck,
  reduced = false,
): CourierPose & { progress: number; settled: boolean } {
  const progress = clamp(w.age / COURIER_SHUTDOWN_TIME, 0, 1);
  const fold = reduced ? 1 : 1 - Math.pow(1 - progress, 3);
  const pose = courierPose(w.snapshot, w.at, true);
  return {
    ...pose,
    position: copy(w.position),
    angle: w.angle,
    wheelAngle: reduced
      ? w.snapshot.wheelDistance / 6
      : w.snapshot.wheelDistance / 6 +
        (1 - Math.pow(1 - progress, 2)) * w.snapshot.velocity.x * 0.12,
    suspension: fold * 3,
    bodyOffset: { x: -fold * 2, y: fold * 3 },
    bodyAngle: -0.12 * fold,
    cargoHeld: false,
    clampOpen: fold,
    boost: 0,
    energy: 0,
    alpha: clamp(w.life / 0.65, 0, 1),
    grounded: w.grounded,
    supportY: w.supportY,
    hitStrength: 0,
    hitLocal: null,
    hitDirection: null,
    mode: progress < 1 && !reduced ? 'shutdown' : 'wreck',
    progress,
    settled: w.grounded,
  };
}

/** One Courier, one inert wreck and at most eight short presentation events. */
export class CourierPresentation {
  readonly game: Game;
  enabled = true;
  wrecks: CourierWreck[] = [];
  events: CourierPresentationEvent[] = [];
  private observed: CourierObservation | null = null;
  private hit: CourierHullHit | null = null;
  private pending: CourierSnapshot | null = null;
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.observed = null;
    this.hit = null;
    this.pending = null;
    this.wrecks = [];
    this.events = [];
  }
  detach() {
    this.observed = null;
    this.hit = null;
    this.pending = null;
  }
  private eligible(e: Enemy) {
    return (
      this.enabled &&
      e.courier === true &&
      this.game.courier.enemy === e &&
      this.game.mode === 'playing' &&
      this.game.hp > 0 &&
      finite(
        this.game.time,
        e.hp,
        e.maxHp,
        e.body.position.x,
        e.body.position.y,
        e.body.velocity.x,
        e.body.velocity.y,
        e.body.angle,
      )
    );
  }
  snapshot(e: Enemy): CourierSnapshot {
    const g = this.game,
      r = g.courier,
      support = courierSupport(g, e),
      old = this.observed?.enemyId === e.id ? this.observed : null;
    return {
      at: g.time,
      enemyId: e.id,
      position: copy(e.body.position),
      velocity: copy(e.body.velocity),
      angle: e.body.angle,
      facing: e.facing || 1,
      hp: e.hp,
      maxHp: e.maxHp,
      spawn: e.spawn,
      running: r.enemy === e && r.running,
      resting: r.enemy === e ? r.resting : 0,
      boost: r.enemy === e ? r.boost : 0,
      opening: r.enemy === e ? r.opening : 0,
      grounded: !!support,
      supportY: support?.y ?? null,
      wheelDistance: old?.wheelDistance ?? 0,
      landingAt: old?.landingAt ?? null,
      landingStrength: old?.landingStrength ?? 0,
      cargoHeld: r.enemy === e && e.hp > 0,
      wear: e.hp <= e.maxHp * 0.3 ? 2 : e.hp <= e.maxHp * 0.65 ? 1 : 0,
      hit: this.hit && g.time - this.hit.at < COURIER_HIT_LIFE ? structuredClone(this.hit) : null,
    };
  }
  observe(e: Enemy) {
    if (!this.eligible(e)) return;
    const current = this.snapshot(e),
      old = this.observed;
    const dx = old?.enemyId === e.id ? current.position.x - old.position.x : 0;
    // A portal relocation is not a driven wheel revolution through the missing space.
    const driven = current.grounded && Math.abs(dx) < 80 ? dx : 0;
    const landing = !!old && !old.grounded && current.grounded && old.velocity.y > 0.5;
    this.observed = {
      enemyId: e.id,
      position: copy(current.position),
      velocity: copy(current.velocity),
      grounded: current.grounded,
      wheelDistance: ((old?.wheelDistance ?? 0) + driven) % 100000,
      landingAt: landing ? this.game.time : (old?.landingAt ?? null),
      landingStrength: landing ? clamp(old!.velocity.y / 14, 0, 1) : (old?.landingStrength ?? 0),
    };
  }
  beforeHit(e: Enemy, damage: number, source?: KillSource) {
    this.pending = null;
    if (
      source === 'cleanup' ||
      !this.eligible(e) ||
      !finite(damage) ||
      damage <= 0 ||
      damage < e.hp
    )
      return;
    this.pending = this.snapshot(e);
  }
  acceptedHit(e: Enemy, healthLost: number, from?: Vec, source?: KillSource) {
    if (source === 'cleanup' || !this.eligible(e) || !finite(healthLost) || healthLost <= 0) return;
    this.hit = { at: this.game.time, healthLost, ...hullHit(e, from) };
    if (this.pending) this.pending.hit = structuredClone(this.hit);
  }
  defeated(e: Enemy) {
    if (!this.enabled || !this.pending || this.pending.enemyId !== e.id || e.hp > 0) {
      this.pending = null;
      return;
    }
    const snapshot = structuredClone(this.pending);
    snapshot.cargoHeld = false;
    const w: CourierWreck = {
      at: this.game.time,
      age: 0,
      life: COURIER_WRECK_LIFE,
      snapshot,
      position: copy(snapshot.position),
      angle: snapshot.angle,
      velocity: {
        x: clamp(snapshot.velocity.x * 0.18, -1.5, 1.5),
        y: Math.min(0, snapshot.velocity.y * 0.12),
      },
      supportY: snapshot.supportY,
      grounded: false,
      landing: null,
    };
    this.wrecks = [w];
    this.detach();
  }
  event(
    kind: CourierPresentationEvent['kind'],
    position: Vec,
    snapshot: CourierSnapshot | null = null,
  ) {
    if (!this.enabled || !finite(position.x, position.y)) return;
    this.events.push({
      kind,
      at: this.game.time,
      age: 0,
      life: COURIER_EVENT_LIFE,
      position: copy(position),
      snapshot: snapshot ? structuredClone(snapshot) : null,
    });
    if (this.events.length > 8) this.events.splice(0, this.events.length - 8);
  }
  update() {
    const g = this.game;
    if (!this.enabled || g.mode !== 'playing') return;
    if (g.courier.enemy) this.observe(g.courier.enemy);
    this.events = this.events.filter((event) => {
      event.age = Math.max(0, g.time - event.at);
      event.life = Math.max(0, COURIER_EVENT_LIFE - event.age);
      return event.life > 0;
    });
    for (const w of this.wrecks) {
      const oldAge = w.age;
      w.age = Math.max(0, g.time - w.at);
      w.life = Math.max(0, COURIER_WRECK_LIFE - w.age);
      const frames = clamp((w.age - oldAge) * 60, 0, 6);
      if (!frames) continue;
      if (w.landing) {
        const body = g.solidBodies.find((body) => body.id === w.landing!.bodyId && !body.isSensor);
        if (body) {
          w.position = worldPoint(w.landing.local, body.position, body.angle);
          const normal = rotate(w.landing.localNormal, body.angle);
          w.angle = Math.atan2(normal.x, -normal.y);
          w.supportY = w.position.y + 16;
          w.grounded = true;
          w.velocity = { x: 0, y: 0 };
          continue;
        }
        w.landing = null;
        w.grounded = false;
      }
      w.velocity.x *= Math.pow(0.985, frames);
      w.velocity.y = Math.min(12, w.velocity.y + 0.28 * frames);
      const to = {
        x: w.position.x + w.velocity.x * frames,
        y: w.position.y + w.velocity.y * frames,
      };
      const hit = firstSolid(
        w.position,
        to,
        { x: 15, y: 16 },
        g.solidBodies.filter((body) => !body.isSensor),
      );
      if (hit && hit.normal.y < -0.45) {
        w.position = {
          x: w.position.x + (to.x - w.position.x) * hit.t,
          y: w.position.y + (to.y - w.position.y) * hit.t,
        };
        w.angle = Math.atan2(hit.normal.x, -hit.normal.y);
        w.landing = {
          bodyId: hit.body.id,
          local: localPoint(w.position, hit.body.position, hit.body.angle),
          localNormal: rotate(hit.normal, -hit.body.angle),
        };
        w.supportY = w.position.y + 16;
        w.grounded = true;
        w.velocity = { x: 0, y: 0 };
      } else {
        w.position = to;
        w.grounded = false;
        w.supportY = null;
      }
    }
    this.wrecks = this.wrecks.filter((w) => w.life > 0);
  }
}
