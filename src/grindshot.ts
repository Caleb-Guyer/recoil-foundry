import type Matter from 'matter-js';
import type { Game, Shot } from './game.ts';
import { firstSolid, sweepBox } from './collisions.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';

export const GRIND = { speed: 420, life: 1.2, radius: 7, offset: 8.5, limit: 8 };
export interface GrindSaw {
  body: Matter.Body;
  edge: number;
  along: number;
  dir: number;
  pos: Vec;
  trail: Vec[];
  life: number;
  damage: number;
  hits: Set<number>;
  wrap: boolean;
  travel: number;
}

// Offset the actual convex hull, keeping even rotated surfaces and their corners
// outside the material. Moving supports supply fresh world vertices each step.
export function grindRail(body: Matter.Body): Vec[] {
  const v = body.vertices;
  const normals = v.map((a, i) => {
    const t = direction(a, v[(i + 1) % v.length]);
    return { x: t.y, y: -t.x };
  });
  return v.map((p, i) => {
    const a = normals[(i + v.length - 1) % v.length],
      b = normals[i];
    const scale = GRIND.offset / Math.max(0.1, 1 + a.x * b.x + a.y * b.y);
    return { x: p.x + (a.x + b.x) * scale, y: p.y + (a.y + b.y) * scale };
  });
}

export class GrindshotSystem {
  game: Game;
  saws: GrindSaw[] = [];
  soundAt = -Infinity;
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.saws = [];
    this.soundAt = -Infinity;
  }

  impact(shot: Shot, body: Matter.Body | undefined, normal: Vec) {
    const g = this.game;
    if (
      !body ||
      g.mode !== 'playing' ||
      !g.mods.includes('grindshot') ||
      !shot.friendly ||
      shot.fragment ||
      shot.echo ||
      shot.reflected ||
      shot.rail ||
      !g.terrainBodies.includes(body) ||
      !(shot.damage > 0)
    )
      return;
    const points = grindRail(body);
    let best = Infinity,
      edge = -1,
      along = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        t = direction(a, b);
      if (t.y * normal.x - t.x * normal.y < 0.5) continue;
      const u = clamp((shot.pos.x - a.x) * t.x + (shot.pos.y - a.y) * t.y, 0, distance(a, b));
      const d = distance(shot.pos, { x: a.x + t.x * u, y: a.y + t.y * u });
      if (d < best) {
        best = d;
        edge = i;
        along = u;
      }
    }
    if (edge < 0) return;
    const a = points[edge],
      t = direction(a, points[(edge + 1) % points.length]);
    const pos = { x: a.x + t.x * along, y: a.y + t.y * along };
    // Do not emerge on the far side of a thin obstruction or into a sealed gap.
    if (
      firstSolid(
        shot.pos,
        pos,
        { x: 2, y: 2 },
        g.solidBodies.filter((b) => b !== body),
      )
    )
      return;
    const tangent = shot.vel.x * t.x + shot.vel.y * t.y;
    const fallback = Math.abs(t.x) > 0.5 ? (g.aim.x - g.player.position.x || 1) * t.x : -t.y;
    this.saws.push({
      body,
      edge,
      along,
      dir: Math.sign(Math.abs(tangent) > 0.001 ? tangent : fallback),
      pos,
      trail: [pos],
      life: GRIND.life,
      damage: shot.damage,
      hits: new Set(shot.hits),
      wrap: g.mods.includes('corner-cutter'),
      travel: 0,
    });
    if (this.saws.length > GRIND.limit) this.saws.shift();
    if (g.time >= this.soundAt) {
      g.onSound('grind');
      this.soundAt = g.time + 0.12;
    }
  }

  private sweep(saw: GrindSaw, end: Vec): boolean {
    const g = this.game,
      start = saw.pos;
    const solids = [
      ...g.solidBodies,
      ...g.enemies.flatMap((e) => (e.crane ? [e.crane.body] : [])),
    ].filter((b) => b !== saw.body);
    const block = firstSolid(start, end, { x: GRIND.radius, y: GRIND.radius }, solids);
    const hits = g.enemies
      .filter((e) => e.hp > 0 && e.spawn <= 0 && !saw.hits.has(e.id))
      .map((e) => ({ e, hit: sweepBox(start, end, { x: GRIND.radius, y: GRIND.radius }, e.body) }))
      .filter(({ hit }) => hit && (!block || hit.t < block.t - 1e-6))
      .sort((a, b) => a.hit!.t - b.hit!.t || a.e.id - b.e.id);
    const velocity = direction(start, end);
    for (const { e, hit } of hits) {
      saw.hits.add(e.id);
      const source = {
        x: start.x + (end.x - start.x) * hit!.t - velocity.x * 10,
        y: start.y + (end.y - start.y) * hit!.t - velocity.y * 10,
      };
      // Secondary damage retains armor, directional shields and Bloodwork;
      // it never creates more saws or repeats the primary round's upgrade procs.
      const shielded = g.hitEnemy(e, saw.damage, source);
      if (shielded || g.mode !== 'playing') return false;
    }
    if (block) {
      const prop = g.props.items.find((p) => p.body === block.body);
      if (prop) g.props.hit(prop, saw.damage, velocity);
      else {
        g.breaches.hitBody(block.body, saw.damage, velocity);
        g.destruction.hitBody(block.body, saw.damage, velocity);
      }
      return false;
    }
    saw.pos = end;
    saw.trail.push({ ...end });
    if (saw.trail.length > 5) saw.trail.shift();
    return end.x >= 0 && end.x <= g.worldWidth && end.y >= g.worldTop && end.y <= 740;
  }

  update(dt: number) {
    const g = this.game;
    if (g.mode !== 'playing' || g.hitStop > 0) return;
    for (const saw of [...this.saws]) {
      if (g.mode !== 'playing') break;
      saw.life -= dt;
      if (saw.life <= 0 || !g.terrainBodies.includes(saw.body)) {
        saw.life = 0;
        continue;
      }
      const points = grindRail(saw.body);
      let budget = GRIND.speed * dt;
      let a = points[saw.edge],
        b = points[(saw.edge + 1) % points.length],
        t = direction(a, b);
      const carried = { x: a.x + t.x * saw.along, y: a.y + t.y * saw.along };
      if (distance(carried, saw.pos) > 0.001 && !this.sweep(saw, carried)) {
        saw.life = 0;
        continue;
      }
      // Small swept steps also prevent a blade from hopping across thin cover.
      for (let step = 0; step < 160 && budget > 0.001 && saw.life > 0; step++) {
        a = points[saw.edge];
        b = points[(saw.edge + 1) % points.length];
        t = direction(a, b);
        const length = distance(a, b),
          remaining = saw.dir > 0 ? length - saw.along : saw.along;
        const move = Math.min(8, budget, Math.max(0, remaining));
        saw.along += move * saw.dir;
        budget -= move;
        saw.travel += move * saw.dir;
        if (move > 0 && !this.sweep(saw, { x: a.x + t.x * saw.along, y: a.y + t.y * saw.along })) {
          saw.life = 0;
          break;
        }
        if (remaining <= move + 0.001) {
          if (!saw.wrap) {
            saw.life = 0;
            break;
          }
          saw.edge = (saw.edge + saw.dir + points.length) % points.length;
          saw.along =
            saw.dir > 0 ? 0 : distance(points[saw.edge], points[(saw.edge + 1) % points.length]);
        }
      }
    }
    this.saws = this.saws.filter((s) => s.life > 0 && g.terrainBodies.includes(s.body));
  }
}
