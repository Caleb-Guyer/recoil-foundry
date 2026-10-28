import type { MachineBodySnapshot, MachineLeg, MachinePose } from './machine-breakdown-pose.ts';
import { clamp, type Vec } from './rules.ts';
import type { MachineVariant } from './patrol-machines.ts';

export type HeavyMachineKind = 'shutter' | 'strider' | 'mortar';
export const isHeavyMachineKind = (kind: string): kind is HeavyMachineKind =>
  kind === 'shutter' || kind === 'strider' || kind === 'mortar';
export interface HeavyBarrel {
  angle: number;
  origin: Vec;
  length: number;
  recoil: number;
  feedOffset?: number;
}
export interface HeavyPanel {
  position: Vec;
  angle: number;
  width: number;
  height: number;
}
export interface HeavyMachinePose extends MachinePose {
  heavy: true;
  kind: HeavyMachineKind;
  mode: string;
  opening: number;
  drive: number;
  loader: number;
  recoil: number;
  barrels: HeavyBarrel[];
  wheels: Vec[];
  panels: HeavyPanel[];
}
const unit = (n: number) => clamp(n, 0, 1);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const finite = (n: number | undefined, fallback = 0) => (Number.isFinite(n) ? n! : fallback);
export function heavyTubeCount(kind: HeavyMachineKind, variant?: MachineVariant) {
  if (kind === 'shutter')
    return variant === 'shutter-fan' ? 3 : variant === 'shutter-burst' ? 2 : 1;
  if (kind === 'strider')
    return variant === 'strider-volley' ? 3 : variant === 'strider-survey' ? 1 : 2;
  return variant === 'mortar-twin' ? 2 : 1;
}
function joint(hip: Vec, foot: Vec, side: number, planted: boolean): MachineLeg {
  const dx = foot.x - hip.x,
    dy = foot.y - hip.y,
    d = Math.max(0.001, Math.hypot(dx, dy)),
    l = Math.max(9, d * 0.56),
    bend = Math.sqrt(Math.max(0, l * l - (d * d) / 4));
  return {
    hip,
    knee: {
      x: (hip.x + foot.x) / 2 + (dy / d) * bend * side,
      y: (hip.y + foot.y) / 2 - (dx / d) * bend * side,
    },
    foot,
    planted,
  };
}
/** All coordinates are relative to the native body center and world-aligned, including barrel angles. */
export function heavyMachinePose(s: MachineBodySnapshot, reduced = false): HeavyMachinePose {
  if (!isHeavyMachineKind(s.kind)) throw new Error('Expected a heavy patrol machine');
  const rig = s.patrol,
    f: -1 | 1 = s.facing < 0 ? -1 : 1,
    moving = !reduced && s.hp > 0 && s.spawn <= 0,
    speed = unit(Math.abs(finite(s.velocity.x)) / 1.7),
    warning = s.state === 'windup' || s.state === 'followup',
    recover = s.state === 'recover',
    tell = finite(rig?.tell, s.kind === 'mortar' ? 1.2 : 0.95),
    brace = warning ? (reduced ? 0.7 : unit(1 - s.timer / tell)) : 0,
    age =
      recover && rig?.recoveryEnteredAt !== null && rig?.recoveryEnteredAt !== undefined
        ? Math.max(0, s.time - rig.recoveryEnteredAt)
        : null,
    dischargeAge =
      rig?.dischargeAt === null || rig?.dischargeAt === undefined
        ? null
        : Math.max(0, s.time - rig.dischargeAt),
    recoil = !moving || dischargeAge === null ? 0 : Math.max(0, 1 - dischargeAge / 0.23) ** 2,
    wear: 0 | 1 | 2 =
      s.hp <= 0 || s.hp / Math.max(1, s.maxHp) <= 0.3
        ? 2
        : s.hp / Math.max(1, s.maxHp) <= 0.65
          ? 1
          : 0,
    ground = !!rig?.grounded,
    footY =
      rig?.supportY !== null && rig?.supportY !== undefined
        ? (rig.supportY - s.position.y) / s.scale - 1
        : s.kind === 'shutter'
          ? 19
          : 17,
    body = { x: -f * recoil * 1.2, y: s.kind === 'strider' ? brace * 0.9 : 0 },
    angle = moving && s.kind === 'strider' ? clamp(s.velocity.x * 0.025, -0.055, 0.055) : 0,
    opening =
      s.kind !== 'shutter'
        ? 0
        : rig?.closed !== false
          ? 0
          : reduced || !warning
            ? 1
            : 0.6 + 0.4 * unit((0.35 - s.timer) / 0.15),
    mode =
      s.kind === 'shutter'
        ? opening === 0
          ? 'closed'
          : opening < 1
            ? 'opening'
            : 'exposed'
        : recover
          ? 'recover'
          : warning
            ? s.timer <= 0.4
              ? 'locked'
              : 'tracking'
            : speed > 0.02
              ? 'walking'
              : 'idle',
    legs: MachineLeg[] = [],
    wheels: Vec[] = [],
    panels: HeavyPanel[] = [],
    barrels: HeavyBarrel[] = [],
    tubes = heavyTubeCount(s.kind, rig?.variant);
  if (s.kind === 'strider') {
    for (const side of [-1, 1]) {
      const phase = s.position.x / 28 + s.id * 0.137 + (side < 0 ? 0.5 : 0),
        cycle = phase - Math.floor(phase),
        walking = moving && speed > 0.025 && !warning && !recover && ground,
        swing = walking && cycle > 0.6,
        progress = swing ? (cycle - 0.6) / 0.4 : cycle / 0.6,
        step = walking ? (swing ? -8.4 + progress * 16.8 : 8.4 - progress * 16.8) : 0,
        foot = {
          x: side * (warning || recover ? 16 : 11) + step,
          y: footY - (swing ? Math.sin(progress * Math.PI) * 6 : 0) - (!ground ? 3 : 0),
        },
        hip = { x: side * 6 + body.x, y: 4 + body.y };
      legs.push(joint(hip, foot, side, ground && !swing));
    }
  } else if (s.kind === 'shutter') {
    for (const side of [-1, 1])
      legs.push(joint({ x: side * 10, y: 10 }, { x: side * 11, y: footY }, side, ground));
    const height = mix(17.5, 6, opening),
      upper = -20 - opening * 2,
      lower = -2.5 + opening * 13.5;
    panels.push(
      { position: { x: f * 14 + body.x, y: upper + height / 2 }, angle: 0, width: 8, height },
      { position: { x: f * 14 + body.x, y: lower + height / 2 }, angle: 0, width: 8, height },
    );
  } else {
    wheels.push({ x: -13, y: footY - 5 }, { x: 13, y: footY - 5 });
  }
  if (s.kind !== 'mortar') {
    const nativeAngles = rig?.angles ?? [Math.atan2(s.aim.y, s.aim.x)];
    for (let i = 0; i < tubes; i++) {
      const a = nativeAngles[Math.min(i, nativeAngles.length - 1)] ?? 0,
        // The Cycle Shutter has two receivers on its native single shot line.
        lateral = s.kind === 'shutter' && tubes === 2 ? (i ? 2.5 : -2.5) : 0;
      barrels.push({
        angle: a,
        origin: { x: Math.cos(a) * 26, y: Math.sin(a) * 26 },
        feedOffset: lateral,
        length: s.kind === 'strider' && rig?.variant === 'strider-survey' ? 24 : 17,
        recoil,
      });
    }
  } else {
    const released = rig?.releaseArcs,
      arcs = rig?.arcs.length
        ? rig.arcs
        : rig?.shells.length
          ? rig.shells.map((shell) => shell.arc)
          : (released ?? []),
      returnToPark = !reduced && recover && age !== null ? unit((age - 0.3) / 1.6) : 0;
    for (let i = 0; i < tubes; i++) {
      const arc = arcs[Math.min(i, arcs.length - 1)],
        aim = arc
          ? Math.atan2(arc.to.y - arc.from.y - 4 * arc.height, arc.to.x - arc.from.x)
          : -Math.PI / 2,
        a =
          aim +
          Math.atan2(Math.sin(-Math.PI / 2 - aim), Math.cos(-Math.PI / 2 - aim)) * returnToPark;
      barrels.push({
        angle: a,
        origin:
          arc && !recover
            ? { x: arc.from.x - s.position.x, y: arc.from.y - s.position.y }
            : { x: 0, y: -26 },
        length: rig?.variant === 'mortar-slow' ? 31 : 25,
        recoil,
      });
    }
  }
  return {
    heavy: true,
    kind: s.kind,
    mode,
    wear,
    forward: f,
    body,
    angle,
    brace,
    recover,
    receiver: recoil * 2,
    rotor: 0,
    legs,
    opening,
    drive: moving && speed > 0.025 ? (s.position.x * 0.28) % (Math.PI * 2) : 0,
    loader: recover
      ? dischargeAge === null
        ? 0
        : reduced
          ? 0.4
          : age === null
            ? 0
            : Math.sin(Math.PI * unit(age / 1.4))
      : warning
        ? brace
        : 0,
    recoil,
    barrels,
    wheels,
    panels,
  };
}
