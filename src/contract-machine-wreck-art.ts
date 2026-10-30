import { ENEMY_STATS } from './enemies.ts';
import type { Vec } from './rules.ts';
import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import type { MachineWreck } from './machine-breakdown.ts';
import type { MachineWreckProjection } from './machine-breakdown-wreck-art.ts';
import {
  contractMachinePose,
  isContractMachineKind,
  type ContractMachinePose,
} from './contract-machine-pose.ts';
import { drawContractChassis } from './contract-machine-art.ts';

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (a: Vec, b: Vec, t: number): Vec => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const smooth = (n: number) => 1 - (1 - Math.max(0, Math.min(1, n))) ** 3;
const angleMix = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** A captured hunt rig loses drive. Its destroyed anchors, plates and mines stay native cleanup, never corpse attacks. */
export function contractShutdownPose(
  s: MachineBodySnapshot,
  age: number,
  reduced = false,
  shutdown = 0.38,
): ContractMachinePose | null {
  if (!isContractMachineKind(s.kind)) return null;
  const start = contractMachinePose({ ...s, flash: 0 }, reduced),
    duration = Number.isFinite(shutdown) ? Math.max(0.01, shutdown) : 0.38,
    elapsed = Number.isFinite(age) ? Math.max(0, age) : 0,
    fold = reduced ? 1 : smooth(elapsed / duration),
    f = start.forward,
    heavy = s.kind === 'bulwark',
    floor = ENEMY_STATS[s.kind].h / 2 - 1,
    body = { x: start.body.x + f * (heavy ? 2.8 : 1.8), y: start.body.y + (heavy ? 7.2 : 5.5) },
    bodyNow = point(start.body, body, fold),
    delta = { x: bodyNow.x - start.body.x, y: bodyNow.y - start.body.y },
    mastBase = { x: start.mast.base.x + delta.x, y: start.mast.base.y + delta.y },
    mastVector = {
      x: start.mast.tip.x - start.mast.base.x,
      y: start.mast.tip.y - start.mast.base.y,
    },
    mastAngle = angleMix(
      Math.atan2(mastVector.y, mastVector.x),
      f > 0 ? -0.24 : Math.PI + 0.24,
      fold,
    ),
    mastLength = Math.hypot(mastVector.x, mastVector.y),
    mastTip = {
      x: mastBase.x + Math.cos(mastAngle) * mastLength,
      y: mastBase.y + Math.sin(mastAngle) * mastLength,
    },
    gunDelta = heavy ? { x: mastTip.x - start.mast.tip.x, y: mastTip.y - start.mast.tip.y } : delta,
    barrelAngle = start.barrel.angle + f * (heavy ? 0.24 : 0.32) * fold,
    rear = {
      x: start.barrel.origin.x - Math.cos(start.barrel.angle) * start.barrel.length + gunDelta.x,
      y: start.barrel.origin.y - Math.sin(start.barrel.angle) * start.barrel.length + gunDelta.y,
    },
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
    angle: start.angle + f * (heavy ? 0.13 : 0.18) * fold,
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
      center: { x: start.gimbal.center.x + gunDelta.x, y: start.gimbal.center.y + gunDelta.y },
      angle: barrelAngle,
    },
    mast: { base: mastBase, tip: mastTip },
    drums: start.drums.map((drum, index) => ({
      ...drum,
      center: { x: drum.center.x + delta.x, y: drum.center.y + delta.y },
      angle: drum.angle + (index ? 1 : -1) * 2.2 * coast,
      tension: 0,
      release: 0,
    })),
    shield: {
      ...start.shield,
      closed: false,
      extension: mix(start.shield.extension, 0, fold),
      plates: start.shield.plates.map((p) => ({ ...p, flash: 0, position: { ...p.position } })),
    },
    rack: start.rack.map((slot) => ({
      ...slot,
      point: { x: slot.point.x + delta.x, y: slot.point.y + delta.y + 4.5 * fold },
      loaded: false,
      arming: 0,
    })),
    legs: start.legs.map((leg, index) => {
      const side = Math.sign(leg.foot.x) || (index % 2 ? 1 : -1);
      return {
        hip: point(leg.hip, { x: body.x + side * 9, y: body.y + 10 }, fold),
        knee: point(leg.knee, { x: side * (heavy ? 23 : 20) + f, y: floor - 5 }, fold),
        foot: point(leg.foot, { x: side * (heavy ? 16 : 13) + f, y: floor - 1 }, fold),
        planted: fold > 0.8,
      };
    }),
  };
}

/** The shared projection owns landing support, clipping, opacity, caps and expiry. No new world object is created. */
export function drawContractMachineWreck(
  c: CanvasRenderingContext2D,
  wreck: MachineWreck,
  projection: MachineWreckProjection,
  reduced = false,
): ContractMachinePose | null {
  const pose = contractShutdownPose(wreck.visual, projection.age, reduced, wreck.shutdown);
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
  drawContractChassis(c, inactive, reduced, pose);
  return pose;
}
