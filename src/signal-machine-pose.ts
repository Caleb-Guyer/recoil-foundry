import type { Enemy, Game } from './game.ts';
import type { MachineBodySnapshot, MachinePose, MachineLeg } from './machine-breakdown-pose.ts';
import type { CallerRig } from './caller.ts';
import { TRANSMISSION } from './annex.ts';
import { clamp, type Vec } from './rules.ts';
export type SignalMachineKind = 'caller' | 'switchman';
export const isSignalMachineKind = (kind: string): kind is SignalMachineKind =>
  kind === 'caller' || kind === 'switchman';
export interface SignalDischarge {
  at: number;
  source: 'body' | 'port';
  angle: number;
  origin: Vec;
  muzzle: Vec;
  index: number;
}
export interface SignalCancellation {
  at: number;
  reason: 'displaced' | 'target-lost' | 'faction-changed';
}
export interface SignalFeedback {
  at: number;
  healthLost: number;
  from: Vec;
}
export interface SignalMachineEventState {
  discharges: SignalDischarge[];
  cancellation: SignalCancellation | null;
  feedback: SignalFeedback | null;
}
export interface SignalMachineSnapshot extends SignalMachineEventState {
  grounded: boolean;
  supportY: number | null;
  caller?: {
    phase: CallerRig['phase'];
    clock: number;
    marks: Vec[];
    next: number;
    target: { id: number; position: Vec; player: boolean; valid: boolean } | null;
    origin: Vec | null;
    allied: boolean;
  };
  switchman?: {
    bodyLocked: boolean;
    annexActive: boolean;
    port: Vec | null;
    junction: Vec | null;
    transmission: {
      ownerId: number;
      phase: 'charging' | 'cooldown';
      at: number;
      aim: Vec;
      interrupted: boolean;
      valid: boolean;
    } | null;
  };
}
export interface SignalMachinePose extends MachinePose {
  signalMachine: true;
  kind: SignalMachineKind;
  energy: number;
  mode: string;
  recoil: number;
  cancellation: number;
  barrel: { origin: Vec; angle: number; length: number; recoil: number };
  gimbal: { center: Vec; angle: number };
  horn: { throat: Vec; lip: Vec; angle: number; diaphragm: number };
  slots: { point: Vec; index: number; recorded: boolean; pending: boolean; selected: boolean }[];
  antenna: {
    base: Vec;
    tip: Vec;
    angle: number;
    charge: number;
    locked: boolean;
    release: number;
    feedback: number;
  };
  radio: { charge: number; locked: boolean; release: number; feedback: number };
}
const copy = (v: Vec): Vec => ({ x: v.x, y: v.y });
/** Only detached native state; no targeting, physics or controller helpers are advanced. */
export function signalMachineSnapshot(
  e: Enemy,
  g?: Game,
  grounded = false,
  supportY: number | null = null,
): SignalMachineSnapshot {
  const events = g?.machineBreakdown.getSignalMachine(e),
    r = e.caller,
    t = g?.annex.transmission,
    own = t?.owner === e ? t : null,
    target = r?.target,
    player = !!target && target === g?.player,
    valid =
      !!target &&
      !!g &&
      (player
        ? !e.allied && g.hp > 0
        : (e.allied ? g.enemies : g.factions.allies).some(
            (a) =>
              a.body === target && (e.allied ? g.factions.targetable(a) : a.hp > 0 && a.spawn <= 0),
          ));
  return {
    grounded,
    supportY,
    discharges: events?.discharges ?? [],
    cancellation: events?.cancellation ?? null,
    feedback: events?.feedback ?? null,
    ...(e.kind === 'caller'
      ? {
          caller: {
            phase: r?.phase ?? 'ready',
            clock: r?.clock ?? 0,
            marks: r?.marks.slice(0, 3).map(copy) ?? [],
            next: r?.next ?? 0,
            target: target
              ? { id: target.id, position: copy(target.position), player, valid }
              : null,
            origin: r?.origin ? copy(r.origin) : null,
            allied: r?.allied ?? !!e.allied,
          },
        }
      : {}),
    ...(e.kind === 'switchman'
      ? {
          switchman: {
            bodyLocked: e.timer <= 0.55 && e.spawn <= 0,
            annexActive: !!g?.annex.active,
            port: g?.annex.active ? copy(g.annex.port) : null,
            junction: g?.annex.active ? copy(g.annex.junction) : null,
            transmission: own
              ? {
                  ownerId: e.id,
                  phase: own.phase,
                  at: own.at,
                  aim: copy(own.aim),
                  interrupted: own.interrupted,
                  valid:
                    !!g?.annex.active &&
                    e.hp > 0 &&
                    (e.allied ? g.factions.allies : g.enemies).includes(e),
                }
              : null,
          },
        }
      : {}),
  };
}
const decay = (time: number, at: number | undefined, duration: number) =>
  at === undefined || time < at ? 0 : Math.max(0, 1 - (time - at) / duration);
/** Limb, muzzle, horn, antenna and slot coordinates are world-aligned, relative to the real hull center. */
export function signalMachinePose(s: MachineBodySnapshot, reduced = false): SignalMachinePose {
  if (!isSignalMachineKind(s.kind)) throw Error('Expected a signal machine');
  const h = s.signalMachine,
    r = h?.caller,
    w = h?.switchman,
    energy = s.hp > 0 ? 1 : 0,
    motion = !reduced && energy > 0 && s.spawn <= 0,
    f: -1 | 1 = s.facing < 0 ? -1 : 1,
    lastBody = h?.discharges.filter((d) => d.source === 'body').at(-1),
    lastPort = h?.discharges.filter((d) => d.source === 'port').at(-1),
    bodyAge = lastBody ? s.time - lastBody.at : Infinity,
    duration = s.kind === 'caller' ? 0.2 : 0.18,
    recoil = motion ? decay(s.time, lastBody?.at, duration) ** 2 : 0,
    release = motion ? decay(s.time, lastPort?.at, 0.26) ** 2 : 0,
    feedback =
      motion && h?.feedback
        ? decay(s.time, h.feedback.at, 0.32) *
          clamp(h.feedback.healthLost / TRANSMISSION.feedback, 0, 1)
        : 0,
    cancellation = motion ? decay(s.time, h?.cancellation?.at, 0.28) : 0,
    transmitting = !!w?.transmission?.valid && w.transmission.phase === 'charging',
    charge = transmitting ? clamp(1 - (w!.transmission!.at - s.time) / TRANSMISSION.tell, 0, 1) : 0,
    locked = transmitting && w!.transmission!.at - s.time <= TRANSMISSION.lock,
    recording = r?.phase === 'recording',
    queue = r?.phase === 'locked' || r?.phase === 'firing',
    braced = (!!r && (recording || queue)) || !!w?.bodyLocked,
    brace = braced ? (reduced ? 0.7 : 1) : 0,
    useBody = motion && !!lastBody && bodyAge >= 0 && bodyAge < duration,
    aim = Math.atan2(s.aim.y, s.aim.x),
    bodyAim = useBody ? lastBody!.angle : aim,
    local = (p: Vec): Vec => ({
      x: (p.x - s.position.x) / s.scale,
      y: (p.y - s.position.y) / s.scale,
    }),
    center = useBody ? local(lastBody!.origin) : { x: 0, y: 0 },
    muzzle = useBody
      ? local(lastBody!.muzzle)
      : {
          x: center.x + (Math.cos(bodyAim) * 26) / s.scale,
          y: center.y + (Math.sin(bodyAim) * 26) / s.scale,
        },
    barrel = { origin: muzzle, angle: bodyAim, length: 26, recoil },
    gimbal = { center, angle: bodyAim },
    horn = {
      throat: { x: center.x - Math.cos(bodyAim) * 9, y: center.y - Math.sin(bodyAim) * 9 },
      lip: { ...muzzle },
      angle: bodyAim,
      diaphragm: recoil,
    },
    radio = { charge, locked, release, feedback },
    antennaBase = { x: -7, y: -14 },
    antennaTip = { x: 6 - f * feedback * 5, y: -30 + feedback * 6 - cancellation * 2 },
    antenna = {
      base: antennaBase,
      tip: antennaTip,
      angle: Math.atan2(antennaTip.y - antennaBase.y, antennaTip.x - antennaBase.x),
      ...radio,
    },
    slots = Array.from({ length: 3 }, (_, index) => ({
      point: { x: -8 + index * 8, y: -23 },
      index,
      recorded: !!r && index < r.marks.length,
      pending: !!r && index >= r.next && index < r.marks.length,
      selected: !!r && index === r.next && index < r.marks.length,
    })),
    wear: 0 | 1 | 2 =
      s.hp <= 0 || s.hp / Math.max(1, s.maxHp) <= 0.3
        ? 2
        : s.hp / Math.max(1, s.maxHp) <= 0.65
          ? 1
          : 0,
    body = { x: -f * recoil * 0.7, y: brace * 0.7 + feedback * 0.5 },
    angle = motion ? clamp(s.velocity.x * 0.015, -0.04, 0.04) - f * feedback * 0.055 : 0,
    moving = motion && h?.grounded && Math.abs(s.velocity.x) > 0.04 && !braced,
    stride = moving ? Math.sin(s.position.x * 0.18) * Math.min(3, Math.abs(s.velocity.x)) : 0,
    floor =
      h?.supportY === null || h?.supportY === undefined
        ? 17
        : (h.supportY - s.position.y) / s.scale - 1,
    legs: MachineLeg[] = [];
  for (const side of [-1, 1]) {
    const planted = !!h?.grounded && (!moving || side * stride <= 0),
      foot = {
        x: side * (11 + brace * 3) + side * stride,
        y: floor - (planted ? 0 : Math.abs(stride)),
      };
    legs.push({ hip: { x: side * 6, y: 6 }, knee: { x: side * 11, y: 12 }, foot, planted });
  }
  const mode =
    s.kind === 'caller'
      ? cancellation > 0
        ? 'cancelled'
        : recoil > 0
          ? 'playback'
          : (r?.phase ?? 'ready')
      : feedback > 0
        ? 'feedback'
        : locked
          ? 'signal-lock'
          : transmitting
            ? 'transmitting'
            : release > 0
              ? 'signal-release'
              : recoil > 0
                ? 'discharge'
                : w?.bodyLocked
                  ? 'body-lock'
                  : 'patrol';
  return {
    signalMachine: true,
    kind: s.kind,
    energy,
    mode,
    recoil,
    cancellation,
    barrel,
    gimbal,
    horn,
    slots,
    antenna,
    radio,
    wear,
    forward: f,
    body,
    angle,
    brace,
    recover: s.state === 'recover',
    receiver: recoil * 2,
    rotor: 0,
    legs,
  };
}
