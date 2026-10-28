import { ENEMY_STATS } from './enemies.ts';
import type { Vec } from './rules.ts';
import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import type { MachineWreck } from './machine-breakdown.ts';
import type { MachineWreckProjection } from './machine-breakdown-wreck-art.ts';
import { supportMachinePose, type SupportMachinePose } from './support-machine-pose.ts';
import { drawSupportChassis } from './support-machine-art.ts';

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (a: Vec, b: Vec, t: number): Vec => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const smooth = (value: number) => 1 - (1 - Math.max(0, Math.min(1, value))) ** 3;
const angleMix = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
export type SupportShutdownReason = 'combat' | 'owner-lost' | 'interrupted';

/** Every failed arm, cell, duct and partial barrel comes from the captured live rig. */
export function supportShutdownPose(
  s: MachineBodySnapshot,
  age: number,
  reduced = false,
  shutdown = 0.38,
  reason: SupportShutdownReason = 'combat',
): SupportMachinePose | null {
  if (!['repairer', 'relay', 'fabricator', 'sentry'].includes(s.kind)) return null;
  const start = supportMachinePose({ ...s, flash: 0 }, reduced);
  const duration = Number.isFinite(shutdown) ? Math.max(0.01, shutdown) : 0.38;
  const elapsed = Number.isFinite(age) ? Math.max(0, age) : 0;
  const fold = reduced ? 1 : smooth(elapsed / duration),
    f = start.forward,
    destroyed = reason === 'combat',
    floor = ENEMY_STATS[s.kind].h / 2 - 1;
  const body =
    s.kind === 'repairer'
      ? { x: f * 1.8, y: 2.8 }
      : s.kind === 'relay'
        ? { x: -f * 2, y: 1.5 }
        : s.kind === 'fabricator'
          ? { x: f * 1.6, y: 3.7 }
          : {
              x: f * (destroyed ? 1.7 : 0.8),
              y: destroyed ? 4.1 : reason === 'interrupted' ? 3.5 : 2.2,
            };
  const bodyNow = point(start.body, body, fold),
    delta = { x: bodyNow.x - start.body.x, y: bodyNow.y - start.body.y };
  const stoppedAt = reduced ? duration : Math.min(elapsed, duration);
  return {
    ...start,
    mode: reason === 'combat' ? 'shutdown' : reason,
    wear: destroyed ? 2 : start.wear,
    energy: 0,
    brace: 0,
    recover: false,
    receiver: 0,
    rotor: start.rotor + 12 * (stoppedAt - (stoppedAt * stoppedAt) / (2 * duration)),
    coil: mix(start.coil, 0, fold),
    pulse: 0,
    // Remaining repair material, charge cells and assembly never grow or vanish.
    reserve: start.reserve,
    cells: [...start.cells],
    assembly: start.assembly,
    body: bodyNow,
    angle: angleMix(
      start.angle,
      f * (s.kind === 'repairer' ? 0.23 : s.kind === 'relay' ? -0.29 : destroyed ? 0.17 : 0.07),
      fold,
    ),
    tools: start.tools.map((tool, index) => {
      const side = Math.abs(tool.tip.x) > 0.5 ? Math.sign(tool.tip.x) : index % 2 ? 1 : -1;
      const drone = s.kind === 'repairer' || s.kind === 'relay';
      return {
        ...tool,
        active: false,
        ...(tool.angle === undefined
          ? {}
          : { angle: angleMix(tool.angle, side > 0 ? 0.22 : Math.PI - 0.22, fold) }),
        base: { x: tool.base.x + delta.x, y: tool.base.y + delta.y },
        elbow: point(tool.elbow, { x: side * (drone ? 18 : 20) + f, y: floor - 5 }, fold),
        tip: point(tool.tip, { x: side * (drone ? 11 : 26) + f, y: floor - 1.5 }, fold),
      };
    }),
    pods: start.pods.map((pod, index) => {
      const side = pod.x < 0 ? -1 : 1;
      return point(pod, { x: pod.x + side * (index % 2 ? 3 : 1.5), y: floor - 3 }, fold);
    }),
    legs: start.legs.map((leg, index) => {
      const side = Math.abs(leg.foot.x) > 0.5 ? Math.sign(leg.foot.x) : index % 2 ? 1 : -1;
      return {
        hip: point(leg.hip, { x: body.x + side * 6, y: body.y + 4 }, fold),
        knee: point(leg.knee, { x: side * 17 + f, y: floor - 3 }, fold),
        foot: point(leg.foot, { x: side * 9 + f, y: floor }, fold),
        planted: fold > 0.8,
      };
    }),
    barrel: start.barrel
      ? {
          ...start.barrel,
          origin: {
            x: start.barrel.origin.x + delta.x,
            y: start.barrel.origin.y + delta.y,
          },
          angle: angleMix(
            start.barrel.angle,
            f > 0 ? (destroyed ? 0.3 : 0.14) : Math.PI - (destroyed ? 0.3 : 0.14),
            fold,
          ),
          recoil: mix(start.barrel.recoil, 0, fold),
        }
      : null,
  };
}

/** Caller owns the common support projection, clipping, lifetime, scale and alpha.
 * The projection import stays type-only to avoid a runtime dispatcher cycle.
 */
export function drawSupportMachineWreck(
  c: CanvasRenderingContext2D,
  wreck: MachineWreck,
  projection: MachineWreckProjection,
  reduced = false,
): SupportMachinePose | null {
  const reason = wreck.reason ?? 'combat';
  const pose = supportShutdownPose(wreck.visual, projection.age, reduced, wreck.shutdown, reason);
  if (!pose) return null;
  const inactive: MachineBodySnapshot = {
    ...wreck.visual,
    // Native owner loss/interruptions retain actual health and damage wear.
    hp: reason === 'combat' ? 0 : wreck.visual.hp,
    flash: 0,
    brace: 0,
    timer: 0,
    state: 'recover',
    velocity: { x: 0, y: 0 },
  };
  drawSupportChassis(c, inactive, reduced, pose);
  return pose;
}
