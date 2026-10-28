import { CHARGE_TELL, HOP_TELL, TWIN_LOCK } from './enemies.ts';
import type { MachineBodySnapshot, MachineLeg, MachinePose } from './machine-breakdown-pose.ts';
import { clamp, type Vec } from './rules.ts';

export type SpecialistMachineKind = 'charger' | 'hopper' | 'sniper';
export const isSpecialistMachineKind = (kind: string): kind is SpecialistMachineKind =>
  kind === 'charger' || kind === 'hopper' || kind === 'sniper';
export interface SpecialistMachinePose extends MachinePose {
  specialist: true;
  kind: SpecialistMachineKind;
  mode: string;
  ram: number;
  drive: number;
  compression: number;
  grounded: boolean;
  tracking: boolean;
  locked: boolean;
  breech: [number, number];
  barrel: number;
}
const finite = (n: number | undefined, fallback = 0) => (Number.isFinite(n) ? n! : fallback);
const unit = (n: number) => clamp(n, 0, 1);
function knee(hip: Vec, foot: Vec, side: number, bend = 1): MachineLeg {
  const dx = foot.x - hip.x,
    dy = foot.y - hip.y,
    d = Math.max(0.001, Math.hypot(dx, dy)),
    length = Math.max(8, d * 0.56),
    arc = Math.sqrt(Math.max(0, length * length - (d * d) / 4));
  return {
    hip,
    knee: {
      x: (hip.x + foot.x) / 2 + (dy / d) * arc * side * bend,
      y: (hip.y + foot.y) / 2 - (dx / d) * arc * side * bend,
    },
    foot,
    planted: true,
  };
}
/** Projects only native state and presentation observations; no timer/AI/physics mutation. */
export function specialistMachinePose(
  s: MachineBodySnapshot,
  reduced = false,
): SpecialistMachinePose {
  if (!isSpecialistMachineKind(s.kind)) throw new Error('Expected a specialist machine');
  const f: -1 | 1 = s.aim.x < 0 ? -1 : 1,
    timer = finite(s.timer),
    motion = !reduced && s.hp > 0 && s.spawn <= 0 ? 1 : 0,
    vx = finite(s.velocity.x),
    vy = finite(s.velocity.y),
    speed = unit(Math.abs(vx) / (s.kind === 'charger' ? 14 : 6.5)),
    ground = !!s.specialist?.grounded,
    footY =
      s.specialist?.supportY !== null && s.specialist?.supportY !== undefined
        ? (s.specialist.supportY - s.position.y) / s.scale - 1
        : 15,
    wear: 0 | 1 | 2 =
      s.hp <= 0 || s.hp / Math.max(1, s.maxHp) <= 0.3
        ? 2
        : s.hp / Math.max(1, s.maxHp) <= 0.65
          ? 1
          : 0,
    hit = motion * unit(s.flash / 0.08) ** 2,
    windup = s.state === 'windup',
    recover = s.state === 'recover',
    age =
      s.specialist?.enteredAt === null || s.specialist?.enteredAt === undefined
        ? 0
        : Math.max(0, s.time - s.specialist.enteredAt),
    recovery = recover ? s.specialist?.recovery : null;
  let mode = s.state as string,
    ram = 0,
    compression = 0,
    brace = 0,
    tracking = false,
    locked = false;
  let body: Vec = { x: hit * s.hitDirection.x * 0.8, y: 0 },
    angle = 0;
  const legs: MachineLeg[] = [],
    breech: [number, number] = [0, 0];
  if (s.kind === 'charger') {
    brace = windup ? (reduced ? 0.7 : unit(1 - timer / CHARGE_TELL)) : 0;
    ram =
      s.state === 'rush'
        ? 1
        : windup
          ? 0.3 + brace * 0.45
          : recover
            ? recovery === 'crash'
              ? 0.08
              : 0.3
            : 0.18;
    mode =
      recover && recovery === 'crash'
        ? 'crash'
        : recover && recovery === 'spent'
          ? 'spent'
          : s.state;
    const crash = recovery === 'crash' ? 1 : 0;
    body = {
      x: -f * brace * 2 - f * crash * 0.8 + body.x,
      y: recover ? crash * 1.1 : -speed * motion * 0.4,
    };
    angle = motion * (f * speed * 0.035 - f * crash * Math.max(0, 1 - age / 0.3) * 0.1);
    for (const side of [-1, 1]) {
      const foot = { x: side * 9, y: footY - 2 },
        hip = { x: side * 7 + body.x, y: 4 + body.y };
      const l = knee(hip, foot, side, 0.35);
      l.planted = ground;
      legs.push(l);
    }
  } else if (s.kind === 'hopper') {
    compression = windup
      ? reduced
        ? 0.7
        : unit(1 - timer / HOP_TELL)
      : recover && ground
        ? reduced
          ? 0.3
          : unit(timer / 0.5) * 0.55
        : 0;
    const air = s.state === 'airborne' || !ground;
    mode = windup
      ? 'compress'
      : recover && ground
        ? 'land'
        : air
          ? vy < -1
            ? 'rise'
            : 'fall'
          : 'idle';
    body = { x: body.x, y: compression * 3.2 };
    angle = motion * clamp(vx * 0.013, -0.07, 0.07);
    for (const side of [-1, 1]) {
      const hip = { x: side * 6 + body.x, y: 2 + body.y },
        tuck = air ? (vy < -1 ? 1 : 0.65) : 0,
        foot = { x: side * (11 + compression * 3 + tuck * 4), y: air ? 9 + (1 - tuck) * 4 : footY };
      const l = knee(hip, foot, side, air ? 1.1 : 1);
      l.planted = ground && !air;
      legs.push(l);
    }
  } else {
    const warning = windup || s.state === 'followup',
      lock = s.state === 'followup' ? TWIN_LOCK : 0.32;
    tracking = warning && timer > lock;
    locked = warning && timer <= lock;
    mode = tracking
      ? 'tracking'
      : locked
        ? s.state === 'followup'
          ? 'second-lock'
          : 'locked'
        : recover
          ? 'breech'
          : 'idle';
    brace = warning
      ? reduced
        ? 0.7
        : unit(1 - timer / (s.state === 'followup' ? 0.65 : 0.95))
      : 0;
    body = { x: body.x, y: warning ? 0.3 : 0 };
    const opening = recover ? (reduced ? 0.4 : Math.sin(Math.PI * unit(age / 0.55))) : 0;
    breech[0] =
      s.elite === 'twin'
        ? s.state === 'followup'
          ? reduced
            ? 0.35
            : unit(timer / 0.65)
          : 0
        : opening;
    breech[1] = s.elite === 'twin' ? opening : 0;
    for (const side of [-1, 1]) {
      const hip = { x: side * 6, y: -4 },
        foot = { x: side * (17 + brace * 2), y: footY };
      const l = knee(hip, foot, side, 0.4);
      l.planted = ground;
      legs.push(l);
    }
    legs.push({
      hip: { x: 0, y: -4 },
      knee: { x: -3, y: 7 },
      foot: { x: 0, y: footY },
      planted: ground,
    });
  }
  return {
    specialist: true,
    kind: s.kind,
    mode,
    wear,
    forward: f,
    body,
    angle,
    brace,
    recover,
    receiver: Math.max(...breech) * 2,
    rotor: 0,
    legs,
    ram,
    drive: motion ? (s.position.x * 0.3) % (Math.PI * 2) : 0,
    compression,
    grounded: ground,
    tracking,
    locked,
    breech,
    barrel: Math.atan2(s.aim.y, s.aim.x),
  };
}
