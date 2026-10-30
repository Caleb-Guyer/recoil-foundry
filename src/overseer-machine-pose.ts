import type { Enemy, Game } from './game.ts';
import type { MachineBodySnapshot, MachinePose, MachineLeg } from './machine-breakdown-pose.ts';
import type { WelderRig } from './welder.ts';
import { WELD_TELL, WELDER_OPENING } from './welder.ts';
import { SIGNAL, signalPoint, type SignalPlan } from './switchboard.ts';
import { AUDITOR_RECALL, type AuditAttack } from './auditor.ts';
import { clamp, type Vec } from './rules.ts';
export type OverseerMachineKind = 'welder' | 'switchboard' | 'auditor';
export const isOverseerMachineKind = (kind: string): kind is OverseerMachineKind =>
  kind === 'welder' || kind === 'switchboard' || kind === 'auditor';
export interface OverseerDischarge {
  at: number;
  source: 'body' | 'port';
  slot: number | null;
  index: number;
  angle: number;
  origin: Vec;
  muzzle: Vec;
}
export interface OverseerDeployment {
  at: number;
  kind: 'seam-trace' | 'seam-ignite' | 'barrier';
  points: Vec[];
}
export interface OverseerInterruption {
  at: number;
  kind: 'barrier-break' | 'junction-cut';
  position: Vec;
  healthLost?: number;
}
export interface OverseerMachineEventState {
  discharges: OverseerDischarge[];
  deployments: OverseerDeployment[];
  interruptions: OverseerInterruption[];
}
export interface OverseerMachineSnapshot extends OverseerMachineEventState {
  grounded: boolean;
  supportY: number | null;
  hullHit: {
    at: number;
    healthLost: number;
    absorbed: number;
    blocked: boolean;
    direction: Vec | null;
  } | null;
  welder?: {
    attack: WelderRig['attack'];
    jumpAt: number;
    stepAt: number;
    seams: { a: Vec; b: Vec; normal: Vec; age: number; ignited: boolean; supportId: number }[];
    barriers: { position: Vec; age: number; supportId: number }[];
    walls: {
      id: number;
      position: Vec;
      angle: number;
      hp: number;
      maxHp: number;
      expires: number | null;
    }[];
  };
  switchboard?: {
    elapsed: number;
    wait: number;
    cooldown: number;
    opening: number;
    interruptions: number;
    fired: number;
    plans: (SignalPlan & { port: Vec; junction: Vec })[];
  };
  auditor?: {
    owned: boolean;
    attack: AuditAttack;
    phase: number;
    rounds: number;
    fired: number;
    nextShot: number;
    jumpAt: number;
    stepAt: number;
    recall: number;
    age: number;
    visits: number;
    returning: boolean;
    status: string | null;
    stateHp: number;
  };
}
export interface OverseerMachinePose extends MachinePose {
  overseerMachine: true;
  kind: OverseerMachineKind;
  energy: number;
  mode: string;
  recoil: number;
  barrel: { origin: Vec; angle: number; length: number; recoil: number };
  gimbal: { center: Vec; angle: number };
  torch: { shoulder: Vec; elbow: Vec; tip: Vec; heat: number; opening: number };
  tracks: { center: Vec; phase: number }[];
  channels: {
    slot: number;
    point: Vec;
    charge: number;
    locked: boolean;
    cut: boolean;
    release: number;
    mobile: boolean;
  }[];
  magazine: { index: number; point: Vec; loaded: boolean; selected: boolean }[];
  caseLatch: { point: Vec; open: number; recall: number };
  deploy: number;
  interruption: number;
}
const copy = (v: Vec): Vec => ({ x: v.x, y: v.y });
/** Native mechanism data only: no target selection, timer mutation or physics helpers. */
export function overseerMachineSnapshot(
  e: Enemy,
  g?: Game,
  grounded = false,
  supportY: number | null = null,
): OverseerMachineSnapshot {
  const events = g?.machineBreakdown.getOverseerMachine(e),
    hit = g?.machineBreakdown.getHits(e.id).at(-1),
    welderOwner = !!g && g.enemies.find((a) => a.kind === 'welder') === e,
    r = e.switchboard,
    a = e.auditor,
    owned = g?.auditor.enemy === e;
  return {
    grounded,
    supportY,
    hullHit: hit
      ? {
          at: hit.at,
          healthLost: hit.healthLost,
          absorbed: hit.absorbed,
          blocked: hit.blocked,
          direction: hit.contact
            ? {
                x: -(
                  hit.contact.normal.x * Math.cos(e.body.angle) -
                  hit.contact.normal.y * Math.sin(e.body.angle)
                ),
                y: -(
                  hit.contact.normal.x * Math.sin(e.body.angle) +
                  hit.contact.normal.y * Math.cos(e.body.angle)
                ),
              }
            : null,
        }
      : null,
    discharges: events?.discharges ?? [],
    deployments: events?.deployments ?? [],
    interruptions: events?.interruptions ?? [],
    ...(e.kind === 'welder'
      ? {
          welder: {
            attack: e.welder?.attack ?? 'seam',
            jumpAt: e.welder?.jumpAt ?? 0,
            stepAt: e.welder?.stepAt ?? 0,
            seams: welderOwner
              ? g!.welder.seams
                  .filter((s) => g!.terrain.includes(s.support))
                  .slice(0, 3)
                  .map((s) => ({
                    a: copy(s.a),
                    b: copy(s.b),
                    normal: copy(s.normal),
                    age: s.age,
                    ignited: s.ignited,
                    supportId: s.support.id,
                  }))
              : [],
            barriers: welderOwner
              ? g!.welder.barriers
                  .filter((b) => g!.terrain.includes(b.support))
                  .slice(0, 2)
                  .map((b) => ({
                    position: { x: b.x, y: b.y },
                    age: b.age,
                    supportId: b.support.id,
                  }))
              : [],
            walls:
              g?.welder.presentationWalls(e).map((p) => ({
                id: p.body.id,
                position: copy(p.body.position),
                angle: p.body.angle,
                hp: p.hp,
                maxHp: p.maxHp,
                expires: p.expires ?? null,
              })) ?? [],
          },
        }
      : {}),
    ...(e.kind === 'switchboard'
      ? {
          switchboard: {
            elapsed: r?.elapsed ?? 0,
            wait: r?.wait ?? 0,
            cooldown: r?.cooldown ?? 0,
            opening: r?.opening ?? 0,
            interruptions: r?.interruptions ?? 0,
            fired: r?.fired ?? 0,
            plans:
              r?.plans.slice(0, 3).map((p) => ({
                ...p,
                origin: copy(p.origin),
                marks: p.marks.slice(0, 3).map(copy),
                angles: [...p.angles],
                escape: p.escape ? copy(p.escape) : null,
                port: g ? signalPoint(g, p.slot, 'port') : copy(p.origin),
                junction: g ? signalPoint(g, p.slot, 'junction') : copy(p.origin),
              })) ?? [],
          },
        }
      : {}),
    ...(e.kind === 'auditor'
      ? {
          auditor: {
            owned,
            attack: a?.attack ?? 'burst',
            phase: a?.phase ?? e.phase,
            rounds: a?.rounds ?? 0,
            fired: a?.fired ?? 0,
            nextShot: a?.nextShot ?? 0,
            jumpAt: a?.jumpAt ?? 0,
            stepAt: a?.stepAt ?? 0,
            recall: owned ? g!.auditor.recall : 0,
            age: owned ? g!.auditor.age : 0,
            visits: owned ? (g!.auditor.state?.visits ?? 0) : 0,
            returning: !!owned && g!.auditor.recall > 0 && e.state === 'return',
            status: owned ? (g!.auditor.state?.status ?? null) : null,
            stateHp: owned ? (g!.auditor.state?.hp ?? e.hp) : e.hp,
          },
        }
      : {}),
  };
}
const decay = (time: number, at: number | undefined, duration: number) =>
  at === undefined || time < at ? 0 : Math.max(0, 1 - (time - at) / duration);
/** All mechanical coordinates are world-aligned relative to the actual hull center. */
export function overseerMachinePose(s: MachineBodySnapshot, reduced = false): OverseerMachinePose {
  if (!isOverseerMachineKind(s.kind)) throw Error('Expected a factory overseer');
  const h = s.overseerMachine,
    w = h?.welder,
    b = h?.switchboard,
    a = h?.auditor,
    energy = s.hp > 0 ? 1 : 0,
    motion = !reduced && energy > 0 && s.spawn <= 0,
    f: -1 | 1 = s.facing < 0 ? -1 : 1,
    bodyShot = h?.discharges.filter((d) => d.source === 'body').at(-1),
    recent = !!bodyShot && s.time - bodyShot.at >= 0 && s.time - bodyShot.at < 0.22,
    recoil = motion ? decay(s.time, bodyShot?.at, 0.22) ** 2 : 0,
    local = (p: Vec): Vec => ({
      x: (p.x - s.position.x) / s.scale,
      y: (p.y - s.position.y) / s.scale,
    }),
    aim = recent ? bodyShot.angle : Math.atan2(s.aim.y, s.aim.x),
    center = recent ? local(bodyShot.origin) : { x: 0, y: 0 },
    length = s.kind === 'auditor' ? 35 : 26,
    muzzle = recent
      ? local(bodyShot.muzzle)
      : {
          x: center.x + (Math.cos(aim) * length) / s.scale,
          y: center.y + (Math.sin(aim) * length) / s.scale,
        },
    barrel = {
      origin: muzzle,
      angle: aim,
      length:
        (recent
          ? Math.hypot(bodyShot.muzzle.x - bodyShot.origin.x, bodyShot.muzzle.y - bodyShot.origin.y)
          : length) / s.scale,
      recoil,
    },
    gimbal = { center, angle: aim },
    acceptedHit =
      motion && h?.hullHit
        ? decay(s.time, h.hullHit.at, 0.24) ** 2 *
          clamp(
            ((h.hullHit.healthLost + h.hullHit.absorbed * 0.25) / Math.max(1, s.maxHp)) * 10,
            0.15,
            1,
          )
        : 0,
    hitDirection = h?.hullHit?.direction,
    winding = s.state === 'windup' || s.state === 'rush',
    brace = winding ? (reduced ? 0.7 : 1) : 0,
    deploy = motion ? decay(s.time, h?.deployments.at(-1)?.at, 0.35) : 0,
    interruption = motion ? decay(s.time, h?.interruptions.at(-1)?.at, 0.4) : 0,
    recall = a?.returning ? clamp(1 - a.recall / AUDITOR_RECALL, 0, 1) : 0,
    body = {
      x: -f * recoil * 0.8 + (hitDirection?.x ?? 0) * acceptedHit * 2,
      y: brace * 0.7 + (hitDirection?.y ?? 0.3) * acceptedHit,
    },
    angle = motion
      ? clamp(s.velocity.x * 0.012, -0.04, 0.04) + (hitDirection?.x ?? 0) * acceptedHit * 0.04
      : 0,
    moving = motion && !!h?.grounded && Math.abs(s.velocity.x) > 0.04 && !winding && !a?.returning,
    stride = moving ? Math.sin(s.position.x * 0.13) * Math.min(4, Math.abs(s.velocity.x) * 1.5) : 0,
    floor =
      h?.supportY === null || h?.supportY === undefined
        ? s.hull.y / 2 - 1
        : (h.supportY - s.position.y) / s.scale - 1,
    legs: MachineLeg[] = [];
  for (const side of [-1, 1]) {
    const planted = !!h?.grounded && (!moving || side * stride <= 0);
    legs.push({
      hip: { x: side * 10, y: 8 },
      knee: { x: side * 17, y: 18 },
      foot: {
        x: side * (18 + brace * 5) + side * stride,
        y: floor - (planted ? 0 : Math.abs(stride)),
      },
      planted,
    });
  }
  const shoulder = { x: -f * 8, y: 0 },
    tip = { ...muzzle },
    dx = tip.x - shoulder.x,
    dy = tip.y - shoulder.y,
    d = Math.max(1, Math.hypot(dx, dy)),
    elbow = {
      x: (shoulder.x + tip.x) / 2 - (dy / d) * 10,
      y: (shoulder.y + tip.y) / 2 + (dx / d) * 10,
    },
    heat =
      energy && w
        ? w.seams.some((s) => s.ignited)
          ? 1
          : s.state === 'windup' && w.attack !== 'arc'
            ? clamp(1 - s.timer / WELD_TELL, 0, 1)
            : recoil
        : 0,
    opening = energy && w && s.state === 'recover' ? clamp(s.timer / WELDER_OPENING, 0, 1) : 0,
    torch = { shoulder, elbow, tip, heat, opening },
    tracks =
      s.kind === 'welder'
        ? [-1, 1].map((side) => ({
            center: { x: side * 17, y: floor - 8 },
            phase: h?.grounded ? s.position.x * 0.13 : 0,
          }))
        : [],
    channels =
      s.kind === 'switchboard'
        ? Array.from({ length: 3 }, (_, slot) => {
            const p = b?.plans.find((p) => p.slot === slot),
              last = h?.discharges.filter((d) => d.slot === slot).at(-1),
              charge =
                p && !p.cut && !p.done
                  ? clamp(((b?.elapsed ?? 0) - p.delay) / SIGNAL.record, 0, 1)
                  : 0;
            return {
              slot,
              point: { x: -24 + slot * 24, y: -6 },
              charge,
              locked: !!p?.locked && !p.cut && !p.done,
              cut: !!p?.cut,
              release: motion ? decay(s.time, last?.at, 0.25) : 0,
              mobile: !!p?.mobile,
            };
          })
        : [],
    magazine =
      s.kind === 'auditor'
        ? Array.from({ length: 5 }, (_, index) => ({
            index,
            point: { x: -14 + index * 7, y: -20 },
            loaded: index < (a?.rounds ?? 0) && index >= (a?.fired ?? 0),
            selected: index === (a?.fired ?? 0) && index < (a?.rounds ?? 0),
          }))
        : [],
    caseLatch = { point: { x: -f * 19, y: 5 }, open: recall, recall },
    wear: 0 | 1 | 2 =
      s.hp <= 0 || s.hp / Math.max(1, s.maxHp) <= 0.3
        ? 2
        : s.hp / Math.max(1, s.maxHp) <= 0.65
          ? 1
          : 0,
    mode = a?.returning
      ? 'recall'
      : interruption > 0
        ? h!.interruptions.at(-1)!.kind
        : recoil > 0
          ? 'discharge'
          : deploy > 0
            ? 'deployment'
            : w
              ? `${w.attack}-${s.state}`
              : s.state;
  return {
    overseerMachine: true,
    kind: s.kind,
    energy,
    mode,
    recoil,
    barrel,
    gimbal,
    torch,
    tracks,
    channels,
    magazine,
    caseLatch,
    deploy,
    interruption,
    wear,
    forward: f,
    body,
    angle,
    brace,
    recover: s.state === 'recover',
    receiver: recoil * 3,
    rotor: 0,
    legs,
  };
}
