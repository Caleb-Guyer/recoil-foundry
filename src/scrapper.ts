import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { Prop } from './props.ts';
import type { Vec } from './rules.ts';
import { clamp, direction, distance } from './rules.ts';
import { firstSolid } from './collisions.ts';

const { Body, Composite, Constraint } = Matter;
export const SCRAPPER_GRAB = 0.6;
export const SCRAPPER_TELL = 0.8;
export const SCRAPPER_STUN = 1.15;
export const SCRAPPER_RECOVER = 1.6;
export const SCRAPPER_DAMAGE = 18;
export interface ScrapperRig {
  held: Prop | null;
  tether: Matter.Constraint | null;
  phase: 'lift' | 'aim';
  origin: Vec;
  release: Vec;
  velocity: Vec;
}
export const createScrapper = (): ScrapperRig => ({
  held: null,
  tether: null,
  phase: 'lift',
  origin: { x: 0, y: 0 },
  release: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
});

export function releaseScrapper(g: Game, e: Enemy, stun = false) {
  const rig = e.scrapper;
  if (!rig) return;
  if (rig.tether) Composite.remove(g.engine.world, rig.tether);
  const holding = !!rig.held;
  rig.held = null;
  rig.tether = null;
  if (stun && holding && e.hp > 0) {
    e.state = 'recover';
    e.timer = SCRAPPER_STUN;
    g.onSound('scrapper-break');
    g.burst(e.body.position, 6, '#d9b991', 2);
  }
}
export function disruptScrapperBody(g: Game, body: Matter.Body) {
  for (const e of g.enemies)
    if (e.scrapper?.held && (e.body === body || e.scrapper.held.body === body))
      releaseScrapper(g, e, true);
}

function clearPull(g: Game, e: Enemy, prop: Prop, to: Vec) {
  const from = prop.body.position;
  const half = {
    x: Math.max(...prop.body.vertices.map((v) => Math.abs(v.x - from.x))),
    y: Math.max(...prop.body.vertices.map((v) => Math.abs(v.y - from.y))),
  };
  const bodies = [...g.solidBodies, g.player, ...g.enemies.map((other) => other.body)]
    .filter((b) => b !== prop.body && b !== e.body)
    // Ignore only a shallow floor contact when lifting away from that floor.
    .filter(
      (b) => !(to.y < from.y && Math.min(...b.vertices.map((v) => v.y)) >= from.y + half.y - 0.6),
    );
  return !firstSolid(from, to, half, bodies);
}

export function throwVelocity(g: Game, from: Vec, target: Vec, frictionAir: number): Vec {
  const frames = clamp(Math.round(distance(from, target) / 11), 22, 60);
  const q = 1 - frictionAir;
  const sum = (q * (1 - q ** frames)) / (1 - q);
  const gravity = g.engine.gravity.y * g.engine.gravity.scale * (1000 / 60) ** 2;
  const fall = (gravity / (1 - q)) * (frames - sum);
  return {
    x: clamp((target.x - from.x) / sum, -17, 17),
    y: clamp((target.y - from.y - fall) / sum, -17, 17),
  };
}

export function updateScrapper(g: Game, e: Enemy) {
  const rig = e.scrapper!,
    p = e.body.position;
  if (rig.held) {
    const prop = rig.held,
      anchor = rig.tether!.pointA;
    if (
      !g.props.items.includes(prop) ||
      prop.body.isStatic ||
      distance(p, rig.origin) > 28 ||
      distance(prop.body.position, anchor) > 195 ||
      !clearPull(g, e, prop, anchor)
    ) {
      releaseScrapper(g, e, true);
      return;
    }
    Body.setVelocity(e.body, { x: e.body.velocity.x * 0.6, y: e.body.velocity.y });
    Body.setAngularVelocity(prop.body, prop.body.angularVelocity * 0.75);
    if (rig.phase === 'lift') {
      if (e.timer > 0) return;
      if (distance(prop.body.position, anchor) > 14) {
        releaseScrapper(g, e, true);
        return;
      }
      rig.phase = 'aim';
      rig.release = { ...prop.body.position };
      e.target = { ...g.player.position };
      e.facing = Math.sign(e.target.x - p.x) || e.facing;
      rig.velocity = throwVelocity(g, rig.release, e.target, prop.body.frictionAir);
      e.aim = direction({ x: 0, y: 0 }, rig.velocity);
      e.timer = SCRAPPER_TELL;
      g.onSound('scrapper-lock');
    } else if (distance(prop.body.position, rig.release) > 12) {
      releaseScrapper(g, e, true);
    } else if (e.timer <= 0) {
      const velocity = { ...rig.velocity };
      releaseScrapper(g, e);
      Body.setVelocity(prop.body, velocity);
      Body.setAngularVelocity(prop.body, Math.sign(velocity.x) * 0.075);
      prop.throwUntil = g.time + 4;
      prop.throwHits = new Set();
      prop.hits.clear();
      e.state = 'recover';
      e.timer = SCRAPPER_RECOVER;
      e.attacks++;
      g.onSound('scrapper-throw');
    }
    return;
  }
  if (e.state === 'recover') {
    Body.setVelocity(e.body, { x: e.body.velocity.x * 0.75, y: e.body.velocity.y });
    if (e.timer <= 0) e.state = 'idle';
    return;
  }
  const available = g.props.items.filter(
    (prop) =>
      prop.kind === 'crate' &&
      !prop.body.isStatic &&
      (prop.throwUntil ?? 0) < g.time &&
      Math.hypot(prop.body.velocity.x, prop.body.velocity.y) < 4 &&
      !g.enemies.some((other) => other.scrapper?.held === prop) &&
      !g.hazards
        .actors()
        .some((actor) => actor !== prop.body && g.hazards.supported(actor, prop.body)),
  );
  if (e.timer <= 0 && Math.abs(e.body.velocity.y) < 1) {
    for (const prop of available.sort(
      (a, b) => distance(a.body.position, p) - distance(b.body.position, p),
    )) {
      const point = prop.body.position;
      if (distance(point, p) > 185 || Math.abs(point.y - p.y) > 45) continue;
      const side = Math.sign(point.x - p.x) || e.facing;
      const anchor = { x: p.x + side * 56, y: p.y - 55 };
      if (!clearPull(g, e, prop, anchor)) continue;
      e.facing = side;
      e.state = 'windup';
      e.timer = SCRAPPER_GRAB;
      rig.phase = 'lift';
      rig.origin = { ...p };
      rig.held = prop;
      rig.tether = Constraint.create({
        pointA: anchor,
        bodyB: prop.body,
        length: 0,
        stiffness: 0.075,
        damping: 0.2,
      });
      Composite.add(g.engine.world, rig.tether);
      Body.setVelocity(e.body, { x: 0, y: e.body.velocity.y });
      g.onSound('scrapper-grab');
      return;
    }
  }
  // With no usable crate, close the distance using normal physical navigation.
  const nearest = available
    .filter((prop) => distance(prop.body.position, p) < 750)
    .sort((a, b) => distance(a.body.position, p) - distance(b.body.position, p))[0];
  const target = nearest?.body.position ?? g.player.position;
  g.updateRunner(e, direction(p, target), distance(p, target));
  e.facing = Math.sign(target.x - p.x) || e.facing;
}
