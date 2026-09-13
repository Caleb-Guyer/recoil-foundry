import Matter from 'matter-js';
import type { Enemy, Game, Shot } from './game.ts';
import { firstSolid } from './collisions.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';

export const ANGLER = { tell: 1.2, lock: 0.6, exposed: 1.25, radius: 5, range: 1500 };
export interface AnglerPlan {
  body: Matter.Body;
  bodyPos: Vec;
  bodyAngle: number;
  origin: Vec;
  start: Vec;
  bounce: Vec;
  end: Vec;
  incoming: Vec;
  outgoing: Vec;
  length: number;
}
export interface AnglerFlight {
  plan: AnglerPlan;
  owner: number;
  banked: boolean;
}
export interface AnglerRig {
  plan?: AnglerPlan;
  searchAt: number;
  exposed: number;
}
export const createAngler = (): AnglerRig => ({ searchAt: 0, exposed: 0 });
export const anglerSpeed = (g: Game) => (g.stage >= 16 || g.overtime ? 14 : 11.5);
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const minus = (a: Vec, b: Vec) => ({ x: a.x - b.x, y: a.y - b.y });
const along = (p: Vec, d: Vec, length: number) => ({
  x: p.x + d.x * length,
  y: p.y + d.y * length,
});
const bodies = (g: Game, owner: number) => [
  ...g.solidBodies,
  ...g.enemies.filter((e) => e.id !== owner && e.hp > 0 && e.spawn <= 0).map((e) => e.body),
  ...g.enemies.filter((e) => e.crane && e.spawn <= 0).map((e) => e.crane!.body),
];
export function anglerSurfaceValid(g: Game, plan: AnglerPlan) {
  return (
    g.terrainBodies.includes(plan.body) &&
    distance(plan.body.position, plan.bodyPos) < 0.75 &&
    Math.abs(plan.body.angle - plan.bodyAngle) < 0.002
  );
}
export function findAnglerPlan(
  g: Game,
  e: Enemy,
  target = g.player.position,
): AnglerPlan | undefined {
  const origin = { x: e.body.position.x, y: e.body.position.y - 5 };
  if (distance(origin, target) > 1000) return;
  const blockers = bodies(g, e.id),
    half = { x: ANGLER.radius, y: ANGLER.radius };
  let best: AnglerPlan | undefined,
    score = Infinity;
  // Reflect the target across each real face, then verify both legs with the
  // same convex sweep used by the fired round. No guessed AABB corner banks.
  for (const body of [...g.terrain, ...g.counterweights.bodies]) {
    if (g.counterweights.owns(body) && Math.abs(body.angularVelocity) > 0.0005) continue;
    for (let i = 0; i < body.vertices.length; i++) {
      const a = body.vertices[i],
        b = body.vertices[(i + 1) % body.vertices.length],
        tangent = direction(a, b),
        normal = { x: tangent.y, y: -tangent.x },
        offset = ANGLER.radius * (Math.abs(normal.x) + Math.abs(normal.y)),
        face = along(a, normal, offset),
        fromSide = dot(minus(origin, face), normal),
        toSide = dot(minus(target, face), normal);
      if (fromSide < 16 || toSide < 16) continue;
      const reflected = along(target, normal, -2 * toSide),
        bounce = along(origin, minus(reflected, origin), fromSide / (fromSide + toSide)),
        u = dot(minus(bounce, a), tangent),
        incoming = direction(origin, bounce),
        outgoing = direction(bounce, target),
        firstLength = distance(origin, bounce),
        targetLength = distance(bounce, target);
      if (
        u < 12 ||
        u > distance(a, b) - 12 ||
        firstLength < 60 ||
        targetLength < 60 ||
        firstLength + targetLength > ANGLER.range ||
        Math.abs(dot(incoming, normal)) < 0.12
      )
        continue;
      const first = firstSolid(origin, along(bounce, incoming, 2), half, blockers);
      if (!first || first.body !== body || dot(first.normal, normal) < 0.999) continue;
      const actual = along(origin, minus(along(bounce, incoming, 2), origin), first.t);
      if (distance(actual, bounce) > 0.1) continue;
      const exit = along(bounce, normal, 0.5);
      if (firstSolid(exit, target, half, blockers)) continue;
      if (g.portals.trace(origin, bounce, half) || g.portals.trace(exit, target, half)) continue;
      if (
        g.cargo.trace(origin, bounce, ANGLER.radius) ||
        g.cargo.trace(exit, target, ANGLER.radius)
      )
        continue;
      const far = along(exit, outgoing, ANGLER.range - firstLength),
        final = firstSolid(exit, far, half, blockers),
        cable = g.cargo.trace(exit, far, ANGLER.radius),
        portal = g.portals.trace(exit, far, half),
        fraction = Math.min(final?.t ?? 1, cable?.t ?? 1, portal?.t ?? 1),
        end = along(exit, minus(far, exit), fraction),
        length = firstLength + distance(exit, end);
      // Prefer a useful bank on vulnerable cover over a near-identical floor
      // route. Moving decks are eligible but never receive hidden aim correction.
      const fragile = g.destruction.pieces.some((p) => p.body === body),
        candidate =
          firstLength + targetLength - (fragile ? 160 : g.counterweights.owns(body) ? 100 : 0);
      if (candidate >= score) continue;
      score = candidate;
      best = {
        body,
        bodyPos: { ...body.position },
        bodyAngle: body.angle,
        origin,
        start: along(origin, incoming, 26),
        bounce,
        end,
        incoming,
        outgoing,
        length,
      };
    }
  }
  return best;
}
export function anglerWarningPoints(g: Game, e: Enemy): Vec[] {
  const plan = e.angler?.plan;
  if (!plan || !anglerSurfaceValid(g, plan)) return [];
  const blockers = bodies(g, e.id),
    half = { x: ANGLER.radius, y: ANGLER.radius };
  const clip = (from: Vec, to: Vec) => {
    const t = Math.min(
      firstSolid(from, to, half, blockers)?.t ?? 1,
      g.cargo.trace(from, to, ANGLER.radius)?.t ?? 1,
      g.portals.trace(from, to, half)?.t ?? 1,
    );
    return { point: along(from, minus(to, from), t), t };
  };
  const first = clip(plan.start, plan.bounce);
  if (first.t < 1 - 1e-6) return [plan.start, first.point];
  const exit = along(plan.bounce, plan.outgoing, 0.75);
  return [plan.start, plan.bounce, clip(exit, plan.end).point];
}
export function interruptAngler(g: Game, e: Enemy) {
  const rig = e.angler;
  if (!rig || e.hp <= 0) return;
  rig.plan = undefined;
  rig.exposed = ANGLER.exposed;
  e.state = 'recover';
  e.timer = ANGLER.exposed;
  g.burst(e.body.position, 5, '#e9bb86', 2);
  g.onSound('angler-break');
}
export function beginAnglerAttack(g: Game, e: Enemy, plan = findAnglerPlan(g, e)) {
  if (!plan || e.spawn > 0 || e.hp <= 0 || g.mode !== 'playing') return false;
  e.angler!.plan = plan;
  e.aim = { ...plan.incoming };
  e.state = 'windup';
  e.timer = ANGLER.tell;
  e.angler!.searchAt = g.time + 0.12;
  g.onSound('angler-lock');
  return true;
}
export function updateAngler(g: Game, e: Enemy, dt: number) {
  const rig = e.angler!,
    p = e.body.position;
  rig.exposed = Math.max(0, rig.exposed - dt);
  if (e.state === 'windup') {
    const plan = rig.plan;
    if (
      !plan ||
      !anglerSurfaceValid(g, plan) ||
      distance({ x: p.x, y: p.y - 5 }, plan.origin) > 7
    ) {
      interruptAngler(g, e);
      return;
    }
    Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.4, y: e.body.velocity.y });
    if (e.timer > ANGLER.lock && g.time >= rig.searchAt) {
      const next = findAnglerPlan(g, e);
      if (next) {
        rig.plan = next;
        e.aim = { ...next.incoming };
      }
      rig.searchAt = g.time + 0.12;
    }
    if (e.timer <= 0) {
      const locked = rig.plan!,
        speed = anglerSpeed(g);
      // Newly moved cover blocks the shot. The round starts at the recorded
      // muzzle and never retargets after lock, even when the player teleports.
      const obstruction = firstSolid(
        locked.origin,
        locked.start,
        { x: ANGLER.radius, y: ANGLER.radius },
        bodies(g, e.id),
      );
      if (obstruction || g.portals.trace(locked.origin, locked.bounce, { x: 5, y: 5 })) {
        interruptAngler(g, e);
        return;
      }
      g.addShot({
        pos: { ...locked.start },
        vel: along({ x: 0, y: 0 }, locked.incoming, speed),
        damage: g.stage >= 16 || g.overtime ? 19 : 15,
        life: Math.max(0.1, (locked.length - 26) / (speed * 60)),
        friendly: false,
        radius: ANGLER.radius,
        bounces: 1,
        pierce: 0,
        fragment: false,
        split: true,
        source: { ...p },
        allyBlock: e.id,
        angler: { plan: locked, owner: e.id, banked: false },
      });
      e.attacks++;
      e.state = 'recover';
      e.timer = g.stage >= 16 ? 0.85 : 1.1;
      rig.plan = undefined;
      g.onSound('angler-fire');
    }
    return;
  }
  if (e.state === 'recover') {
    Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.8, y: e.body.velocity.y });
    if (e.timer <= 0) {
      e.state = 'idle';
      e.timer = g.stage >= 16 ? 0.9 : 1.4;
    }
    return;
  }
  if (e.timer <= 0 && g.time >= rig.searchAt && Math.abs(e.body.velocity.y) < 1) {
    rig.searchAt = g.time + 0.18;
    if (beginAnglerAttack(g, e)) return;
  }
  // Reposition through ordinary walking, hops, gravity and body collisions.
  // There is no fallback shot through cover when no bank is available.
  const d = direction(p, g.player.position),
    range = distance(p, g.player.position);
  e.facing = Math.sign(d.x) || e.facing;
  if (range > 200 || e.timer <= 0) {
    g.updateRunner(e, d, range);
    const limit = Math.abs(e.body.velocity.y) > 1 ? 4.5 : g.stage >= 16 ? 2.2 : 1.8;
    Matter.Body.setVelocity(e.body, {
      x: clamp(e.body.velocity.x, -limit, limit),
      y: e.body.velocity.y,
    });
  } else Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.8, y: e.body.velocity.y });
}
export function updateAnglerShot(g: Game, s: Shot) {
  if (!s.angler || s.friendly || s.angler.banked || s.life <= 0) return;
  if (!anglerSurfaceValid(g, s.angler.plan)) {
    s.life = 0;
    g.burst(s.pos, 3, '#e9bb86', 1);
    const owner = g.enemies.find((e) => e.id === s.angler!.owner);
    if (owner) interruptAngler(g, owner);
  }
}
