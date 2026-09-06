import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level } from './levels.ts';
import { clamp, direction, distance, segmentBox, seeded, sample } from './rules.ts';
import type { Vec } from './rules.ts';

const { Bodies, Body, Composite, Events } = Matter;
export type PropKind = 'crate' | 'canister' | 'cover';
export const PROP_STATS = {
  crate: { w: 44, h: 44, hp: 120 },
  canister: { w: 24, h: 38, hp: Infinity },
  cover: { w: 24, h: 84, hp: 72 },
};
export interface Prop {
  kind: PropKind;
  body: Matter.Body;
  hp: number;
  maxHp: number;
  flash: number;
  armedAt: number;
  detonateAt: number;
  velocity: Vec;
  hits: Map<number, number>;
}
export interface PropPlacement extends Vec {
  kind: PropKind;
}

// Three small objects per room. Only wide, clear support surfaces are eligible.
// Geometry and spawn anchors remain authoritative; scenery never creates a prop.
export function propPlacements(level: Level, seed: string): PropPlacement[] {
  const result: PropPlacement[] = [];
  const rng = seeded(seed + ':props:' + level.id);
  const supports = [{ x: 260, y: 740, w: 1500, h: 100 }, ...level.solids];
  const kinds: PropKind[] = level.boss
    ? ['crate', 'canister']
    : level.area === 'furnace' && rng() < 0.4
      ? ['crate', 'canister', 'canister']
      : ['crate', 'canister', 'cover'];
  for (const kind of kinds) {
    const paired = kind === 'canister' ? result.find((p) => p.kind === 'canister') : undefined;
    const { w, h } = PROP_STATS[kind];
    const candidates: Vec[] = [];
    for (const support of supports) {
      if (support.y < 240 || support.w < w + 60) continue;
      for (let x = support.x + 35 + w / 2; x < support.x + support.w - 35 - w / 2; x += 80) {
        const y = support.y - h / 2 - 1;
        if (x < 320 || x > 1740) continue;
        if (kind === 'cover') {
          const path = [{ x: 140, y: 680 }, ...level.route, { x: 1910, y: 720 }];
          if (
            path
              .slice(1)
              .some((point, i) =>
                segmentBox(
                  path[i],
                  point,
                  { x: x - w / 2 - 26, y: y - h / 2 - 25 },
                  { x: x + w / 2 + 26, y: y + h / 2 + 25 },
                ),
              )
          )
            continue;
        }
        if (
          level.solids.some(
            (s) =>
              x + w / 2 + 12 > s.x &&
              x - w / 2 - 12 < s.x + s.w &&
              y + h / 2 > s.y &&
              y - h / 2 - 12 < s.y + s.h,
          )
        )
          continue;
        if (
          level.spawns.some((s) => Math.abs(x - s.x) < w / 2 + 65 && Math.abs(y - s.y) < h / 2 + 65)
        )
          continue;
        if (result.some((p) => distance(p, { x, y }) < (p === paired ? 75 : 280))) continue;
        candidates.push({ x, y });
      }
    }
    // A crate near the entrance teaches that shots move it before the busy fights.
    const preferred = paired
      ? candidates.filter((p) => distance(p, paired) < 145)
      : kind === 'crate'
        ? candidates.filter((p) => p.x < 850 && p.y > 600)
        : candidates;
    const point = sample(preferred.length ? preferred : candidates, 1, rng)[0];
    if (point) result.push({ kind, ...point });
  }
  return result;
}

// Matter bounds include velocity padding. Trace the visible, rotated hull instead.
export function traceProp(prop: Prop, start: Vec, end: Vec, padding = 0) {
  const { position: p, angle } = prop.body;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const local = (v: Vec) => ({
    x: (v.x - p.x) * cos + (v.y - p.y) * sin,
    y: -(v.x - p.x) * sin + (v.y - p.y) * cos,
  });
  const { w, h } = PROP_STATS[prop.kind];
  const hit = segmentBox(
    local(start),
    local(end),
    { x: -w / 2 - padding, y: -h / 2 - padding },
    { x: w / 2 + padding, y: h / 2 + padding },
  );
  if (!hit) return null;
  return {
    t: hit.t,
    normal: {
      x: hit.normal.x * cos - hit.normal.y * sin,
      y: hit.normal.x * sin + hit.normal.y * cos,
    },
  };
}

export class PropSystem {
  game: Game;
  items: Prop[] = [];
  impacts: { prop: Prop; other: Matter.Body; speed: number }[] = [];
  constructor(game: Game) {
    this.game = game;
    // Collect contacts while Matter steps; remove destroyed bodies only afterward.
    const collisions = (event: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of event.pairs) {
        for (const prop of this.items) {
          const a = pair.bodyA === prop.body,
            b = pair.bodyB === prop.body;
          if (!a && !b) continue;
          const other = a ? pair.bodyB : pair.bodyA;
          const n = pair.collision.normal;
          const speed =
            (prop.velocity.x - other.velocity.x) * n.x * (a ? -1 : 1) +
            (prop.velocity.y - other.velocity.y) * n.y * (a ? -1 : 1);
          if (speed > 5) this.impacts.push({ prop, other, speed });
        }
      }
    };
    Events.on(game.engine, 'collisionStart', collisions);
    Events.on(game.engine, 'collisionActive', collisions);
  }
  get bodies() {
    return this.items.map((p) => p.body);
  }
  reset(level: Level) {
    for (const prop of this.items) Composite.remove(this.game.engine.world, prop.body);
    this.items = [];
    this.impacts = [];
    for (const p of propPlacements(level, this.game.seed)) {
      const { w, h } = PROP_STATS[p.kind];
      const blocked = this.game.hazards.items.some(({ placement: hazard }) => {
        const top = hazard.y - (hazard.kind === 'lift' ? hazard.travel : 0);
        const bottom = hazard.y + hazard.h + (hazard.kind === 'crusher' ? hazard.travel : 0);
        return (
          p.x + w / 2 + 24 > hazard.x - hazard.w / 2 &&
          p.x - w / 2 - 24 < hazard.x + hazard.w / 2 &&
          p.y + h / 2 + 24 > top &&
          p.y - h / 2 - 24 < bottom
        );
      });
      if (!blocked) this.spawn(p.kind, p.x, p.y);
    }
  }
  spawn(kind: PropKind, x: number, y: number): Prop {
    const { w, h, hp } = PROP_STATS[kind];
    const body = Bodies.rectangle(x, y, w, h, {
      isStatic: kind === 'cover',
      friction: 0.35,
      frictionStatic: 0.5,
      frictionAir: 0.008,
      restitution: kind === 'canister' ? 0.25 : 0.08,
      density: kind === 'crate' ? 0.0012 : 0.001,
      label: 'prop',
    });
    const prop: Prop = {
      kind,
      body,
      hp,
      maxHp: hp,
      flash: 0,
      armedAt: Infinity,
      detonateAt: Infinity,
      velocity: { x: 0, y: 0 },
      hits: new Map(),
    };
    this.items.push(prop);
    Composite.add(this.game.engine.world, body);
    return prop;
  }
  remove(prop: Prop) {
    Composite.remove(this.game.engine.world, prop.body);
    this.items = this.items.filter((p) => p !== prop);
  }
  hit(prop: Prop, damage: number, velocity: Vec) {
    if (!this.items.includes(prop)) return;
    const g = this.game,
      d = direction({ x: 0, y: 0 }, velocity);
    prop.hp -= damage;
    prop.flash = 0.08;
    g.burst(prop.body.position, 4, prop.kind === 'canister' ? '#e4bb6e' : '#9dacaf', 2.3);
    g.onSound('prop');
    if (prop.kind === 'canister' && !Number.isFinite(prop.armedAt)) {
      prop.armedAt = g.time + 0.06;
      g.onSound('arm');
    }
    if (!prop.body.isStatic) {
      const force = clamp(damage * (prop.kind === 'canister' ? 0.42 : 0.28), 0.4, 12);
      Body.setVelocity(prop.body, {
        x: clamp(prop.body.velocity.x + d.x * force, -18, 18),
        y: clamp(prop.body.velocity.y + d.y * force - Math.abs(d.x) * force * 0.25, -18, 18),
      });
      Body.setAngularVelocity(
        prop.body,
        clamp(prop.body.angularVelocity + d.x * 0.05, -0.18, 0.18),
      );
    }
    if (prop.hp <= 0) this.break(prop);
  }
  break(prop: Prop) {
    if (!this.items.includes(prop)) return;
    this.remove(prop);
    this.game.burst(prop.body.position, 16, '#a9b5b3', 4);
    this.game.feedback(2);
    this.game.onSound('break');
  }
  beforeStep() {
    this.impacts = [];
    for (const prop of this.items) {
      prop.velocity = { ...prop.body.velocity };
      if (!prop.body.isStatic) {
        Body.setVelocity(prop.body, {
          x: clamp(prop.velocity.x, -18, 18),
          y: clamp(prop.velocity.y, -18, 18),
        });
        Body.setAngularVelocity(prop.body, clamp(prop.body.angularVelocity, -0.18, 0.18));
      }
    }
  }
  afterStep(dt: number) {
    const g = this.game;
    for (const prop of this.items) prop.flash = Math.max(0, prop.flash - dt);
    for (const { prop, other, speed } of this.impacts) {
      if (!this.items.includes(prop)) continue;
      if (prop.kind === 'canister' && Number.isFinite(prop.armedAt) && speed >= 6) {
        // A wall immediately beside a canister must not swallow an impact during arming.
        prop.detonateAt = Math.min(prop.detonateAt, Math.max(g.time, prop.armedAt));
      } else if (prop.kind === 'crate' && Math.hypot(prop.velocity.x, prop.velocity.y) >= 5) {
        const enemy = g.enemies.find((e) => e.body === other);
        if (enemy && enemy.spawn <= 0 && g.time - (prop.hits.get(enemy.id) ?? -10) > 0.35) {
          prop.hits.set(enemy.id, g.time);
          g.hitEnemy(enemy, clamp(speed * 7, 28, 100));
          g.feedback(2);
          g.onSound('crash');
        }
      }
    }
    this.impacts = [];
    for (const prop of [...this.items]) {
      if (g.time >= prop.detonateAt) this.explode(prop);
      if (g.mode !== 'playing') return;
    }
    // Guard the same world boundaries as the player, including rotated extents.
    for (const prop of this.items) {
      if (prop.body.isStatic) continue;
      const b = prop.body,
        p = b.position;
      const w = Math.max(...b.vertices.map((v) => Math.abs(v.x - p.x)));
      const h = Math.max(...b.vertices.map((v) => Math.abs(v.y - p.y)));
      const x = clamp(p.x, w, 2000 - w),
        y = clamp(p.y, h, 740 - h);
      if (x !== p.x || y !== p.y) {
        Body.setVelocity(b, { x: x !== p.x ? 0 : b.velocity.x, y: y !== p.y ? 0 : b.velocity.y });
        Body.setPosition(b, { x, y });
      }
    }
  }
  explode(prop: Prop) {
    if (this.game.mode !== 'playing' || !this.items.includes(prop)) return;
    const g = this.game,
      p = { ...prop.body.position };
    this.remove(prop);
    // Determine occlusion before damaging cover so one blast cannot pass through it.
    const visible = (target: Vec, ignored?: Prop) =>
      distance(g.lineEnd(p, target, 0, ignored), target) < 0.1;
    const enemies = g.enemies.filter(
      (e) => e.spawn <= 0 && distance(p, e.body.position) < 160 && visible(e.body.position),
    );
    const props = this.items.filter(
      (other) => distance(p, other.body.position) < 160 && visible(other.body.position, other),
    );
    const hurtsPlayer = distance(p, g.player.position) < 140 && visible(g.player.position);
    g.burst(p, 30, '#ffd28a', 7);
    if (g.particles.length < 220)
      g.particles.push({
        pos: p,
        vel: { x: 0, y: 0 },
        life: 0.22,
        max: 0.22,
        size: 160,
        color: '#eec184',
        kind: 'ring',
      });
    g.feedback(7);
    g.hitStop = Math.max(g.hitStop, 0.04);
    g.onSound('explode');
    for (const e of enemies) {
      g.hitEnemy(e, 105 * (1 - distance(p, e.body.position) / 220));
      if (e.hp > 0 && !e.body.isStatic) {
        const d = direction(p, e.body.position);
        Body.setVelocity(e.body, {
          x: e.body.velocity.x + d.x * 7,
          y: e.body.velocity.y + d.y * 7 - 2,
        });
      }
    }
    for (const other of props) {
      if (other.kind === 'canister') this.explode(other);
      else this.hit(other, 80, direction(p, other.body.position));
      if (g.mode !== 'playing') return;
    }
    if (hurtsPlayer) g.damagePlayer(Math.ceil(20 * (1 - distance(p, g.player.position) / 180)), p);
  }
}
