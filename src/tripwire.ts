import Matter from 'matter-js';
import type { Game, Shot } from './game.ts';
import { closestBlastPoint } from './demolition.ts';
import { firstSolid } from './collisions.ts';
import { clamp, distance, type Vec } from './rules.ts';

export const TRIPWIRE = {
  min: 80,
  max: 720,
  arm: 0.22,
  limit: 2,
  radius: 104,
  damage: 2.4,
  tension: 0.75,
};
export interface WireAnchor {
  body: Matter.Body;
  pos: Vec;
  normal: Vec;
  origin: Vec;
  angle: number;
  damage: number;
}
export interface Tripwire {
  a: WireAnchor;
  b: WireAnchor;
  at: number;
  damage: number;
  tension: number;
}
// Continuous SAT against the enemy's visible convex hull, including its width.
// Testing only its center or its end position would miss fast charges.
export function wireCrossing(a: Vec, b: Vec, body: Matter.Body, from: Vec) {
  const delta = { x: body.position.x - from.x, y: body.position.y - from.y };
  const span = distance(a, b);
  if (span < 1) return null;
  const axes: Vec[] = [{ x: -(b.y - a.y) / span, y: (b.x - a.x) / span }];
  for (let i = 0; i < body.vertices.length; i++) {
    const p = body.vertices[i],
      q = body.vertices[(i + 1) % body.vertices.length],
      length = distance(p, q);
    if (length) axes.push({ x: -(q.y - p.y) / length, y: (q.x - p.x) / length });
  }
  let enter = 0,
    leave = 1;
  for (const axis of axes) {
    const dots = body.vertices.map((v) => (v.x - delta.x) * axis.x + (v.y - delta.y) * axis.y);
    const low = Math.min(...dots),
      high = Math.max(...dots);
    const ends = [a.x * axis.x + a.y * axis.y, b.x * axis.x + b.y * axis.y];
    const min = Math.min(...ends) - 1,
      max = Math.max(...ends) + 1;
    const speed = delta.x * axis.x + delta.y * axis.y;
    if (Math.abs(speed) < 1e-8) {
      if (high < min || low > max) return null;
      continue;
    }
    const t1 = (min - high) / speed,
      t2 = (max - low) / speed;
    enter = Math.max(enter, Math.min(t1, t2));
    leave = Math.min(leave, Math.max(t1, t2));
    if (enter > leave) return null;
  }
  const center = { x: from.x + delta.x * enter, y: from.y + delta.y * enter };
  const along = clamp(
    ((center.x - a.x) * (b.x - a.x) + (center.y - a.y) * (b.y - a.y)) / (span * span),
    0,
    1,
  );
  return { t: enter, point: { x: a.x + (b.x - a.x) * along, y: a.y + (b.y - a.y) * along } };
}

export class TripwireSystem {
  game: Game;
  anchor: WireAnchor | null = null;
  wires: Tripwire[] = [];
  private starts = new Map<Matter.Body, Vec>();
  private cover = new Map<Matter.Body, Vec[]>();
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.anchor = null;
    this.wires = [];
    this.starts.clear();
    this.cover.clear();
  }
  private surface(body: Matter.Body) {
    const g = this.game;
    return (
      body.isStatic &&
      !body.isSensor &&
      (g.terrain.includes(body) || g.breaches.bodies.includes(body))
    );
  }
  private valid(anchor: WireAnchor) {
    return (
      this.surface(anchor.body) &&
      distance(anchor.origin, anchor.body.position) < 0.01 &&
      Math.abs(anchor.angle - anchor.body.angle) < 0.0001
    );
  }
  private get blockers() {
    const g = this.game;
    return [
      ...g.solidBodies,
      ...g.enemies.filter((e) => e.crane && e.hp > 0 && e.spawn <= 0).map((e) => e.crane!.body),
    ];
  }
  private clear(a: Vec, b: Vec) {
    return !firstSolid(a, b, { x: 1, y: 1 }, this.blockers);
  }
  private validate() {
    if (this.anchor && !this.valid(this.anchor)) this.anchor = null;
    this.wires = this.wires.filter(
      (w) => this.valid(w.a) && this.valid(w.b) && this.clear(w.a.pos, w.b.pos),
    );
  }
  impact(s: Shot, body: Matter.Body | undefined, normal: Vec) {
    const g = this.game;
    if (
      !s.tripwire ||
      !body ||
      !this.surface(body) ||
      !g.mods.includes('tripwire') ||
      g.mode !== 'playing' ||
      g.escape?.phase === 'extracting' ||
      !s.friendly ||
      s.fragment ||
      s.echo ||
      s.reflected
    )
      return;
    const damage = s.tripwire;
    s.tripwire = undefined; // One center round, one anchor, even after banks or recall.
    if (!(damage > 0) || !Number.isFinite(damage)) return;
    this.validate();
    const point = closestBlastPoint(s.pos, body);
    const next: WireAnchor = {
      body,
      pos: { x: point.x + normal.x * 3, y: point.y + normal.y * 3 },
      normal: { ...normal },
      origin: { ...body.position },
      angle: body.angle,
      damage,
    };
    if (Matter.Vertices.contains(body.vertices, next.pos)) return;
    const a = this.anchor,
      length = a ? distance(a.pos, next.pos) : 0;
    // Repeated fire at one spot keeps the original pin rather than drawing stubs.
    if (a && length < TRIPWIRE.min) return;
    if (a && length <= TRIPWIRE.max && this.clear(a.pos, next.pos)) {
      const tension = g.mods.includes('tension')
        ? clamp((length - TRIPWIRE.min) / (600 - TRIPWIRE.min), 0, 1)
        : 0;
      this.wires.push({
        a,
        b: next,
        at: g.time + TRIPWIRE.arm,
        tension,
        damage:
          Math.min(260, (a.damage + damage) * 0.5 * TRIPWIRE.damage) *
          (1 + tension * TRIPWIRE.tension),
      });
      if (this.wires.length > TRIPWIRE.limit) this.wires.shift();
      this.anchor = null;
      g.onSound('tripwire-link');
    } else {
      this.anchor = next;
      g.onSound('tripwire-pin');
    }
  }
  beforeStep() {
    this.starts.clear();
    this.cover.clear();
    const g = this.game;
    if (g.mode !== 'playing' || g.hitStop > 0) return;
    if (!g.mods.includes('tripwire')) {
      this.reset();
      return;
    }
    this.validate();
    if (!this.wires.length) return;
    for (const e of g.enemies)
      if (e.hp > 0 && e.spawn <= 0) this.starts.set(e.body, { ...e.body.position });
    for (const b of this.blockers)
      this.cover.set(
        b,
        b.vertices.map((v) => ({ x: v.x, y: v.y })),
      );
  }
  teleported(body: Matter.Body) {
    // Portal travel has no intervening physical path. Contact at the exit still counts.
    if (this.starts.has(body)) this.starts.set(body, { ...body.position });
    if (this.cover.has(body))
      this.cover.set(
        body,
        body.vertices.map((v) => ({ x: v.x, y: v.y })),
      );
  }
  afterStep() {
    const g = this.game;
    if (g.mode !== 'playing' || g.hitStop > 0 || g.escape?.phase === 'extracting') return;
    this.validate();
    for (const wire of [...this.wires]) {
      if (g.mode !== 'playing') return;
      if (!this.wires.includes(wire)) continue;
      const { a, b } = wire;
      // Swept cover also cuts a wire when a fast train passes completely through
      // it in one step. Wires have no physics bodies and cannot jam machinery.
      const blocked = this.blockers.some((body) => {
        const old = this.cover.get(body);
        if (
          !old ||
          (old.length === body.vertices.length &&
            old.every((v, i) => distance(v, body.vertices[i]) < 0.01))
        )
          return false;
        const vertices = Matter.Vertices.hull([...old, ...body.vertices] as Matter.Vertex[]);
        return !!firstSolid(a.pos, b.pos, { x: 1, y: 1 }, [{ ...body, vertices }]);
      });
      if (blocked || !this.valid(a) || !this.valid(b) || !this.clear(a.pos, b.pos)) {
        this.wires = this.wires.filter((w) => w !== wire);
        continue;
      }
      if (g.time < wire.at) continue;
      const hits = g.enemies
        .filter((e) => e.hp > 0 && e.spawn <= 0)
        .flatMap((enemy) => {
          const hit = wireCrossing(
            a.pos,
            b.pos,
            enemy.body,
            this.starts.get(enemy.body) ?? enemy.body.position,
          );
          return hit ? [{ enemy, ...hit }] : [];
        })
        .sort((x, y) => x.t - y.t || x.enemy.id - y.enemy.id);
      const hit = hits[0];
      if (!hit) continue;
      // Remove before detonating: kills, destroyed anchors, and chain explosions
      // can all mutate the room while the ordinary blast system resolves.
      this.wires = this.wires.filter((w) => w !== wire);
      g.demolition.detonate(
        {
          pos: hit.point,
          damage: wire.damage,
          radius: TRIPWIRE.radius,
          launch: g.gun.blastSurf ? 8 : 0,
          kind: 'tripwire',
        },
        hit.enemy,
      );
      this.validate();
    }
    this.starts.clear();
    this.cover.clear();
  }
}
