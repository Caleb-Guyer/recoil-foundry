import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import { clamp, direction, distance, segmentBox, type Vec } from './rules.ts';
import { finalePending } from './final-arsenal.ts';

// A firing lane ends at the near edge of the player's collision hull. A
// platform beside the player must not hide their exposed side from every gun.
export function finaleFiringLane(g: Game, from: Vec) {
  const to = g.player.position;
  const edge = segmentBox(
    from,
    to,
    { x: g.player.bounds.min.x - 5, y: g.player.bounds.min.y - 5 },
    { x: g.player.bounds.max.x + 5, y: g.player.bounds.max.y + 5 },
  );
  return !g.solidBodies.some((body) => {
    const hit = segmentBox(
      from,
      to,
      { x: body.bounds.min.x - 7, y: body.bounds.min.y - 7 },
      { x: body.bounds.max.x + 7, y: body.bounds.max.y + 7 },
    );
    return hit && hit.t <= (edge ? edge.t : 1);
  });
}

// The giant forms need routes for their real, enlarged hull. Reusing the
// ordinary rival's base dimensions sends the Siege frame into shelf corners.
export function finalePursuitRoute(g: Game, e: Enemy, phase: number, relocate: boolean): Vec[] {
  const start = e.body.position,
    player = g.player.position;
  const xs = e.body.vertices.map((v) => v.x),
    ys = e.body.vertices.map((v) => v.y);
  const halfW = (Math.max(...xs) - Math.min(...xs)) / 2 + 7,
    halfH = (Math.max(...ys) - Math.min(...ys)) / 2 + 7;
  const minX = halfW + 5,
    maxX = g.worldWidth - halfW - 5,
    minY = halfH + 5,
    maxY = 740 - halfH - 5;
  // Boundary contacts are valid starting points. The graph's coordinate
  // limits already keep every destination inside these four world walls.
  const obstacles = g.solidBodies.filter((b) => !g.terrain.slice(0, 4).includes(b));
  const blocks = obstacles.map((b) => ({
    min: { x: b.bounds.min.x - halfW, y: b.bounds.min.y - halfH },
    max: { x: b.bounds.max.x + halfW, y: b.bounds.max.y + halfH },
  }));
  // A traversal is not a charge through the player. The first segment is
  // warned by the ordinary recoil-vault tell, and routes leave a body-wide gap.
  if (distance(start, player) > 180)
    blocks.push({
      min: { x: player.x - halfW - 48, y: player.y - halfH - 52 },
      max: { x: player.x + halfW + 48, y: player.y + halfH + 52 },
    });
  const valid = (p: Vec) =>
    p.x >= minX &&
    p.x <= maxX &&
    p.y >= minY &&
    p.y <= maxY &&
    !blocks.some((b) => p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y);
  const clear = (a: Vec, b: Vec) => !blocks.some((box) => segmentBox(a, b, box.min, box.max));
  // Recoil can settle the actual hull on a shelf, inside the planner's extra
  // seven-pixel clearance. Leave that contact physically before routing;
  // treating it as an impassable starting box strands an otherwise live boss.
  const escape: Vec[] = [];
  let origin = { ...start };
  if (
    blocks.some(
      (b) => origin.x > b.min.x && origin.x < b.max.x && origin.y > b.min.y && origin.y < b.max.y,
    )
  ) {
    const physicalClear = (p: Vec) =>
      !obstacles.some((b) =>
        segmentBox(
          start,
          p,
          { x: b.bounds.min.x - halfW + 7.5, y: b.bounds.min.y - halfH + 7.5 },
          { x: b.bounds.max.x + halfW - 7.5, y: b.bounds.max.y + halfH - 7.5 },
        ),
      );
    const exits = blocks
      .flatMap((b) => [
        { x: b.min.x - 5, y: origin.y },
        { x: b.max.x + 5, y: origin.y },
        { x: origin.x, y: b.min.y - 5 },
        { x: origin.x, y: b.max.y + 5 },
        { x: b.min.x - 5, y: b.min.y - 5 },
        { x: b.max.x + 5, y: b.min.y - 5 },
        { x: b.min.x - 5, y: b.max.y + 5 },
        { x: b.max.x + 5, y: b.max.y + 5 },
      ])
      .filter((p) => valid(p) && physicalClear(p))
      .sort((a, b) => distance(start, a) - distance(start, b));
    if (!exits.length) return [];
    origin = exits[0];
    escape.push(origin);
  }
  const heights = [
    ...new Set([
      ...[-340, -240, -150, -70, 0, 70].map((dy) => clamp(player.y + dy, minY, maxY)),
      minY + 12,
      maxY - 2,
      ...blocks.flatMap((b) => [b.min.y - 5, b.max.y + 5]),
    ]),
  ].filter((y) => y >= minY && y <= maxY);
  const widths = [
    ...new Set([
      ...[-560, -400, -260, -150, 150, 260, 400, 560].map((dx) => clamp(player.x + dx, minX, maxX)),
      minX + 5,
      maxX - 5,
      ...blocks.flatMap((b) => [b.min.x - 5, b.max.x + 5]),
    ]),
  ].filter((x) => x >= minX && x <= maxX);
  const candidates = widths
    .flatMap((x) => heights.map((y) => ({ x, y })))
    .filter(
      (p) =>
        valid(p) &&
        distance(p, player) >= 185 &&
        distance(p, player) <= 680 &&
        (!relocate || distance(p, start) >= (phase === 1 ? 160 : 210)) &&
        finaleFiringLane(g, p),
    );
  const corners = blocks
    .flatMap((b) => [
      { x: b.min.x - 5, y: b.min.y - 5 },
      { x: b.max.x + 5, y: b.min.y - 5 },
      { x: b.min.x - 5, y: b.max.y + 5 },
      { x: b.max.x + 5, y: b.max.y + 5 },
    ])
    .filter(valid);
  // Only obstacle corners can bend a shortest collision-free path. Goals
  // need one connection to this small graph, not quadratic goal-to-goal rays.
  const nodes = [origin, ...corners],
    costs = nodes.map(() => Infinity),
    previous = nodes.map(() => -1),
    visited = new Set<number>();
  costs[0] = 0;
  for (let n = 0; n < nodes.length; n++) {
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
  let goal: Vec | null = null,
    entry = -1,
    best = Infinity;
  for (const p of candidates) {
    let cost = Infinity,
      via = -1;
    for (let i = 0; i < nodes.length; i++) {
      const reach = costs[i] + distance(nodes[i], p);
      if (reach < cost && clear(nodes[i], p)) {
        cost = reach;
        via = i;
      }
    }
    // Duelist closes quickly, Siege finds a low flank, Rupture changes height
    // and sweeps the arena instead of staying above one fixed control point.
    const desiredY = player.y - (phase === 0 ? 140 : phase === 1 ? 65 : 230);
    const score =
      cost +
      Math.abs(distance(p, player) - (phase === 1 ? 310 : 370)) * 0.65 +
      Math.abs(p.y - desiredY) * (phase === 2 ? 0.5 : 0.2);
    if (score < best) {
      best = score;
      goal = p;
      entry = via;
    }
  }
  const route: Vec[] = goal ? [goal] : [];
  while (entry > 0) {
    route.unshift(nodes[entry]);
    entry = previous[entry];
  }
  return [...escape, ...route];
}

export class FinalePursuit {
  route: Vec[] = [];
  lastMovedAttacks = -1;
  lastPosition: Vec | null = null;
  stalled = 0;
  travel = 0;
  nextPlan = 0;
  reset() {
    this.route = [];
    this.lastMovedAttacks = -1;
    this.lastPosition = null;
    this.stalled = this.travel = this.nextPlan = 0;
  }
  finish(g: Game, e: Enemy) {
    this.route = [];
    this.lastPosition = null;
    this.stalled = this.travel = 0;
    this.nextPlan = g.time + 0.2;
    Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
    e.state = 'idle';
    e.timer = 0.12;
    e.interceptor!.origin = { ...e.body.position };
    e.interceptor!.relocate = false;
    e.hunt = undefined;
  }
  update(g: Game, e: Enemy, phase: number, dt: number) {
    const rig = e.interceptor!;
    if (this.route.length) {
      if (e.state === 'windup') return false;
      if (e.state !== 'airborne') {
        this.route = [];
        return false;
      }
      rig.muzzle = Math.max(0, rig.muzzle - dt);
      this.travel += dt;
      const pos = e.body.position;
      if (this.lastPosition && distance(pos, this.lastPosition) < 0.2) this.stalled += dt;
      else this.stalled = 0;
      this.lastPosition = { ...pos };
      while (this.route.length && distance(pos, this.route[0]) < 5) this.route.shift();
      if (!this.route.length || this.travel >= 4.5 || this.stalled >= 0.35) {
        this.finish(g, e);
        return true;
      }
      const target = this.route[0],
        length = distance(pos, target),
        speed = [11.2, 8.8, 12][phase] * (g.overtime ? 1.12 : 1),
        power = Math.min(speed, length / Math.max(1, dt * 60)),
        d = direction(pos, target);
      Matter.Body.applyForce(e.body, pos, {
        x: 0,
        y: -e.body.mass * g.engine.gravity.y * g.engine.gravity.scale,
      });
      Matter.Body.setVelocity(e.body, { x: d.x * power, y: d.y * power });
      rig.launch = { x: d.x * speed, y: d.y * speed };
      return true;
    }
    if (e.state !== 'idle' || e.timer > 0 || finalePending(e) || g.time < this.nextPlan)
      return false;
    const hasLane =
      distance(e.body.position, g.player.position) < 760 && finaleFiringLane(g, e.body.position);
    if (hasLane && this.lastMovedAttacks === e.attacks) return false;
    this.nextPlan = g.time + 0.4;
    this.route = finalePursuitRoute(g, e, phase, hasLane);
    if (!this.route.length) return false;
    this.lastMovedAttacks = e.attacks;
    this.lastPosition = null;
    this.stalled = this.travel = 0;
    const d = direction(e.body.position, this.route[0]);
    rig.launch = { x: d.x * 11, y: d.y * 11 };
    rig.origin = { ...e.body.position };
    // A previous countershot cannot silently catch bullets during a vault.
    rig.move = 'aimed';
    e.aim = { x: -d.x, y: -d.y };
    e.attack = 'vault';
    e.state = 'windup';
    e.timer = 0.56;
    g.soundAt('interceptor-lock', e.body.position, `enemy:${e.id}`);
    return true;
  }
}
