import type { MachineBodySnapshot, MachinePose, MachineLeg } from './machine-breakdown-pose.ts';
import { SUPPORT } from './teamwork.ts';
import { SENTRY_LOCK } from './fabricator.ts';
import { clamp, type Vec } from './rules.ts';

export type SupportMachineKind = 'repairer' | 'relay' | 'fabricator' | 'sentry';
export const isSupportMachineKind = (kind: string): kind is SupportMachineKind =>
  kind === 'repairer' || kind === 'relay' || kind === 'fabricator' || kind === 'sentry';
export interface SupportTool {
  base: Vec;
  elbow: Vec;
  tip: Vec;
  active: boolean;
  angle?: number;
}
export interface SupportBarrel {
  origin: Vec;
  angle: number;
  length: number;
  recoil: number;
}
export interface SupportMachinePose extends MachinePose {
  supportMachine: true;
  kind: SupportMachineKind;
  mode: string;
  energy: number;
  tools: SupportTool[];
  reserve: number;
  cells: [boolean, boolean, boolean];
  coil: number;
  pulse: number;
  assembly: number;
  barrel: SupportBarrel | null;
  pods: Vec[];
}
const unit = (n: number) => clamp(n, 0, 1);
function joint(hip: Vec, foot: Vec, side: number, planted: boolean): MachineLeg {
  const dx = foot.x - hip.x,
    dy = foot.y - hip.y,
    d = Math.max(0.001, Math.hypot(dx, dy)),
    length = Math.max(8, d * 0.55),
    bend = Math.sqrt(Math.max(0, length * length - (d * d) / 4));
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
/** Native controller projection only. Every coordinate is world-aligned relative to the real body center. */
export function supportMachinePose(s: MachineBodySnapshot, reduced = false): SupportMachinePose {
  if (!isSupportMachineKind(s.kind)) throw Error('Expected a support machine');
  const state = s.supportMachine,
    support = state?.support,
    fabricator = state?.fabricator,
    sentry = state?.sentry,
    f: -1 | 1 = s.facing < 0 ? -1 : 1,
    energy = s.hp > 0 ? 1 : 0,
    motion = !reduced && energy > 0 && s.spawn <= 0,
    wear: 0 | 1 | 2 =
      s.hp <= 0 || s.hp / Math.max(1, s.maxHp) <= 0.3
        ? 2
        : s.hp / Math.max(1, s.maxHp) <= 0.65
          ? 1
          : 0,
    pulseAge = support?.pulse ? Math.max(0, s.time - support.pulse.at) : null,
    pulse = pulseAge === null || pulseAge >= 0.3 || reduced ? 0 : unit(1 - pulseAge / 0.3),
    dischargeAge =
      sentry?.dischargeAt === null || sentry?.dischargeAt === undefined
        ? null
        : Math.max(0, s.time - sentry.dischargeAt),
    recoil = motion && dischargeAge !== null ? Math.max(0, 1 - dischargeAge / 0.23) ** 2 : 0,
    assembly = unit(sentry?.buildProgress ?? fabricator?.frame?.buildProgress ?? 0),
    warning = s.kind === 'sentry' && !!sentry?.ready && s.state === 'windup',
    brace = warning
      ? reduced
        ? 0.7
        : unit(1 - s.timer / 0.85)
      : support?.phase === 'windup'
        ? reduced
          ? 0.7
          : unit(1 - support.timer / SUPPORT.tell)
        : 0,
    body = {
      x: s.kind === 'sentry' ? -Math.cos(Math.atan2(s.aim.y, s.aim.x)) * recoil * 0.9 : 0,
      y: 0,
    },
    angle =
      motion && (s.kind === 'repairer' || s.kind === 'relay')
        ? clamp(s.velocity.x * 0.025, -0.06, 0.06)
        : 0,
    tools: SupportTool[] = [],
    legs: MachineLeg[] = [],
    pods: Vec[] = [],
    cells: [boolean, boolean, boolean] = [false, false, false];
  let mode = s.state as string,
    coil = 0,
    reserve = 0,
    barrel: SupportBarrel | null = null;
  if (s.kind === 'repairer' || s.kind === 'relay') {
    mode = support?.phase ?? 'idle';
    const target =
        support?.partner ??
        (!reduced && pulseAge !== null && pulseAge < 0.3 ? support?.pulse?.target : null),
      d = target
        ? { x: target.position.x - s.position.x, y: target.position.y - s.position.y }
        : { x: f, y: 0.15 },
      length = Math.max(0.001, Math.hypot(d.x, d.y)),
      dir = { x: d.x / length, y: d.y / length },
      side = dir.x < 0 ? -1 : 1,
      active = !!support?.partner;
    tools.push(
      {
        base: { x: side * 9, y: 1 },
        elbow: { x: side * 20, y: -1 - Math.abs(dir.y) * 8 },
        tip: { x: dir.x * 27, y: dir.y * 27 },
        active,
        angle: Math.atan2(dir.y, dir.x),
      },
      {
        base: { x: -side * 9, y: 3 },
        elbow: { x: -side * 17, y: 10 },
        tip: { x: -side * 23, y: 7 + pulse * 2 },
        active: false,
        angle: side > 0 ? Math.PI : 0,
      },
    );
    pods.push({ x: -22, y: -15 }, { x: 22, y: -15 });
    if (s.kind === 'repairer')
      reserve = unit((support?.remaining ?? SUPPORT.budget) / SUPPORT.budget);
    else {
      for (let i = 0; i < 3; i++) cells[i] = (support?.remaining ?? SUPPORT.charges) > i;
      coil =
        support?.phase === 'ready'
          ? 1
          : support?.phase === 'windup'
            ? unit(1 - support.timer / SUPPORT.tell)
            : pulse;
    }
  } else if (s.kind === 'fabricator') {
    const frame = fabricator?.frame,
      active = !!frame;
    mode = active ? 'building' : s.state === 'recover' ? 'recover' : 'seeking';
    const weldStroke = active && motion ? Math.sin(assembly * Math.PI * 6) * 2.5 : 0,
      tip = { x: f * 26, y: active ? -12 + weldStroke : -2 },
      target = frame
        ? { x: frame.position.x - s.position.x, y: frame.position.y - s.position.y - 10 }
        : { x: f * 100, y: -2 },
      a = Math.atan2(target.y - tip.y, target.x - tip.x);
    tools.push(
      { base: { x: f * 7, y: 0 }, elbow: { x: f * 19, y: -19 }, tip, active, angle: a },
      {
        base: { x: -f * 7, y: 2 },
        elbow: { x: f * 10, y: -10 },
        tip: { x: f * 23, y: active ? -7 - weldStroke * 0.6 : 7 },
        active,
        angle: a,
      },
    );
    for (const side of [-1, 1])
      legs.push(joint({ x: side * 9, y: 7 }, { x: side * 11, y: 15 }, side, !!state?.grounded));
  } else {
    mode = !sentry?.ready
      ? 'assembling'
      : warning
        ? s.timer <= SENTRY_LOCK
          ? 'locked'
          : 'tracking'
        : s.state === 'recover'
          ? 'recover'
          : 'ready';
    const origin = sentry
      ? { x: sentry.muzzle.x - s.position.x, y: sentry.muzzle.y - s.position.y }
      : { x: 0, y: -8 };
    barrel = {
      origin,
      angle: sentry?.ready ? Math.atan2(s.aim.y, s.aim.x) : (-Math.PI / 2) * (1 - assembly),
      length: sentry?.ready ? 26 : 10 + assembly * 16,
      recoil,
    };
    const floor =
      state?.supportY !== null && state?.supportY !== undefined
        ? (state.supportY - s.position.y) / s.scale - 1
        : 15;
    for (const side of [-1, 1])
      legs.push(
        joint(
          { x: side * 8, y: 5 + (1 - assembly) * 4 },
          { x: side * (10 + assembly * 6), y: floor - (state?.grounded ? 0 : 2) },
          side,
          !!state?.grounded,
        ),
      );
  }
  return {
    supportMachine: true,
    kind: s.kind,
    mode,
    energy,
    wear,
    forward: f,
    body,
    angle,
    brace,
    recover: s.state === 'recover',
    receiver: recoil * 2,
    rotor: motion
      ? s.kind === 'repairer' || s.kind === 'relay'
        ? (s.time * 25 + s.id * 0.7) % (Math.PI * 2)
        : s.kind === 'fabricator' && Math.abs(s.velocity.x) > 0.03
          ? s.position.x * 0.3
          : 0
      : 0,
    legs,
    tools,
    reserve,
    cells,
    coil,
    pulse,
    assembly,
    barrel,
    pods,
  };
}
