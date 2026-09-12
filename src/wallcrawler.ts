import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import { firstSolid } from './collisions.ts';
import { grindRail } from './grindshot.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';

const { Body } = Matter;
export const CRAWLER = { offset: 17, half: 14, tell: 0.95, lock: 0.5, burst: 0.13, stun: 1.5 };
export interface CrawlerRig {
  support?: Matter.Body;
  edge: number;
  dir: number;
  normal: Vec;
  origin: Vec;
  angles: number[];
  fired: number;
  vulnerable: number;
  blocked: number;
  travel: number;
}
export const crawlerAngles = (aim: Vec) => {
  const a = Math.atan2(aim.y, aim.x);
  return [a, a - 0.12, a + 0.12];
};
export const crawlerSpeed = (g: Game) => (g.stage >= 16 ? 11 : 9.5);
function supported(g: Game, body: Matter.Body) {
  // Structural map faces provide the route. Loose crates and moving machinery
  // remain physical obstacles, never an invisible rail through the room.
  return g.terrain.includes(body) && Math.abs(body.angle) < 0.001;
}
function footing(g: Game, e: Enemy, only?: Matter.Body, range = 7) {
  let best: { body: Matter.Body; edge: number; point: Vec; normal: Vec; error: number } | undefined;
  for (const body of only ? [only] : g.terrain) {
    if (!supported(g, body)) continue;
    const rail = grindRail(body, CRAWLER.offset);
    for (let edge = 0; edge < rail.length; edge++) {
      const a = rail[edge],
        b = rail[(edge + 1) % rail.length],
        axis = direction(a, b);
      const u = clamp(
        (e.body.position.x - a.x) * axis.x + (e.body.position.y - a.y) * axis.y,
        0,
        distance(a, b),
      );
      const point = { x: a.x + axis.x * u, y: a.y + axis.y * u },
        error = distance(point, e.body.position);
      if (error > range || (best && error >= best.error)) continue;
      if (
        firstSolid(
          e.body.position,
          point,
          { x: CRAWLER.half, y: CRAWLER.half },
          g.solidBodies.filter((b) => b !== body),
        )
      )
        continue;
      best = { body, edge, point, normal: { x: axis.y, y: -axis.x }, error };
    }
  }
  return best;
}
function grip(g: Game, e: Enemy, foot: NonNullable<ReturnType<typeof footing>>) {
  const rig = e.crawler!;
  rig.support = foot.body;
  rig.edge = foot.edge;
  rig.normal = foot.normal;
  rig.blocked = 0;
  const rail = grindRail(foot.body, CRAWLER.offset),
    t = direction(rail[foot.edge], rail[(foot.edge + 1) % rail.length]);
  rig.dir =
    Math.abs(t.y) > 0.5
      ? -Math.sign(t.y)
      : Math.sign((g.player.position.x - e.body.position.x) * t.x) || 1;
}
export function createWallcrawler(g: Game, e: Enemy): CrawlerRig {
  e.crawler = {
    edge: 0,
    dir: 1,
    normal: { x: 0, y: -1 },
    origin: { ...e.body.position },
    angles: [],
    fired: 0,
    vulnerable: 0,
    blocked: 0,
    travel: 0,
  };
  const foot = footing(g, e);
  if (foot) grip(g, e, foot);
  return e.crawler;
}
export function dropWallcrawler(g: Game, e: Enemy) {
  const rig = e.crawler;
  if (!rig?.support) return;
  rig.support = undefined;
  rig.angles = [];
  rig.fired = 0;
  rig.vulnerable = CRAWLER.stun;
  e.state = 'recover';
  e.timer = CRAWLER.stun;
  // Gravity and the normal collision solver handle the fall. No position warp.
  g.burst(e.body.position, 5, '#e4bd89', 2);
  g.onSound('crawler-drop');
}
function steer(g: Game, e: Enemy, to: Vec) {
  Body.applyForce(e.body, e.body.position, {
    x: -e.body.mass * g.engine.gravity.x * g.engine.gravity.scale,
    y: -e.body.mass * g.engine.gravity.y * g.engine.gravity.scale,
  });
  Body.setVelocity(e.body, {
    x: clamp((to.x - e.body.position.x) / 0.97, -3.4, 3.4),
    y: clamp((to.y - e.body.position.y) / 0.97, -3.4, 3.4),
  });
}
function aim(g: Game, e: Enemy) {
  const rig = e.crawler!;
  e.aim = direction(e.body.position, g.player.position);
  rig.origin = { ...e.body.position };
  rig.angles = crawlerAngles(e.aim);
}
export function beginCrawlerAttack(g: Game, e: Enemy) {
  const rig = e.crawler!;
  if (!rig.support || rig.vulnerable > 0) return;
  e.state = 'windup';
  e.timer = CRAWLER.tell;
  rig.fired = 0;
  aim(g, e);
  g.onSound('crawler-lock');
}
function fire(g: Game, e: Enemy) {
  const rig = e.crawler!;
  g.enemyShot(e, rig.angles[rig.fired++], crawlerSpeed(g), g.stage >= 16 ? 18 : 14, rig.origin);
  g.onSound('enemy');
  if (rig.fired === 3) {
    e.state = 'recover';
    e.timer = 0.7;
    e.attacks++;
  } else {
    e.state = 'followup';
    e.timer = CRAWLER.burst;
  }
}
export function updateWallcrawler(g: Game, e: Enemy, dt: number) {
  const rig = e.crawler!,
    p = e.body.position;
  rig.vulnerable = Math.max(0, rig.vulnerable - dt);
  if (
    rig.support &&
    (!supported(g, rig.support) ||
      !footing(g, e, rig.support, 9) ||
      Math.abs(e.body.velocity.x * rig.normal.x + e.body.velocity.y * rig.normal.y) > 5)
  )
    dropWallcrawler(g, e);
  if (!rig.support) {
    // A broken grip cannot reattach in mid-fall or leave a queued volley behind.
    if (rig.vulnerable > 0) return;
    const foot = footing(g, e);
    if (!foot) return;
    grip(g, e, foot);
    e.state = 'idle';
    e.timer = 0.65;
  }
  const host = rig.support!,
    rail = grindRail(host, CRAWLER.offset);
  let a = rail[rig.edge],
    b = rail[(rig.edge + 1) % rail.length],
    axis = direction(a, b);
  let u = clamp((p.x - a.x) * axis.x + (p.y - a.y) * axis.y, 0, distance(a, b));
  const home = { x: a.x + axis.x * u, y: a.y + axis.y * u };
  rig.normal = { x: axis.y, y: -axis.x };
  if (e.spawn > 0) {
    steer(g, e, home);
    return;
  }
  if (e.state === 'windup' || e.state === 'followup') {
    if (distance(p, rig.origin) > 8) {
      e.state = 'idle';
      e.timer = 0.5;
      rig.angles = [];
      rig.fired = 0;
    } else {
      steer(g, e, home);
      if (e.state === 'windup' && e.timer > CRAWLER.lock) aim(g, e);
      if (e.timer <= 0) fire(g, e);
      return;
    }
  }
  if (e.state === 'recover') {
    steer(g, e, home);
    if (e.timer <= 0) {
      e.state = 'idle';
      e.timer = g.stage >= 16 ? 1.05 : 1.45;
      rig.angles = [];
    }
    return;
  }
  const target = g.player.position;
  if (
    e.timer <= 0 &&
    distance(p, target) < 900 &&
    distance(g.lineEnd(p, target, 5), target) < 0.1
  ) {
    beginCrawlerAttack(g, e);
    steer(g, e, home);
    return;
  }
  // Reach a corner before changing faces. Actual positions, not a timer, advance
  // this cursor; a crate can stop the hull without the route outrunning it.
  const corner = rig.dir > 0 ? b : a;
  if (distance(p, corner) < 0.35) {
    rig.edge = (rig.edge + rig.dir + rail.length) % rail.length;
    a = rail[rig.edge];
    b = rail[(rig.edge + 1) % rail.length];
    axis = direction(a, b);
    u = rig.dir > 0 ? 0 : distance(a, b);
    rig.normal = { x: axis.y, y: -axis.x };
  }
  const speed = g.stage >= 16 ? 2.7 : 2.05,
    along = clamp(u + rig.dir * speed, 0, distance(a, b));
  const next = { x: a.x + axis.x * along, y: a.y + axis.y * along };
  const hit = firstSolid(
    p,
    next,
    { x: CRAWLER.offset, y: CRAWLER.offset },
    g.solidBodies.filter((b) => b !== host),
  );
  if (hit) {
    const foot = supported(g, hit.body) ? footing(g, e, hit.body, 8) : undefined;
    if (foot) {
      grip(g, e, foot);
      steer(g, e, foot.point);
      return;
    }
    rig.blocked += dt;
    if (rig.blocked > 0.2) {
      rig.dir *= -1;
      rig.blocked = 0;
    }
    steer(g, e, home);
    return;
  }
  if (
    next.x < CRAWLER.half ||
    next.x > g.worldWidth - CRAWLER.half ||
    next.y < g.worldTop + CRAWLER.half ||
    next.y > 740 - CRAWLER.half
  ) {
    rig.dir *= -1;
    steer(g, e, home);
    return;
  }
  rig.blocked = 0;
  rig.travel += distance(p, next);
  steer(g, e, next);
}
