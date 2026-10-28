import { ENEMY_STATS } from './enemies.ts';
import type { Vec } from './rules.ts';
import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import type { MachineWreck } from './machine-breakdown.ts';
import type { MachineWreckProjection } from './machine-breakdown-wreck-art.ts';
import { heavyMachinePose, type HeavyMachinePose } from './heavy-machine-pose.ts';
import { drawHeavyChassis } from './heavy-machine-art.ts';

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (a: Vec, b: Vec, t: number): Vec => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const smooth = (value: number) => 1 - (1 - Math.max(0, Math.min(1, value))) ** 3;
const angleMix = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** Uses the exact live leaves, tubes, knees and wheels, with no body-scale squash. */
export function heavyShutdownPose(
  s: MachineBodySnapshot,
  age: number,
  reduced = false,
  shutdown = 0.38,
): HeavyMachinePose | null {
  if (s.kind !== 'shutter' && s.kind !== 'strider' && s.kind !== 'mortar') return null;
  const start = heavyMachinePose({ ...s, flash: 0 }, reduced);
  const duration = Number.isFinite(shutdown) ? Math.max(0.01, shutdown) : 0.38;
  const elapsed = Number.isFinite(age) ? Math.max(0, age) : 0;
  const fold = reduced ? 1 : smooth(elapsed / duration),
    f = start.forward;
  const floor = ENEMY_STATS[s.kind].h / 2 - 1;
  const body =
    s.kind === 'shutter'
      ? { x: f * 1.6, y: 3.4 }
      : s.kind === 'strider'
        ? { x: f * 1.3, y: 5.2 }
        : { x: f * 1.2, y: 2.5 };
  const bodyNow = point(start.body, body, fold),
    bodyDelta = { x: bodyNow.x - start.body.x, y: bodyNow.y - start.body.y };
  const stoppedAt = reduced ? duration : Math.min(elapsed, duration);
  const drive =
    start.drive +
    Math.sign(s.velocity.x) * 2 * (stoppedAt - (stoppedAt * stoppedAt) / (2 * duration));
  return {
    ...start,
    mode: 'shutdown',
    wear: 2,
    brace: 0,
    recover: false,
    receiver: 0,
    body: bodyNow,
    angle: angleMix(
      start.angle,
      f * (s.kind === 'shutter' ? 0.12 : s.kind === 'strider' ? 0.11 : 0.16),
      fold,
    ),
    opening: mix(start.opening, 1, fold),
    drive,
    loader: mix(start.loader, 0, fold),
    recoil: mix(start.recoil, 0, fold),
    panels: start.panels.map((panel, index) => {
      const lower = index > 0;
      const target = {
        x: panel.position.x + f * 1.5,
        y: lower ? floor - panel.height / 2 - 1 : panel.position.y + (body.y - start.body.y) + 5,
      };
      return {
        ...panel,
        position: point(panel.position, target, fold),
        angle: angleMix(panel.angle, f * (lower ? -0.36 : 0.26), fold),
      };
    }),
    legs: start.legs.map((leg, index) => {
      const side = Math.abs(leg.foot.x) > 0.5 ? Math.sign(leg.foot.x) : index % 2 ? 1 : -1;
      const hip = { x: body.x + side * 5, y: body.y + (s.kind === 'shutter' ? 10 : 4) },
        knee = { x: side * 14 + f, y: floor - 3 },
        foot = { x: side * 8 + f, y: floor };
      return {
        hip: point(leg.hip, hip, fold),
        knee: point(leg.knee, knee, fold),
        foot: point(leg.foot, foot, fold),
        planted: fold > 0.8,
      };
    }),
    wheels: start.wheels.map((wheel, index) => {
      const side = wheel.x < 0 ? -1 : 1;
      return point(wheel, { x: wheel.x + side * (index % 2 ? 4 : 1), y: floor - 5 }, fold);
    }),
    barrels: start.barrels.map((barrel, index) => {
      const pivot = {
        x: barrel.origin.x - Math.cos(barrel.angle) * barrel.length + bodyDelta.x,
        y: barrel.origin.y - Math.sin(barrel.angle) * barrel.length + bodyDelta.y,
      };
      const spread = (index - (start.barrels.length - 1) / 2) * 0.045;
      const drop = (s.kind === 'mortar' ? 0.34 : 0.18) + spread;
      const target = f > 0 ? drop : Math.PI - drop;
      const angle = angleMix(barrel.angle, target, fold);
      // A broken Twin Mortar bracket lets its two real tubes part slightly;
      // their shared live muzzle remains exact at the start of shutdown.
      const lateral = s.kind === 'mortar' ? (index - (start.barrels.length - 1) / 2) * 6 * fold : 0;
      return {
        ...barrel,
        angle,
        recoil: mix(barrel.recoil, 0, fold),
        origin: {
          x: pivot.x + Math.cos(angle) * barrel.length - Math.sin(angle) * lateral,
          y: pivot.y + Math.sin(angle) * barrel.length + Math.cos(angle) * lateral,
        },
      };
    }),
  };
}

/** Caller owns world projection, split scale, alpha and actual support-plane clipping.
 * This module imports its projection type only, avoiding a runtime dispatcher cycle.
 */
export function drawHeavyMachineWreck(
  c: CanvasRenderingContext2D,
  wreck: MachineWreck,
  projection: MachineWreckProjection,
  reduced = false,
): HeavyMachinePose | null {
  const pose = heavyShutdownPose(wreck.visual, projection.age, reduced, wreck.shutdown);
  if (!pose) return null;
  const inactive: MachineBodySnapshot = {
    ...wreck.visual,
    hp: 0,
    flash: 0,
    brace: 0,
    timer: 0,
    state: 'recover',
    velocity: { x: 0, y: 0 },
  };
  drawHeavyChassis(c, inactive, reduced, pose);
  return pose;
}
