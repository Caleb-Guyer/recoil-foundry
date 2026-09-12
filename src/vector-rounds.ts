import type { Shot } from './game.ts';
import { clamp, distance, type Vec } from './rules.ts';

export const VECTOR = {
  speed: 0.75,
  turnRate: 8,
  turnBudget: Math.PI * 0.75,
  duration: 0.7,
  grace: 0.05,
  settle: 0.1,
  boostSpeed: 1.35,
  boostDamage: 1.3,
};
export interface VectorFlight {
  grace: number;
  time: number;
  bent: number;
  settled: number;
  afterburner: boolean;
  boosted: boolean;
}
export function prepareVector(s: Shot, mods: readonly string[]) {
  if (!mods.includes('vector') || !s.friendly || s.fragment || s.reflected || s.rail || s.echo)
    return;
  s.vector = {
    grace: VECTOR.grace,
    time: 0,
    bent: 0,
    settled: 0,
    afterburner: mods.includes('afterburner'),
    boosted: false,
  };
  s.trace ??= { bank: false, pierce: false, points: [{ ...s.pos }] };
}
// A portal or bank owns its immediate exit direction. It does not replenish
// steering time, turning allowance, or the one-use Afterburner payload.
export function redirectVector(s: Shot) {
  if (!s.vector) return;
  s.vector.grace = VECTOR.grace;
  s.vector.settled = 0;
}
export function steerVector(s: Shot, aim: Vec, dt: number) {
  const v = s.vector;
  if (!v || s.life <= 0 || s.recall?.returning || v.boosted || s.waypoints?.length) return;
  if (!Number.isFinite(aim.x) || !Number.isFinite(aim.y) || !(dt > 0)) return;
  // Preserve the muzzle direction before accepting steering, including rear
  // rounds. Convergence completes its authored shape before guidance takes over.
  const delayed = Math.min(dt, v.grace);
  v.grace -= delayed;
  const step = Math.min(dt - delayed, VECTOR.duration - v.time);
  if (step <= 0 || v.bent >= VECTOR.turnBudget) return;
  v.time += step;
  const speed = Math.hypot(s.vel.x, s.vel.y);
  if (speed < 0.001 || distance(s.pos, aim) < 24) {
    v.settled = 0;
    return;
  }
  const a = Math.atan2(s.vel.y, s.vel.x),
    target = Math.atan2(aim.y - s.pos.y, aim.x - s.pos.x),
    delta = Math.atan2(Math.sin(target - a), Math.cos(target - a));
  const limit = Math.min(VECTOR.turnRate * step, VECTOR.turnBudget - v.bent),
    turn = clamp(delta, -limit, limit);
  v.bent += Math.abs(turn);
  const angle = a + turn;
  s.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  // Straight shots never earn the bonus. The player must first shape a curve,
  // then hold a steady line; the boosted round commits to that line.
  v.settled = Math.abs(delta) < 0.07 && v.bent >= 0.18 ? v.settled + step : 0;
  if (v.afterburner && v.settled + 1e-8 >= VECTOR.settle) {
    v.boosted = true;
    s.vel.x *= VECTOR.boostSpeed;
    s.vel.y *= VECTOR.boostSpeed;
    s.damage *= VECTOR.boostDamage;
    if (s.shell) s.shell.damage *= VECTOR.boostDamage;
  }
}
