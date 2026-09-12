import Matter from 'matter-js';
import { firstSolid, sweepBox } from './collisions.ts';
import type { Game, Enemy } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp, direction, distance, segmentBox } from './rules.ts';
import { FLAK_TELL, FLAK_LOCK, flakAngles, bossMuzzle } from './enemies.ts';

const { Body, Bodies, Composite } = Matter;
export const CRANE_HEAD = { w: 50, h: 46 };
export const CRANE_RAIL = { left: 90, right: 1910, y: 150 };
export const CRANE_SWEEP_TELL = 0.95;
export const CRANE_SLAM_TELL = 1.1;
export const CRANE_LOCK = 0.45;
export interface CraneRig {
  head: Vec;
  prev: Vec;
  from: Vec;
  to: Vec;
  hit: boolean;
  body: Matter.Body;
  route: Vec[];
  planAt: number;
}

export function createCrane(g: Game, e: Enemy): CraneRig {
  const head = { x: e.body.position.x, y: 300 };
  const body = Bodies.rectangle(head.x, head.y, CRANE_HEAD.w, CRANE_HEAD.h, {
    isStatic: true,
    isSensor: false,
    label: 'crane-head',
  });
  Composite.add(g.engine.world, body);
  return {
    head,
    prev: { ...head },
    from: { ...head },
    to: { ...head },
    hit: false,
    body,
    route: [],
    planAt: 0,
  };
}

function trace(g: Game, from: Vec, to: Vec, retract = false) {
  let nearest: { t: number; normal: Vec; body: Matter.Body } | undefined;
  for (const body of g.solidBodies) {
    // Physics may leave a small existing overlap. Harmless retraction
    // can leave that existing overlap; attacks still stop on every solid.
    if (
      retract &&
      !body.isStatic &&
      from.x > body.bounds.min.x - 25 &&
      from.x < body.bounds.max.x + 25 &&
      from.y > body.bounds.min.y - 23 &&
      from.y < body.bounds.max.y + 23
    )
      continue;
    const hit = sweepBox(from, to, { x: 25, y: 23 }, body);
    if (hit && (!nearest || hit.t < nearest.t)) nearest = { ...hit, body };
  }
  return nearest;
}
function clip(g: Game, from: Vec, to: Vec, retract = false): Vec {
  const hit = trace(g, from, to, retract);
  return hit
    ? {
        x: from.x + (to.x - from.x) * hit.t + hit.normal.x * 0.05,
        y: from.y + (to.y - from.y) * hit.t + hit.normal.y * 0.05,
      }
    : { ...to };
}
function available(g: Game, p: Vec) {
  return (
    p.x >= 26 &&
    p.x <= g.worldWidth - 26 &&
    p.y >= 200 &&
    p.y <= 716 &&
    !g.solidBodies.some(
      (body) =>
        p.x + 25 > body.bounds.min.x &&
        p.x - 25 < body.bounds.max.x &&
        p.y + 23 > body.bounds.min.y &&
        p.y - 23 < body.bounds.max.y,
    )
  );
}
function setHead(rig: CraneRig, p: Vec) {
  rig.prev = { ...rig.head };
  rig.head = p;
  Body.setPosition(rig.body, p);
}

// The harmless retract still follows a hull-sized route. A cable may cross
// scenery, but the heavy head never slides through a platform to reset.
function route(g: Game, from: Vec, to: Vec): Vec[] {
  const corners = g.solidBodies
    .flatMap((body) => [
      { x: body.bounds.min.x - 29, y: body.bounds.min.y - 27 },
      { x: body.bounds.max.x + 29, y: body.bounds.min.y - 27 },
      { x: body.bounds.min.x - 29, y: body.bounds.max.y + 27 },
      { x: body.bounds.max.x + 29, y: body.bounds.max.y + 27 },
    ])
    .filter((p) => available(g, p));
  const nodes = [{ ...from }, to, ...corners],
    costs = nodes.map(() => Infinity),
    previous = nodes.map(() => -1),
    seen = new Set<number>();
  costs[0] = 0;
  for (let count = 0; count < nodes.length; count++) {
    let next = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!seen.has(i) && (next < 0 || costs[i] < costs[next])) next = i;
    if (next < 0 || !Number.isFinite(costs[next])) break;
    if (next === 1) break;
    seen.add(next);
    for (let i = 1; i < nodes.length; i++) {
      if (seen.has(i)) continue;
      const cost = costs[next] + distance(nodes[next], nodes[i]);
      if (cost < costs[i] && !trace(g, nodes[next], nodes[i], true)) {
        costs[i] = cost;
        previous[i] = next;
      }
    }
  }
  const points: Vec[] = [];
  let index = Number.isFinite(costs[1]) ? 1 : -1;
  while (index > 0) {
    points.unshift(nodes[index]);
    index = previous[index];
  }
  return points;
}
function moveHead(g: Game, rig: CraneRig, target: Vec, speed = 15) {
  if (g.time >= rig.planAt || !rig.route.length || distance(rig.route.at(-1)!, target) > 20) {
    rig.route = route(g, rig.head, target);
    rig.planAt = g.time + 0.3;
  }
  while (rig.route.length > 1 && distance(rig.head, rig.route[0]) < 1) rig.route.shift();
  const point = rig.route[0];
  if (!point) return false;
  const d = direction(rig.head, point),
    travel = Math.min(speed, distance(rig.head, point));
  setHead(
    rig,
    clip(g, rig.head, { x: rig.head.x + d.x * travel, y: rig.head.y + d.y * travel }, true),
  );
  return true;
}

function primaryPlan(g: Game, e: Enemy, attack: 'sweep' | 'slam') {
  const player = g.player.position,
    rig = e.crane!;
  if (attack === 'slam') {
    const from = { x: clamp(player.x, 26, g.worldWidth - 26), y: clamp(player.y - 245, 215, 475) };
    if (!available(g, from)) return null;
    const to = clip(g, from, { x: from.x, y: 717 });
    if (to.y + 23 < player.y - 18) return null;
    return { from, to };
  }
  const y = clamp(player.y - 8, 215, 714),
    preferred = rig.head.x < player.x ? -1 : 1;
  for (const side of [preferred, -preferred]) {
    for (const span of [320, 220, 140]) {
      const from = { x: clamp(player.x + side * span, 26, g.worldWidth - 26), y };
      const target = { x: clamp(player.x, 26, g.worldWidth - 26), y };
      if (Math.abs(from.x - target.x) < 90 || !available(g, from) || trace(g, from, target))
        continue;
      const to = clip(g, from, { x: clamp(player.x - side * 340, 26, g.worldWidth - 26), y });
      return { from, to };
    }
  }
  return null;
}
function lane(g: Game, x: number) {
  return !g.solidBodies.some((body) =>
    segmentBox(
      { x, y: CRANE_RAIL.y - 38 },
      g.player.position,
      { x: body.bounds.min.x - 7, y: body.bounds.min.y - 7 },
      { x: body.bounds.max.x + 7, y: body.bounds.max.y + 7 },
    ),
  );
}
function moveMotor(g: Game, e: Enemy, seekShot: boolean) {
  let x = clamp(g.player.position.x, CRANE_RAIL.left, CRANE_RAIL.right);
  if (seekShot) {
    const choices = [
      x,
      CRANE_RAIL.left,
      CRANE_RAIL.right,
      ...[-220, 220, -440, 440, -700, 700].map((dx) =>
        clamp(x + dx, CRANE_RAIL.left, CRANE_RAIL.right),
      ),
    ].filter((candidate) => lane(g, candidate));
    choices.sort((a, b) => Math.abs(a - e.body.position.x) - Math.abs(b - e.body.position.x));
    x = choices[0] ?? x;
  }
  const from = { ...e.body.position };
  const to = {
    x: e.body.position.x + clamp(x - e.body.position.x, -7, 7),
    y: CRANE_RAIL.y,
  };
  const contact = firstSolid(from, to, { x: 45, y: 27 }, g.solidBodies);
  Body.setPosition(
    e.body,
    contact
      ? {
          x: from.x + (to.x - from.x) * contact.t + contact.normal.x * 0.05,
          y: from.y + (to.y - from.y) * contact.t + contact.normal.y * 0.05,
        }
      : to,
  );
  const prop = contact && g.props.items.find((prop) => prop.body === contact.body);
  if (prop) g.props.strike(prop, 160, direction(from, to));
  if (contact) g.destruction.hitBody(contact.body, 160, direction(from, to));
}
function recover(g: Game, e: Enemy, impact: boolean) {
  const rig = e.crane!;
  e.state = 'recover';
  e.timer = rig.hit ? 0.45 : 1.05;
  rig.route = [];
  if (impact) {
    g.burst(rig.head, 18, '#ffd19a', 4);
    g.feedback(4);
    g.onSound('crane-hit');
  }
}

export function updateCrane(g: Game, e: Enemy) {
  const rig = e.crane!;
  if (e.state === 'rush') {
    const d = direction(rig.head, rig.to),
      travel = Math.min(e.attack === 'slam' ? 19 : 16, distance(rig.head, rig.to));
    const desired = { x: rig.head.x + d.x * travel, y: rig.head.y + d.y * travel };
    const obstruction = trace(g, rig.head, desired),
      end = clip(g, rig.head, desired);
    const player = g.player.position;
    const contact = segmentBox(
      rig.head,
      desired,
      { x: player.x - 13 - 25, y: player.y - 18 - 23 },
      { x: player.x + 13 + 25, y: player.y + 18 + 23 },
    );
    if (!rig.hit && contact && (!obstruction || contact.t < obstruction.t)) {
      rig.hit = true;
      g.damagePlayer(24, rig.head);
      if (g.mode !== 'playing') return;
    }
    setHead(rig, end);
    const finished = distance(rig.head, rig.to) < 1;
    // A warned path stops just outside cover. Resolve that final contact too,
    // without extending player damage beyond the marked endpoint.
    const impact =
      obstruction ??
      (finished
        ? trace(g, rig.head, {
            x: rig.head.x + d.x * 2,
            y: rig.head.y + d.y * 2,
          })
        : undefined);
    if (impact) {
      const prop = g.props.items.find((p) => p.body === impact.body);
      if (prop) g.props.strike(prop, 160, d);
      g.destruction.hitBody(impact.body, 160, d);
      if (e.hp <= 0 || g.mode !== 'playing') return;
    }
    if (obstruction || finished || e.timer <= 0) recover(g, e, !!impact || e.attack === 'slam');
    return;
  }
  if (e.state === 'windup') {
    if (e.attack === 'flak') {
      if (e.timer > FLAK_LOCK) e.aim = direction(bossMuzzle(e), g.player.position);
      if (e.timer <= 0) {
        for (const angle of flakAngles(Math.atan2(e.aim.y, e.aim.x), e.phase === 1))
          g.enemyShot(e, angle, 10, 18, bossMuzzle(e));
        e.attacks++;
        e.state = 'idle';
        e.timer = 0.3;
        g.onSound('enemy');
      }
      return;
    }
    if (e.timer > CRANE_LOCK) {
      const next = primaryPlan(g, e, e.attack as 'sweep' | 'slam');
      if (next) {
        rig.from = next.from;
        rig.to = next.to;
      }
    }
    moveHead(g, rig, rig.from);
    if (e.timer <= 0 && distance(rig.head, rig.from) < 1) {
      e.state = 'rush';
      e.timer = 2.1;
      rig.hit = false;
      e.attacks++;
      g.onSound(e.attack === 'sweep' ? 'crane-swing' : 'press');
    } else if (e.timer < -0.25) {
      e.state = 'idle';
      e.timer = 0.1;
    }
    return;
  }
  if (e.state === 'recover') {
    if (e.timer <= 0) {
      e.state = 'return';
      e.timer = 0.25;
      rig.planAt = 0;
    }
    return;
  }
  if (e.state === 'return') {
    moveMotor(g, e, false);
    if (e.hp <= 0 || g.mode !== 'playing') return;
    const nextAttack = e.attacks % 2 ? 'slam' : 'sweep',
      plan = g.player.position.y < 215 ? null : primaryPlan(g, e, nextAttack),
      home = { x: e.body.position.x, y: 250 },
      target = plan?.from ?? home;
    // Retract toward the next setup through the same collision-safe route.
    // A blocked setup falls back to the overhead home, where flak can seek a lane.
    const moving = moveHead(g, rig, target);
    if (!moving && plan) moveHead(g, rig, home);
    if (distance(rig.head, target) < 8 || e.timer < -2) {
      e.state = 'idle';
      e.timer = 0.1;
    }
    return;
  }
  const nextAttack = e.attacks % 2 ? 'slam' : 'sweep';
  let plan = g.player.position.y < 215 ? null : primaryPlan(g, e, nextAttack);
  if (plan && e.timer <= 0 && !moveHead(g, rig, plan.from)) plan = null;
  moveMotor(g, e, !plan);
  if (e.hp <= 0 || g.mode !== 'playing') return;
  if (e.timer > 0) return;
  if (!plan) {
    moveHead(g, rig, { x: e.body.position.x, y: 250 });
    if (lane(g, e.body.position.x)) {
      e.attack = 'flak';
      e.state = 'windup';
      e.timer = FLAK_TELL;
      e.phase = g.overtime || e.hp < e.maxHp / 2 ? 1 : 0;
      e.aim = direction(bossMuzzle(e), g.player.position);
      g.onSound('lock');
    }
    return;
  }
  if (distance(rig.head, plan.from) < 8) {
    e.attack = nextAttack;
    e.state = 'windup';
    e.timer = nextAttack === 'sweep' ? CRANE_SWEEP_TELL : CRANE_SLAM_TELL;
    rig.from = plan.from;
    rig.to = plan.to;
    rig.hit = false;
    g.onSound('crane-wind');
  }
}
