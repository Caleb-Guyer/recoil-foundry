import Matter from 'matter-js';
import { ENEMY_STATS } from './enemies.ts';
import type { Enemy, Game } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp, distance, segmentBox } from './rules.ts';

export interface BossHunt {
  route: Vec[];
  nextPlan: number;
}

function firingLane(g: Game, from: Vec, padding = 9) {
  // A center ray can skim a platform that still catches the five-pixel bolt.
  // Leave a little clearance for both the projectile and the braking drift.
  return !g.solidBodies.some((body) =>
    segmentBox(
      from,
      g.player.position,
      { x: body.bounds.min.x - padding, y: body.bounds.min.y - padding },
      { x: body.bounds.max.x + padding, y: body.bounds.max.y + padding },
    ),
  );
}

export function bossHasLane(g: Game, e: Enemy) {
  return (
    distance(e.body.position, g.player.position) < 760 &&
    firingLane(g, e.body.position, e.kind === 'turbine' ? 16 : 9)
  );
}

// Navigate the hull around solid corners. Shots still use the ordinary swept
// collision path; acquiring an angle never grants permission to fire through cover.
function plan(g: Game, e: Enemy, relocate = false): Vec[] {
  const start = e.body.position,
    player = g.player.position;
  const halfW = ENEMY_STATS[e.kind].w / 2 - 0.5,
    halfH = ENEMY_STATS[e.kind].h / 2 - 0.5;
  const blocks = g.solidBodies.map((body) => ({
    min: { x: body.bounds.min.x - halfW, y: body.bounds.min.y - halfH },
    max: { x: body.bounds.max.x + halfW, y: body.bounds.max.y + halfH },
  }));
  const valid = (p: Vec) =>
    p.x >= 48 &&
    p.x <= g.worldWidth - 48 &&
    p.y >= 48 &&
    p.y <= 699 &&
    !blocks.some((b) => p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y);
  const clear = (a: Vec, b: Vec) => !blocks.some((box) => segmentBox(a, b, box.min, box.max));
  // Include ledge heights: fixed offsets alone miss firing slots between a
  // low stack and a shelf, even when the hull cannot enter the player's pocket.
  const heights = [
    ...new Set([
      ...[-300, -180, -80, 80].map((y) => clamp(player.y + y, 52, 695)),
      ...g.terrainBodies.flatMap((body) => [body.bounds.min.y - 42, body.bounds.max.y + 42]),
    ]),
  ].filter((y) => y >= 52 && y <= 695);
  const goals = [
    start,
    ...[-420, -280, -160, 0, 160, 280, 420].flatMap((x) =>
      heights.map((y) => ({
        x: clamp(player.x + x, 52, g.worldWidth - 52),
        y,
      })),
    ),
  ].filter(
    (p) =>
      valid(p) &&
      (!relocate || distance(p, start) >= 140) &&
      (e.kind !== 'interceptor' || start.y - player.y < 140 || p.y <= player.y + 90) &&
      distance(p, player) >= 175 &&
      distance(p, player) <= 600 &&
      firingLane(g, p, e.kind === 'turbine' ? 16 : 9),
  );
  const corners = blocks
    .flatMap((b) => [
      { x: b.min.x - 5, y: b.min.y - 5 },
      { x: b.max.x + 5, y: b.min.y - 5 },
      { x: b.min.x - 5, y: b.max.y + 5 },
      { x: b.max.x + 5, y: b.max.y + 5 },
    ])
    .filter(valid);
  const nodes = [{ ...start }, ...goals, ...corners],
    costs = nodes.map(() => Infinity);
  const previous = nodes.map(() => -1),
    visited = new Set<number>();
  costs[0] = 0;
  for (let count = 0; count < nodes.length; count++) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!visited.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
    if (current < 0 || !Number.isFinite(costs[current])) break;
    visited.add(current);
    for (let i = 1; i < nodes.length; i++) {
      if (visited.has(i)) continue;
      const cost = costs[current] + distance(nodes[current], nodes[i]);
      if (cost < costs[i] && clear(nodes[current], nodes[i])) {
        costs[i] = cost;
        previous[i] = current;
      }
    }
  }
  let goal = -1,
    best = Infinity;
  for (let i = 1; i <= goals.length; i++) {
    const cost = costs[i] + Math.abs(distance(nodes[i], player) - 330) * 0.7;
    if (cost < best) {
      best = cost;
      goal = i;
    }
  }
  const route: Vec[] = [];
  while (goal > 0) {
    route.unshift(nodes[goal]);
    goal = previous[goal];
  }
  return route;
}

export function bossHuntTarget(g: Game, e: Enemy, relocate = false): Vec {
  if (!e.hunt || e.hunt.nextPlan <= g.time)
    e.hunt = { route: plan(g, e, relocate), nextPlan: g.time + 0.45 };
  const p = e.body.position;
  while (e.hunt.route.length > 1 && distance(p, e.hunt.route[0]) < 6) e.hunt.route.shift();
  return e.hunt.route[0] ?? p;
}

export function huntBoss(g: Game, e: Enemy) {
  const target = bossHuntTarget(g, e),
    p = e.body.position;
  Matter.Body.setVelocity(e.body, {
    x: clamp((target.x - p.x) * 0.12, -5.8, 5.8),
    y: clamp((target.y - p.y) * 0.12, -4.8, 4.8),
  });
}
