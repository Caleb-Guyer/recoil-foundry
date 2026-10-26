import Matter from 'matter-js';
import type { Game, Input, Shot } from './game.ts';
import type { Level } from './levels.ts';
import { clamp, distance, seeded, type Vec } from './rules.ts';
import { AREAS } from './areas.ts';
import { redirectVector } from './vector-rounds.ts';
import { markShot } from './weapon-mastery.ts';
import { shiftCampaign } from './shift-catalog.ts';
import {
  captureRework,
  shiftRouteLayout,
  SHIFT_ROUTE_IDS,
  type ShiftRouteId,
  type ShiftRouteLayout,
  type ReworkSnapshot,
} from './shift-route-layouts.ts';
export {
  SHIFT_ROUTE_IDS,
  SHIFT_ROUTE_NAMES,
  type ShiftRouteId,
  type ReworkSnapshot,
} from './shift-route-layouts.ts';
const { Body, Composite, Query } = Matter;
export interface ShiftRouteSave {
  version: 1;
  kind: ShiftRouteId;
  stage: number;
  turns?: number[];
  mirrors?: number[];
  gates?: number;
  rush?: number;
  rework?: ReworkSnapshot;
}
const plain = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const bounded = (n: unknown, min: number, max: number) =>
  typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k));
export function validReworkSnapshot(raw: unknown): raw is ReworkSnapshot {
  if (
    !plain(raw) ||
    !keys(raw, ['version', 'source', 'name', 'area', 'solids', 'props', 'scars']) ||
    raw.version !== 1 ||
    typeof raw.source !== 'string' ||
    !raw.source.length ||
    raw.source.length > 80 ||
    typeof raw.name !== 'string' ||
    raw.name.length > 80 ||
    typeof raw.area !== 'string' ||
    !Object.hasOwn(AREAS, raw.area) ||
    !Array.isArray(raw.solids) ||
    raw.solids.length > 36 ||
    !Array.isArray(raw.props) ||
    raw.props.length > 12 ||
    !Array.isArray(raw.scars) ||
    raw.scars.length > 12
  )
    return false;
  return (
    raw.solids.every(
      (s) =>
        plain(s) &&
        keys(s, ['x', 'y', 'w', 'h']) &&
        bounded(s.x, 0, 2000) &&
        bounded(s.y, 0, 740) &&
        bounded(s.w, 1, 2000) &&
        bounded(s.h, 1, 740) &&
        Number(s.x) + Number(s.w) <= 2000.02 &&
        Number(s.y) + Number(s.h) <= 740.02,
    ) &&
    raw.props.every(
      (p) =>
        plain(p) &&
        keys(p, ['kind', 'x', 'y', 'hp']) &&
        ['crate', 'cover', 'canister'].includes(String(p.kind)) &&
        bounded(p.x, 180, 1820) &&
        bounded(p.y, 0, 740) &&
        (p.hp === undefined || bounded(p.hp, 1, 400)),
    ) &&
    raw.scars.every(
      (p) => plain(p) && keys(p, ['x', 'y']) && bounded(p.x, 0, 2000) && bounded(p.y, 0, 740.02),
    )
  );
}
export function validShiftRouteSave(raw: unknown): raw is ShiftRouteSave {
  if (
    !plain(raw) ||
    !keys(raw, ['version', 'kind', 'stage', 'turns', 'mirrors', 'gates', 'rush', 'rework']) ||
    raw.version !== 1 ||
    !(SHIFT_ROUTE_IDS as readonly unknown[]).includes(raw.kind) ||
    !Number.isInteger(raw.stage) ||
    !bounded(raw.stage, 4, 18)
  )
    return false;
  const quarters = (v: unknown, n: number) =>
    Array.isArray(v) && v.length === n && v.every((i) => Number.isInteger(i) && bounded(i, 0, 3));
  return (
    (raw.kind === 'turntable-works' ? quarters(raw.turns, 2) : raw.turns === undefined) &&
    (raw.kind === 'prism-glassworks' ? quarters(raw.mirrors, 3) : raw.mirrors === undefined) &&
    (raw.kind === 'express-airlocks'
      ? Number.isInteger(raw.gates) &&
        bounded(raw.gates, 0, 2) &&
        Number.isInteger(raw.rush) &&
        bounded(raw.rush, 0, Number(raw.gates))
      : raw.gates === undefined && raw.rush === undefined) &&
    (raw.kind === 'rework-loop' ? validReworkSnapshot(raw.rework) : raw.rework === undefined)
  );
}
export function planShiftRoute(seed: string, stage: number, rework = false): ShiftRouteId[] {
  if (!Number.isInteger(stage) || stage < 4 || stage > 18) return [];
  const choices = SHIFT_ROUTE_IDS.filter((id) => id !== 'rework-loop' || rework);
  const rng = seeded(seed + ':shift-routes:' + stage);
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices.slice(0, 2);
}
interface Mechanism {
  body: Matter.Body;
  console: Vec;
  target: number;
  index: number;
}
export class ShiftRoutes {
  readonly game: Game;
  state: ShiftRouteSave | null = null;
  lastRework: ReworkSnapshot | null = null;
  rotors: Mechanism[] = [];
  mirrors: Mechanism[] = [];
  gates: { body: Matter.Body; console: Vec; chamberEnd: number }[] = [];
  private shotBanks = new WeakMap<Shot, number>();
  private roomClear = false;
  constructor(g: Game) {
    this.game = g;
  }
  get enabled() {
    const g = this.game;
    return (
      shiftCampaign(g.seed) &&
      !/^RF-D/.test(g.seed) &&
      !g.practice &&
      !g.workshop.active &&
      !g.overtime
    );
  }
  start(save?: { shiftRoute?: ShiftRouteSave; shiftRework?: ReworkSnapshot }) {
    this.state =
      this.enabled && validShiftRouteSave(save?.shiftRoute)
        ? structuredClone(save!.shiftRoute!)
        : null;
    this.lastRework =
      this.enabled && validReworkSnapshot(save?.shiftRework)
        ? structuredClone(save!.shiftRework!)
        : null;
    this.rotors = [];
    this.mirrors = [];
    this.gates = [];
  }
  get active() {
    return (
      this.enabled &&
      !!this.state &&
      this.state.stage === this.game.stage &&
      this.game.level.id === 'shift-' + this.state.kind
    );
  }
  get kind() {
    return this.active ? this.state!.kind : null;
  }
  get layout() {
    return this.game.level as ShiftRouteLayout;
  }
  get pending() {
    return this.active && this.kind === 'express-airlocks' && (this.state!.gates ?? 0) < 2;
  }
  get bonus() {
    return this.kind === 'express-airlocks'
      ? (this.state!.rush ?? 0)
      : this.kind === 'rework-loop'
        ? 1
        : 0;
  }
  snapshot() {
    return this.enabled && this.state?.stage === this.game.stage
      ? structuredClone(this.state)
      : undefined;
  }
  choices() {
    return this.enabled ? planShiftRoute(this.game.seed, this.game.stage, !!this.lastRework) : [];
  }
  remember() {
    if (!this.enabled) return false;
    const source = captureRework(this.game);
    if (!source || !validReworkSnapshot(source)) return false;
    this.lastRework = source;
    return true;
  }
  enter(kind: ShiftRouteId) {
    const g = this.game;
    if (
      !this.enabled ||
      !(SHIFT_ROUTE_IDS as readonly string[]).includes(kind) ||
      g.stage < 4 ||
      g.stage > 18 ||
      g.overtime ||
      g.practice ||
      g.workshop.active ||
      (kind === 'rework-loop' && !this.lastRework)
    )
      return false;
    this.state = {
      version: 1,
      kind,
      stage: g.stage,
      ...(kind === 'turntable-works' ? { turns: [0, 0] } : {}),
      ...(kind === 'prism-glassworks' ? { mirrors: [0, 0, 0] } : {}),
      ...(kind === 'express-airlocks' ? { gates: 0, rush: 0 } : {}),
      ...(kind === 'rework-loop' ? { rework: structuredClone(this.lastRework!) } : {}),
    };
    return true;
  }
  level(base: Level): Level {
    const g = this.game,
      s = this.state;
    if (!this.enabled || !s || s.stage !== g.stage || g.overtime || g.practice || g.workshop.active)
      return base;
    return shiftRouteLayout(s.kind, base.area, s.rework);
  }
  reset(cleared = false) {
    const g = this.game;
    g.engine.gravity.y = 1;
    g.player.frictionAir = 0.008;
    this.rotors = [];
    this.mirrors = [];
    this.gates = [];
    this.shotBanks = new WeakMap();
    this.roomClear = cleared;
    if (!this.active) return;
    const s = this.state!,
      room = this.layout;
    if (s.kind === 'vacuum-docks') {
      g.engine.gravity.y = 0.24;
      g.player.frictionAir = 0.001;
    }
    this.rotors = (room.rotors ?? []).map((m, index) => {
      const body = g.terrain[m.solid + 4],
        target = ((s.turns![index] ?? 0) * Math.PI) / 2;
      Body.setAngle(body, target);
      return { body, console: { ...m.console }, index, target };
    });
    this.mirrors = (room.mirrors ?? []).map((m, index) => {
      const body = g.terrain[m.solid + 4],
        target = -Math.PI / 4 + ((s.mirrors![index] ?? 0) * Math.PI) / 4;
      Body.setAngle(body, target);
      return { body, console: { ...m.console }, index, target };
    });
    this.gates = (room.airlocks ?? []).map((m) => ({
      body: g.terrain[m.solid + 4],
      console: { ...m.console },
      chamberEnd: m.chamberEnd,
    }));
    for (let i = 0; i < (s.gates ?? 0); i++) this.removeGate(i);
    if (s.kind === 'rework-loop') {
      for (const p of s.rework!.props)
        if (p.hp !== undefined) {
          const actual = g.props.items.find(
            (a) =>
              Math.abs(a.body.position.x - (2000 - p.x)) < 1 &&
              Math.abs(a.body.position.y - p.y) < 1,
          );
          if (actual) actual.hp = Math.min(actual.maxHp, p.hp);
        }
    }
  }
  private removeGate(index: number) {
    const gate = this.gates[index];
    if (!gate) return;
    Composite.remove(this.game.engine.world, gate.body);
    this.game.terrain = this.game.terrain.filter((b) => b !== gate.body);
  }
  interact() {
    const g = this.game,
      s = this.state;
    if (!this.active || !s || g.mode !== 'playing' || g.hitStop > 0 || this.roomClear) return false;
    const near = (p: Vec) => distance(g.player.position, p) < 78;
    if (s.kind === 'turntable-works') {
      const rotor = this.rotors.find((r) => near(r.console));
      if (!rotor) return false;
      if (Math.abs(rotor.body.angle - rotor.target) > 0.01) return true;
      s.turns![rotor.index] = (s.turns![rotor.index] + 1) % 4;
      rotor.target = rotor.body.angle + Math.PI / 2;
      g.onSound('machine');
      return true;
    }
    if (s.kind === 'prism-glassworks') {
      const mirror = this.mirrors.find((m) => near(m.console));
      if (!mirror) return false;
      s.mirrors![mirror.index] = (s.mirrors![mirror.index] + 1) % 4;
      mirror.target = -Math.PI / 4 + (s.mirrors![mirror.index] * Math.PI) / 4;
      g.onSound('machine');
      return true;
    }
    if (s.kind === 'express-airlocks') {
      const index = s.gates ?? 0,
        gate = this.gates[index];
      if (!gate || !near(gate.console)) return false;
      if (g.enemies.some((e) => e.hp > 0 && !e.allied && e.body.position.x < gate.chamberEnd))
        s.rush = (s.rush ?? 0) + 1;
      s.gates = index + 1;
      this.removeGate(index);
      g.onSound('cargo-release');
      return true;
    }
    return false;
  }
  private rotate(mechanism: Mechanism, dt: number, speed: number) {
    const delta = clamp(mechanism.target - mechanism.body.angle, -speed * dt, speed * dt);
    if (Math.abs(delta) < 0.0001) return;
    const body = mechanism.body,
      old = body.angle;
    const actors = [
      this.game.player,
      ...this.game.enemies.filter((e) => e.hp > 0).map((e) => e.body),
      ...this.game.props.bodies,
    ];
    const blockers = [
      ...new Set([...actors, ...this.game.terrainBodies.filter((b) => b !== body)]),
    ];
    Body.setAngle(body, old + delta);
    if (Query.collides(body, blockers).length) Body.setAngle(body, old);
  }
  beforeStep(input: Input, dt: number) {
    if (
      !this.active ||
      this.game.mode !== 'playing' ||
      this.game.hitStop > 0 ||
      !Number.isFinite(dt) ||
      dt <= 0
    )
      return;
    if (input.jump && this.interact()) {
      input.jump = false;
      this.game.jumpBuffer = 0;
    }
    for (const rotor of this.rotors) this.rotate(rotor, dt, Math.PI / 1.2);
    for (const mirror of this.mirrors) this.rotate(mirror, dt, Math.PI * 1.5);
  }
  afterStep(_dt: number) {
    if (!this.active) return;
    if (this.kind === 'vacuum-docks') {
      // The floor refuges still arrest a landing; only airborne drift changes.
      for (const p of this.game.props.items) if (!p.body.isStatic) p.body.frictionAir = 0.004;
    }
    this.roomClear ||= this.game.clear;
  }
  owns(body: Matter.Body | undefined) {
    return this.active && !!body && [...this.rotors, ...this.mirrors].some((m) => m.body === body);
  }
  isMirror(body: Matter.Body | undefined) {
    return this.active && !!body && this.mirrors.some((m) => m.body === body);
  }
  mirrorDirection(body: Matter.Body, normal: Vec, dir: Vec, used = 0): Vec | null {
    if (
      !this.isMirror(body) ||
      used >= 4 ||
      ![normal.x, normal.y, dir.x, dir.y].every(Number.isFinite)
    )
      return null;
    const size = Math.hypot(normal.x, normal.y);
    if (size < 0.5) return null;
    const n = { x: normal.x / size, y: normal.y / size },
      dot = dir.x * n.x + dir.y * n.y;
    return { x: dir.x - 2 * dot * n.x, y: dir.y - 2 * dot * n.y };
  }
  reflect(s: Shot, body: Matter.Body | undefined, normal: Vec) {
    if (
      !body ||
      s.shell ||
      s.massDriver ||
      s.rail ||
      s.blade ||
      s.molten ||
      s.enemyAmmo ||
      s.meltTransit
    )
      return false;
    const used = this.shotBanks.get(s) ?? 0,
      dir = this.mirrorDirection(body, normal, s.vel, used);
    if (!dir) return false;
    this.shotBanks.set(s, used + 1);
    s.banks++;
    s.damage *= 1 + s.bankGrowth;
    markShot(s, 'banked');
    redirectVector(s);
    s.vel = dir;
    s.pos = { x: s.pos.x + normal.x * 0.75, y: s.pos.y + normal.y * 0.75 };
    s.waypoints = undefined;
    return true;
  }
}
