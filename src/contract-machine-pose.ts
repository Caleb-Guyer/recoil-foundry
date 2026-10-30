import type { Enemy, Game } from './game.ts';
import type { MachineBodySnapshot, MachinePose, MachineLeg } from './machine-breakdown-pose.ts';
import type { Prop } from './props.ts';
import { clamp, type Vec } from './rules.ts';

export type ContractMachineKind = 'cableweaver' | 'bulwark' | 'demolisher';
export const isContractMachineKind = (kind: string): kind is ContractMachineKind =>
  kind === 'cableweaver' || kind === 'bulwark' || kind === 'demolisher';
export interface ContractPropSnapshot {
  id: number;
  kind: 'anchor' | 'plate' | 'mine';
  position: Vec;
  angle: number;
  hp: number;
  maxHp: number;
  flash: number;
}
export interface ContractDischarge {
  at: number;
  angle: number;
  origin: Vec;
  muzzle: Vec;
}
export interface ContractDeployment {
  at: number;
  kind: 'anchors' | 'mine' | 'plates';
  points: Vec[];
}
export interface ContractInterruption {
  at: number;
  kind: 'cable-cut' | 'plate-break' | 'mine-disarm';
  position: Vec;
}
export interface ContractMachineEventState {
  discharges: ContractDischarge[];
  deployment: ContractDeployment | null;
  interruption: ContractInterruption | null;
}
export interface ContractMachineSnapshot extends ContractMachineEventState {
  grounded: boolean;
  supportY: number | null;
  arenaActive: boolean;
  supplies: number;
  armorClosed: boolean;
  hullHit: {
    at: number;
    healthLost: number;
    absorbed: number;
    blocked: boolean;
    direction: Vec | null;
  } | null;
  cables: {
    anchors: [ContractPropSnapshot, ContractPropSnapshot];
    liveAt: number;
    endsAt: number;
  }[];
  plates: ContractPropSnapshot[];
  mines: { prop: ContractPropSnapshot; explodesAt: number }[];
}
export interface ContractMachinePose extends MachinePose {
  contractMachine: true;
  kind: ContractMachineKind;
  energy: number;
  mode: string;
  recoil: number;
  barrel: { origin: Vec; angle: number; length: number; recoil: number };
  gimbal: { center: Vec; angle: number };
  drums: { center: Vec; radius: number; angle: number; tension: number; release: number }[];
  shield: { closed: boolean; extension: number; plates: ContractPropSnapshot[] };
  rack: { point: Vec; index: number; loaded: boolean; arming: number }[];
  mast: { base: Vec; tip: Vec };
  deploy: number;
  interruption: number;
}
const copy = (v: Vec): Vec => ({ x: v.x, y: v.y });
const propSnapshot = (p: Prop): ContractPropSnapshot => ({
  id: p.body.id,
  kind: p.hunt!,
  position: copy(p.body.position),
  angle: p.body.angle,
  hp: p.hp,
  maxHp: p.maxHp,
  flash: p.flash,
});
/** Detached native gear only. Drawing never advances the hunt or recreates a prop. */
export function contractMachineSnapshot(
  e: Enemy,
  g?: Game,
  grounded = false,
  supportY: number | null = null,
): ContractMachineSnapshot {
  const h = g?.hunts,
    active = !!g && h?.kind === e.kind,
    present = (p: Prop) => !!g?.props.items.includes(p),
    events = g?.machineBreakdown.getContractMachine(e),
    hit = g?.machineBreakdown.getHits(e.id).at(-1);
  return {
    grounded,
    supportY,
    arenaActive: active,
    supplies: active ? h!.supplies : 0,
    armorClosed: !!g && g.hunts.armor(e) < 1,
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
    cables: active
      ? h!.cables
          .filter((c) => c.anchors.every(present))
          .slice(0, 2)
          .map((c) => ({
            anchors: c.anchors.map(propSnapshot) as [ContractPropSnapshot, ContractPropSnapshot],
            liveAt: c.liveAt,
            endsAt: c.endsAt,
          }))
      : [],
    plates: active ? h!.plates.filter(present).slice(0, 2).map(propSnapshot) : [],
    mines: active
      ? h!.mines
          .filter((m) => present(m.prop))
          .slice(0, 2)
          .map((m) => ({ prop: propSnapshot(m.prop), explodesAt: m.explodesAt }))
      : [],
    discharges: events?.discharges ?? [],
    deployment: events?.deployment ?? null,
    interruption: events?.interruption ?? null,
  };
}
const decay = (time: number, at: number | undefined, duration: number) =>
  at === undefined || time < at ? 0 : Math.max(0, 1 - (time - at) / duration);
/** Coordinates are world-aligned and relative to the real hull center. */
export function contractMachinePose(s: MachineBodySnapshot, reduced = false): ContractMachinePose {
  if (!isContractMachineKind(s.kind)) throw Error('Expected a contract machine');
  const h = s.contractMachine,
    energy = s.hp > 0 ? 1 : 0,
    motion = !reduced && energy > 0 && s.spawn <= 0,
    f: -1 | 1 = s.facing < 0 ? -1 : 1,
    last = h?.discharges.at(-1),
    recoil = motion ? decay(s.time, last?.at, 0.22) ** 2 : 0,
    deploy = motion ? decay(s.time, h?.deployment?.at, 0.36) : 0,
    interruption = motion ? decay(s.time, h?.interruption?.at, 0.4) : 0,
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
    winding = s.state === 'windup',
    progress = winding ? clamp(1 - s.timer / 1.15, 0, 1) : 0,
    brace = winding ? (reduced ? 0.7 : 1) : 0,
    nativeAim = Math.atan2(s.aim.y, s.aim.x),
    recent = !!last && s.time - last.at >= 0 && s.time - last.at < 0.22,
    aim = recent ? last.angle : nativeAim,
    local = (p: Vec): Vec => ({
      x: (p.x - s.position.x) / s.scale,
      y: (p.y - s.position.y) / s.scale,
    }),
    center = recent ? local(last.origin) : { x: 0, y: s.kind === 'bulwark' ? -95 : -27 },
    muzzle = recent
      ? local(last.muzzle)
      : {
          x: center.x + (Math.cos(aim) * 26) / s.scale,
          y: center.y + (Math.sin(aim) * 26) / s.scale,
        },
    barrel = { origin: muzzle, angle: aim, length: 26, recoil },
    gimbal = { center, angle: aim },
    live = h?.cables.filter((c) => s.time >= c.liveAt && s.time < c.endsAt).length ?? 0,
    tension = Math.min(1, live / 2),
    moving = motion && !!h?.grounded && Math.abs(s.velocity.x) > 0.04 && !winding,
    stride = moving ? Math.sin(s.position.x * 0.12) * Math.min(4, Math.abs(s.velocity.x) * 1.8) : 0,
    floor =
      h?.supportY === null || h?.supportY === undefined
        ? 29
        : (h.supportY - s.position.y) / s.scale - 1,
    legs: MachineLeg[] = [];
  for (const side of [-1, 1]) {
    const planted = !!h?.grounded && (!moving || side * stride <= 0),
      foot = {
        x: side * (21 + brace * 5) + side * stride,
        y: floor - (planted ? 0 : Math.abs(stride)),
      };
    legs.push({ hip: { x: side * 13, y: 13 }, knee: { x: side * 22, y: 21 }, foot, planted });
  }
  const drums =
    s.kind === 'cableweaver'
      ? [-1, 1].map((side) => ({
          center: { x: side * 29, y: 4 },
          radius: 15,
          angle:
            (moving ? s.position.x * 0.045 : 0) +
            side * (progress * 0.7 + deploy * 0.9 - interruption * 0.7),
          tension,
          release: deploy,
        }))
      : [];
  const remaining = Math.max(0, 6 - (h?.supplies ?? 0)),
    rack =
      s.kind === 'demolisher'
        ? Array.from({ length: 6 }, (_, index) => ({
            point: { x: -20 + index * 8, y: -31 },
            index,
            loaded: index < remaining,
            arming: winding && s.attack === 'mortar' && index === remaining - 1 ? progress : 0,
          }))
        : [],
    extension = h?.armorClosed ? 1 : 0,
    shield = {
      closed: !!h?.armorClosed,
      extension,
      plates: h?.plates.map((p) => ({ ...p, position: copy(p.position) })) ?? [],
    },
    wear: 0 | 1 | 2 =
      s.hp <= 0 || s.hp / Math.max(1, s.maxHp) <= 0.3
        ? 2
        : s.hp / Math.max(1, s.maxHp) <= 0.65
          ? 1
          : 0,
    body = {
      x: -f * recoil * 0.7 + (hitDirection?.x ?? 0) * acceptedHit * 2,
      y: brace * 0.8 + interruption * 0.5 + (hitDirection?.y ?? 0.3) * acceptedHit,
    },
    angle = motion
      ? clamp(s.velocity.x * 0.012, -0.035, 0.035) -
        f * interruption * 0.035 +
        (hitDirection?.x ?? 0) * acceptedHit * 0.035
      : 0,
    mode =
      interruption > 0
        ? h!.interruption!.kind
        : recoil > 0
          ? 'discharge'
          : deploy > 0
            ? 'deployment'
            : winding
              ? s.attack === 'mortar'
                ? 'deploy-lock'
                : 'volley-lock'
              : s.state;
  return {
    contractMachine: true,
    kind: s.kind,
    energy,
    mode,
    recoil,
    barrel,
    gimbal,
    drums,
    shield,
    rack,
    mast: { base: { x: 0, y: -23 }, tip: { x: 0, y: s.kind === 'bulwark' ? -95 : -40 } },
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
