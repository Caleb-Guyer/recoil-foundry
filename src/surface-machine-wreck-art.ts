import { ENEMY_STATS } from './enemies.ts';
import type { Vec } from './rules.ts';
import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import type { MachineWreck } from './machine-breakdown.ts';
import type { MachineWreckProjection } from './machine-breakdown-wreck-art.ts';
import { surfaceMachinePose, type SurfaceMachinePose } from './surface-machine-pose.ts';
import { drawSurfaceChassis } from './surface-machine-art.ts';

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (a: Vec, b: Vec, t: number): Vec => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const smooth = (n: number) => 1 - (1 - Math.max(0, Math.min(1, n))) ** 3;
const angleMix = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;

/** Folding is expressed in the captured support basis; floor, wall, ceiling and falling rigs stay distinct. */
export function surfaceShutdownPose(
  s: MachineBodySnapshot,
  age: number,
  reduced = false,
  shutdown = 0.38,
): SurfaceMachinePose | null {
  if (s.kind !== 'angler' && s.kind !== 'wallcrawler') return null;
  const start = surfaceMachinePose({ ...s, flash: 0 }, reduced),
    duration = Number.isFinite(shutdown) ? Math.max(0.01, shutdown) : 0.38,
    elapsed = Number.isFinite(age) ? Math.max(0, age) : 0,
    fold = reduced ? 1 : smooth(elapsed / duration),
    fallen = s.kind === 'wallcrawler' && start.grip === 0,
    n = fallen ? { x: Math.sin(start.angle), y: -Math.cos(start.angle) } : start.normal,
    t = fallen ? { x: Math.cos(start.angle), y: Math.sin(start.angle) } : start.tangent,
    extent = ENEMY_STATS[s.kind].h / 2 - 1,
    body = { x: start.body.x + n.x * 2.1 + t.x * 0.9, y: start.body.y + 3.4 + n.y * 0.6 },
    bodyNow = point(start.body, body, fold),
    delta = { x: bodyNow.x - start.body.x, y: bodyNow.y - start.body.y },
    supportPoint = (side: number, along: number, down: number): Vec => ({
      x: body.x + t.x * side * along - n.x * down,
      y: body.y + t.y * side * along - n.y * down,
    }),
    legs = start.legs.map((leg, index) => {
      const side = Math.sign(dot(leg.foot, t)) || (index % 2 ? 1 : -1),
        hip = supportPoint(side, 5, 3),
        knee = supportPoint(side, 11, extent - 8),
        foot = supportPoint(
          side,
          7 + (s.kind === 'wallcrawler' ? (index % 2 ? -1.5 : 1.5) : 0),
          extent - 6,
        );
      return {
        hip: point(leg.hip, hip, fold),
        knee: point(leg.knee, knee, fold),
        foot: point(leg.foot, foot, fold),
        planted: s.kind === 'angler' && fold > 0.8,
      };
    }),
    barrel = start.barrel,
    dropAngle = angleMix(
      barrel.angle,
      barrel.angle + start.forward * (s.kind === 'angler' ? 0.3 : 0.2),
      fold,
    ),
    rear = {
      x: barrel.origin.x - Math.cos(barrel.angle) * barrel.length + delta.x,
      y: barrel.origin.y - Math.sin(barrel.angle) * barrel.length + delta.y,
    };
  return {
    ...start,
    mode: 'shutdown',
    energy: 0,
    wear: 2,
    brace: 0,
    recover: false,
    receiver: 0,
    exposure: 0,
    grip: 0,
    recoil: 0,
    body: bodyNow,
    angle: start.angle + start.forward * (s.kind === 'angler' ? 0.16 : 0.19) * fold,
    normal: { ...start.normal },
    tangent: { ...start.tangent },
    legs,
    barrel: {
      ...barrel,
      angle: dropAngle,
      origin: {
        x: rear.x + Math.cos(dropAngle) * barrel.length,
        y: rear.y + Math.sin(dropAngle) * barrel.length,
      },
      recoil: 0,
    },
    gimbal: {
      center: { x: start.gimbal.center.x + delta.x, y: start.gimbal.center.y + delta.y },
      angle: dropAngle,
    },
    shutters: start.shutters.map((shutter, index) => {
      const from = { ...shutter.from },
        dx = shutter.to.x - shutter.from.x,
        dy = shutter.to.y - shutter.from.y,
        length = Math.hypot(dx, dy),
        a = Math.atan2(dy, dx) + start.forward * (index % 2 ? -0.22 : 0.22) * fold;
      return {
        ...shutter,
        from,
        to: { x: from.x + Math.cos(a) * length, y: from.y + Math.sin(a) * length },
        open: mix(shutter.open, 0, fold),
      };
    }),
    pads: start.pads.map((pad, index) => ({
      ...pad,
      point:
        legs[index]?.foot ??
        point(pad.point, { x: pad.point.x + delta.x, y: pad.point.y + delta.y }, fold),
      normal: { ...pad.normal },
      planted: false,
    })),
  };
}

/** Common projection supplies real landing support and clipping; detached rig geometry creates no collision or attack. */
export function drawSurfaceMachineWreck(
  c: CanvasRenderingContext2D,
  wreck: MachineWreck,
  projection: MachineWreckProjection,
  reduced = false,
): SurfaceMachinePose | null {
  const pose = surfaceShutdownPose(wreck.visual, projection.age, reduced, wreck.shutdown);
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
  drawSurfaceChassis(c, inactive, reduced, pose);
  return pose;
}
