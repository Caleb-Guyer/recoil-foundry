import { ENEMY_STATS } from './enemies.ts';
import type { Vec } from './rules.ts';
import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import type { MachineWreck } from './machine-breakdown.ts';
import type { MachineWreckProjection } from './machine-breakdown-wreck-art.ts';
import { specialistMachinePose, type SpecialistMachinePose } from './specialist-machine-pose.ts';
import { drawSpecialistChassis } from './specialist-machine-art.ts';

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (a: Vec, b: Vec, t: number): Vec => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const smooth = (value: number) => 1 - (1 - Math.max(0, Math.min(1, value))) ** 3;
const angleMix = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** The live specialist rig supplies every body, carriage, knee and tripod joint. */
export function specialistShutdownPose(
  s: MachineBodySnapshot,
  age: number,
  reduced = false,
  shutdown = 0.38,
): SpecialistMachinePose | null {
  if (s.kind !== 'charger' && s.kind !== 'hopper' && s.kind !== 'sniper') return null;
  const start = specialistMachinePose({ ...s, flash: 0 }, reduced);
  const duration = Number.isFinite(shutdown) ? Math.max(0.01, shutdown) : 0.38;
  const elapsed = Number.isFinite(age) ? Math.max(0, age) : 0;
  const fold = reduced ? 1 : smooth(elapsed / duration),
    f = start.forward;
  const floor = ENEMY_STATS[s.kind].h / 2 - 1;
  const body =
    s.kind === 'charger'
      ? { x: f * 2.6, y: 3.4 }
      : s.kind === 'hopper'
        ? { x: -f * 1.8, y: 4.1 }
        : { x: f * 1.4, y: 4.8 };
  const finalAngle = s.kind === 'charger' ? f * 0.14 : s.kind === 'hopper' ? -f * 0.17 : f * 0.1;
  const stoppedAt = reduced ? duration : Math.min(elapsed, duration);
  const coast =
    Math.sign(s.velocity.x) * 3 * (stoppedAt - (stoppedAt * stoppedAt) / (2 * duration));
  const barrel =
    f > 0 ? (s.elite === 'twin' ? 0.12 : 0.22) : Math.PI - (s.elite === 'twin' ? 0.12 : 0.22);
  return {
    ...start,
    mode: 'shutdown',
    wear: 2,
    brace: 0,
    recover: false,
    receiver: 0,
    body: point(start.body, body, fold),
    angle: angleMix(start.angle, finalAngle, fold),
    ram: mix(start.ram, 0, fold),
    drive: start.drive + coast,
    compression: mix(start.compression, 0, fold),
    tracking: false,
    locked: false,
    breech: [0, 0],
    barrel: angleMix(start.barrel, barrel, fold),
    legs: start.legs.map((leg, index) => {
      const side =
        Math.abs(leg.foot.x) > 0.5
          ? Math.sign(leg.foot.x)
          : s.kind === 'sniper'
            ? 0
            : index % 2
              ? 1
              : -1;
      const hip = {
        x: body.x + side * (s.kind === 'hopper' ? 6 : 5),
        y: body.y + (s.kind === 'sniper' ? 1.8 : 4),
      };
      const knee = {
        x:
          side * (s.kind === 'hopper' ? 18 : s.kind === 'sniper' ? 15 : 11) +
          f * (side === 0 ? -5 : 1),
        y: floor - (s.kind === 'hopper' ? 2 : 2.5),
      };
      const foot = {
        x: side * (s.kind === 'hopper' ? 8 : s.kind === 'sniper' ? 7 : 6) + f * 2,
        y: s.kind === 'charger' ? floor - 2 : floor,
      };
      return {
        hip: point(leg.hip, hip, fold),
        knee: point(leg.knee, knee, fold),
        foot: point(leg.foot, foot, fold),
        planted: fold > 0.8,
      };
    }),
  };
}
function line(c: CanvasRenderingContext2D, a: Vec, b: Vec, color: string, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}
function slackDrive(c: CanvasRenderingContext2D, p: SpecialistMachinePose, fold: number) {
  c.save();
  c.translate(p.body.x, p.body.y);
  c.rotate(p.angle);
  c.strokeStyle = '#615f52';
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(-p.forward * 7, 1);
  c.quadraticCurveTo(p.forward * 3, 1 + fold * 12, p.forward * 12, 3 + fold * 3);
  c.stroke();
  line(
    c,
    { x: p.forward * 11, y: 2 + fold * 3 },
    { x: p.forward * 14, y: 4 + fold * 3 },
    '#394747',
    2,
  );
  c.restore();
}
function releasedSpring(c: CanvasRenderingContext2D, p: SpecialistMachinePose, fold: number) {
  if (fold <= 0) return;
  const floor = ENEMY_STATS.hopper.h / 2 - 1,
    drop = fold * 2;
  c.strokeStyle = '#696655';
  c.lineWidth = 1.1;
  c.beginPath();
  c.moveTo(-10, floor - 4);
  c.quadraticCurveTo(-7, floor - 8 + drop, -4, floor - 3);
  c.quadraticCurveTo(-1, floor + drop, 2, floor - 3);
  c.quadraticCurveTo(5, floor - 8 + drop, 9, floor - 2);
  c.stroke();
  c.fillStyle = '#444e46';
  c.fillRect(-11, floor - 4, 3, 2);
}
function fallenSniperBarrel(
  c: CanvasRenderingContext2D,
  s: MachineBodySnapshot,
  p: SpecialistMachinePose,
) {
  c.save();
  c.translate(p.body.x, p.body.y - 1);
  c.rotate(p.barrel);
  for (const y of s.elite === 'twin' ? [-6, 4] : [-2]) {
    c.fillStyle = '#354345';
    c.fillRect(7, y, 30, 4);
    c.fillStyle = s.allied ? '#526872' : '#756959';
    c.fillRect(10, y, 17, 1.2);
    c.fillStyle = '#1b292d';
    c.fillRect(34, y, 3, 4);
    c.fillStyle = '#4d5750';
    c.fillRect(17, y - 1, 4, 1);
  }
  c.restore();
}

/** Local coordinates only: caller owns projection, alpha, split scale and native support clip.
 * Returns the pose so the existing common inactive identity layers can be reused.
 * The projection import is type-only, preventing a runtime cycle with the dispatcher.
 */
export function drawSpecialistMachineWreck(
  c: CanvasRenderingContext2D,
  wreck: MachineWreck,
  projection: MachineWreckProjection,
  reduced = false,
): SpecialistMachinePose | null {
  const s = wreck.visual;
  const pose = specialistShutdownPose(s, projection.age, reduced, wreck.shutdown);
  if (!pose) return null;
  const inactive: MachineBodySnapshot = {
    ...s,
    hp: 0,
    flash: 0,
    brace: 0,
    timer: 0,
    state: 'recover',
    velocity: { x: 0, y: 0 },
  };
  drawSpecialistChassis(c, inactive, reduced, pose);
  if (s.kind === 'charger') slackDrive(c, pose, projection.fold);
  else if (s.kind === 'hopper') releasedSpring(c, pose, projection.fold);
  else fallenSniperBarrel(c, s, pose);
  return pose;
}
