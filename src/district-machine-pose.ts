import type { Enemy, Game } from './game.ts';
import type { MachineBodySnapshot, MachinePose, MachineLeg } from './machine-breakdown-pose.ts';
import { coolingAngles, SKIMMER_TELL, COOLING_LOCK } from './cooling.ts';
import { squadGunOrigin } from './squads.ts';
import { clamp, distance, type Vec } from './rules.ts';

export type DistrictMachineKind = 'borer' | 'sifter' | 'skimmer';
export const isDistrictMachineKind = (kind: string): kind is DistrictMachineKind =>
  kind === 'borer' || kind === 'sifter' || kind === 'skimmer';
export interface DistrictMachineEventState {
  dischargeAt: number | null;
  dischargeAngles: number[];
  dischargeMuzzles: Vec[];
  recoveryEnteredAt: number | null;
}
export interface DistrictMachineSnapshot extends DistrictMachineEventState {
  grounded: boolean;
  supportY: number | null;
  cover: { id: number; position: Vec; velocity: Vec; hull: Vec } | null;
  braced: boolean;
  angles: number[];
  tell: number;
  lock: number;
  locked: boolean;
  muzzles: Vec[];
}
export interface DistrictMachinePose extends MachinePose {
  districtMachine: true;
  kind: DistrictMachineKind;
  mode: string;
  energy: number;
  tread: number;
  coverBrace: number;
  bank: number;
  recoil: number;
  vent: number;
  ports: { origin: Vec; angle: number; length: number; open: number; recoil: number }[];
  rotors: { center: Vec; radius: number; angle: number }[];
  fins: { base: Vec; tip: Vec }[];
  louvers: { from: Vec; to: Vec; open: number }[];
}
const copy = (v: Vec): Vec => ({ x: v.x, y: v.y });
const finite = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback);
const unit = (v: number) => clamp(finite(v), 0, 1);
export function districtNativeAngles(e: Enemy): number[] {
  if (!isDistrictMachineKind(e.kind) || e.elite === 'volatile') return [];
  const aim = Math.atan2(e.aim.y, e.aim.x);
  return e.kind === 'skimmer'
    ? coolingAngles(e).slice(0, 16)
    : [-1, 0, 1].map((i) => aim + i * (e.kind === 'sifter' ? 0.22 : 0.045));
}
/** Native cover eligibility projected without navigation, collision queries or any state mutation. */
export function districtMachineSnapshot(
  e: Enemy,
  g?: Game,
  grounded = false,
  supportY: number | null = null,
): DistrictMachineSnapshot {
  const p = e.body.position,
    cover =
      e.kind === 'borer'
        ? g?.props.items.find(
            (prop) =>
              prop.kind === 'crate' &&
              Math.abs(prop.body.position.y - p.y) < 55 &&
              distance(prop.body.position, p) < 170 &&
              (prop.body.position.x - p.x) * (g.player.position.x - p.x) > 0,
          )
        : undefined,
    angles = districtNativeAngles(e),
    origin = squadGunOrigin(e),
    events = g?.machineBreakdown.getDistrictMachine(e),
    tell = e.kind === 'skimmer' ? SKIMMER_TELL : 0.9,
    lock = e.kind === 'skimmer' ? COOLING_LOCK : 0.5;
  return {
    grounded,
    supportY,
    cover: cover
      ? {
          id: cover.body.id,
          position: copy(cover.body.position),
          velocity: copy(cover.body.velocity),
          hull: {
            x: cover.body.bounds.max.x - cover.body.bounds.min.x,
            y: cover.body.bounds.max.y - cover.body.bounds.min.y,
          },
        }
      : null,
    braced: !!cover && e.state === 'idle' && !!g && distance(g.player.position, p) < 700,
    angles,
    tell,
    lock,
    locked: e.state === 'windup' && e.timer <= lock,
    muzzles: angles.map((a) => ({
      x: origin.x + Math.cos(a) * 26,
      y: origin.y + Math.sin(a) * 26,
    })),
    dischargeAt: events?.dischargeAt ?? null,
    dischargeAngles: events?.dischargeAngles ?? [],
    dischargeMuzzles: events?.dischargeMuzzles ?? [],
    recoveryEnteredAt: events?.recoveryEnteredAt ?? null,
  };
}
/** Pure working rig with its barrel tips fixed to the native projectile muzzles. */
export function districtMachinePose(s: MachineBodySnapshot, reduced = false): DistrictMachinePose {
  if (!isDistrictMachineKind(s.kind)) throw Error('Expected a district machine');
  const d = s.districtMachine,
    f: -1 | 1 = s.facing < 0 ? -1 : 1,
    energy = s.hp > 0 ? 1 : 0,
    motion = !reduced && energy > 0 && s.spawn <= 0,
    firing = d?.dischargeAt !== null && d?.dischargeAt !== undefined,
    age = firing ? Math.max(0, s.time - d!.dischargeAt!) : Infinity,
    recoil = motion ? Math.max(0, 1 - age / 0.24) ** 2 : 0,
    warning = s.state === 'windup' && s.elite !== 'volatile',
    brace = warning ? (reduced ? 0.7 : unit(1 - s.timer / (d?.tell ?? 0.9))) : 0,
    coverBrace = d?.braced ? 1 : 0,
    wear: 0 | 1 | 2 =
      s.hp <= 0 || s.hp / Math.max(1, s.maxHp) <= 0.3
        ? 2
        : s.hp / Math.max(1, s.maxHp) <= 0.65
          ? 1
          : 0,
    flying = s.kind !== 'borer',
    bank = motion && flying ? clamp(finite(s.velocity.x) * 0.035, -0.14, 0.14) : 0,
    angle = flying
      ? bank
      : motion
        ? clamp(finite(s.velocity.x) * 0.012, -0.045, 0.045) - f * recoil * 0.035
        : 0,
    body = { x: -f * recoil * 0.8, y: warning ? brace * 0.6 : coverBrace * 0.6 },
    tread =
      motion && s.kind === 'borer' && !!d?.grounded && Math.abs(s.velocity.x) > 0.04
        ? s.position.x * 0.28
        : 0,
    fallback = Math.atan2(s.aim.y, s.aim.x),
    angles =
      d?.angles ??
      [-1, 0, 1].map(
        (i) => fallback + i * (s.kind === 'borer' ? 0.045 : s.kind === 'sifter' ? 0.22 : 0.11),
      ),
    local = (p: Vec): Vec => ({
      x: (p.x - s.position.x) / s.scale,
      y: (p.y - s.position.y) / s.scale,
    }),
    ports = angles.map((a, i) => {
      const accepted =
          d?.dischargeAngles.findIndex(
            (angle) => Math.abs(Math.atan2(Math.sin(angle - a), Math.cos(angle - a))) < 1e-7,
          ) ?? -1,
        discharged = accepted >= 0 && !!d?.dischargeMuzzles[accepted];
      return {
        origin: d?.muzzles[i] ? local(d.muzzles[i]) : { x: Math.cos(a) * 26, y: Math.sin(a) * 26 },
        angle: a,
        length: s.kind === 'borer' ? 24 : 13,
        open: warning ? brace : !reduced && discharged && firing && age < 0.24 ? 1 : 0,
        recoil: discharged ? recoil : 0,
      };
    }),
    rotors: DistrictMachinePose['rotors'] = [],
    fins: DistrictMachinePose['fins'] = [],
    louvers: DistrictMachinePose['louvers'] = [],
    legs: MachineLeg[] = [];
  if (s.kind === 'borer') {
    const floor =
      d?.supportY === null || d?.supportY === undefined
        ? 15
        : (d.supportY - s.position.y) / s.scale - 1;
    for (const side of [-1, 1])
      legs.push({
        hip: { x: side * 7, y: 5 },
        knee: { x: side * (10 + coverBrace), y: 11 },
        foot: { x: side * (12 + coverBrace * 2), y: floor },
        planted: !!d?.grounded,
      });
  } else if (s.kind === 'sifter') {
    for (const side of [-1, 1]) {
      rotors.push({
        center: { x: side * 14, y: -8 },
        radius: 7,
        angle: motion ? (s.time * 19 + s.id * 0.7) * side : 0,
      });
      fins.push({
        base: { x: side * 11, y: 5 },
        tip: { x: side * (21 + brace * 2), y: 15 + brace * 3 },
      });
    }
  } else {
    rotors.push({
      center: { x: 0, y: 0 },
      radius: 12,
      angle: motion ? -s.time * 15 - s.id * 0.7 : 0,
    });
    for (const side of [-1, 1])
      fins.push({ base: { x: side * 12, y: 7 }, tip: { x: side * 21, y: 12 + brace * 2 } });
    for (let i = -1; i <= 1; i++)
      louvers.push({
        from: { x: f * 12, y: i * 6 },
        to: { x: f * (17 + brace * 3), y: i * 6 + (1 - brace) * 3 },
        open: ports[i + 1]?.open ?? 0,
      });
  }
  const mode = warning
    ? d?.locked
      ? 'locked'
      : 'tracking'
    : recoil > 0
      ? 'discharge'
      : s.state === 'recover'
        ? 'recover'
        : coverBrace
          ? 'braced'
          : flying
            ? 'hover'
            : 'travel';
  return {
    districtMachine: true,
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
    rotor: rotors[0]?.angle ?? tread,
    legs,
    tread,
    coverBrace,
    bank,
    recoil,
    vent: warning ? brace : recoil,
    ports,
    rotors,
    fins,
    louvers,
  };
}
