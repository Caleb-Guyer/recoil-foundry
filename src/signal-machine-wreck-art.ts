import { ENEMY_STATS } from './enemies.ts';
import type { Vec } from './rules.ts';
import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import type { MachineWreck } from './machine-breakdown.ts';
import type { MachineWreckProjection } from './machine-breakdown-wreck-art.ts';
import { signalMachinePose, type SignalMachinePose } from './signal-machine-pose.ts';
import { drawSignalChassis } from './signal-machine-art.ts';

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (a: Vec, b: Vec, t: number): Vec => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const smooth = (n: number) => 1 - (1 - Math.max(0, Math.min(1, n))) ** 3;
const angleMix = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const rotate = (p: Vec, angle: number): Vec => ({
  x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
  y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
});

/** Only the captured speaker/radio rig collapses. No recording, transmission or projectile is played by a corpse. */
export function signalShutdownPose(
  s: MachineBodySnapshot,
  age: number,
  reduced = false,
  shutdown = 0.38,
): SignalMachinePose | null {
  if (s.kind !== 'caller' && s.kind !== 'switchman') return null;
  const start = signalMachinePose({ ...s, flash: 0 }, reduced),
    duration = Number.isFinite(shutdown) ? Math.max(0.01, shutdown) : 0.38,
    elapsed = Number.isFinite(age) ? Math.max(0, age) : 0,
    fold = reduced ? 1 : smooth(elapsed / duration),
    f = start.forward,
    floor = ENEMY_STATS[s.kind].h / 2 - 1,
    body = {
      x: start.body.x + f * (s.kind === 'caller' ? 1.4 : 1.8),
      y: start.body.y + (s.kind === 'caller' ? 4 : 3.4),
    },
    bodyNow = point(start.body, body, fold),
    delta = { x: bodyNow.x - start.body.x, y: bodyNow.y - start.body.y },
    barrelAngle = start.barrel.angle + f * (s.kind === 'caller' ? 0.3 : 0.25) * fold,
    rear = {
      x: start.barrel.origin.x - Math.cos(start.barrel.angle) * start.barrel.length + delta.x,
      y: start.barrel.origin.y - Math.sin(start.barrel.angle) * start.barrel.length + delta.y,
    },
    hornAngle = start.horn.angle + f * 0.3 * fold,
    hornThroat = { x: start.horn.throat.x + delta.x, y: start.horn.throat.y + delta.y },
    hornAxis = rotate(
      { x: start.horn.lip.x - start.horn.throat.x, y: start.horn.lip.y - start.horn.throat.y },
      hornAngle - start.horn.angle,
    ),
    antennaBase = { x: start.antenna.base.x + delta.x, y: start.antenna.base.y + delta.y },
    antennaVector = {
      x: start.antenna.tip.x - start.antenna.base.x,
      y: start.antenna.tip.y - start.antenna.base.y,
    },
    antennaAngle = angleMix(
      Math.atan2(antennaVector.y, antennaVector.x),
      f > 0 ? 0.2 : Math.PI - 0.2,
      fold,
    ),
    antennaLength = Math.hypot(antennaVector.x, antennaVector.y);
  return {
    ...start,
    mode: 'shutdown',
    energy: 0,
    wear: 2,
    brace: 0,
    recover: false,
    receiver: 0,
    recoil: 0,
    cancellation: 0,
    body: bodyNow,
    angle: start.angle + f * (s.kind === 'caller' ? 0.17 : 0.12) * fold,
    barrel: {
      ...start.barrel,
      origin: {
        x: rear.x + Math.cos(barrelAngle) * start.barrel.length,
        y: rear.y + Math.sin(barrelAngle) * start.barrel.length,
      },
      angle: barrelAngle,
      recoil: 0,
    },
    gimbal: {
      center: { x: start.gimbal.center.x + delta.x, y: start.gimbal.center.y + delta.y },
      angle: barrelAngle,
    },
    horn: {
      ...start.horn,
      angle: hornAngle,
      throat: hornThroat,
      lip: { x: hornThroat.x + hornAxis.x, y: hornThroat.y + hornAxis.y },
      diaphragm: 0,
    },
    slots: start.slots.map((slot) => ({
      ...slot,
      point: { x: slot.point.x + delta.x, y: slot.point.y + delta.y },
      recorded: false,
      pending: false,
      selected: false,
    })),
    antenna: {
      ...start.antenna,
      base: antennaBase,
      tip: {
        x: antennaBase.x + Math.cos(antennaAngle) * antennaLength,
        y: antennaBase.y + Math.sin(antennaAngle) * antennaLength,
      },
      angle: antennaAngle,
      charge: 0,
      locked: false,
      release: 0,
      feedback: 0,
    },
    radio: { ...start.radio, charge: 0, locked: false, release: 0, feedback: 0 },
    legs: start.legs.map((leg, index) => {
      const side = Math.abs(leg.foot.x) > 0.5 ? Math.sign(leg.foot.x) : index % 2 ? 1 : -1;
      return {
        hip: point(leg.hip, { x: body.x + side * 5, y: body.y + 3 }, fold),
        knee: point(leg.knee, { x: side * 13 + f, y: floor - 5 }, fold),
        foot: point(leg.foot, { x: side * 8 + f, y: floor - 1 }, fold),
        planted: fold > 0.8,
      };
    }),
  };
}

/** The shared projection supplies real support, clipping, split scale, opacity and the short native wreck lifetime. */
export function drawSignalMachineWreck(
  c: CanvasRenderingContext2D,
  wreck: MachineWreck,
  projection: MachineWreckProjection,
  reduced = false,
): SignalMachinePose | null {
  const pose = signalShutdownPose(wreck.visual, projection.age, reduced, wreck.shutdown);
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
  drawSignalChassis(c, inactive, reduced, pose);
  return pose;
}
