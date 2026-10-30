import { ENEMY_STATS } from './enemies.ts';
import type { Vec } from './rules.ts';
import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import type { MachineWreck } from './machine-breakdown.ts';
import type { MachineWreckProjection } from './machine-breakdown-wreck-art.ts';
import {
  overseerMachinePose,
  isOverseerMachineKind,
  type OverseerMachinePose,
} from './overseer-machine-pose.ts';
import { drawOverseerChassis } from './overseer-machine-art.ts';
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (a: Vec, b: Vec, t: number): Vec => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const smooth = (n: number) => 1 - (1 - Math.max(0, Math.min(1, n))) ** 3;
const swing = (from: Vec, to: Vec, angle: number): Vec => ({
  x: from.x + (to.x - from.x) * Math.cos(angle) - (to.y - from.y) * Math.sin(angle),
  y: from.y + (to.x - from.x) * Math.sin(angle) + (to.y - from.y) * Math.cos(angle),
});

/** Only an actual captured defeat folds the rig. Auditor recall never reaches this path. */
export function overseerShutdownPose(
  s: MachineBodySnapshot,
  age: number,
  reduced = false,
  shutdown = 0.38,
): OverseerMachinePose | null {
  if (!isOverseerMachineKind(s.kind)) return null;
  const start = overseerMachinePose({ ...s, flash: 0 }, reduced),
    duration = Number.isFinite(shutdown) ? Math.max(0.01, shutdown) : 0.38,
    elapsed = Number.isFinite(age) ? Math.max(0, age) : 0,
    fold = reduced ? 1 : smooth(elapsed / duration),
    f = start.forward,
    floor = ENEMY_STATS[s.kind].h / 2 - 1,
    body = {
      x: start.body.x + f * (s.kind === 'welder' ? 2.2 : 1.8),
      y: start.body.y + (s.kind === 'switchboard' ? 4 : 6.2),
    },
    bodyNow = point(start.body, body, fold),
    delta = { x: bodyNow.x - start.body.x, y: bodyNow.y - start.body.y },
    barrelAngle = start.barrel.angle + f * (s.kind === 'welder' ? 0.27 : 0.34) * fold,
    rear = {
      x: start.barrel.origin.x - Math.cos(start.barrel.angle) * start.barrel.length + delta.x,
      y: start.barrel.origin.y - Math.sin(start.barrel.angle) * start.barrel.length + delta.y,
    },
    shoulder = { x: start.torch.shoulder.x + delta.x, y: start.torch.shoulder.y + delta.y },
    oldElbow = { x: start.torch.elbow.x + delta.x, y: start.torch.elbow.y + delta.y },
    oldTip = { x: start.torch.tip.x + delta.x, y: start.torch.tip.y + delta.y },
    elbow = swing(shoulder, oldElbow, f * 0.58 * fold),
    elbowDelta = { x: elbow.x - oldElbow.x, y: elbow.y - oldElbow.y },
    tip = swing(elbow, { x: oldTip.x + elbowDelta.x, y: oldTip.y + elbowDelta.y }, f * 0.72 * fold),
    stop = Math.min(elapsed, duration),
    coast = reduced ? duration * 0.5 : stop - (stop * stop) / (2 * duration);
  return {
    ...start,
    energy: 0,
    mode: 'shutdown',
    wear: 2,
    brace: 0,
    recover: false,
    receiver: 0,
    recoil: 0,
    deploy: 0,
    interruption: 0,
    body: bodyNow,
    angle: start.angle + f * (s.kind === 'switchboard' ? 0.14 : 0.18) * fold,
    barrel: {
      ...start.barrel,
      angle: barrelAngle,
      recoil: 0,
      origin:
        s.kind === 'welder'
          ? tip
          : {
              x: rear.x + Math.cos(barrelAngle) * start.barrel.length,
              y: rear.y + Math.sin(barrelAngle) * start.barrel.length,
            },
    },
    gimbal: {
      center:
        s.kind === 'welder'
          ? {
              x: tip.x - Math.cos(barrelAngle) * start.barrel.length,
              y: tip.y - Math.sin(barrelAngle) * start.barrel.length,
            }
          : { x: start.gimbal.center.x + delta.x, y: start.gimbal.center.y + delta.y },
      angle: barrelAngle,
    },
    torch: { ...start.torch, shoulder, elbow, tip, heat: 0, opening: 0 },
    tracks: start.tracks.map((track, index) => ({
      ...track,
      // Tracks lose drive on their captured support plane; only the upper hull folds.
      center: { ...track.center },
      phase: track.phase + (index ? 1 : -1) * 0.9 * coast,
    })),
    channels: start.channels.map((channel) => ({
      ...channel,
      point: { x: channel.point.x + delta.x, y: channel.point.y + delta.y + 2.6 * fold },
      charge: 0,
      locked: false,
      release: 0,
      mobile: false,
    })),
    magazine: start.magazine.map((cell) => ({
      ...cell,
      point: { x: cell.point.x + delta.x, y: cell.point.y + delta.y + 2 * fold },
      loaded: false,
      selected: false,
    })),
    caseLatch: {
      ...start.caseLatch,
      point: { x: start.caseLatch.point.x + delta.x, y: start.caseLatch.point.y + delta.y },
      open: 0,
      recall: 0,
    },
    legs: start.legs.map((leg, index) => {
      const side = Math.sign(leg.foot.x) || (index % 2 ? 1 : -1);
      return {
        hip: point(leg.hip, { x: body.x + side * 8, y: body.y + 9 }, fold),
        knee: point(leg.knee, { x: side * 19 + f, y: floor - 5 }, fold),
        foot: point(leg.foot, { x: side * 13 + f, y: floor - 1 }, fold),
        planted: fold > 0.8,
      };
    }),
  };
}

/** Shared landing projection clips this inert production chassis; no gear, score, light or damage is emitted. */
export function drawOverseerMachineWreck(
  c: CanvasRenderingContext2D,
  wreck: MachineWreck,
  projection: MachineWreckProjection,
  reduced = false,
): OverseerMachinePose | null {
  const pose = overseerShutdownPose(wreck.visual, projection.age, reduced, wreck.shutdown);
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
  drawOverseerChassis(c, inactive, reduced, pose);
  return pose;
}
