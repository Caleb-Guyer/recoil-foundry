import type { Enemy, Game } from './game.ts';
import type { KillSource } from './commendations.ts';
import { firstSolid, sweepBox } from './collisions.ts';
import {
  machineBodySnapshot,
  type MachineBodySnapshot,
  type MachineKind,
} from './machine-breakdown-pose.ts';
import type { Vec } from './rules.ts';

export const MACHINE_HIT_LIFETIME = 0.24;
export const MACHINE_MAX_HITS_PER_ENEMY = 3;
export const MACHINE_MAX_HITS = 96;
export const MACHINE_SHUTDOWN = 0.38;
export const MACHINE_WRECK_LIFETIME = 2.4;
export const MACHINE_MAX_WRECKS = 12;
export interface MachineHit {
  id: number;
  enemyId: number;
  kind: MachineKind;
  at: number;
  incoming: number;
  applied: number;
  healthLost: number;
  absorbed: number;
  blocked: boolean;
  /** Actual body-local hull contact; absent when the native source has no direction. */
  contact: { local: Vec; normal: Vec } | null;
}
export interface MachineLanding {
  point: Vec;
  center: Vec;
  normal: Vec;
  bodyId: number;
  local: Vec;
  localCenter: Vec;
  localNormal: Vec;
  available: boolean;
}
export interface MachineWreck {
  id: number;
  at: number;
  shutdown: number;
  lifetime: number;
  /** Pre-lethal native pose and identity, with no Enemy/Matter references. */
  visual: MachineBodySnapshot;
  landing: MachineLanding | null;
  hit: MachineHit | null;
}
const finite = (...values: number[]) => values.every(Number.isFinite);
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const rotate = (p: Vec, angle: number): Vec => ({
  x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
  y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
});
const local = (point: Vec, center: Vec, angle: number) =>
  rotate({ x: point.x - center.x, y: point.y - center.y }, -angle);
const world = (point: Vec, center: Vec, angle: number) => {
  const p = rotate(point, angle);
  return { x: p.x + center.x, y: p.y + center.y };
};
function cloneHit(hit: MachineHit): MachineHit {
  return {
    ...hit,
    contact: hit.contact
      ? { local: { ...hit.contact.local }, normal: { ...hit.contact.normal } }
      : null,
  };
}
function hullContact(e: Enemy, from?: Vec): MachineHit['contact'] {
  if (!from || !finite(from.x, from.y, e.body.position.x, e.body.position.y)) return null;
  const p = e.body.position,
    dx = from.x - p.x,
    dy = from.y - p.y,
    length = Math.hypot(dx, dy);
  if (length < 0.001) return null;
  // Extend the supplied native approach direction outside the actual convex hull.
  // This infers the struck face, never a weak point or an exposed-core bonus.
  const radius = Math.max(...e.body.vertices.map((v) => Math.hypot(v.x - p.x, v.y - p.y))) + 2;
  const start = { x: p.x + (dx / length) * radius, y: p.y + (dy / length) * radius };
  const hit = firstSolid(start, p, { x: 0, y: 0 }, [e.body]);
  if (!hit) return null;
  const point = { x: start.x + (p.x - start.x) * hit.t, y: start.y + (p.y - start.y) * hit.t };
  return { local: local(point, p, e.body.angle), normal: rotate(hit.normal, -e.body.angle) };
}
function edgeDistance(point: Vec, vertices: readonly Vec[]) {
  let distance = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length],
      dx = b.x - a.x,
      dy = b.y - a.y;
    const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    distance = Math.min(distance, Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t));
  }
  return distance;
}
/** A downward hull projection from the real actor, not an assumed world floor. */
export function machineLanding(g: Game, visual: MachineBodySnapshot): MachineLanding | null {
  const bodies = g.solidBodies.filter((b) => !b.isSensor && b.vertices.length > 2);
  if (!bodies.length) return null;
  const half = { x: visual.hull.x / 2, y: visual.hull.y / 2 };
  if (!finite(half.x, half.y, visual.position.x, visual.position.y) || half.x <= 0 || half.y <= 0)
    return null;
  const bottom = Math.max(...bodies.flatMap((b) => b.vertices.map((v) => v.y)));
  const to = {
    x: clamp(visual.position.x + visual.velocity.x * 7, half.x, g.worldWidth - half.x),
    y: Math.max(visual.position.y + 1, bottom + half.y + 2),
  };
  let nearest: { landing: MachineLanding; t: number } | null = null;
  for (const body of bodies) {
    const hit = sweepBox(visual.position, to, half, body);
    if (!hit || hit.normal.y > -0.45 || (nearest && hit.t >= nearest.t)) continue;
    const center = {
      x: visual.position.x + (to.x - visual.position.x) * hit.t,
      y: visual.position.y + (to.y - visual.position.y) * hit.t,
    };
    const point = {
      x: center.x - (Math.abs(hit.normal.x) < 0.001 ? 0 : Math.sign(hit.normal.x) * half.x),
      y: center.y - Math.sign(hit.normal.y) * half.y,
    };
    // Starting inside an expanded ceiling/wall cannot fabricate a support plane.
    if (point.y < visual.position.y + half.y - 6 || edgeDistance(point, body.vertices) > 5)
      continue;
    nearest = {
      t: hit.t,
      landing: {
        point,
        center,
        normal: { ...hit.normal },
        bodyId: body.id,
        local: local(point, body.position, body.angle),
        localCenter: local(center, body.position, body.angle),
        localNormal: rotate(hit.normal, -body.angle),
        available: true,
      },
    };
  }
  return nearest?.landing ?? null;
}
/** Cosmetic records only; native bodies, HP, AI, audio and rewards stay authoritative. */
export class MachineBreakdown {
  readonly game: Game;
  wrecks: MachineWreck[] = [];
  private hitsByEnemy = new Map<number, MachineHit[]>();
  private next = 0;
  constructor(game: Game) {
    this.game = game;
  }
  get diagnostics() {
    return {
      hits: [...this.hitsByEnemy.values()].reduce((n, a) => n + a.length, 0),
      wrecks: this.wrecks.length,
    };
  }
  reset() {
    this.hitsByEnemy.clear();
    this.wrecks = [];
    this.next = 0;
  }
  private eligible(e: Enemy, source?: KillSource) {
    const g = this.game;
    return (
      source !== 'cleanup' &&
      g.mode === 'playing' &&
      g.hp > 0 &&
      !g.workshop.active &&
      !g.finale.cinema?.active &&
      !e.workshopTarget &&
      e.recoilTarget === undefined &&
      !e.courier &&
      e.eventRole !== 'relay' &&
      e.spawn <= 0 &&
      (e.kind === 'runner' || e.kind === 'shooter' || e.kind === 'flyer') &&
      finite(
        g.time,
        e.body.position.x,
        e.body.position.y,
        e.body.velocity.x,
        e.body.velocity.y,
        e.hp,
        e.maxHp,
      )
    );
  }
  /** Called before native HP subtraction, committed only if the real kill proceeds. */
  beforeHit(e: Enemy, applied: number, source?: KillSource): MachineBodySnapshot | null {
    return this.eligible(e, source) && finite(applied) && applied > 0 && e.hp > 0 && applied >= e.hp
      ? machineBodySnapshot(e, this.game.time)
      : null;
  }
  hit(
    e: Enemy,
    incoming: number,
    applied: number,
    healthLost: number,
    blocked: boolean,
    from?: Vec,
    source?: KillSource,
  ) {
    if (
      !this.eligible(e, source) ||
      !finite(incoming, applied, healthLost) ||
      incoming <= 0 ||
      applied < 0 ||
      healthLost < 0
    )
      return;
    const hit: MachineHit = {
      id: ++this.next,
      enemyId: e.id,
      kind: e.kind as MachineKind,
      at: this.game.time,
      incoming,
      applied,
      healthLost,
      absorbed: Math.max(0, incoming - applied),
      blocked,
      contact: hullContact(e, from),
    };
    const list = this.hitsByEnemy.get(e.id) ?? [];
    list.push(hit);
    if (list.length > MACHINE_MAX_HITS_PER_ENEMY)
      list.splice(0, list.length - MACHINE_MAX_HITS_PER_ENEMY);
    this.hitsByEnemy.set(e.id, list);
    while (this.diagnostics.hits > MACHINE_MAX_HITS) {
      let oldestId: number | undefined,
        oldest = Infinity;
      for (const [id, hits] of this.hitsByEnemy)
        if (hits[0].id < oldest) {
          oldest = hits[0].id;
          oldestId = id;
        }
      const items = this.hitsByEnemy.get(oldestId!)!;
      items.shift();
      if (!items.length) this.hitsByEnemy.delete(oldestId!);
    }
  }
  getHits(enemyId: number): readonly MachineHit[] {
    return (this.hitsByEnemy.get(enemyId) ?? [])
      .filter((h) => this.game.time - h.at >= 0 && this.game.time - h.at < MACHINE_HIT_LIFETIME)
      .map(cloneHit);
  }
  defeated(e: Enemy, visual: MachineBodySnapshot | null, source?: KillSource) {
    if (
      !visual ||
      e.hp > 0 ||
      !this.eligible(e, source) ||
      this.wrecks.some((w) => w.visual.id === e.id)
    )
      return;
    const hits = this.hitsByEnemy.get(e.id),
      last = hits?.at(-1);
    this.wrecks.push({
      id: ++this.next,
      at: this.game.time,
      shutdown: MACHINE_SHUTDOWN,
      lifetime: MACHINE_WRECK_LIFETIME,
      visual: structuredClone(visual),
      landing: machineLanding(this.game, visual),
      hit: last ? cloneHit(last) : null,
    });
    if (this.wrecks.length > MACHINE_MAX_WRECKS)
      this.wrecks.splice(0, this.wrecks.length - MACHINE_MAX_WRECKS);
    this.hitsByEnemy.delete(e.id);
  }
  update() {
    const g = this.game;
    if (g.mode !== 'playing') return;
    if (!Number.isFinite(g.time)) {
      this.reset();
      return;
    }
    const alive = new Set(
      [...g.enemies, ...g.factions.allies].filter((e) => e.hp > 0).map((e) => e.id),
    );
    for (const [id, hits] of this.hitsByEnemy) {
      const kept = hits.filter((h) => g.time - h.at >= 0 && g.time - h.at < MACHINE_HIT_LIFETIME);
      if (!alive.has(id) || !kept.length) this.hitsByEnemy.delete(id);
      else this.hitsByEnemy.set(id, kept);
    }
    this.wrecks = this.wrecks.filter((w) => g.time - w.at >= 0 && g.time - w.at < w.lifetime);
    if (!this.wrecks.some((w) => w.landing?.available)) return;
    const bodies = new Map(g.solidBodies.map((b) => [b.id, b]));
    for (const wreck of this.wrecks) {
      const landing = wreck.landing;
      if (!landing?.available) continue;
      const body = bodies.get(landing.bodyId);
      if (!body || body.isSensor) {
        landing.available = false;
        wreck.lifetime = Math.min(wreck.lifetime, g.time - wreck.at + 0.16);
        continue;
      }
      landing.point = world(landing.local, body.position, body.angle);
      landing.center = world(landing.localCenter, body.position, body.angle);
      landing.normal = rotate(landing.localNormal, body.angle);
    }
  }
}
