import Matter from 'matter-js';
import type { Game } from './game.ts';
import { firstSolid, sweepBox } from './collisions.ts';
import { clamp, distance } from './rules.ts';
import type { Vec } from './rules.ts';
import { breakSquad } from './squads.ts';

export const PORTAL_RADIUS = 40;
export const PORTAL_COLORS = ['#64ceff', '#ffa563'] as const;
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const tangent = (n: Vec): Vec => ({ x: -n.y, y: n.x });
const extent = (half: Vec, axis: Vec) => Math.abs(axis.x) * half.x + Math.abs(axis.y) * half.y;
export interface Portal {
  pos: Vec;
  normal: Vec;
  body: Matter.Body;
}
export interface Passage {
  t: number;
  entry: Portal;
  exit: Portal;
  pos: Vec;
}

// A rotation between the two facing surfaces, never a reflection or a speed boost.
export function portalVector(v: Vec, entry: Portal, exit: Portal): Vec {
  const inward = -dot(v, entry.normal),
    along = -dot(v, tangent(entry.normal));
  const t = tangent(exit.normal);
  return { x: exit.normal.x * inward + t.x * along, y: exit.normal.y * inward + t.y * along };
}

function overlaps(pos: Vec, half: Vec, body: Matter.Body) {
  const axes = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  for (let i = 0; i < body.vertices.length; i++) {
    const a = body.vertices[i],
      b = body.vertices[(i + 1) % body.vertices.length];
    axes.push({ x: -(b.y - a.y), y: b.x - a.x });
  }
  return axes.every((axis) => {
    const p = dot(pos, axis),
      r = extent(half, axis);
    const dots = body.vertices.map((v) => dot(v, axis));
    return p + r > Math.min(...dots) + 1e-6 && p - r < Math.max(...dots) - 1e-6;
  });
}
export function bodyHalf(body: Matter.Body): Vec {
  return {
    x: Math.max(...body.vertices.map((v) => Math.abs(v.x - body.position.x))),
    y: Math.max(...body.vertices.map((v) => Math.abs(v.y - body.position.y))),
  };
}

export class PortalSystem {
  game: Game;
  pair: [Portal | null, Portal | null] = [null, null];
  next = 0;
  revision = 0;
  rejected: { pos: Vec; until: number } | null = null;
  private starts = new Map<Matter.Body, Vec>();
  private cooldown = new WeakMap<Matter.Body, { until: number; exit: Portal }>();
  constructor(game: Game) {
    this.game = game;
  }
  get equipped() {
    return this.game.mods.includes('fold');
  }
  get canPlace() {
    return this.equipped && (this.next < 2 || this.game.mods.includes('rewire'));
  }
  get nextIndex() {
    return this.next % 2;
  }
  get linked() {
    return this.equipped && this.pair.every((p) => p && this.game.terrain.includes(p.body));
  }
  reset() {
    this.pair = [null, null];
    this.next = 0;
    this.rejected = null;
    this.starts.clear();
    this.cooldown = new WeakMap();
  }
  private free(pos: Vec, half: Vec, bodies: Matter.Body[]) {
    return (
      pos.x - half.x >= -0.01 &&
      pos.x + half.x <= this.game.worldWidth + 0.01 &&
      pos.y - half.y >= -0.01 &&
      pos.y + half.y <= 740.01 &&
      !bodies.some((b) => overlaps(pos, half, b))
    );
  }
  candidate(point: Vec): Portal | null {
    if (!this.canPlace || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    const candidates: { portal: Portal; score: number }[] = [];
    for (const body of this.game.terrain) {
      const { min, max } = body.bounds;
      const faces = [
        { normal: { x: -1, y: 0 }, edge: min.x, lo: Math.max(0, min.y), hi: Math.min(740, max.y) },
        { normal: { x: 1, y: 0 }, edge: max.x, lo: Math.max(0, min.y), hi: Math.min(740, max.y) },
        {
          normal: { x: 0, y: -1 },
          edge: min.y,
          lo: Math.max(0, min.x),
          hi: Math.min(this.game.worldWidth, max.x),
        },
        {
          normal: { x: 0, y: 1 },
          edge: max.y,
          lo: Math.max(0, min.x),
          hi: Math.min(this.game.worldWidth, max.x),
        },
      ];
      for (const { normal, edge, lo, hi } of faces) {
        if (hi - lo < PORTAL_RADIUS * 2) continue;
        const vertical = normal.x !== 0,
          along = vertical ? point.y : point.x;
        const score = Math.hypot(
          (vertical ? point.x : point.y) - edge,
          along - clamp(along, lo, hi),
        );
        if (score > 28) continue;
        const center = clamp(along, lo + PORTAL_RADIUS, hi - PORTAL_RADIUS);
        const pos = vertical ? { x: edge, y: center } : { x: center, y: edge };
        const other = this.pair[1 - this.nextIndex];
        if (other && distance(pos, other.pos) < PORTAL_RADIUS * 2 + 8) continue;
        // The entire opening needs an exposed, permanent face and room to emerge.
        const clearance = { x: pos.x + normal.x * 20.5, y: pos.y + normal.y * 20.5 };
        const half = vertical
          ? { x: 20, y: PORTAL_RADIUS - 0.1 }
          : { x: PORTAL_RADIUS - 0.1, y: 20 };
        if (this.free(clearance, half, this.game.solidBodies))
          candidates.push({ portal: { pos, normal, body }, score });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    return candidates[0]?.portal ?? null;
  }
  place(point: Vec) {
    if (!this.equipped || this.game.mode !== 'playing' || this.game.escape?.phase === 'extracting')
      return false;
    const p = this.candidate(point);
    if (!p) {
      this.rejected = { pos: { ...point }, until: this.game.time + 0.22 };
      this.game.onSound('portal-denied');
      return false;
    }
    this.pair[this.nextIndex] = p;
    this.game.burst(p.pos, 8, PORTAL_COLORS[this.nextIndex], 1.7);
    this.game.onSound(this.nextIndex === 0 ? 'portal-blue' : 'portal-orange');
    // Saturate after the initial pair; Rewire alternates 2 (blue) and 3 (orange).
    // Keeping the spent state independent of linkage prevents accidental refunds.
    this.next = this.next < 2 ? this.next + 1 : this.next === 2 ? 3 : 2;
    this.rejected = null;
    return true;
  }
  traceBody(from: Vec, to: Vec, body: Matter.Body, blockers = this.game.solidBodies) {
    // Before collision resolution, gravity and Matter's resting slop put feet
    // a fraction of a unit inside their support. Rounds get no such tolerance.
    return this.trace(from, to, bodyHalf(body), blockers, 0.5);
  }
  trace(
    from: Vec,
    to: Vec,
    half: Vec,
    blockers = this.game.solidBodies,
    contactTolerance = 0,
  ): Passage | null {
    if (!this.linked || Math.max(half.x, half.y) > PORTAL_RADIUS) return null;
    let nearest: Passage | null = null;
    for (let i = 0; i < 2; i++) {
      const entry = this.pair[i]!,
        exit = this.pair[1 - i]!;
      const delta = { x: to.x - from.x, y: to.y - from.y };
      const approach = -dot(delta, entry.normal);
      if (approach <= 1e-7) continue;
      const rel = { x: from.x - entry.pos.x, y: from.y - entry.pos.y };
      const gap = dot(rel, entry.normal) - extent(half, entry.normal);
      // Matter permits a small resting overlap. Never admit travel from behind a wall.
      if (gap < -1.5 || gap > approach + 0.15) continue;
      const t = clamp((gap - 0.15) / approach, 0, 1);
      const rawOffset = dot(
        { x: rel.x + delta.x * t, y: rel.y + delta.y * t },
        tangent(entry.normal),
      );
      const capacity =
        PORTAL_RADIUS -
        Math.max(extent(half, tangent(entry.normal)), extent(half, tangent(exit.normal)));
      if (Math.abs(rawOffset) > capacity + contactTolerance + 0.01) continue;
      // Keep the entire body inside the exit, even if its feet were fractionally
      // below the entrance rim during the unresolved gravity step.
      const offset = clamp(rawOffset, -capacity, capacity);
      const obstructed = blockers.some((body) => {
        if (body === entry.body) return false;
        const hit = sweepBox(from, to, half, body);
        if (!hit || hit.t > t + 1e-6) return false;
        if (contactTolerance && Math.abs(dot(hit.normal, entry.normal)) < 1e-6) {
          const plane = Math.max(...body.vertices.map((v) => dot(v, hit.normal)));
          const fromGap = dot(from, hit.normal) - plane - extent(half, hit.normal);
          const toGap = dot(to, hit.normal) - plane - extent(half, hit.normal);
          // Only allow sliding along an existing support. Steps, props in front,
          // and deeper penetration still block the approach normally.
          if (Math.abs(fromGap) <= contactTolerance && toGap >= -contactTolerance) return false;
        }
        return true;
      });
      if (obstructed) continue;
      const out = extent(half, exit.normal) + 0.75,
        axis = tangent(exit.normal);
      const pos = {
        x: exit.pos.x + exit.normal.x * out - axis.x * offset,
        y: exit.pos.y + exit.normal.y * out - axis.y * offset,
      };
      if (!this.free(pos, half, blockers)) continue;
      if (!nearest || t < nearest.t) nearest = { t, entry, exit, pos };
    }
    return nearest;
  }
  beforeStep() {
    this.starts.clear();
    if (!this.linked) return;
    const g = this.game;
    const bodies = [
      g.player,
      ...g.enemies.filter((e) => e.spawn <= 0).map((e) => e.body),
      ...g.props.bodies,
    ];
    for (const b of bodies) {
      if (b.isStatic) continue;
      const guard = this.cooldown.get(b);
      if (guard && this.pair.includes(guard.exit)) {
        const rel = { x: b.position.x - guard.exit.pos.x, y: b.position.y - guard.exit.pos.y };
        const half = bodyHalf(b);
        const nearOpening =
          dot(rel, guard.exit.normal) - extent(half, guard.exit.normal) < 6 &&
          Math.abs(dot(rel, tangent(guard.exit.normal))) <
            PORTAL_RADIUS + extent(half, tangent(guard.exit.normal));
        // A body at rest on the exit must leave its lip before it can re-enter.
        // A timer alone would flicker it between two floor portals indefinitely.
        if (g.time < guard.until || nearOpening) continue;
      }
      this.cooldown.delete(b);
      this.starts.set(b, { ...b.position });
    }
  }
  // Matter has integrated movement, but has not resolved the supporting wall yet.
  afterIntegrate() {
    const g = this.game;
    if (g.mode !== 'playing' || !this.linked) return;
    for (const [body, from] of this.starts) {
      const half = bodyHalf(body);
      const blockers = [
        ...g.solidBodies,
        g.player,
        ...g.enemies.map((e) => e.body),
        ...g.enemies.flatMap((e) => (e.crane ? [e.crane.body] : [])),
      ].filter((b) => b !== body);
      const passage = this.traceBody(from, body.position, body, blockers);
      if (!passage) continue;
      const { entry, exit, pos, t } = passage;
      const rest = portalVector(
        { x: (body.position.x - from.x) * (1 - t), y: (body.position.y - from.y) * (1 - t) },
        entry,
        exit,
      );
      const end = { x: pos.x + rest.x, y: pos.y + rest.y };
      const solid = firstSolid(pos, end, half, blockers);
      const travel = solid ? Math.max(0, solid.t - 0.01) : 1;
      const velocity = portalVector(body.velocity, entry, exit);
      Matter.Body.setPosition(body, { x: pos.x + rest.x * travel, y: pos.y + rest.y * travel });
      Matter.Body.setVelocity(body, velocity);
      // Old contact warm-start impulses belong to the entrance, not the exit.
      const impulse = (body as Matter.Body & { positionImpulse: Vec }).positionImpulse;
      impulse.x = impulse.y = 0;
      this.cooldown.set(body, { until: g.time + 0.14, exit });
      const enemy = g.enemies.find((e) => e.body === body);
      if (enemy) {
        breakSquad(g, enemy);
        enemy.aim = portalVector(enemy.aim, entry, exit);
        if (velocity.x) enemy.facing = Math.sign(velocity.x);
        if (enemy.interceptor) {
          // A teleported gun cannot release a warning drawn at its old position.
          enemy.interceptor.origin = { ...body.position };
          enemy.interceptor.launch = { x: 0, y: 0 };
          enemy.interceptor.volley = 0;
          enemy.interceptor.relocate = true;
          enemy.hunt = undefined;
          enemy.state = 'airborne';
          enemy.timer = 0.3;
        } else if (enemy.state === 'rush') {
          enemy.state = 'recover';
          enemy.timer = 0.3;
        }
      }
      g.props.velocities.set(body, { ...velocity });
      const prop = g.props.items.find((p) => p.body === body);
      if (prop) prop.velocity = { ...velocity };
      if (body === g.player) {
        g.evolutions.travel();
        this.revision++;
        g.trail = [];
        g.grounded = false;
        g.coyote = 0;
        g.jumpCut = true;
        g.landingSpeed = 0;
        g.feedback(1.2);
        g.onSound('portal-travel');
      }
      g.burst(exit.pos, 5, PORTAL_COLORS[this.pair.indexOf(exit)], 1.5);
    }
    this.starts.clear();
  }
}
