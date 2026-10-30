import {
  isOverseerMachineKind,
  type OverseerMachineEventState,
  type OverseerDeployment,
  type OverseerInterruption,
} from './overseer-machine-pose.ts';
import {
  isContractMachineKind,
  type ContractMachineEventState,
  type ContractDeployment,
  type ContractInterruption,
} from './contract-machine-pose.ts';
import type { Enemy, Game } from './game.ts';
import { isSignalMachineKind, type SignalMachineEventState } from './signal-machine-pose.ts';
import { distance } from './rules.ts';
import { isSurfaceMachineKind, type SurfaceMachineEventState } from './surface-machine-pose.ts';
import { isDistrictMachineKind, type DistrictMachineEventState } from './district-machine-pose.ts';
import type { KillSource } from './commendations.ts';
import { firstSolid, sweepBox } from './collisions.ts';
import {
  machineBodySnapshot,
  isMachineKind,
  type MachineBodySnapshot,
  type MachineKind,
  type MachineSupportPulse,
  type MachineSupportTarget,
  machineSupportPartner,
  machineSupportTarget,
} from './machine-breakdown-pose.ts';
import type { Vec } from './rules.ts';
import { isPatrolMachine } from './patrol-machines.ts';
import type { MortarArc } from './patrol-machine-system.ts';
import { FABRICATOR_BUILD } from './fabricator.ts';
import { isHazardMachineKind, type HazardMachineEventState } from './hazard-machine-pose.ts';

export const MACHINE_HIT_LIFETIME = 0.24;
export const MACHINE_MAX_HITS_PER_ENEMY = 3;
export const MACHINE_MAX_HITS = 96;
export const MACHINE_SHUTDOWN = 0.38;
export const MACHINE_WRECK_LIFETIME = 2.4;
export const MACHINE_MAX_WRECKS = 12;
/** A short playable settling beat before the native hunt result/reward route. */
export const CONTRACT_SHUTDOWN_VIEW = 1;
export interface MachineSpecialistState {
  recovery: 'crash' | 'spent' | 'landing' | 'breech' | null;
  enteredAt: number | null;
}
export interface MachinePatrolState {
  recoveryEnteredAt: number | null;
  dischargeAt: number | null;
  releaseArcs: MortarArc[];
}
const specialistKind = (kind: string) =>
  kind === 'charger' || kind === 'hopper' || kind === 'sniper';
export interface MachineSupportState {
  pulse: MachineSupportPulse | null;
  dischargeAt: number | null;
  interruptedAt: number | null;
  buildProgress: number | null;
}
interface SupportObservation extends MachineSupportState {
  remaining?: number;
  partner: MachineSupportTarget | null;
  frame?: number;
  built?: number;
  state: Enemy['state'];
  attacks: number;
}
interface HazardObservation extends HazardMachineEventState {
  attacks: number;
  heldId: number | null;
  harpoonPhase: string | null;
  spoolAngle: number;
}
interface DistrictObservation extends DistrictMachineEventState {
  attacks: number;
  state: Enemy['state'];
}
interface DistrictRelease {
  at: number;
  attack: number;
  angles: number[];
  muzzles: Vec[];
}
interface SurfaceObservation extends SurfaceMachineEventState {
  attached: boolean;
  exposed: number;
  vulnerable: number;
}
interface SignalObservation extends SignalMachineEventState {
  phase: string;
  next: number;
  attacks: number;
  allied: boolean;
  origin: Vec | null;
}
export type MachineRemovalReason = 'owner-lost' | 'interrupted' | 'cleanup';
export interface MachineHit {
  id: number;
  enemyId: number;
  kind: MachineKind;
  at: number;
  incoming: number;
  applied: number;
  healthLost: number;
  absorbed: number;
  blocked: boolean;
  /** Actual body-local hull contact; absent when the native source has no direction. */
  contact: { local: Vec; normal: Vec } | null;
}
export interface MachineLanding {
  point: Vec;
  center: Vec;
  normal: Vec;
  bodyId: number;
  local: Vec;
  localCenter: Vec;
  localNormal: Vec;
  available: boolean;
}
export interface MachineWreck {
  /** Older authored fixtures may omit combat; all runtime records set it explicitly. */
  reason?: 'combat' | Exclude<MachineRemovalReason, 'cleanup'>;
  id: number;
  at: number;
  shutdown: number;
  lifetime: number;
  /** Pre-lethal native pose and identity, with no Enemy/Matter references. */
  visual: MachineBodySnapshot;
  landing: MachineLanding | null;
  hit: MachineHit | null;
}
const finite = (...values: number[]) => values.every(Number.isFinite);
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const rotate = (p: Vec, angle: number): Vec => ({
  x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
  y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
});
const local = (point: Vec, center: Vec, angle: number) =>
  rotate({ x: point.x - center.x, y: point.y - center.y }, -angle);
const world = (point: Vec, center: Vec, angle: number) => {
  const p = rotate(point, angle);
  return { x: p.x + center.x, y: p.y + center.y };
};
function cloneHit(hit: MachineHit): MachineHit {
  return {
    ...hit,
    contact: hit.contact
      ? { local: { ...hit.contact.local }, normal: { ...hit.contact.normal } }
      : null,
  };
}
function hullContact(e: Enemy, from?: Vec): MachineHit['contact'] {
  if (!from || !finite(from.x, from.y, e.body.position.x, e.body.position.y)) return null;
  const p = e.body.position,
    dx = from.x - p.x,
    dy = from.y - p.y,
    length = Math.hypot(dx, dy);
  if (length < 0.001) return null;
  // Extend the supplied native approach direction outside the actual convex hull.
  // This infers the struck face, never a weak point or an exposed-core bonus.
  const radius = Math.max(...e.body.vertices.map((v) => Math.hypot(v.x - p.x, v.y - p.y))) + 2;
  const start = { x: p.x + (dx / length) * radius, y: p.y + (dy / length) * radius };
  const hit = firstSolid(start, p, { x: 0, y: 0 }, [e.body]);
  if (!hit) return null;
  const point = { x: start.x + (p.x - start.x) * hit.t, y: start.y + (p.y - start.y) * hit.t };
  return { local: local(point, p, e.body.angle), normal: rotate(hit.normal, -e.body.angle) };
}
function edgeDistance(point: Vec, vertices: readonly Vec[]) {
  let distance = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length],
      dx = b.x - a.x,
      dy = b.y - a.y;
    const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    distance = Math.min(distance, Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t));
  }
  return distance;
}
/** A downward hull projection from the real actor, not an assumed world floor. */
export function machineLanding(g: Game, visual: MachineBodySnapshot): MachineLanding | null {
  const bodies = g.solidBodies.filter((b) => !b.isSensor && b.vertices.length > 2);
  if (!bodies.length) return null;
  const half = { x: visual.hull.x / 2, y: visual.hull.y / 2 };
  if (!finite(half.x, half.y, visual.position.x, visual.position.y) || half.x <= 0 || half.y <= 0)
    return null;
  const bottom = Math.max(...bodies.flatMap((b) => b.vertices.map((v) => v.y)));
  const to = {
    x: clamp(visual.position.x + visual.velocity.x * 7, half.x, g.worldWidth - half.x),
    y: Math.max(visual.position.y + 1, bottom + half.y + 2),
  };
  let nearest: { landing: MachineLanding; t: number } | null = null;
  for (const body of bodies) {
    const hit = sweepBox(visual.position, to, half, body);
    if (!hit || hit.normal.y > -0.45 || (nearest && hit.t >= nearest.t)) continue;
    const center = {
      x: visual.position.x + (to.x - visual.position.x) * hit.t,
      y: visual.position.y + (to.y - visual.position.y) * hit.t,
    };
    const point = {
      x: center.x - (Math.abs(hit.normal.x) < 0.001 ? 0 : Math.sign(hit.normal.x) * half.x),
      y: center.y - Math.sign(hit.normal.y) * half.y,
    };
    // Starting inside an expanded ceiling/wall cannot fabricate a support plane.
    if (point.y < visual.position.y + half.y - 6 || edgeDistance(point, body.vertices) > 5)
      continue;
    nearest = {
      t: hit.t,
      landing: {
        point,
        center,
        normal: { ...hit.normal },
        bodyId: body.id,
        local: local(point, body.position, body.angle),
        localCenter: local(center, body.position, body.angle),
        localNormal: rotate(hit.normal, -body.angle),
        available: true,
      },
    };
  }
  return nearest?.landing ?? null;
}
/** Cosmetic records only; native bodies, HP, AI, audio and rewards stay authoritative. */
export class MachineBreakdown {
  readonly game: Game;
  wrecks: MachineWreck[] = [];
  private hitsByEnemy = new Map<number, MachineHit[]>();
  private next = 0;
  private specialists = new Map<number, MachineSpecialistState & { state: Enemy['state'] }>();
  private patrols = new Map<number, MachinePatrolState & { state: Enemy['state'] }>();
  private supportMachines = new Map<number, SupportObservation>();
  private hazardMachines = new Map<number, HazardObservation>();
  private districtMachines = new Map<number, DistrictObservation>();
  private districtReleases = new Map<number, DistrictRelease>();
  private surfaceMachines = new Map<number, SurfaceObservation>();
  private signalMachines = new Map<number, SignalObservation>();
  private contractMachines = new Map<number, ContractMachineEventState>();
  private overseerMachines = new Map<number, OverseerMachineEventState>();
  constructor(game: Game) {
    this.game = game;
  }
  get contractShutdownActive() {
    return (
      this.game.hp > 0 &&
      this.wrecks.some(
        (w) =>
          w.reason === 'combat' &&
          isContractMachineKind(w.visual.kind) &&
          this.game.time - w.at >= 0 &&
          this.game.time - w.at < CONTRACT_SHUTDOWN_VIEW,
      )
    );
  }
  get overseerShutdownActive() {
    return (
      this.game.hp > 0 &&
      this.wrecks.some(
        (w) =>
          w.reason === 'combat' &&
          isOverseerMachineKind(w.visual.kind) &&
          this.game.time - w.at >= 0 &&
          this.game.time - w.at < CONTRACT_SHUTDOWN_VIEW,
      )
    );
  }
  get shutdownActive() {
    return this.contractShutdownActive || this.overseerShutdownActive;
  }
  get diagnostics() {
    return {
      hits: [...this.hitsByEnemy.values()].reduce((n, a) => n + a.length, 0),
      wrecks: this.wrecks.length,
    };
  }
  reset() {
    this.hitsByEnemy.clear();
    this.wrecks = [];
    this.next = 0;
    this.specialists.clear();
    this.patrols.clear();
    this.supportMachines.clear();
    this.hazardMachines.clear();
    this.districtMachines.clear();
    this.districtReleases.clear();
    this.surfaceMachines.clear();
    this.signalMachines.clear();
    this.contractMachines.clear();
    this.overseerMachines.clear();
  }
  /** Only observed native transition timers establish a recovery identity. */
  private observeSpecialist(e: Enemy) {
    if (!specialistKind(e.kind) || !finite(this.game.time, e.timer)) return;
    const old = this.specialists.get(e.id);
    let recovery: MachineSpecialistState['recovery'] = null,
      enteredAt: number | null = null;
    if (e.state === 'recover' && old?.state === 'recover') {
      recovery = old.recovery;
      enteredAt = old.enteredAt;
    } else if (e.state === 'recover' && old && old.state !== 'recover') {
      const exact = (value: number) => Math.abs(e.timer - value) < 1e-7;
      if (e.kind === 'charger') recovery = exact(1.1) ? 'crash' : exact(0.6) ? 'spent' : null;
      else if (e.kind === 'hopper' && exact(0.5)) recovery = 'landing';
      else if (e.kind === 'sniper' && (exact(1.65) || exact(1.9))) recovery = 'breech';
      if (recovery) enteredAt = this.game.time;
    }
    this.specialists.set(e.id, { state: e.state, recovery, enteredAt });
    while (this.specialists.size > MACHINE_MAX_HITS)
      this.specialists.delete(this.specialists.keys().next().value!);
  }
  getSpecialist(e: Enemy): MachineSpecialistState | null {
    if (!specialistKind(e.kind)) return null;
    const current = this.specialists.get(e.id);
    return current ? { recovery: current.recovery, enteredAt: current.enteredAt } : null;
  }
  /** Observes the real patrol cycle; never infers a launch from a drawing or late timer. */
  private observePatrol(e: Enemy) {
    if (!isPatrolMachine(e.kind) || !e.patrol || !finite(this.game.time, e.timer)) return;
    const old = this.patrols.get(e.id);
    let recoveryEnteredAt: number | null = null,
      dischargeAt =
        e.state === 'followup' || e.state === 'recover' ? (old?.dischargeAt ?? null) : null,
      releaseArcs: MortarArc[] = [];
    if (e.state === 'recover' && old?.state === 'recover') {
      recoveryEnteredAt = old.recoveryEnteredAt;
      releaseArcs = old.releaseArcs;
    } else if (e.state === 'recover' && old && old.state !== 'recover') {
      const duration = e.kind === 'mortar' ? 2.7 : e.patrol.variant === 'shutter-burst' ? 1.6 : 1.3;
      if (Math.abs(e.timer - duration) < 1e-7) {
        recoveryEnteredAt = this.game.time;
        if (e.kind === 'mortar')
          releaseArcs = this.game.patrolMachines.shells
            .filter((s) => s.owner === e.id)
            .slice(0, 2)
            .map((s) => structuredClone(s.arc));
        if (e.kind !== 'mortar' || releaseArcs.length > 0) dischargeAt = this.game.time;
      }
    }
    if (
      e.patrol.variant === 'shutter-burst' &&
      e.state === 'followup' &&
      old?.state === 'windup' &&
      Math.abs(e.timer - 0.95) < 1e-7
    )
      dischargeAt = this.game.time;
    this.patrols.set(e.id, { state: e.state, recoveryEnteredAt, dischargeAt, releaseArcs });
    while (this.patrols.size > MACHINE_MAX_HITS)
      this.patrols.delete(this.patrols.keys().next().value!);
  }
  getPatrol(e: Enemy): MachinePatrolState | null {
    if (!isPatrolMachine(e.kind)) return null;
    const current = this.patrols.get(e.id);
    return current
      ? {
          recoveryEnteredAt: current.recoveryEnteredAt,
          dischargeAt: current.dischargeAt,
          releaseArcs: structuredClone(current.releaseArcs),
        }
      : null;
  }
  private observeSupportMachine(e: Enemy) {
    if (
      !['repairer', 'relay', 'fabricator', 'sentry'].includes(e.kind) ||
      !finite(this.game.time, e.timer, e.attacks)
    )
      return;
    const old = this.supportMachines.get(e.id),
      g = this.game,
      rig = e.support,
      partner = rig ? machineSupportPartner(g, e) : null;
    let pulse = old?.pulse ?? null,
      dischargeAt = old?.dischargeAt ?? null,
      interruptedAt = old?.interruptedAt ?? null;
    if (
      rig &&
      old?.remaining !== undefined &&
      finite(rig.remaining, old.remaining) &&
      rig.remaining < old.remaining
    ) {
      const id = rig.target ?? old.partner?.id,
        actual = id === undefined ? undefined : g.enemies.find((other) => other.id === id);
      pulse = {
        at: g.time,
        amount: old.remaining - rig.remaining,
        target: actual
          ? machineSupportTarget(actual)
          : old.partner
            ? structuredClone(old.partner)
            : null,
      };
    }
    if (e.sentry) {
      if (
        e.state === 'recover' &&
        old &&
        e.attacks > old.attacks &&
        Math.abs(e.timer - 1.25) < 1e-7
      )
        dischargeAt = g.time;
      else if (e.state !== 'recover') dischargeAt = null;
    }
    if (e.fabricator) {
      if (
        old?.frame !== undefined &&
        e.fabricator.frame === undefined &&
        e.fabricator.built === old.built &&
        e.state === 'recover' &&
        Math.abs(e.timer - 1.3) < 1e-7
      )
        interruptedAt = g.time;
      else if (e.fabricator.frame !== undefined) interruptedAt = null;
    }
    const owner = e.sentry ? g.enemies.find((other) => other.id === e.sentry!.owner) : undefined,
      buildProgress = e.sentry
        ? e.sentry.ready
          ? 1
          : owner?.fabricator
            ? clamp(1 - owner.timer / FABRICATOR_BUILD, 0, 1)
            : (old?.buildProgress ?? 0)
        : null;
    this.supportMachines.set(e.id, {
      pulse,
      dischargeAt,
      interruptedAt,
      buildProgress,
      remaining: rig?.remaining,
      partner,
      frame: e.fabricator?.frame,
      built: e.fabricator?.built,
      state: e.state,
      attacks: e.attacks,
    });
    while (this.supportMachines.size > MACHINE_MAX_HITS)
      this.supportMachines.delete(this.supportMachines.keys().next().value!);
  }
  getSupportMachine(e: Enemy): MachineSupportState | null {
    const current = this.supportMachines.get(e.id);
    return current
      ? {
          pulse: current.pulse ? structuredClone(current.pulse) : null,
          dischargeAt: current.dischargeAt,
          interruptedAt: current.interruptedAt,
          buildProgress: current.buildProgress,
        }
      : null;
  }
  /** Native counters distinguish successful throws from cancelled/failed windups. */
  private observeHazardMachine(e: Enemy) {
    if (!isHazardMachineKind(e.kind) || !finite(this.game.time, e.attacks)) return;
    const old = this.hazardMachines.get(e.id),
      heldId = e.scrapper?.held?.body.id ?? null,
      harpoonPhase = e.harpoon?.phase ?? null;
    let releaseAt = old?.releaseAt ?? null,
      interruptedAt = old?.interruptedAt ?? null,
      breakSpoolAngle = old?.breakSpoolAngle ?? null;
    if (old && e.attacks > old.attacks) {
      releaseAt = this.game.time;
      interruptedAt = null;
      breakSpoolAngle = null;
    } else if (
      old &&
      ((old.heldId !== null && heldId === null) ||
        (old.harpoonPhase !== null && old.harpoonPhase !== 'ready' && harpoonPhase === 'ready'))
    ) {
      interruptedAt = this.game.time;
      if (e.harpoon) breakSpoolAngle = old.spoolAngle;
    }
    this.hazardMachines.set(e.id, {
      releaseAt,
      interruptedAt,
      attacks: e.attacks,
      heldId,
      harpoonPhase,
      spoolAngle:
        e.harpoon?.phase === 'flight'
          ? e.harpoon.travel * 0.08
          : e.harpoon?.phase === 'latched'
            ? e.harpoon.length * -0.08
            : (old?.spoolAngle ?? 0),
      breakSpoolAngle,
    });
    while (this.hazardMachines.size > MACHINE_MAX_HITS)
      this.hazardMachines.delete(this.hazardMachines.keys().next().value!);
  }
  getHazardMachine(e: Enemy): HazardMachineEventState | null {
    const current = this.hazardMachines.get(e.id);
    return current
      ? {
          releaseAt: current.releaseAt,
          interruptedAt: current.interruptedAt,
          breakSpoolAngle: current.breakSpoolAngle,
        }
      : null;
  }
  /** Called only for an admitted native projectile or its real close-cover impact. */
  districtDischarge(e: Enemy, angle: number, origin: Vec, muzzle: Vec) {
    if (
      !isDistrictMachineKind(e.kind) ||
      !this.eligible(e) ||
      !finite(angle, origin.x, origin.y, muzzle.x, muzzle.y, e.attacks)
    )
      return;
    if (!this.districtMachines.has(e.id))
      this.districtMachines.set(e.id, {
        attacks: e.attacks,
        state: e.state,
        dischargeAt: null,
        dischargeAngles: [],
        dischargeMuzzles: [],
        recoveryEnteredAt: null,
      });
    let release = this.districtReleases.get(e.id);
    if (!release || release.attack !== e.attacks || release.at !== this.game.time) {
      release = { attack: e.attacks, at: this.game.time, angles: [], muzzles: [] };
      this.districtReleases.set(e.id, release);
    }
    if (release.angles.length < 16) {
      release.angles.push(angle);
      release.muzzles.push({ ...muzzle });
    }
    while (this.districtReleases.size > MACHINE_MAX_HITS)
      this.districtReleases.delete(this.districtReleases.keys().next().value!);
    while (this.districtMachines.size > MACHINE_MAX_HITS)
      this.districtMachines.delete(this.districtMachines.keys().next().value!);
  }
  private observeDistrictMachine(e: Enemy) {
    if (!isDistrictMachineKind(e.kind) || !finite(this.game.time, e.attacks)) return;
    const old = this.districtMachines.get(e.id),
      release = this.districtReleases.get(e.id),
      fired =
        !!old &&
        e.attacks > old.attacks &&
        !!release &&
        release.attack < e.attacks &&
        release.at === this.game.time,
      attempted = !!old && e.attacks > old.attacks,
      recovering = e.state === 'recover';
    const dischargeAt = fired
        ? release!.at
        : attempted || !recovering
          ? null
          : (old?.dischargeAt ?? null),
      dischargeAngles = fired
        ? [...release!.angles]
        : dischargeAt !== null
          ? [...(old?.dischargeAngles ?? [])]
          : [],
      dischargeMuzzles = fired
        ? release!.muzzles.map((v) => ({ ...v }))
        : dischargeAt !== null
          ? (old?.dischargeMuzzles ?? []).map((v) => ({ ...v }))
          : [],
      recoveryEnteredAt = recovering
        ? old?.state === 'recover'
          ? old.recoveryEnteredAt
          : fired
            ? this.game.time
            : null
        : null;
    this.districtMachines.set(e.id, {
      attacks: e.attacks,
      state: e.state,
      dischargeAt,
      dischargeAngles,
      dischargeMuzzles,
      recoveryEnteredAt,
    });
    if (release && (fired || release.at < this.game.time)) this.districtReleases.delete(e.id);
    while (this.districtMachines.size > MACHINE_MAX_HITS)
      this.districtMachines.delete(this.districtMachines.keys().next().value!);
  }
  getDistrictMachine(e: Enemy): DistrictMachineEventState | null {
    const current = this.districtMachines.get(e.id);
    return current
      ? {
          dischargeAt: current.dischargeAt,
          dischargeAngles: [...current.dischargeAngles],
          dischargeMuzzles: current.dischargeMuzzles.map((v) => ({ ...v })),
          recoveryEnteredAt: current.recoveryEnteredAt,
        }
      : null;
  }
  /** The native projectile-admission/impact path is the only source of recoil events. */
  surfaceDischarge(e: Enemy, angle: number, origin: Vec, muzzle: Vec, index = 0) {
    if (
      !isSurfaceMachineKind(e.kind) ||
      !this.eligible(e) ||
      !finite(angle, origin.x, origin.y, muzzle.x, muzzle.y, index)
    )
      return;
    this.observeSurfaceMachine(e);
    const current = this.surfaceMachines.get(e.id)!;
    current.discharges.push({
      at: this.game.time,
      angle,
      muzzle: { ...muzzle },
      origin: { ...origin },
      index: clamp(Math.trunc(index), 0, 2),
    });
    if (current.discharges.length > 3) current.discharges.splice(0, current.discharges.length - 3);
  }
  private observeSurfaceMachine(e: Enemy) {
    if (!isSurfaceMachineKind(e.kind) || !finite(this.game.time)) return;
    const old = this.surfaceMachines.get(e.id),
      attached = !!e.crawler?.support,
      exposed = e.angler?.exposed ?? 0,
      vulnerable = e.crawler?.vulnerable ?? 0;
    const drop =
        !!e.crawler && ((old?.attached && !attached) || vulnerable > (old?.vulnerable ?? 0) + 1e-7),
      interrupted = !!e.angler && exposed > (old?.exposed ?? 0) + 1e-7;
    this.surfaceMachines.set(e.id, {
      attached,
      exposed,
      vulnerable,
      discharges: (old?.discharges ?? [])
        .filter((d) => this.game.time - d.at >= 0 && this.game.time - d.at < 0.65)
        .map((d) => ({ ...d, muzzle: { ...d.muzzle }, origin: { ...d.origin } })),
      dropAt: drop ? this.game.time : attached ? null : (old?.dropAt ?? null),
      interruptedAt: interrupted ? this.game.time : (old?.interruptedAt ?? null),
    });
    while (this.surfaceMachines.size > MACHINE_MAX_HITS)
      this.surfaceMachines.delete(this.surfaceMachines.keys().next().value!);
  }
  getSurfaceMachine(e: Enemy): SurfaceMachineEventState | null {
    const current = this.surfaceMachines.get(e.id);
    return current
      ? {
          discharges: current.discharges.map((d) => ({
            ...d,
            muzzle: { ...d.muzzle },
            origin: { ...d.origin },
          })),
          dropAt: current.dropAt,
          interruptedAt: current.interruptedAt,
        }
      : null;
  }
  /** Only the native admitted projectile or actual muzzle impact records a discharge. */
  signalDischarge(e: Enemy, angle: number, origin: Vec, muzzle: Vec) {
    if (
      !isSignalMachineKind(e.kind) ||
      !this.eligible(e) ||
      !finite(angle, origin.x, origin.y, muzzle.x, muzzle.y)
    )
      return;
    this.observeSignalMachine(e);
    const port = this.game.annex.port,
      t = this.game.annex.transmission,
      remote =
        e.kind === 'switchman' &&
        t?.owner === e &&
        origin !== e.body.position &&
        distance(origin, port) < 1e-7,
      current = this.signalMachines.get(e.id)!;
    const angle0 = t ? Math.atan2(t.aim.y, t.aim.x) : angle,
      index = remote
        ? Math.round((angle - angle0) / 0.12) + 1
        : e.kind === 'caller'
          ? (e.caller?.next ?? 0)
          : 0;
    current.discharges.push({
      at: this.game.time,
      source: remote ? 'port' : 'body',
      angle,
      origin: { ...origin },
      muzzle: { ...muzzle },
      index: clamp(index, 0, 2),
    });
    if (current.discharges.length > 6) current.discharges.splice(0, current.discharges.length - 6);
  }
  private observeSignalMachine(e: Enemy, healthLost?: number) {
    if (!isSignalMachineKind(e.kind) || !finite(this.game.time)) return;
    const g = this.game,
      old = this.signalMachines.get(e.id),
      r = e.caller,
      phase = r?.phase ?? 'ready',
      next = r?.next ?? 0,
      complete = !!old && old.next === 2 && e.attacks > old.attacks,
      cancelled = !!old && old.phase !== 'ready' && phase === 'ready' && !complete,
      t = g.annex.transmission,
      actualFeedback =
        e.kind === 'switchman' &&
        t?.owner === e &&
        t.interrupted &&
        g.annex.interruptedAt === g.time &&
        healthLost !== undefined,
      feedback =
        actualFeedback && old?.feedback?.at !== g.annex.interruptedAt
          ? {
              at: g.annex.interruptedAt,
              healthLost: Math.max(0, healthLost!),
              from: { ...g.annex.junction },
            }
          : (old?.feedback ?? null);
    this.signalMachines.set(e.id, {
      phase,
      next,
      attacks: e.attacks,
      allied: !!e.allied,
      origin: r?.origin ? { ...r.origin } : null,
      discharges: (old?.discharges ?? [])
        .filter((d) => g.time - d.at >= 0 && g.time - d.at < 0.7)
        .map((d) => ({ ...d, origin: { ...d.origin }, muzzle: { ...d.muzzle } })),
      cancellation: cancelled
        ? {
            at: g.time,
            reason:
              old!.allied !== !!e.allied
                ? 'faction-changed'
                : old!.origin && distance(old!.origin, e.body.position) > 40
                  ? 'displaced'
                  : 'target-lost',
          }
        : (old?.cancellation ?? null),
      feedback,
    });
    while (this.signalMachines.size > MACHINE_MAX_HITS)
      this.signalMachines.delete(this.signalMachines.keys().next().value!);
  }
  getSignalMachine(e: Enemy): SignalMachineEventState | null {
    const current = this.signalMachines.get(e.id);
    return current
      ? {
          discharges: current.discharges.map((d) => ({
            ...d,
            origin: { ...d.origin },
            muzzle: { ...d.muzzle },
          })),
          cancellation: current.cancellation ? { ...current.cancellation } : null,
          feedback: current.feedback
            ? { ...current.feedback, from: { ...current.feedback.from } }
            : null,
        }
      : null;
  }
  private observeContractMachine(e: Enemy) {
    if (!isContractMachineKind(e.kind) || !finite(this.game.time)) return;
    const old = this.contractMachines.get(e.id);
    this.contractMachines.set(e.id, {
      discharges: (old?.discharges ?? []).filter(
        (d) => this.game.time - d.at >= 0 && this.game.time - d.at < 0.75,
      ),
      deployment:
        old?.deployment &&
        this.game.time - old.deployment.at >= 0 &&
        this.game.time - old.deployment.at < 0.75
          ? old.deployment
          : null,
      interruption:
        old?.interruption &&
        this.game.time - old.interruption.at >= 0 &&
        this.game.time - old.interruption.at < 0.75
          ? old.interruption
          : null,
    });
    while (this.contractMachines.size > MACHINE_MAX_HITS)
      this.contractMachines.delete(this.contractMachines.keys().next().value!);
  }
  /** Only admitted native shots and real close-muzzle impacts may cycle a hunt receiver. */
  contractDischarge(e: Enemy, angle: number, origin: Vec, muzzle: Vec) {
    if (
      !isContractMachineKind(e.kind) ||
      !this.eligible(e) ||
      !finite(angle, origin.x, origin.y, muzzle.x, muzzle.y)
    )
      return;
    this.observeContractMachine(e);
    const current = this.contractMachines.get(e.id)!;
    current.discharges.push({
      at: this.game.time,
      angle,
      origin: { ...origin },
      muzzle: { ...muzzle },
    });
    if (current.discharges.length > 6) current.discharges.splice(0, current.discharges.length - 6);
  }
  /** Actual successful native prop placement; no animation-side prediction or spawn. */
  contractDeployment(e: Enemy, kind: ContractDeployment['kind'], points: readonly Vec[]) {
    if (
      !isContractMachineKind(e.kind) ||
      !this.eligible(e) ||
      !points.length ||
      !points.every((p) => finite(p.x, p.y))
    )
      return;
    this.observeContractMachine(e);
    this.contractMachines.get(e.id)!.deployment = {
      at: this.game.time,
      kind,
      points: points.slice(0, 2).map((p) => ({ ...p })),
    };
  }
  /** A player actually destroyed a native hunt anchor, plate or mine. */
  contractInterruption(e: Enemy, kind: ContractInterruption['kind'], position: Vec) {
    if (!isContractMachineKind(e.kind) || !this.eligible(e) || !finite(position.x, position.y))
      return;
    this.observeContractMachine(e);
    this.contractMachines.get(e.id)!.interruption = {
      at: this.game.time,
      kind,
      position: { ...position },
    };
  }
  getContractMachine(e: Enemy): ContractMachineEventState | null {
    const current = this.contractMachines.get(e.id);
    return current ? structuredClone(current) : null;
  }
  private observeOverseerMachine(e: Enemy, healthLost?: number) {
    if (!isOverseerMachineKind(e.kind) || !finite(this.game.time)) return;
    const old = this.overseerMachines.get(e.id),
      current: OverseerMachineEventState = {
        discharges: (old?.discharges ?? []).filter(
          (d) => this.game.time - d.at >= 0 && this.game.time - d.at < 0.8,
        ),
        deployments: (old?.deployments ?? []).filter(
          (d) => this.game.time - d.at >= 0 && this.game.time - d.at < 0.8,
        ),
        interruptions: (old?.interruptions ?? []).filter(
          (d) => this.game.time - d.at >= 0 && this.game.time - d.at < 0.8,
        ),
      };
    const cut = current.interruptions.at(-1);
    if (
      e.kind === 'switchboard' &&
      cut?.kind === 'junction-cut' &&
      cut.at === this.game.time &&
      cut.healthLost === undefined &&
      healthLost !== undefined
    )
      cut.healthLost = Math.max(0, healthLost);
    this.overseerMachines.set(e.id, current);
    while (this.overseerMachines.size > MACHINE_MAX_HITS)
      this.overseerMachines.delete(this.overseerMachines.keys().next().value!);
  }
  /** Actual admitted native rounds or native close-muzzle impacts, never attempt counters. */
  overseerDischarge(e: Enemy, angle: number, origin: Vec, muzzle: Vec) {
    if (
      !isOverseerMachineKind(e.kind) ||
      !this.eligible(e) ||
      !finite(angle, origin.x, origin.y, muzzle.x, muzzle.y)
    )
      return;
    this.observeOverseerMachine(e);
    const plan = e.switchboard?.plans.find(
        (p) =>
          !p.cut &&
          !p.done &&
          distance(p.origin, origin) < 1e-6 &&
          Math.abs((p.angles[p.sent] ?? Infinity) - angle) < 1e-6,
      ),
      current = this.overseerMachines.get(e.id)!;
    current.discharges.push({
      at: this.game.time,
      source: plan && !plan.mobile ? 'port' : 'body',
      slot: plan?.slot ?? null,
      index: plan?.sent ?? e.auditor?.fired ?? 0,
      angle,
      origin: { ...origin },
      muzzle: { ...muzzle },
    });
    if (current.discharges.length > 12)
      current.discharges.splice(0, current.discharges.length - 12);
  }
  /** Native accepted seam/cover placement or actual ignition. */
  overseerDeployment(e: Enemy, kind: OverseerDeployment['kind'], points: readonly Vec[]) {
    if (
      !isOverseerMachineKind(e.kind) ||
      !this.eligible(e) ||
      !points.length ||
      !points.every((p) => finite(p.x, p.y))
    )
      return;
    this.observeOverseerMachine(e);
    const list = this.overseerMachines.get(e.id)!.deployments;
    list.push({ at: this.game.time, kind, points: points.slice(0, 6).map((p) => ({ ...p })) });
    if (list.length > 6) list.splice(0, list.length - 6);
  }
  /** Native broken cover or an actually accepted junction interrupt. */
  overseerInterruption(e: Enemy, kind: OverseerInterruption['kind'], position: Vec) {
    if (!isOverseerMachineKind(e.kind) || !this.eligible(e) || !finite(position.x, position.y))
      return;
    this.observeOverseerMachine(e);
    const list = this.overseerMachines.get(e.id)!.interruptions;
    list.push({ at: this.game.time, kind, position: { ...position } });
    if (list.length > 6) list.splice(0, list.length - 6);
  }
  getOverseerMachine(e: Enemy): OverseerMachineEventState | null {
    const current = this.overseerMachines.get(e.id);
    return current ? structuredClone(current) : null;
  }
  /** Recall is a native noncombat departure, never a death, corpse or completion hold. */
  overseerRecalled(e: Enemy) {
    if (e.kind !== 'auditor') return;
    this.overseerMachines.delete(e.id);
    this.hitsByEnemy.delete(e.id);
  }
  /** Native noncombat removals remain non-scoring; only their detached presentation is recorded. */
  removed(e: Enemy, reason: MachineRemovalReason, actualOwner?: Enemy) {
    if (
      reason === 'cleanup' ||
      !e.sentry ||
      e.hp <= 0 ||
      !this.eligible(e) ||
      this.wrecks.some((w) => w.visual.id === e.id)
    )
      return;
    this.observeSupportMachine(e);
    const visual = machineBodySnapshot(e, this.game.time, this.game, actualOwner);
    if (!visual) return;
    this.wrecks.push({
      reason,
      id: ++this.next,
      at: this.game.time,
      shutdown: MACHINE_SHUTDOWN,
      lifetime: MACHINE_WRECK_LIFETIME,
      visual,
      landing: machineLanding(this.game, visual),
      hit: null,
    });
    if (this.wrecks.length > MACHINE_MAX_WRECKS)
      this.wrecks.splice(0, this.wrecks.length - MACHINE_MAX_WRECKS);
    this.hitsByEnemy.delete(e.id);
    this.supportMachines.delete(e.id);
  }
  private eligible(e: Enemy, source?: KillSource) {
    const g = this.game;
    return (
      source !== 'cleanup' &&
      g.mode === 'playing' &&
      g.hp > 0 &&
      !g.workshop.active &&
      !g.finale.cinema?.active &&
      !e.workshopTarget &&
      e.recoilTarget === undefined &&
      !e.courier &&
      e.eventRole !== 'relay' &&
      e.spawn <= 0 &&
      isMachineKind(e.kind) &&
      finite(
        g.time,
        e.body.position.x,
        e.body.position.y,
        e.body.velocity.x,
        e.body.velocity.y,
        e.hp,
        e.maxHp,
      )
    );
  }
  /** Called before native HP subtraction, committed only if the real kill proceeds. */
  beforeHit(e: Enemy, applied: number, source?: KillSource): MachineBodySnapshot | null {
    if (
      !this.eligible(e, source) ||
      !finite(applied) ||
      applied <= 0 ||
      e.hp <= 0 ||
      applied < e.hp
    )
      return null;
    this.observeSpecialist(e);
    this.observePatrol(e);
    this.observeSupportMachine(e);
    this.observeHazardMachine(e);
    this.observeDistrictMachine(e);
    this.observeSurfaceMachine(e);
    this.observeSignalMachine(e, Math.min(e.hp, applied));
    this.observeContractMachine(e);
    this.observeOverseerMachine(e, Math.min(e.hp, applied));
    return machineBodySnapshot(e, this.game.time, this.game);
  }
  hit(
    e: Enemy,
    incoming: number,
    applied: number,
    healthLost: number,
    blocked: boolean,
    from?: Vec,
    source?: KillSource,
  ) {
    if (
      !this.eligible(e, source) ||
      !finite(incoming, applied, healthLost) ||
      incoming <= 0 ||
      applied < 0 ||
      healthLost < 0
    )
      return;
    this.observeSpecialist(e);
    this.observePatrol(e);
    this.observeSupportMachine(e);
    this.observeHazardMachine(e);
    this.observeDistrictMachine(e);
    this.observeSurfaceMachine(e);
    this.observeSignalMachine(e, healthLost);
    this.observeContractMachine(e);
    this.observeOverseerMachine(e, healthLost);
    const hit: MachineHit = {
      id: ++this.next,
      enemyId: e.id,
      kind: e.kind as MachineKind,
      at: this.game.time,
      incoming,
      applied,
      healthLost,
      absorbed: Math.max(0, incoming - applied),
      blocked,
      contact: hullContact(e, from),
    };
    const list = this.hitsByEnemy.get(e.id) ?? [];
    list.push(hit);
    if (list.length > MACHINE_MAX_HITS_PER_ENEMY)
      list.splice(0, list.length - MACHINE_MAX_HITS_PER_ENEMY);
    this.hitsByEnemy.set(e.id, list);
    while (this.diagnostics.hits > MACHINE_MAX_HITS) {
      let oldestId: number | undefined,
        oldest = Infinity;
      for (const [id, hits] of this.hitsByEnemy)
        if (hits[0].id < oldest) {
          oldest = hits[0].id;
          oldestId = id;
        }
      const items = this.hitsByEnemy.get(oldestId!)!;
      items.shift();
      if (!items.length) this.hitsByEnemy.delete(oldestId!);
    }
  }
  getHits(enemyId: number): readonly MachineHit[] {
    return (this.hitsByEnemy.get(enemyId) ?? [])
      .filter((h) => this.game.time - h.at >= 0 && this.game.time - h.at < MACHINE_HIT_LIFETIME)
      .map(cloneHit);
  }
  defeated(e: Enemy, visual: MachineBodySnapshot | null, source?: KillSource) {
    if (
      !visual ||
      e.hp > 0 ||
      !this.eligible(e, source) ||
      this.wrecks.some((w) => w.visual.id === e.id)
    )
      return;
    const hits = this.hitsByEnemy.get(e.id),
      last = hits?.at(-1);
    this.wrecks.push({
      reason: 'combat',
      id: ++this.next,
      at: this.game.time,
      shutdown: MACHINE_SHUTDOWN,
      lifetime: MACHINE_WRECK_LIFETIME,
      visual: structuredClone(visual),
      landing: machineLanding(this.game, visual),
      hit: last ? cloneHit(last) : null,
    });
    if (this.wrecks.length > MACHINE_MAX_WRECKS)
      this.wrecks.splice(0, this.wrecks.length - MACHINE_MAX_WRECKS);
    this.hitsByEnemy.delete(e.id);
    this.specialists.delete(e.id);
    this.patrols.delete(e.id);
    this.supportMachines.delete(e.id);
    this.hazardMachines.delete(e.id);
    this.districtMachines.delete(e.id);
    this.districtReleases.delete(e.id);
    this.surfaceMachines.delete(e.id);
    this.signalMachines.delete(e.id);
    this.contractMachines.delete(e.id);
    this.overseerMachines.delete(e.id);
  }
  update() {
    const g = this.game;
    if (g.mode !== 'playing') return;
    if (!Number.isFinite(g.time)) {
      this.reset();
      return;
    }
    const alive = new Set(
      [...g.enemies, ...g.factions.allies].filter((e) => e.hp > 0).map((e) => e.id),
    );
    for (const e of [...g.enemies, ...g.factions.allies])
      if (e.hp > 0) {
        this.observeSpecialist(e);
        this.observePatrol(e);
        this.observeSupportMachine(e);
        this.observeHazardMachine(e);
        this.observeDistrictMachine(e);
        this.observeSurfaceMachine(e);
        this.observeSignalMachine(e);
        this.observeContractMachine(e);
        this.observeOverseerMachine(e);
      }
    for (const id of this.specialists.keys()) if (!alive.has(id)) this.specialists.delete(id);
    for (const id of this.patrols.keys()) if (!alive.has(id)) this.patrols.delete(id);
    for (const id of this.supportMachines.keys())
      if (!alive.has(id)) this.supportMachines.delete(id);
    for (const id of this.hazardMachines.keys()) if (!alive.has(id)) this.hazardMachines.delete(id);
    for (const id of this.districtMachines.keys())
      if (!alive.has(id)) this.districtMachines.delete(id);
    for (const id of this.signalMachines.keys()) if (!alive.has(id)) this.signalMachines.delete(id);
    for (const id of this.contractMachines.keys())
      if (!alive.has(id)) this.contractMachines.delete(id);
    for (const id of this.overseerMachines.keys())
      if (!alive.has(id)) this.overseerMachines.delete(id);
    for (const id of this.surfaceMachines.keys())
      if (!alive.has(id)) this.surfaceMachines.delete(id);
    for (const [id, release] of this.districtReleases)
      if (!alive.has(id) || release.at < g.time) this.districtReleases.delete(id);
    for (const [id, hits] of this.hitsByEnemy) {
      const kept = hits.filter((h) => g.time - h.at >= 0 && g.time - h.at < MACHINE_HIT_LIFETIME);
      if (!alive.has(id) || !kept.length) this.hitsByEnemy.delete(id);
      else this.hitsByEnemy.set(id, kept);
    }
    this.wrecks = this.wrecks.filter((w) => g.time - w.at >= 0 && g.time - w.at < w.lifetime);
    if (!this.wrecks.some((w) => w.landing?.available)) return;
    const bodies = new Map(g.solidBodies.map((b) => [b.id, b]));
    for (const wreck of this.wrecks) {
      const landing = wreck.landing;
      if (!landing?.available) continue;
      const body = bodies.get(landing.bodyId);
      if (!body || body.isSensor) {
        landing.available = false;
        wreck.lifetime = Math.min(wreck.lifetime, g.time - wreck.at + 0.16);
        continue;
      }
      landing.point = world(landing.local, body.position, body.angle);
      landing.center = world(landing.localCenter, body.position, body.angle);
      landing.normal = rotate(landing.localNormal, body.angle);
    }
  }
}
