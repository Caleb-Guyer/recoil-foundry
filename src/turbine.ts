import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp, direction, distance } from './rules.ts';
import { bossPhase } from './enemies.ts';
import { bossHasLane, huntBoss } from './boss-hunt.ts';
import type { Prop } from './props.ts';

export const TURBINE_LOCK = 0.45;
export const TURBINE_GUST_TELL = 1.15;
export const TURBINE_SWEEP_TELL = 1.05;
export const TURBINE_GUST_TIME = 1.8;
export const TURBINE_RECOVER = 1.1;
export const TURBINE_RANGE = 850;
export interface TurbineRig {
  origin: Vec;
  angles: number[];
  sent: number;
  active: number;
}
export const createTurbine = (): TurbineRig => ({
  origin: { x: 0, y: 0 },
  angles: [],
  sent: 0,
  active: 0,
});
export const turbineRelease = (gust: boolean, index: number, count: number) =>
  gust ? 0.25 + Math.floor(index / count) * 0.95 + (index % count) * 0.1 : index * 0.14;
export function turbineAngles(e: Enemy): number[] {
  const aim = Math.atan2(e.aim.y, e.aim.x);
  const count = e.phase === 0 ? 3 : 5;
  const spacing = e.attack === 'gust' ? 0.16 : 0.3;
  return Array.from({ length: count }, (_, i) => aim + (i - (count - 1) / 2) * spacing);
}
// The same finite cone is used by the airflow marks and the force. Cover is
// checked per target; wind never leaks around a corner or through a loose crate.
export function turbineWind(g: Game, e: Enemy, point: Vec, ignored?: Prop): number {
  if (
    e.kind !== 'turbine' ||
    !e.turbine ||
    e.state !== 'rush' ||
    e.attack !== 'gust' ||
    e.hp <= 0 ||
    e.spawn > 0
  )
    return 0;
  const from = e.turbine.origin;
  const dx = point.x - from.x,
    dy = point.y - from.y;
  const along = dx * e.aim.x + dy * e.aim.y;
  const across = Math.abs(dx * e.aim.y - dy * e.aim.x);
  const width = 48 + along * 0.14;
  if (along < 50 || along > TURBINE_RANGE || across > width) return 0;
  if (distance(g.lineEnd(from, point, 0, ignored), point) > 0.1) return 0;
  return clamp((width - across) / 30, 0, 1) * clamp(e.turbine.active / 0.2, 0, 1);
}
export function applyTurbineWind(g: Game, e: Enemy, dt: number) {
  const push = (body: Matter.Body, amount: number, cap: number) => {
    if (!amount || body.isStatic) return;
    Matter.Body.setVelocity(body, {
      x: clamp(body.velocity.x + e.aim.x * amount * dt * 60, -cap, cap),
      y: clamp(body.velocity.y + e.aim.y * amount * dt * 60, -21, 20),
    });
  };
  push(g.player, turbineWind(g, e, g.player.position) * (g.grounded ? 0.18 : 0.62), 23);
  for (const prop of g.props.items)
    push(prop.body, turbineWind(g, e, prop.body.position, prop) * 0.22, 12);
}
function recover(g: Game, e: Enemy) {
  e.state = 'recover';
  e.timer = TURBINE_RECOVER - e.phase * 0.1;
  e.attacks++;
  e.hunt = undefined;
  g.onSound('turbine-open');
}
export function updateTurbine(g: Game, e: Enemy, dt: number) {
  const rig = e.turbine!;
  Matter.Body.applyForce(e.body, e.body.position, { x: 0, y: -e.body.mass * 0.001 });
  const phase = bossPhase(e.hp, e.maxHp);
  if (phase > e.phase) {
    e.phase = phase;
    e.state = 'transition';
    e.timer = 0.75;
    rig.angles = [];
    rig.sent = 0;
    rig.active = 0;
    e.hunt = undefined;
    g.feedback(3);
    g.onSound('phase');
  }
  if (['windup', 'rush', 'transition', 'recover'].includes(e.state)) {
    Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
  } else huntBoss(g, e);
  if (e.state === 'transition' || e.state === 'recover') {
    if (e.timer <= 0) {
      e.state = 'idle';
      e.timer = 0.2;
    }
    return;
  }
  if (e.state === 'windup') {
    if (e.timer > TURBINE_LOCK) {
      e.aim = direction(e.body.position, g.player.position);
      rig.origin = { ...e.body.position };
      rig.angles = turbineAngles(e);
    }
    if (e.timer <= 0) {
      e.state = 'rush';
      e.timer = e.attack === 'gust' ? TURBINE_GUST_TIME : 0.7;
      rig.active = 0;
      rig.sent = 0;
      g.onSound(e.attack === 'gust' ? 'turbine-gust' : 'turbine-cut');
    }
    return;
  }
  if (e.state === 'rush') {
    rig.active += dt;
    if (e.attack === 'gust') applyTurbineWind(g, e, dt);
    // A whole fan is shown before commitment. Blades release across its lanes
    // over time; the last phase reverses the sweep without hiding any lane.
    const count = rig.angles.length;
    while (
      rig.sent < count * (e.attack === 'gust' ? 2 : 1) &&
      rig.active >= turbineRelease(e.attack === 'gust', rig.sent, count)
    ) {
      const next = rig.sent % count;
      const index = e.phase === 2 ? count - 1 - next : next;
      g.enemyShot(e, rig.angles[index], 9.6 + e.phase * 0.5, 22, rig.origin, true);
      rig.sent++;
    }
    if (e.timer <= 0) recover(g, e);
    return;
  }
  if (e.timer <= 0 && bossHasLane(g, e)) {
    e.attack = e.attacks % 2 === 0 ? 'gust' : 'sweep';
    e.aim = direction(e.body.position, g.player.position);
    rig.origin = { ...e.body.position };
    rig.angles = turbineAngles(e);
    rig.sent = 0;
    rig.active = 0;
    e.state = 'windup';
    e.timer = e.attack === 'gust' ? TURBINE_GUST_TELL : TURBINE_SWEEP_TELL;
    g.onSound('turbine-wind');
  }
}
