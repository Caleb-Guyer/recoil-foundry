import { ENEMY_STATS } from './enemies.ts';
import type { Vec } from './rules.ts';
import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import type { MachineWreck } from './machine-breakdown.ts';
import type { MachineWreckProjection } from './machine-breakdown-wreck-art.ts';
import { hazardMachinePose, type HazardMachinePose } from './hazard-machine-pose.ts';
import { drawHazardChassis } from './hazard-machine-art.ts';

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (a: Vec, b: Vec, t: number): Vec => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const smooth = (n: number) => 1 - (1 - Math.max(0, Math.min(1, n))) ** 3;
const angleMix = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** Only captured hardware folds. Real crates, harpoons and charges remain in their native controllers. */
export function hazardShutdownPose(
  s: MachineBodySnapshot,
  age: number,
  reduced = false,
  shutdown = 0.38,
): HazardMachinePose | null {
  if (s.kind !== 'scrapper' && s.kind !== 'harpooner' && s.kind !== 'sapper') return null;
  const start = hazardMachinePose({ ...s, flash: 0 }, reduced),
    duration = Number.isFinite(shutdown) ? Math.max(0.01, shutdown) : 0.38,
    elapsed = Number.isFinite(age) ? Math.max(0, age) : 0,
    fold = reduced ? 1 : smooth(elapsed / duration),
    f = start.forward,
    floor = ENEMY_STATS[s.kind].h / 2 - 1,
    body = {
      x: f * (s.kind === 'scrapper' ? 2 : 1),
      y: s.kind === 'scrapper' ? 3.2 : s.kind === 'harpooner' ? 3.8 : 4.4,
    },
    bodyNow = point(start.body, body, fold),
    delta = { x: bodyNow.x - start.body.x, y: bodyNow.y - start.body.y },
    stoppedAt = reduced ? duration : Math.min(elapsed, duration),
    coast = stoppedAt - (stoppedAt * stoppedAt) / (2 * duration);
  const barrel = start.barrel;
  const barrelAngle = barrel
    ? angleMix(
        barrel.angle,
        f > 0 ? (s.kind === 'sapper' ? 0.45 : 0.27) : Math.PI - (s.kind === 'sapper' ? 0.45 : 0.27),
        fold,
      )
    : 0;
  // Live barrel origins are muzzle endpoints, so rotate around the captured rear hinge.
  const barrelOrigin = barrel
    ? {
        x:
          barrel.origin.x -
          Math.cos(barrel.angle) * barrel.length +
          delta.x +
          Math.cos(barrelAngle) * barrel.length,
        y:
          barrel.origin.y -
          Math.sin(barrel.angle) * barrel.length +
          delta.y +
          Math.sin(barrelAngle) * barrel.length,
      }
    : { x: 0, y: 0 };
  return {
    ...start,
    mode: 'shutdown',
    energy: 0,
    wear: 2,
    brace: 0,
    recover: false,
    receiver: 0,
    release: 0,
    strain: 0,
    brake: 0,
    body: bodyNow,
    angle: angleMix(
      start.angle,
      f * (s.kind === 'scrapper' ? -0.12 : s.kind === 'harpooner' ? 0.17 : 0.22),
      fold,
    ),
    tread: start.tread + Math.sign(s.velocity.x) * coast * 2,
    arm: start.arm
      ? {
          ...start.arm,
          shoulder: { x: start.arm.shoulder.x + delta.x, y: start.arm.shoulder.y + delta.y },
          elbow: point(start.arm.elbow, { x: f * 22, y: floor - 16 }, fold),
          hand: point(start.arm.hand, { x: f * 31, y: floor - 11 }, fold),
          grip: mix(start.arm.grip, 0, fold),
        }
      : null,
    barrel: barrel
      ? { ...barrel, origin: barrelOrigin, angle: barrelAngle, recoil: mix(barrel.recoil, 0, fold) }
      : null,
    spool: start.spool
      ? {
          ...start.spool,
          center: { x: start.spool.center.x + delta.x, y: start.spool.center.y + delta.y },
          angle: start.spool.angle + f * 9 * coast,
          tension: mix(start.spool.tension, 0, fold),
        }
      : null,
    loader: start.loader
      ? {
          ...start.loader,
          origin: { x: start.loader.origin.x + delta.x, y: start.loader.origin.y + delta.y },
          seat: point(start.loader.seat, { x: start.loader.seat.x + f * 4, y: floor - 5 }, fold),
          stroke: mix(start.loader.stroke, 0, fold),
          charge: false,
        }
      : null,
    legs: start.legs.map((leg, index) => {
      const side = Math.abs(leg.foot.x) > 0.5 ? Math.sign(leg.foot.x) : index % 2 ? 1 : -1;
      return {
        hip: point(leg.hip, { x: body.x + side * 6, y: body.y + 4 }, fold),
        knee: point(leg.knee, { x: side * 15 + f, y: floor - 3 }, fold),
        foot: point(leg.foot, { x: side * 9 + f, y: floor }, fold),
        planted: fold > 0.8,
      };
    }),
  };
}

/** Shared projection supplies actual floor/moving-deck support, alpha, scale and lifetime. */
export function drawHazardMachineWreck(
  c: CanvasRenderingContext2D,
  wreck: MachineWreck,
  projection: MachineWreckProjection,
  reduced = false,
): HazardMachinePose | null {
  const pose = hazardShutdownPose(wreck.visual, projection.age, reduced, wreck.shutdown);
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
  drawHazardChassis(c, inactive, reduced, pose);
  return pose;
}
