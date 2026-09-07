import Matter from 'matter-js';
import type { Game, Enemy } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp, direction, distance, segmentBox } from './rules.ts';
import { traceProp } from './props.ts';
import { FLAK_TELL, FLAK_LOCK, flakAngles } from './enemies.ts';

const { Body, Query } = Matter;
export const KILN_TELL = 1.1;
export const KILN_LOCK = 0.5;
export const KILN_HEAT_WARN = 0.4;
export const KILN_HEAT_LIFE = 1.8;
export const KILN_HEAT_WIDTH = 112;
export const KILN_RADIUS = 7;
export interface KilnArc {
  from: Vec;
  to: Vec;
  height: number;
  duration: number;
  impact: Vec;
  normal: Vec;
  fraction: number;
}
export interface KilnShell {
  arc: KilnArc;
  t: number;
  pos: Vec;
  prev: Vec;
}
export interface KilnPatch {
  x: number;
  y: number;
  w: number;
  warn: number;
  life: number;
  support: Matter.Body;
}
export interface KilnRig {
  plans: KilnArc[];
  shells: KilnShell[];
  patches: KilnPatch[];
  next: number;
}
export const createKiln = (): KilnRig => ({ plans: [], shells: [], patches: [], next: 0 });
export const kilnMuzzle = (e: Enemy): Vec => ({ x: e.body.position.x, y: e.body.position.y - 62 });
export function kilnPoint(arc: KilnArc, t: number): Vec {
  return {
    x: arc.from.x + (arc.to.x - arc.from.x) * t,
    y: arc.from.y + (arc.to.y - arc.from.y) * t - 4 * arc.height * t * (1 - t),
  };
}
export function clearKiln(e: Enemy) {
  if (e.kiln) {
    e.kiln.plans = [];
    e.kiln.shells = [];
    e.kiln.patches = [];
    e.kiln.next = 0;
  }
}

function trace(g: Game, from: Vec, to: Vec) {
  let nearest: { t: number; normal: Vec; body: Matter.Body } | undefined;
  for (const body of g.terrainBodies) {
    const hit = segmentBox(
      from,
      to,
      { x: body.bounds.min.x - KILN_RADIUS, y: body.bounds.min.y - KILN_RADIUS },
      { x: body.bounds.max.x + KILN_RADIUS, y: body.bounds.max.y + KILN_RADIUS },
    );
    if (hit && (!nearest || hit.t < nearest.t)) nearest = { ...hit, body };
  }
  for (const prop of g.props.items) {
    const hit = traceProp(prop, from, to, KILN_RADIUS);
    if (hit && (!nearest || hit.t < nearest.t)) nearest = { ...hit, body: prop.body };
  }
  return nearest;
}
function predict(g: Game, arc: KilnArc): KilnArc {
  // The preview and live flight use the same curve and swept collision rules.
  let from = arc.from;
  for (let i = 1; i <= 120; i++) {
    const t = i / 120,
      to = kilnPoint(arc, t),
      hit = trace(g, from, to);
    if (hit)
      return {
        ...arc,
        fraction: (i - 1 + hit.t) / 120,
        impact: { x: from.x + (to.x - from.x) * hit.t, y: from.y + (to.y - from.y) * hit.t },
        normal: hit.normal,
      };
    from = to;
  }
  return arc;
}
function surface(g: Game, x: number, feet: number) {
  return Math.min(
    740,
    ...g.terrainBodies
      .filter(
        (b) =>
          b.bounds.min.x < x &&
          b.bounds.max.x > x &&
          b.bounds.min.y >= feet - 4 &&
          b.bounds.min.y <= 740,
      )
      .map((b) => b.bounds.min.y),
  );
}
function planArc(g: Game, e: Enemy, x: number): KilnArc {
  const from = kilnMuzzle(e),
    to = {
      x: clamp(x, 26, g.worldWidth - 26),
      y: surface(g, x, g.player.position.y + 18) - KILN_RADIUS,
    },
    duration = 1.05 + Math.abs(to.x - from.x) / 2100;
  let best: KilnArc | undefined;
  for (const height of [240, 340, 440, 530]) {
    const arc = predict(g, {
      from,
      to,
      height,
      duration,
      impact: to,
      normal: { x: 0, y: -1 },
      fraction: 1,
    });
    if (!best || distance(arc.impact, to) < distance(best.impact, to)) best = arc;
    if (distance(arc.impact, to) < 8) break;
  }
  return best!;
}
function planVolley(g: Game, e: Enemy) {
  const center = clamp(g.player.position.x + clamp(g.player.velocity.x * 12, -100, 100), 26, 1974),
    offsets = e.phase === 1 ? [0, -145, 145, e.attacks % 2 ? -290 : 290] : [0, -130, 130];
  return offsets.map((offset) => planArc(g, e, clamp(center + offset, 26, 1974)));
}
function grounded(g: Game, e: Enemy) {
  return (
    e.body.velocity.y >= -1 &&
    [-46, 0, 46].some(
      (dx) =>
        Query.ray(
          g.solidBodies,
          { x: e.body.position.x + dx, y: e.body.bounds.max.y - 2 },
          { x: e.body.position.x + dx, y: e.body.bounds.max.y + 5 },
          12,
        ).length > 0,
    )
  );
}
function lane(g: Game, from: Vec) {
  return distance(g.lineEnd(from, g.player.position, 7), g.player.position) < 0.1;
}
function approach(g: Game, e: Enemy, counter: boolean) {
  const p = e.body.position,
    player = g.player.position;
  let target = clamp(player.x + (p.x < player.x ? -400 : 400), 95, 1905);
  if (counter) {
    // Seek an actual standing position on the ground or a low stack. The
    // boiler gets there with physical tread movement and hops, never a warp.
    const positions = [
      p.x,
      player.x,
      ...[-850, -550, -300, 300, 550, 850].map((x) => player.x + x),
      100,
      1900,
    ];
    const choices = positions
      .map((x) => clamp(x, 65, 1935))
      .filter((x) => {
        const floor = surface(g, x, 605);
        return lane(g, { x, y: floor - 42 - 62 });
      });
    choices.sort((a, b) => Math.abs(a - p.x) - Math.abs(b - p.x));
    target = choices[0] ?? clamp(player.x, 65, 1935);
  }
  const dx = target - p.x,
    sign = Math.sign(dx) || Math.sign(player.x - p.x) || 1,
    blocked = Query.ray(g.solidBodies, p, { x: p.x + sign * 80, y: p.y + 10 }, 14).length > 0;
  Body.setVelocity(e.body, {
    x: e.body.velocity.x + ((Math.abs(dx) < 12 ? 0 : sign * 2.8) - e.body.velocity.x) * 0.12,
    y: e.body.velocity.y,
  });
  if (grounded(g, e) && blocked) {
    Body.setVelocity(e.body, { x: sign * 5.2, y: -13.5 });
    e.timer = Math.max(e.timer, 0.35);
  }
}
function impact(g: Game, e: Enemy, shell: KilnShell, hit: NonNullable<ReturnType<typeof trace>>) {
  const rig = e.kiln!,
    prop = g.props.items.find((p) => p.body === hit.body);
  g.burst(shell.pos, 16, '#f1b477', 3.8);
  g.feedback(2.5);
  g.onSound('kiln-impact');
  if (prop) {
    g.props.hit(prop, 160, direction(shell.prev, shell.pos));
    return;
  }
  if (hit.normal.y > -0.5 || !hit.body.isStatic) return;
  const left = Math.max(hit.body.bounds.min.x, shell.pos.x - KILN_HEAT_WIDTH / 2),
    right = Math.min(hit.body.bounds.max.x, shell.pos.x + KILN_HEAT_WIDTH / 2);
  if (right - left < 16) return;
  if (rig.patches.length >= 8) rig.patches.shift();
  rig.patches.push({
    x: (left + right) / 2,
    y: hit.body.bounds.min.y,
    w: right - left,
    warn: KILN_HEAT_WARN,
    life: KILN_HEAT_LIFE,
    support: hit.body,
  });
}
function updateHazards(g: Game, e: Enemy, dt: number) {
  const rig = e.kiln!;
  for (const patch of [...rig.patches]) {
    if (!g.terrainBodies.includes(patch.support)) {
      rig.patches = rig.patches.filter((p) => p !== patch);
      continue;
    }
    if (patch.warn > 0) {
      patch.warn = Math.max(0, patch.warn - dt);
      continue;
    }
    patch.life -= dt;
    if (patch.life <= 0) {
      rig.patches = rig.patches.filter((p) => p !== patch);
      continue;
    }
    const p = g.player.position;
    if (
      p.x + 13 > patch.x - patch.w / 2 &&
      p.x - 13 < patch.x + patch.w / 2 &&
      p.y + 18 > patch.y - 10 &&
      p.y - 18 < patch.y + 2 &&
      distance(
        g.lineEnd(
          { x: clamp(p.x, patch.x - patch.w / 2, patch.x + patch.w / 2), y: patch.y - 8 },
          p,
        ),
        p,
      ) < 0.1
    ) {
      g.damagePlayer(18, { x: patch.x, y: patch.y });
      if (g.mode !== 'playing') return;
    }
  }
  for (const shell of [...rig.shells]) {
    shell.prev = { ...shell.pos };
    // Bound each curved segment to a small normalized step. A fast shell
    // cannot tunnel through a thin shelf or the player's swept hull.
    const endT = shell.t + dt / shell.arc.duration;
    let consumed = false;
    while (shell.t < endT - 1e-8) {
      const nextT = Math.min(endT, shell.t + 1 / 120),
        to = kilnPoint(shell.arc, nextT),
        hit = trace(g, shell.pos, to),
        p = g.player.position,
        playerHit = segmentBox(
          shell.pos,
          to,
          { x: p.x - 13 - KILN_RADIUS, y: p.y - 18 - KILN_RADIUS },
          { x: p.x + 13 + KILN_RADIUS, y: p.y + 18 + KILN_RADIUS },
        );
      if (playerHit && (!hit || playerHit.t < hit.t)) {
        g.damagePlayer(26, shell.pos);
        if (g.mode !== 'playing') return;
        consumed = true;
        g.burst(p, 10, '#e3a273', 2.5);
      }
      if (consumed) break;
      if (hit) {
        shell.pos = {
          x: shell.pos.x + (to.x - shell.pos.x) * hit.t,
          y: shell.pos.y + (to.y - shell.pos.y) * hit.t,
        };
        impact(g, e, shell, hit);
        consumed = true;
        break;
      }
      shell.pos = to;
      shell.t = nextT;
    }
    if (
      consumed ||
      shell.t > 2 ||
      shell.pos.x < -20 ||
      shell.pos.x > g.worldWidth + 20 ||
      shell.pos.y > 800
    )
      rig.shells = rig.shells.filter((s) => s !== shell);
    if (g.mode !== 'playing' || e.hp <= 0) return;
  }
}

export function updateKiln(g: Game, e: Enemy, dt: number) {
  const rig = e.kiln!;
  updateHazards(g, e, dt);
  if (g.mode !== 'playing' || e.hp <= 0) return;
  if (e.state === 'windup') {
    Body.setVelocity(e.body, { x: e.body.velocity.x * 0.5, y: e.body.velocity.y });
    if (e.attack === 'flak') {
      if (e.timer > FLAK_LOCK) e.aim = direction(kilnMuzzle(e), g.player.position);
      if (e.timer <= 0) {
        for (const angle of flakAngles(Math.atan2(e.aim.y, e.aim.x), e.phase === 1))
          g.enemyShot(e, angle, 10, 18, kilnMuzzle(e));
        e.attacks++;
        e.state = 'idle';
        e.timer = 0.3;
        g.onSound('kiln-fire');
      }
      return;
    }
    if (e.timer > KILN_LOCK) rig.plans = planVolley(g, e);
    if (e.timer <= 0) {
      // A moving prop can remove the boiler's footing during the warning.
      // Reposition and warn again instead of launching from a stale muzzle.
      if (!grounded(g, e) || distance(kilnMuzzle(e), rig.plans[0].from) > 12) {
        e.state = 'idle';
        e.timer = 0.25;
        rig.plans = [];
        return;
      }
      e.state = 'rush';
      e.timer = 0;
      rig.next = 0;
    }
    return;
  }
  if (e.state === 'rush') {
    Body.setVelocity(e.body, { x: e.body.velocity.x * 0.5, y: e.body.velocity.y });
    const pending = rig.plans[rig.next];
    if (pending && distance(kilnMuzzle(e), pending.from) > 12) {
      e.state = 'idle';
      e.timer = 0.25;
      rig.plans = [];
      return;
    }
    if (e.timer <= 0) {
      const arc = rig.plans[rig.next++];
      if (arc && rig.shells.length < 8)
        rig.shells.push({ arc, t: 0, pos: { ...arc.from }, prev: { ...arc.from } });
      e.timer = 0.18;
      g.onSound('kiln-fire');
      if (rig.next >= rig.plans.length) {
        e.attacks++;
        e.state = 'recover';
        e.timer = 1.5;
        rig.plans = [];
      }
    }
    return;
  }
  if (e.state === 'recover') {
    Body.setVelocity(e.body, { x: e.body.velocity.x * 0.7, y: e.body.velocity.y });
    if (e.timer <= 0) {
      e.state = 'idle';
      e.timer = 0.2;
    }
    return;
  }
  const above = g.player.position.y < e.body.position.y - 155;
  let plans: KilnArc[] = [];
  if (!above && e.timer <= 0 && grounded(g, e)) {
    e.phase = e.hp < e.maxHp / 2 ? 1 : 0;
    plans = planVolley(g, e);
  }
  const sheltered =
      plans.length > 0 &&
      (plans[0].impact.y < g.player.position.y - 45 ||
        Math.abs(plans[0].impact.x - plans[0].to.x) > 65),
    counter = above || sheltered;
  if (e.timer <= 0 && grounded(g, e) && counter && lane(g, kilnMuzzle(e))) {
    e.phase = e.hp < e.maxHp / 2 ? 1 : 0;
    e.attack = 'flak';
    e.aim = direction(kilnMuzzle(e), g.player.position);
    e.state = 'windup';
    e.timer = FLAK_TELL;
    rig.plans = [];
    Body.setVelocity(e.body, { x: 0, y: 0 });
    g.onSound('kiln-wind');
  } else if (plans.length && !counter) {
    e.attack = 'mortar';
    e.state = 'windup';
    e.timer = KILN_TELL;
    rig.plans = plans;
    Body.setVelocity(e.body, { x: 0, y: 0 });
    g.onSound('kiln-wind');
  } else approach(g, e, counter);
}
