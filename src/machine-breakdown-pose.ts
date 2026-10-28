import type { Enemy, Game } from './game.ts';
import { type EnemyState, type EliteKind, ENEMY_STATS, VOLATILE_TELL } from './enemies.ts';
import { clamp, type Vec } from './rules.ts';
import { attackBrace } from './combat-readability.ts';
import { SPLIT_SCALE, type MutationRig } from './mutations.ts';
import type { SquadTag } from './squads.ts';
import { firstSolid } from './collisions.ts';
import { isSpecialistMachineKind, specialistMachinePose } from './specialist-machine-pose.ts';
import type { Attack } from './enemies.ts';

export type MachineKind = 'runner' | 'shooter' | 'flyer' | 'charger' | 'hopper' | 'sniper';
export const isMachineKind = (kind: string): kind is MachineKind =>
  ['runner', 'shooter', 'flyer', 'charger', 'hopper', 'sniper'].includes(kind);
export interface MachineBodySnapshot {
  kind: MachineKind;
  id: number;
  position: Vec;
  velocity: Vec;
  aim: Vec;
  state: EnemyState;
  timer: number;
  hp: number;
  maxHp: number;
  flash: number;
  hitDirection: Vec;
  allied: boolean;
  elite?: EliteKind;
  remastered: boolean;
  spawn: number;
  time: number;
  scale: number;
  brace: number;
  bodyAngle: number;
  angularVelocity: number;
  hull: Vec;
  facing: number;
  splitChild: boolean;
  mutation?: Pick<MutationRig, 'kind' | 'phase' | 'timer' | 'count'>;
  squad?: SquadTag & { connected: boolean };
  attack?: Attack;
  phase?: number;
  attacks?: number;
  target?: Vec;
  specialist?: {
    grounded: boolean;
    supportY: number | null;
    recovery: 'crash' | 'spent' | 'landing' | 'breech' | null;
    enteredAt: number | null;
  };
}
export interface MachineLeg {
  hip: Vec;
  knee: Vec;
  foot: Vec;
  planted: boolean;
}
export interface MachinePose {
  kind: MachineKind;
  wear: 0 | 1 | 2;
  forward: -1 | 1;
  body: Vec;
  angle: number;
  brace: number;
  recover: boolean;
  receiver: number;
  rotor: number;
  legs: MachineLeg[];
}
export function machineBodySnapshot(e: Enemy, time: number, g?: Game): MachineBodySnapshot | null {
  if (!isMachineKind(e.kind)) return null;
  const angle = e.body.angle,
    cos = Math.cos(angle),
    sin = Math.sin(angle),
    local = e.body.vertices.map((v) => ({
      x: (v.x - e.body.position.x) * cos + (v.y - e.body.position.y) * sin,
      y: -(v.x - e.body.position.x) * sin + (v.y - e.body.position.y) * cos,
    }));
  const specialist = isSpecialistMachineKind(e.kind),
    start = { x: e.body.position.x, y: e.body.bounds.max.y - 2 },
    end = { x: start.x, y: e.body.bounds.max.y + 5 },
    // Same native 20px support probe without Query.ray's temporary Matter body allocation.
    support =
      specialist && g && e.body.velocity.y >= -1
        ? firstSolid(start, end, { x: 10, y: 0 }, g.solidBodies)
        : undefined,
    grounded = !!support,
    supportY = support && support.normal.y < -0.45 ? start.y + (end.y - start.y) * support.t : null,
    observed = specialist ? g?.machineBreakdown.getSpecialist(e) : null;
  return {
    kind: e.kind,
    id: e.id,
    position: { ...e.body.position },
    velocity: { ...e.body.velocity },
    aim: { ...e.aim },
    state: e.state,
    timer: e.timer,
    hp: e.hp,
    maxHp: e.maxHp,
    flash: e.flash,
    hitDirection: { ...(e.hitDirection ?? { x: 0, y: 0 }) },
    allied: !!e.allied,
    elite: e.elite,
    remastered: !!e.remaster,
    spawn: e.spawn,
    time,
    scale: e.splitChild ? SPLIT_SCALE : 1,
    brace:
      e.elite === 'volatile' && e.state === 'windup'
        ? clamp(1 - e.timer / VOLATILE_TELL, 0, 1)
        : attackBrace(e),
    bodyAngle: e.body.angle,
    angularVelocity: e.body.angularVelocity,
    hull: {
      x: Math.max(...local.map((v) => v.x)) - Math.min(...local.map((v) => v.x)),
      y: Math.max(...local.map((v) => v.y)) - Math.min(...local.map((v) => v.y)),
    },
    facing: e.facing,
    attack: e.attack,
    phase: e.phase,
    attacks: e.attacks,
    target: { ...e.target },
    ...(specialist
      ? {
          specialist: {
            grounded,
            supportY,
            recovery: observed?.recovery ?? null,
            enteredAt: observed?.enteredAt ?? null,
          },
        }
      : {}),
    splitChild: !!e.splitChild,
    ...(e.mutation
      ? {
          mutation: {
            kind: e.mutation.kind,
            phase: e.mutation.phase,
            timer: e.mutation.timer,
            count: e.mutation.count,
          },
        }
      : {}),
    ...(e.squad
      ? { squad: { kind: e.squad.kind, role: e.squad.role, connected: e.squad.connected } }
      : {}),
  };
}
const finite = (n: number, fallback = 0) => (Number.isFinite(n) ? n : fallback);
function leg(hip: Vec, foot: Vec, bend: number, planted: boolean): MachineLeg {
  const dx = foot.x - hip.x,
    dy = foot.y - hip.y,
    d = Math.max(0.001, Math.hypot(dx, dy)),
    length = Math.max(9, d * 0.55),
    h = Math.sqrt(Math.max(0, length * length - (d * d) / 4));
  return {
    hip,
    knee: {
      x: (hip.x + foot.x) / 2 + (dy / d) * h * bend,
      y: (hip.y + foot.y) / 2 - (dx / d) * h * bend,
    },
    foot,
    planted,
  };
}
// A pure projection of native state. It never advances a clock, changes AI, or moves a hull.
export function machinePose(s: MachineBodySnapshot, reduced = false): MachinePose {
  if (isSpecialistMachineKind(s.kind)) return specialistMachinePose(s, reduced);
  const time = finite(s.time),
    vx = finite(s.velocity.x),
    vy = finite(s.velocity.y),
    speed = clamp(Math.abs(vx) / 3.8, 0, 1),
    forward: -1 | 1 = finite(s.aim.x, 1) < 0 ? -1 : 1,
    active = s.spawn <= 0 && s.hp > 0,
    motion = !reduced && active ? 1 : 0,
    brace =
      s.state === 'windup' || s.state === 'followup'
        ? reduced
          ? 0.7
          : clamp(finite(s.brace), 0, 1)
        : 0,
    recover = s.state === 'recover',
    wear: 0 | 1 | 2 =
      s.hp <= 0
        ? 2
        : s.hp / Math.max(1, finite(s.maxHp, 1)) <= 0.3
          ? 2
          : s.hp / Math.max(1, finite(s.maxHp, 1)) <= 0.65
            ? 1
            : 0,
    hit = motion * clamp(finite(s.flash) / 0.08, 0, 1) ** 2,
    phase = finite(s.position.x) * 0.19 + finite(s.id),
    stride = Math.sin(phase) * speed * (1 - brace) * motion,
    body = {
      x: (recover ? -forward * 0.7 : -forward * brace * 1.4) + hit * finite(s.hitDirection.x) * 1.2,
      y:
        s.kind === 'flyer'
          ? motion * Math.sin(time * 3 + s.id) * 0.6
          : brace * 1.4 + (recover ? 0.8 : 0) - Math.abs(stride) * 0.55,
    },
    angle =
      motion * (clamp(vx * 0.016, -0.075, 0.075) + finite(s.hitDirection.x) * hit * 0.045) -
      forward * brace * 0.035,
    floor = ENEMY_STATS[s.kind].h / 2 - 1,
    legs: MachineLeg[] = [];
  if (s.kind !== 'flyer') {
    for (const side of [-1, 1]) {
      const footPhase = (phase + (side < 0 ? Math.PI : 0)) / (Math.PI * 2),
        cycle = footPhase - Math.floor(footPhase),
        moving = motion && speed > 0.025 && brace < 0.1 && !recover,
        swing = moving && cycle > 0.55,
        progress = swing ? (cycle - 0.55) / 0.45 : cycle / 0.55,
        travel = 8 * speed,
        steppingX = moving
          ? swing
            ? -travel + 2 * travel * progress
            : travel - 2 * travel * progress
          : 0,
        spread = s.kind === 'shooter' ? 11 + brace * 6 : 7 + brace * 3,
        airborne = s.state === 'airborne' || Math.abs(vy) > 2.5,
        foot = {
          x: side * spread + steppingX,
          y: floor - (swing ? Math.sin(progress * Math.PI) * 5 : 0) - (airborne ? 3 : 0),
        },
        hip = { x: side * (s.kind === 'runner' ? 5 : 7) + body.x, y: 4 + body.y };
      legs.push(leg(hip, foot, side, !swing && !airborne));
    }
  }
  return {
    kind: s.kind,
    wear,
    forward,
    body,
    angle,
    brace,
    recover,
    receiver:
      motion *
      (recover
        ? Math.max(0, Math.sin((clamp(finite(s.timer), 0, 0.6) * Math.PI) / 0.6)) * 2
        : hit * 1.4),
    rotor: motion ? (time * 25 + s.id * 0.7) % (Math.PI * 2) : 0,
    legs,
  };
}
