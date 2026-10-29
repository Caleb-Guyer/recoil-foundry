import type { Enemy, Game } from './game.ts';
import type { MachineBodySnapshot, MachinePose, MachineLeg } from './machine-breakdown-pose.ts';
import { SCRAPPER_GRAB, SCRAPPER_TELL } from './scrapper.ts';
import { HARPOON_TELL, HARPOON_LOCK, harpoonMuzzle } from './harpooner.ts';
import { SAPPER_TELL, SAPPER_LOCK, sapperMuzzle, CHARGE_LIMIT } from './sapper.ts';
import { clamp, distance, type Vec } from './rules.ts';

export type HazardMachineKind = 'scrapper' | 'harpooner' | 'sapper';
export const isHazardMachineKind = (kind: string): kind is HazardMachineKind =>
  kind === 'scrapper' || kind === 'harpooner' || kind === 'sapper';
export interface HazardMachineEventState {
  /** Observed native attacks counter increment, never an inferred recovery pose. */
  releaseAt: number | null;
  /** Observed actual grip or cable release without another accepted attack. */
  interruptedAt: number | null;
  /** Last actual flight/reel angle held for the brief native cable-release brake. */
  breakSpoolAngle: number | null;
}
export interface HazardMachineProp {
  id: number;
  kind: string;
  position: Vec;
  velocity: Vec;
  angle: number;
  hull: Vec;
}
export interface HazardMachineSnapshot extends HazardMachineEventState {
  grounded: boolean;
  supportY: number | null;
  scrapper?: {
    phase: 'lift' | 'aim';
    held: HazardMachineProp | null;
    anchor: Vec | null;
    origin: Vec;
    release: Vec;
    velocity: Vec;
  };
  harpoon?: {
    phase: 'ready' | 'aim' | 'flight' | 'latched';
    origin: Vec;
    head: Vec;
    velocity: Vec;
    length: number;
    travel: number;
    expires: number;
    anchorHp: number;
    target: {
      id: number;
      position: Vec;
      velocity: Vec;
      isPlayer: boolean;
      isStatic: boolean;
    } | null;
    muzzle: Vec;
    span: number;
    tension: number;
  };
  sapper?: {
    origin: Vec;
    anchor: Vec;
    velocity: Vec;
    arc: Vec[];
    advance: boolean;
    muzzle: Vec;
    charges: {
      id: number;
      position: Vec;
      velocity: Vec;
      angle: number;
      at: number;
      born: number;
      loose: boolean;
      hostId: number | null;
      isStatic: boolean;
    }[];
  };
}
export interface HazardMachinePose extends MachinePose {
  hazardMachine: true;
  kind: HazardMachineKind;
  mode: string;
  energy: number;
  tread: number;
  release: number;
  strain: number;
  brake: number;
  arm: { shoulder: Vec; elbow: Vec; hand: Vec; grip: number } | null;
  barrel: { origin: Vec; angle: number; length: number; recoil: number } | null;
  spool: { center: Vec; angle: number; tension: number } | null;
  loader: { origin: Vec; seat: Vec; stroke: number; charge: boolean } | null;
}
const copy = (v: Vec): Vec => ({ x: v.x, y: v.y });
const finite = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback);
const unit = (v: number) => clamp(finite(v), 0, 1);
/** Detached projection only; no native validation helper is called or advanced. */
export function hazardMachineSnapshot(
  e: Enemy,
  g?: Game,
  grounded = false,
  supportY: number | null = null,
): HazardMachineSnapshot {
  const events = g?.machineBreakdown.getHazardMachine(e),
    sr = e.scrapper,
    hr = e.harpoon,
    sp = e.sapper,
    held = sr?.held && (!g || g.props.items.includes(sr.held)) ? sr.held : null,
    muzzle = hr ? harpoonMuzzle(e) : null,
    span = hr && muzzle ? distance(muzzle, hr.head) : 0;
  return {
    grounded,
    supportY,
    releaseAt: events?.releaseAt ?? null,
    interruptedAt: events?.interruptedAt ?? null,
    breakSpoolAngle: events?.breakSpoolAngle ?? null,
    ...(sr
      ? {
          scrapper: {
            phase: sr.phase,
            held: held
              ? {
                  id: held.body.id,
                  kind: held.kind,
                  position: copy(held.body.position),
                  velocity: copy(held.body.velocity),
                  angle: held.body.angle,
                  hull: {
                    x: held.body.bounds.max.x - held.body.bounds.min.x,
                    y: held.body.bounds.max.y - held.body.bounds.min.y,
                  },
                }
              : null,
            anchor: sr.tether ? copy(sr.tether.pointA) : null,
            origin: copy(sr.origin),
            release: copy(sr.release),
            velocity: copy(sr.velocity),
          },
        }
      : {}),
    ...(hr
      ? {
          harpoon: {
            phase: hr.phase,
            origin: copy(hr.origin),
            head: copy(hr.head),
            velocity: copy(hr.velocity),
            length: hr.length,
            travel: hr.travel,
            expires: hr.expires,
            anchorHp: hr.anchorHp,
            target: hr.target
              ? {
                  id: hr.target.id,
                  position: copy(hr.target.position),
                  velocity: copy(hr.target.velocity),
                  isPlayer: hr.target === g?.player,
                  isStatic: hr.target.isStatic,
                }
              : null,
            muzzle: muzzle!,
            span,
            tension: hr.phase === 'latched' ? unit((span - hr.length) / 40) : 0,
          },
        }
      : {}),
    ...(sp
      ? {
          sapper: {
            origin: copy(sp.origin),
            anchor: copy(sp.anchor),
            velocity: copy(sp.velocity),
            arc: sp.arc.slice(0, 32).map(copy),
            advance: sp.advance,
            muzzle: sapperMuzzle(e),
            charges: g
              ? g.sappers.items
                  .filter((p) => p.charge?.owner === e.id)
                  .slice(0, CHARGE_LIMIT)
                  .map((p) => ({
                    id: p.body.id,
                    position: copy(p.body.position),
                    velocity: copy(p.body.velocity),
                    angle: p.body.angle,
                    at: p.charge!.at,
                    born: p.charge!.born,
                    loose: p.charge!.loose,
                    hostId: p.charge!.host?.id ?? null,
                    isStatic: p.body.isStatic,
                  }))
              : [],
          },
        }
      : {}),
  };
}
function leg(side: number, foot: Vec, grounded: boolean): MachineLeg {
  return { hip: { x: side * 7, y: 6 }, knee: { x: side * 13, y: 11 }, foot, planted: grounded };
}
/** Working tools follow the native grip, locked aim, physical cable and accepted release event. */
export function hazardMachinePose(s: MachineBodySnapshot, reduced = false): HazardMachinePose {
  if (!isHazardMachineKind(s.kind)) throw Error('Expected a hazard machine');
  const h = s.hazardMachine,
    sr = h?.scrapper,
    hr = h?.harpoon,
    sp = h?.sapper,
    f: -1 | 1 = s.facing < 0 ? -1 : 1,
    energy = s.hp > 0 ? 1 : 0,
    motion = !reduced && energy > 0 && s.spawn <= 0,
    releaseAge =
      h?.releaseAt === null || h?.releaseAt === undefined
        ? Infinity
        : Math.max(0, s.time - h.releaseAt),
    brokenAge =
      h?.interruptedAt === null || h?.interruptedAt === undefined
        ? Infinity
        : Math.max(0, s.time - h.interruptedAt),
    release = motion ? Math.max(0, 1 - releaseAge / 0.28) ** 2 : 0,
    interrupted = brokenAge < 0.4,
    brake =
      s.kind === 'harpooner' &&
      motion &&
      h?.breakSpoolAngle !== null &&
      h?.breakSpoolAngle !== undefined
        ? unit(1 - brokenAge / 0.55)
        : 0,
    local = (p: Vec): Vec => ({
      x: (finite(p.x) - s.position.x) / s.scale,
      y: (finite(p.y) - s.position.y) / s.scale,
    }),
    wear: 0 | 1 | 2 =
      s.hp <= 0 || s.hp / Math.max(1, s.maxHp) <= 0.3
        ? 2
        : s.hp / Math.max(1, s.maxHp) <= 0.65
          ? 1
          : 0,
    speed = unit(Math.abs(s.velocity.x) / 2.5),
    tread = motion && speed > 0.02 ? s.position.x * 0.26 : 0,
    legs: MachineLeg[] = [],
    strain = hr?.phase === 'ready' ? brake * 0.45 : unit(hr?.tension ?? 0);
  let mode: string = s.state,
    brace = 0,
    arm: HazardMachinePose['arm'] = null,
    barrel: HazardMachinePose['barrel'] = null,
    spool: HazardMachinePose['spool'] = null,
    loader: HazardMachinePose['loader'] = null;
  if (s.kind === 'scrapper') {
    mode = sr?.held
      ? sr.phase
      : interrupted
        ? 'stunned'
        : releaseAge < 0.28
          ? 'throw'
          : s.state === 'recover'
            ? 'recover'
            : 'seeking';
    const held = sr?.held,
      hand = held
        ? local(held.position)
        : { x: f * (25 + release * 12), y: s.state === 'recover' ? 6 - release * 15 : -12 },
      side = held ? Math.sign(hand.x) || f : f;
    arm = {
      shoulder: { x: 0, y: -9 },
      elbow: { x: side * 21, y: held ? -39 : -25 + release * 8 },
      hand,
      grip: held ? 1 : 0.3 * (1 - release),
    };
    brace = held
      ? reduced
        ? 0.7
        : unit(1 - s.timer / (sr.phase === 'lift' ? SCRAPPER_GRAB : SCRAPPER_TELL))
      : 0;
  } else if (s.kind === 'harpooner') {
    mode =
      hr?.phase === 'ready'
        ? s.state === 'recover'
          ? brake > 0
            ? 'braking'
            : 'recover'
          : 'ready'
        : hr?.phase === 'aim'
          ? s.timer <= HARPOON_LOCK
            ? 'locked'
            : 'tracking'
          : (hr?.phase ?? 'ready');
    const angle = Math.atan2(s.aim.y, s.aim.x),
      origin = hr ? local(hr.muzzle) : { x: Math.cos(angle) * 26, y: -5 + Math.sin(angle) * 26 };
    barrel = { origin, angle, length: 28, recoil: release };
    spool = {
      center: { x: 0, y: -4 },
      angle: motion
        ? hr?.phase === 'flight'
          ? (hr.travel ?? 0) * 0.08
          : hr?.phase === 'latched'
            ? (hr.length ?? 0) * -0.08
            : h?.breakSpoolAngle !== null && h?.breakSpoolAngle !== undefined
              ? h.breakSpoolAngle + f * (1 - brake) * 0.9
              : 0
        : 0,
      tension: strain,
    };
    brace =
      hr?.phase === 'aim'
        ? reduced
          ? 0.7
          : unit(1 - s.timer / HARPOON_TELL)
        : hr?.phase === 'latched'
          ? strain * 0.75
          : 0;
    loader = {
      origin: { x: -f * 8, y: 0 },
      seat: { x: f * 11, y: -5 },
      stroke: hr?.phase === 'aim' ? unit(1 - s.timer / HARPOON_TELL) : 0,
      charge: hr?.phase === 'aim' || hr?.phase === 'ready',
    };
  } else {
    mode =
      s.state === 'windup'
        ? s.timer <= SAPPER_LOCK
          ? 'locked'
          : 'loading'
        : releaseAge < 0.28
          ? 'eject'
          : s.state === 'recover'
            ? 'recover'
            : 'seeking';
    const angle = Math.atan2(s.aim.y, s.aim.x),
      origin = sp ? local(sp.muzzle) : { x: f * 22, y: -28 };
    barrel = { origin, angle, length: 14, recoil: release };
    loader = {
      origin: { x: -f * 8, y: -9 },
      seat: { x: f * 12, y: -16 },
      stroke: s.state === 'windup' ? unit(1 - s.timer / SAPPER_TELL) : release,
      charge: s.state === 'windup',
    };
    brace = s.state === 'windup' ? (reduced ? 0.7 : unit(1 - s.timer / SAPPER_TELL)) : 0;
    const floor =
      h?.supportY === null || h?.supportY === undefined
        ? 15
        : (h.supportY - s.position.y) / s.scale - 1;
    for (const side of [-1, 1])
      legs.push(leg(side, { x: side * 12, y: floor - (h?.grounded ? 0 : 2) }, !!h?.grounded));
  }
  const body = { x: -f * release * 1.2, y: brace * 0.55 },
    angle = motion ? clamp(s.velocity.x * 0.014, -0.04, 0.04) - f * release * 0.045 : 0;
  return {
    hazardMachine: true,
    kind: s.kind,
    mode,
    energy,
    wear,
    forward: f,
    body,
    angle,
    brace,
    recover: s.state === 'recover',
    receiver: release * 2,
    rotor: tread,
    legs,
    tread,
    release,
    strain,
    brake,
    arm,
    barrel,
    spool,
    loader,
  };
}
