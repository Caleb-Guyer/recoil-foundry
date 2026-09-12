import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level } from './levels.ts';
import { clamp, direction, distance, segmentBox, seeded, sample } from './rules.ts';
import type { Vec } from './rules.ts';
import type { CargoRig } from './cargo.ts';
import { CARGO_SIZE } from './cargo-layout.ts';
import { disruptScrapperBody, SCRAPPER_DAMAGE } from './scrapper.ts';

const { Bodies, Body, Composite, Events } = Matter;
export type PropKind = 'crate' | 'canister' | 'cover' | 'cargo' | 'rubble';
export const PROP_STATS = {
  crate: { w: 44, h: 44, hp: 120 },
  canister: { w: 24, h: 38, hp: Infinity },
  cover: { w: 24, h: 84, hp: 72 },
  cargo: { ...CARGO_SIZE, hp: 400 },
  rubble: { w: 26, h: 18, hp: 24 },
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
  cargo?: CargoRig;
  throwUntil?: number;
  throwHits?: Set<number>;
  expires?: number;
}
export interface PropPlacement extends Vec {
  kind: PropKind;
}

// Three small objects per room. Only wide, clear support surfaces are eligible.
// Geometry and spawn anchors remain authoritative; scenery never creates a prop.
export function propPlacements(level: Level, seed: string): PropPlacement[] {
  if (level.magnets) return level.magnets.map((m) => ({ kind: 'crate', x: m.x, y: m.floor - 23 }));
  const result: PropPlacement[] = [];
  const rng = seeded(seed + ':props:' + level.id);
  const supports = [
    {
      x: level.routeChoice === 'low' ? 240 : 260,
      y: 740,
      w: level.routeChoice === 'low' ? 1520 : 1500,
      h: 100,
    },
    ...level.solids,
  ];
  const kinds: PropKind[] =
    level.routeChoice === 'low'
      ? ['crate', 'cover', 'crate', 'canister', 'cover']
      : level.boss
        ? ['crate', 'canister']
        : level.area === 'furnace' && rng() < 0.4
          ? ['crate', 'canister', 'canister']
          : ['crate', 'canister', 'cover'];
  for (const kind of kinds) {
    if (kind === 'crate' && level.scrapperCrate) {
      result.push({ kind, ...level.scrapperCrate });
      continue;
    }
    const paired = kind === 'canister' ? result.find((p) => p.kind === 'canister') : undefined;
    const { w, h } = PROP_STATS[kind];
    const candidates: Vec[] = [];
    for (const support of supports) {
      if (support.y < 240 || support.w < w + 60) continue;
      for (
        let x = support.x + 35 + w / 2;
        x < support.x + support.w - 35 - w / 2;
        x += level.routeChoice === 'low' ? 40 : 80
      ) {
        const y = support.y - h / 2 - 1;
        if (x < (level.routeChoice === 'low' ? 280 : 320) || x > 1740) continue;
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
        if (
          result.some(
            (p) =>
              distance(p, { x, y }) < (p === paired ? 75 : level.routeChoice === 'low' ? 180 : 280),
          )
        )
          continue;
        candidates.push({ x, y });
      }
    }
    // A crate near the entrance teaches that shots move it before the busy fights.
    const preferred = paired
      ? candidates.filter((p) => distance(p, paired) < 145)
      : kind === 'crate'
        ? candidates.filter(
            (p) =>
              p.y > 600 &&
              (level.routeChoice === 'low' && result.some((r) => r.kind === 'crate')
                ? p.x > 1600
                : p.x < 850),
          )
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
  velocities = new Map<Matter.Body, Vec>();
  impacts: { prop: Prop; other: Matter.Body; speed: number; incomingSpeed: number }[] = [];
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
          const velocity = this.velocities.get(other) ?? other.velocity;
          const speed =
            (prop.velocity.x - velocity.x) * n.x * (a ? -1 : 1) +
            (prop.velocity.y - velocity.y) * n.y * (a ? -1 : 1);
          const incomingSpeed = (velocity.x * n.x + velocity.y * n.y) * (a ? 1 : -1);
          if (speed > 5) this.impacts.push({ prop, other, speed, incomingSpeed });
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
    this.velocities.clear();
    for (const p of propPlacements(level, this.game.layoutSeed)) {
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
      const ventBlocked = this.game.breaches.bodies.some(
        (body) =>
          p.x + w / 2 + 12 > body.bounds.min.x &&
          p.x - w / 2 - 12 < body.bounds.max.x &&
          p.y + h / 2 + 12 > body.bounds.min.y &&
          p.y - h / 2 - 12 < body.bounds.max.y,
      );
      if (!blocked && !ventBlocked) this.spawn(p.kind, p.x, p.y);
    }
  }
  spawn(kind: PropKind, x: number, y: number): Prop {
    const { w, h, hp } = PROP_STATS[kind];
    const body = Bodies.rectangle(x, y, w, h, {
      friction: 0.35,
      frictionStatic: 0.5,
      frictionAir: 0.008,
      restitution: kind === 'canister' ? 0.25 : 0.08,
      density: kind === 'cargo' ? 0.003 : kind === 'crate' ? 0.0012 : 0.001,
      ...(kind === 'cargo' ? { inertia: Infinity } : {}),
      label: 'prop',
    });
    // Store finite mass and inertia before anchoring cover, so it can become
    // an ordinary falling body if its supporting ledge breaks.
    if (kind === 'cover') Body.setStatic(body, true);
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
    this.game.harpoons.disrupt(prop.body);
    this.game.magnets.release(prop.body);
    disruptScrapperBody(this.game, prop.body);
    Composite.remove(this.game.engine.world, prop.body);
    this.items = this.items.filter((p) => p !== prop);
  }
  hit(prop: Prop, damage: number, velocity: Vec) {
    this.game.magnets.release(prop.body);
    if (!this.items.includes(prop)) return;
    disruptScrapperBody(this.game, prop.body);
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
      const force = clamp(
        damage * (prop.kind === 'cargo' ? 0.08 : prop.kind === 'canister' ? 0.42 : 0.28),
        0.4,
        prop.kind === 'cargo' ? 6 : 12,
      );
      Body.setVelocity(prop.body, {
        x: clamp(prop.body.velocity.x + d.x * force, -18, 18),
        y: clamp(prop.body.velocity.y + d.y * force - Math.abs(d.x) * force * 0.25, -18, 18),
      });
      if (prop.kind !== 'cargo')
        Body.setAngularVelocity(
          prop.body,
          clamp(prop.body.angularVelocity + d.x * 0.05, -0.18, 0.18),
        );
    }
    if (prop.hp <= 0) this.break(prop);
  }
  // Direct heavy contact shares the same material response across every enemy.
  strike(prop: Prop, damage: number, velocity: Vec) {
    if (prop.kind === 'canister') this.explode(prop);
    else this.hit(prop, damage, velocity);
  }
  break(prop: Prop) {
    if (!this.items.includes(prop)) return;
    this.remove(prop);
    if (prop.kind === 'rubble') {
      this.game.burst(prop.body.position, 3, '#a9b5b3', 1.5);
      return;
    }
    this.game.burst(prop.body.position, 16, '#a9b5b3', 4);
    this.game.feedback(2);
    this.game.onSound('break');
    this.game.demolition.brokenProp(prop.body.position);
  }
  beforeStep() {
    this.impacts = [];
    this.velocities.clear();
    for (const body of Composite.allBodies(this.game.engine.world))
      this.velocities.set(body, { ...body.velocity });
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
    for (const { prop, other, speed, incomingSpeed } of this.impacts) {
      if (!this.items.includes(prop)) continue;
      if (this.game.cargo.impact(prop, other, speed)) {
        if (g.mode !== 'playing') return;
        continue;
      }
      if (
        prop.kind === 'crate' &&
        (prop.throwUntil ?? 0) > g.time &&
        speed >= 6 &&
        Math.hypot(prop.velocity.x, prop.velocity.y) >= 6 &&
        !prop.throwHits?.has(other.id)
      ) {
        if (other === g.player) {
          prop.throwHits?.add(other.id);
          prop.throwUntil = 0;
          g.damagePlayer(SCRAPPER_DAMAGE, prop.body.position);
        } else {
          const target = this.items.find((p) => p.body === other);
          if (target) {
            prop.throwHits?.add(other.id);
            if (target.kind === 'canister') this.explode(target);
            else this.hit(target, clamp(speed * 6, 36, 90), prop.velocity);
          }
        }
        if (g.mode !== 'playing') return;
        if (!this.items.includes(prop)) continue;
      }
      const enemy = g.enemies.find((e) => e.body === other || e.crane?.body === other);
      const incoming = this.velocities.get(other);
      if (
        enemy &&
        enemy.spawn <= 0 &&
        enemy.hp > 0 &&
        incoming &&
        incomingSpeed >= 6 &&
        speed >= 6 &&
        g.time - (prop.hits.get(enemy.id) ?? -10) > 0.35
      ) {
        prop.hits.set(enemy.id, g.time);
        this.strike(prop, clamp(speed * 10, 60, 160), incoming);
        if (g.mode !== 'playing') return;
        continue;
      }
      if (prop.kind === 'canister' && Number.isFinite(prop.armedAt) && speed >= 6) {
        // A wall immediately beside a canister must not swallow an impact during arming.
        prop.detonateAt = Math.min(prop.detonateAt, Math.max(g.time, prop.armedAt));
      } else if (prop.kind === 'crate' && Math.hypot(prop.velocity.x, prop.velocity.y) >= 5) {
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
      if (prop.expires !== undefined && g.time >= prop.expires) {
        this.remove(prop);
        continue;
      }
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
      const x = clamp(p.x, w, g.worldWidth - w),
        y = clamp(p.y, g.worldTop + h, 740 - h);
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
    const panels = g.breaches.targets(p, 160);
    const terrain = g.destruction.targets(p, 160);
    g.harpoons.blast(p, 105, 160);
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
    if (g.mode !== 'playing') return;
    for (const panel of panels) g.breaches.hit(panel, 80, direction(p, panel.body.position));
    for (const piece of terrain)
      g.destruction.hitBody(piece.body, 80, direction(p, piece.body.position));
  }
}
