import type Matter from 'matter-js';
import type { Game, Input } from './game.ts';
import type { Vec } from './rules.ts';

export type OperatorSurfaceKind = 'metal' | 'grating' | 'coolant';
export type OperatorContactKind = 'step' | 'skid' | 'land';
export interface OperatorSurfaceContact {
  surface: OperatorSurfaceKind;
  body: Matter.Body;
  point: Vec;
  supportVelocity: Vec;
  beltSpeed: number;
}
export interface OperatorSurfaceMark {
  kind: OperatorContactKind;
  surface: OperatorSurfaceKind;
  point: Vec;
  at: number;
  side: -1 | 1;
  strength: number;
}
const finite = (n: number) => Number.isFinite(n);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** The upper polygon intersection under a boot, not a scenery/material guess. */
function topAt(body: Matter.Body, x: number) {
  let y = Infinity;
  const v = body.vertices;
  for (let i = 0; i < v.length; i++) {
    const a = v[i],
      b = v[(i + 1) % v.length];
    if (
      x < Math.min(a.x, b.x) - 0.01 ||
      x > Math.max(a.x, b.x) + 0.01 ||
      Math.abs(b.x - a.x) < 0.001
    )
      continue;
    y = Math.min(y, a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x));
  }
  return y;
}
/** Pure, native foot support: moving decks, counterweights, props and coolant bounds. */
export function operatorSurfaceContact(g: Game): OperatorSurfaceContact | null {
  const p = g.player;
  if (!p || !finite(p.position.x) || !finite(p.position.y) || !finite(p.velocity.y)) return null;
  const feet = Math.max(...p.vertices.map((v) => v.y));
  const platform = g.counterweights.supporting(p);
  let best: { body: Matter.Body; x: number; y: number; gap: number } | null = null;
  for (const body of g.solidBodies) {
    if (body === p || body.isSensor || !body.vertices.length) continue;
    // Exact polygon bounds ignore Matter's velocity-expanded broad-phase box.
    const left = Math.min(...body.vertices.map((v) => v.x)),
      right = Math.max(...body.vertices.map((v) => v.x));
    if (p.position.x + 8 < left || p.position.x - 8 > right) continue;
    for (const offset of [0, -8, 8]) {
      const x = clamp(p.position.x + offset, left + 0.01, right - 0.01),
        y = topAt(body, x),
        gap = feet - y;
      if (!finite(y) || y < p.position.y + 9 || gap < -6 || gap > 5) continue;
      if (!best || Math.abs(gap) < Math.abs(best.gap)) best = { body, x, y, gap };
    }
  }
  if (!best) return null;
  const { body, x, y } = best;
  const belt = g.conveyors.items.find((b) => x > b.x && x < b.x + b.w && Math.abs(y - b.y) < 4);
  const supportVelocity =
    platform?.item.body === body
      ? { ...platform.velocity }
      : {
          x: body.velocity.x - body.angularVelocity * (y - body.position.y),
          y: body.velocity.y + body.angularVelocity * (x - body.position.x),
        };
  if (
    !finite(supportVelocity.x) ||
    !finite(supportVelocity.y) ||
    p.velocity.y < supportVelocity.y - 1.5
  )
    return null;
  const beltSpeed = belt && finite(belt.speed) ? belt.speed : 0;
  supportVelocity.x += beltSpeed;
  const wet = (g.level.coolant ?? []).some(
    (pool) =>
      p.position.x > pool.x &&
      p.position.x < pool.x + pool.w &&
      feet >= pool.y &&
      feet <= pool.y + pool.h + 6,
  );
  const prop = g.props.items.some((item) => item.body === body);
  const height =
    Math.max(...body.vertices.map((v) => v.y)) - Math.min(...body.vertices.map((v) => v.y));
  const surface: OperatorSurfaceKind = wet
    ? 'coolant'
    : belt || platform?.item.body === body || (!prop && height <= 30)
      ? 'grating'
      : 'metal';
  return { surface, body, point: { x: p.position.x, y }, supportVelocity, beltSpeed };
}
interface Sample {
  x: number;
  y: number;
  body: Matter.Body | null;
  bodyX: number;
  bodyY: number;
  angle: number;
  relative: number;
  portal: number;
  time: number;
}
/** Presentation-only cadence; no forces, particles, damage, RNG or persistence. */
export class OperatorSurface {
  readonly game: Game;
  contact: OperatorSurfaceContact | null = null;
  braking = 0;
  marks: OperatorSurfaceMark[] = [];
  private sample: Sample | null = null;
  private distance = 0;
  private lastStep = -100;
  private lastSkid = -100;
  private lastEvent = -100;
  private air = 0;
  private down = 0;
  private settled = false;
  private alternating: -1 | 1 = 1;
  private counts = { steps: 0, skids: 0, landings: 0 };
  private lastKind: string | null = null;
  constructor(game: Game) {
    this.game = game;
  }
  get diagnostics() {
    return {
      surface: this.contact?.surface ?? null,
      braking: this.braking,
      ...this.counts,
      lastKind: this.lastKind,
      lastAt: this.lastEvent,
      marks: this.marks.length,
    };
  }
  reset() {
    this.pause(false);
    this.marks = [];
    this.counts = { steps: 0, skids: 0, landings: 0 };
    this.lastKind = null;
    this.lastEvent = -100;
    this.settled = false;
  }
  pause(preserve = false) {
    this.sample = null;
    if (!preserve) {
      this.contact = null;
      this.braking = 0;
    }
    this.distance = 0;
    this.air = this.down = 0;
    this.lastStep = this.lastSkid = -100;
  }
  private emit(kind: OperatorContactKind, contact: OperatorSurfaceContact, strength: number) {
    const g = this.game;
    if (g.time - this.lastEvent < 0.12) return;
    this.lastEvent = g.time;
    this.lastKind = `operator-${kind}-${contact.surface}`;
    if (kind === 'step') this.counts.steps++;
    else if (kind === 'skid') this.counts.skids++;
    else this.counts.landings++;
    this.alternating = this.alternating === 1 ? -1 : 1;
    this.marks.push({
      kind,
      surface: contact.surface,
      point: { ...contact.point },
      at: g.time,
      side: this.alternating,
      strength: clamp(strength, 0.2, 1),
    });
    if (this.marks.length > 12) this.marks.splice(0, this.marks.length - 12);
    // Native land's thud/haptics are unchanged; this is its quiet contact material layer.
    g.soundAt(this.lastKind, contact.point, 'operator-surface');
  }
  update(dt: number, input: Input) {
    const g = this.game;
    if (
      g.mode !== 'playing' ||
      g.hp <= 0 ||
      g.clockOut.active ||
      g.shutdown.complete ||
      g.escape?.phase === 'extracting' ||
      g.finale.cinema?.active ||
      !finite(dt) ||
      dt <= 0 ||
      dt > 0.1
    ) {
      this.pause();
      return;
    }
    this.marks = this.marks.filter((mark) => g.time - mark.at >= 0 && g.time - mark.at < 0.38);
    const next = operatorSurfaceContact(g),
      old = this.sample,
      p = g.player;
    const relative = next ? p.velocity.x - next.supportVelocity.x : 0;
    const current: Sample = {
      x: p.position.x,
      y: p.position.y,
      body: next?.body ?? null,
      bodyX: next?.body.position.x ?? 0,
      bodyY: next?.body.position.y ?? 0,
      angle: next?.body.angle ?? 0,
      relative,
      portal: g.portals.revision,
      time: g.time,
    };
    this.contact = next;
    this.braking = 0;
    if (
      !old ||
      old.portal !== g.portals.revision ||
      g.time <= old.time ||
      Math.hypot(p.position.x - old.x, p.position.y - old.y) > 80
    ) {
      this.sample = current;
      this.distance = 0;
      this.air = this.down = 0;
      this.settled = !!next;
      return;
    }
    this.sample = current;
    if (!next) {
      this.air += dt;
      this.down = Math.max(this.down, g.landingSpeed, p.velocity.y);
      this.distance = 0;
      return;
    }
    if (!old.body && this.air >= 0.045) {
      const impact = Math.max(this.down, g.landingSpeed);
      if (this.settled && impact > 2.5) this.emit('land', next, impact / 16);
      this.settled = true;
      this.air = this.down = 0;
      this.distance = 0;
      this.lastStep = g.time;
      return;
    }
    this.air = this.down = 0;
    this.settled = true;
    if (old.body !== next.body) {
      this.distance = 0;
      return;
    }
    const move =
      typeof input.move === 'number' && finite(input.move)
        ? clamp(input.move, -1, 1)
        : Number(input.right) - Number(input.left);
    const carried =
      next.body.position.x -
      old.bodyX -
      (next.body.angle - old.angle) * (next.point.y - next.body.position.y);
    const travel = p.position.x - old.x - carried - next.beltSpeed * dt * 60;
    const speed = Math.abs(relative),
      slowing = Math.max(0, Math.abs(old.relative) - speed);
    const brakingIntent =
      Math.abs(move) < 0.1 || (Math.abs(move) > 0.1 && Math.sign(move) !== Math.sign(relative));
    if (brakingIntent && speed > 2 && Math.sign(old.relative) === Math.sign(relative))
      this.braking = clamp(slowing / 2, 0, 1);
    if (brakingIntent && speed >= 5 && Math.abs(travel) > 0.3 && g.time - this.lastSkid >= 0.32) {
      this.emit('skid', next, speed / 18);
      this.lastSkid = g.time;
      this.distance = 0;
      return;
    }
    if (Math.abs(move) < 0.12 || Math.sign(move) !== Math.sign(travel) || Math.abs(travel) < 0.15) {
      this.distance = 0;
      return;
    }
    this.distance = Math.min(80, this.distance + Math.abs(travel));
    if (this.distance >= 62 && g.time - this.lastStep >= 0.24) {
      this.emit('step', next, speed / 9);
      this.lastStep = g.time;
      this.distance = 0;
    }
  }
}
