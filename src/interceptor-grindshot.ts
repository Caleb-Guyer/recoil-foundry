import type Matter from 'matter-js';
import type { Enemy, Game, Shot } from './game.ts';
import { firstSolid, sweepBox } from './collisions.ts';
import { grindRail } from './grindshot.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';

export const RIVAL_GRIND = { speed: 340, life: 1.35, damage: 18, limit: 2, radius: 7 };
export interface RivalGrindPlan {
  body: Matter.Body;
  support: Vec;
  angle: number;
  origin: Vec;
  impact: Vec;
  heading: number;
  path: Vec[];
  wrap: boolean;
}
export interface RivalSaw {
  plan: RivalGrindPlan;
  pos: Vec;
  next: number;
  life: number;
  travel: number;
}
export function grindPlanValid(g: Game, plan: RivalGrindPlan) {
  return (
    g.terrainBodies.includes(plan.body) &&
    distance(plan.body.position, plan.support) < 0.1 &&
    Math.abs(plan.body.angle - plan.angle) < 0.001
  );
}
function surfaceRoute(
  g: Game,
  body: Matter.Body,
  impact: Vec,
  normal: Vec,
  incoming: Vec,
  wrap: boolean,
) {
  const points = grindRail(body);
  let edge = -1,
    along = 0,
    best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      t = direction(a, b);
    if (t.y * normal.x - t.x * normal.y < 0.9) continue;
    const u = clamp((impact.x - a.x) * t.x + (impact.y - a.y) * t.y, 0, distance(a, b));
    const d = distance(impact, { x: a.x + t.x * u, y: a.y + t.y * u });
    if (d < best) {
      best = d;
      edge = i;
      along = u;
    }
  }
  if (edge < 0) return [];
  const t = direction(points[edge], points[(edge + 1) % points.length]);
  const tangent = incoming.x * t.x + incoming.y * t.y;
  const dir = Math.sign(Math.abs(tangent) > 0.001 ? tangent : Math.abs(t.x) > 0.5 ? t.x : -t.y);
  const path: Vec[] = [{ x: points[edge].x + t.x * along, y: points[edge].y + t.y * along }];
  const solids = g.solidBodies.filter((b) => b !== body);
  if (firstSolid(impact, path[0], { x: 2, y: 2 }, solids)) return [];
  let budget = RIVAL_GRIND.speed * RIVAL_GRIND.life;
  for (let corner = 0; corner < 12 && budget > 0.001; corner++) {
    const a = points[edge],
      b = points[(edge + 1) % points.length],
      t = direction(a, b),
      length = distance(a, b);
    const move = Math.min(budget, dir > 0 ? length - along : along);
    const end = { x: a.x + t.x * (along + move * dir), y: a.y + t.y * (along + move * dir) };
    const start = path.at(-1)!;
    const block = firstSolid(start, end, { x: RIVAL_GRIND.radius, y: RIVAL_GRIND.radius }, solids);
    const point = block
      ? { x: start.x + (end.x - start.x) * block.t, y: start.y + (end.y - start.y) * block.t }
      : end;
    // Arena boundaries remain closed; there is no route around the outside.
    if (point.x < 0 || point.x > g.worldWidth || point.y < g.worldTop || point.y > 740) break;
    if (distance(point, start) > 0.001) path.push(point);
    if (block || !wrap || budget <= move + 0.001) break;
    budget -= move;
    edge = (edge + dir + points.length) % points.length;
    along = dir > 0 ? 0 : distance(points[edge], points[(edge + 1) % points.length]);
  }
  return path;
}

// Plan once, against real cover. The same vertices are displayed and traversed;
// moving targets never bend a committed surface warning.
export function planRivalGrind(g: Game, e: Enemy): RivalGrindPlan[] {
  const origin = { ...e.body.position },
    player = g.player.position;
  const candidates: { plan: RivalGrindPlan; score: number }[] = [];
  for (const body of g.terrainBodies) {
    for (let edge = 0; edge < body.vertices.length; edge++) {
      const a = body.vertices[edge],
        b = body.vertices[(edge + 1) % body.vertices.length];
      const t = direction(a, b),
        n = { x: t.y, y: -t.x };
      if (distance(a, b) < 24) continue;
      const projected = clamp(
        ((player.x - a.x) * t.x + (player.y - a.y) * t.y) / distance(a, b),
        0.08,
        0.92,
      );
      for (const fraction of [
        0.15,
        0.5,
        0.85,
        projected,
        ...[-320, -180, 180, 320].map((offset) =>
          clamp(projected + offset / distance(a, b), 0.04, 0.96),
        ),
      ]) {
        const target = {
          x: a.x + (b.x - a.x) * fraction - n.x * 8,
          y: a.y + (b.y - a.y) * fraction - n.y * 8,
        };
        const length = distance(origin, target);
        if (length < 90 || length > 1050) continue;
        const hit = firstSolid(origin, target, { x: 5, y: 5 }, g.solidBodies);
        if (!hit || hit.body !== body || hit.normal.x * n.x + hit.normal.y * n.y < 0.9) continue;
        const impact = {
          x: origin.x + (target.x - origin.x) * hit.t,
          y: origin.y + (target.y - origin.y) * hit.t,
        };
        const d = direction(origin, impact);
        if (distance(origin, impact) < 65 || g.portals.trace(origin, impact, { x: 5, y: 5 }))
          continue;
        const path = surfaceRoute(g, body, impact, hit.normal, d, e.phase > 0);
        if (path.length < 2 || distance(path[0], player) < 90) continue;
        let closest = Infinity,
          total = 0;
        for (let i = 1; i < path.length; i++) {
          const p = path[i - 1],
            q = path[i],
            axis = direction(p, q),
            len = distance(p, q);
          const u = clamp((player.x - p.x) * axis.x + (player.y - p.y) * axis.y, 0, len);
          closest = Math.min(
            closest,
            distance(player, { x: p.x + axis.x * u, y: p.y + axis.y * u }),
          );
          total += len;
        }
        // Save the surface attack for a reachable perch or floor lane.
        if (total < 70 || closest > 180) continue;
        candidates.push({
          plan: {
            body,
            support: { ...body.position },
            angle: body.angle,
            origin,
            impact,
            heading: Math.atan2(d.y, d.x),
            path,
            wrap: e.phase > 0,
          },
          score: closest + length * 0.06,
        });
      }
    }
  }
  candidates.sort((a, b) => a.score - b.score || a.plan.body.id - b.plan.body.id);
  const plans: RivalGrindPlan[] = [];
  for (const { plan } of candidates) {
    // One direction per support leaves a jumpable lane instead of a pincer.
    if (plans.some((p) => p.body === plan.body)) continue;
    plans.push(plan);
    if (plans.length === (e.phase > 0 ? 2 : 1)) break;
  }
  return plans;
}
export function rivalGrindAngles(e: Enemy) {
  const rig = e.interceptor!;
  return [...rig.grindPlans.map((p) => p.heading), ...rig.grindBullets];
}
export function fireRivalGrind(g: Game, e: Enemy) {
  const rig = e.interceptor!;
  for (const plan of rig.grindPlans) {
    if (!grindPlanValid(g, plan)) continue;
    const previous = g.shots.at(-1)?.id;
    g.enemyShot(e, plan.heading, 18, 8, rig.origin);
    const shot = g.shots.at(-1);
    if (shot && shot.id !== previous && !shot.friendly) {
      shot.enemyAmmo = { owner: e.id, kind: 'grindshot', age: 0, grind: plan };
      shot.life = 1.1;
    }
  }
  for (const angle of rig.grindBullets) {
    const previous = g.shots.at(-1)?.id;
    g.enemyShot(e, angle, 11.5, 16, rig.origin);
    const shot = g.shots.at(-1);
    if (shot && shot.id !== previous && !shot.friendly)
      shot.enemyAmmo = { owner: e.id, kind: 'aimed', age: 0 };
  }
}
export function rivalGrindImpact(g: Game, e: Enemy, shot: Shot, body?: Matter.Body) {
  const plan = shot.enemyAmmo?.grind,
    rig = e.interceptor!;
  if (
    !plan ||
    body !== plan.body ||
    !grindPlanValid(g, plan) ||
    distance(shot.pos, plan.impact) > 2 ||
    rig.saws.length >= RIVAL_GRIND.limit
  )
    return;
  rig.saws.push({ plan, pos: { ...plan.path[0] }, next: 1, life: RIVAL_GRIND.life, travel: 0 });
  g.onSound('rival-grind');
}
export function updateRivalGrind(g: Game, e: Enemy, dt: number) {
  if (g.mode !== 'playing' || e.hp <= 0 || dt <= 0) return;
  const rig = e.interceptor!;
  for (const saw of [...rig.saws]) {
    if (!grindPlanValid(g, saw.plan)) {
      saw.life = 0;
      continue;
    }
    let budget = RIVAL_GRIND.speed * Math.min(dt, saw.life);
    while (budget > 0.001 && saw.life > 0 && saw.next < saw.plan.path.length) {
      const start = saw.pos,
        target = saw.plan.path[saw.next],
        len = distance(start, target);
      const move = Math.min(len, budget, 8),
        d = direction(start, target);
      const end = { x: start.x + d.x * move, y: start.y + d.y * move };
      const block = firstSolid(
        start,
        end,
        { x: RIVAL_GRIND.radius, y: RIVAL_GRIND.radius },
        g.solidBodies.filter((b) => b !== saw.plan.body),
      );
      const player = sweepBox(
        start,
        end,
        { x: RIVAL_GRIND.radius, y: RIVAL_GRIND.radius },
        g.player,
      );
      if (player && (!block || player.t < block.t - 1e-6)) {
        g.damagePlayer(RIVAL_GRIND.damage, start);
        saw.life = 0;
        if (g.mode !== 'playing') return;
        break;
      }
      if (block) {
        // New cover catches a saw even if this hit breaks that cover.
        const prop = g.props.items.find((p) => p.body === block.body);
        if (prop) g.props.hit(prop, 24, d);
        else {
          g.breaches.hitBody(block.body, 24, d);
          g.destruction.hitBody(block.body, 24, d);
        }
        saw.life = 0;
        if (g.mode !== 'playing') return;
        break;
      }
      saw.pos = end;
      budget -= move;
      saw.travel += move;
      if (len <= move + 0.001) saw.next++;
    }
    saw.life -= dt;
    if (saw.next >= saw.plan.path.length) saw.life = 0;
  }
  rig.saws = rig.saws.filter((s) => s.life > 0);
}
