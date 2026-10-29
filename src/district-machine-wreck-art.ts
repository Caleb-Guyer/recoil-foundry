import { ENEMY_STATS } from './enemies.ts';
import type { Vec } from './rules.ts';
import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import type { MachineWreck } from './machine-breakdown.ts';
import type { MachineWreckProjection } from './machine-breakdown-wreck-art.ts';
import { districtMachinePose, type DistrictMachinePose } from './district-machine-pose.ts';
import { drawDistrictChassis } from './district-machine-art.ts';

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (a: Vec, b: Vec, t: number): Vec => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const smooth = (n: number) => 1 - (1 - Math.max(0, Math.min(1, n))) ** 3;
const angleMix = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** Captured receiver, fins, louvers and rotors fail; native released volleys stay in Game.shots. */
export function districtShutdownPose(
  s: MachineBodySnapshot,
  age: number,
  reduced = false,
  shutdown = 0.38,
): DistrictMachinePose | null {
  if (s.kind !== 'borer' && s.kind !== 'sifter' && s.kind !== 'skimmer') return null;
  const start = districtMachinePose({ ...s, flash: 0 }, reduced),
    duration = Number.isFinite(shutdown) ? Math.max(0.01, shutdown) : 0.38,
    elapsed = Number.isFinite(age) ? Math.max(0, age) : 0,
    fold = reduced ? 1 : smooth(elapsed / duration),
    f = start.forward,
    body = {
      x: f * (s.kind === 'borer' ? 1.4 : s.kind === 'sifter' ? -2 : 1.8),
      y: s.kind === 'borer' ? 3.4 : s.kind === 'sifter' ? 4.2 : 3.1,
    },
    bodyNow = point(start.body, body, fold),
    delta = { x: bodyNow.x - start.body.x, y: bodyNow.y - start.body.y },
    stoppedAt = reduced ? duration : Math.min(elapsed, duration),
    coast = stoppedAt - (stoppedAt * stoppedAt) / (2 * duration),
    floor = ENEMY_STATS[s.kind].h / 2 - 1;
  return {
    ...start,
    mode: 'shutdown',
    energy: 0,
    wear: 2,
    brace: 0,
    recover: false,
    receiver: mix(start.receiver, 0, fold),
    coverBrace: 0,
    bank: mix(start.bank, 0, fold),
    recoil: 0,
    vent: 0,
    body: bodyNow,
    angle: angleMix(
      start.angle,
      f * (s.kind === 'borer' ? 0.13 : s.kind === 'sifter' ? -0.21 : 0.17),
      fold,
    ),
    tread:
      start.tread +
      (s.kind === 'borer' && s.districtMachine?.grounded ? s.velocity.x * 16.8 : 0) * coast,
    rotor:
      start.rotor +
      (s.kind === 'borer'
        ? s.districtMachine?.grounded
          ? s.velocity.x * 16.8
          : 0
        : s.kind === 'sifter'
          ? -19
          : -15) *
        coast,
    ports: start.ports.map((port, index) => {
      const angle = angleMix(
          port.angle,
          f > 0 ? 0.24 + (index - 1) * 0.035 : Math.PI - 0.24 - (index - 1) * 0.035,
          fold,
        ),
        rear = {
          x: port.origin.x - Math.cos(port.angle) * port.length + delta.x,
          y: port.origin.y - Math.sin(port.angle) * port.length + delta.y,
        };
      return {
        ...port,
        angle,
        origin: {
          x: rear.x + Math.cos(angle) * port.length,
          y: rear.y + Math.sin(angle) * port.length,
        },
        open: mix(port.open, 0, fold),
        recoil: 0,
      };
    }),
    rotors: start.rotors.map((rotor) => ({
      ...rotor,
      center: { x: rotor.center.x + delta.x, y: rotor.center.y + delta.y },
      angle: rotor.angle + (s.kind === 'sifter' ? Math.sign(rotor.center.x) * 19 : -15) * coast,
    })),
    fins: start.fins.map((fin) => {
      const base = { x: fin.base.x + delta.x, y: fin.base.y + delta.y },
        dx = fin.tip.x - fin.base.x,
        dy = fin.tip.y - fin.base.y,
        length = Math.hypot(dx, dy),
        side = dx < 0 ? -1 : 1,
        angle = angleMix(Math.atan2(dy, dx), side > 0 ? 0.75 : Math.PI - 0.75, fold);
      return {
        base,
        tip: { x: base.x + Math.cos(angle) * length, y: base.y + Math.sin(angle) * length },
      };
    }),
    louvers: start.louvers.map((louver, index) => {
      const from = { x: louver.from.x + delta.x, y: louver.from.y + delta.y },
        dx = louver.to.x - louver.from.x,
        dy = louver.to.y - louver.from.y,
        length = Math.hypot(dx, dy),
        side = dx < 0 ? -1 : 1,
        angle = angleMix(
          Math.atan2(dy, dx),
          side > 0 ? 0.35 + index * 0.03 : Math.PI - 0.35 - index * 0.03,
          fold,
        );
      return {
        ...louver,
        from,
        to: { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length },
        open: mix(louver.open, 0, fold),
      };
    }),
    legs: start.legs.map((leg, index) => {
      const side = Math.abs(leg.foot.x) > 0.5 ? Math.sign(leg.foot.x) : index % 2 ? 1 : -1;
      return {
        hip: point(leg.hip, { x: body.x + side * 6, y: body.y + 4 }, fold),
        knee: point(leg.knee, { x: side * 14 + f, y: floor - 3 }, fold),
        foot: point(leg.foot, { x: side * 9 + f, y: floor }, fold),
        planted: fold > 0.8,
      };
    }),
  };
}

/** Common projection owns real support/slopes/moving decks, clipping, alpha, split scale and expiry. */
export function drawDistrictMachineWreck(
  c: CanvasRenderingContext2D,
  wreck: MachineWreck,
  projection: MachineWreckProjection,
  reduced = false,
): DistrictMachinePose | null {
  const pose = districtShutdownPose(wreck.visual, projection.age, reduced, wreck.shutdown);
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
  drawDistrictChassis(c, inactive, reduced, pose);
  return pose;
}
