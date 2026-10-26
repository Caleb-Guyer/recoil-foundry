import Matter from 'matter-js';
import type { Game, Input, Shot } from './game.ts';
import {
  availableMods,
  clamp,
  direction,
  distance,
  getGun,
  sample,
  seeded,
  type Mod,
  type Vec,
} from './rules.ts';
import { SHIFT_MORPHS, isShiftMorph, shiftCampaign, type ShiftMorphId } from './shift-catalog.ts';
import { firstSolid } from './collisions.ts';
import type { HazardPlacement } from './hazard-layouts.ts';

const { Bodies, Body, Composite } = Matter;
export const SHIFT_JUNCTIONS = [6, 10, 14, 18] as const;
export const SHIFT_CIRCUITS = ['transport', 'security', 'reclamation'] as const;
export type ShiftCircuit = (typeof SHIFT_CIRCUITS)[number];
export const EXPERIMENTS = {
  'ricochet-harness': {
    name: 'Return assembly',
    event: 'rebound',
    target: 3,
    task: 'Make three real recoil rebounds.',
    outcomes: ['double-return', 'impact-echo'],
  },
  'spring-rivets': {
    name: 'Scaffold fitting',
    event: 'pad',
    target: 3,
    task: 'Launch from three installed spring pads.',
    outcomes: ['twin-mounts', 'loaded-spring'],
  },
  'slip-gauge': {
    name: 'Clearance trial',
    event: 'slip',
    target: 3,
    task: 'Earn and spend three dodge charges.',
    outcomes: ['deep-reserve', 'counterstep'],
  },
} as const;
export type ExperimentId = keyof typeof EXPERIMENTS;
export const EVOLUTIONS: Readonly<Record<string, { name: string; description: string }>> = {
  'double-return': {
    name: 'Double Return',
    description: 'Earn two terrain rebounds from each paid discharge.',
  },
  'impact-echo': {
    name: 'Impact Echo',
    description:
      'A recoil rebound sends a short, cover-blocked shock through nearby ordinary machines. Brief recharge.',
  },
  'twin-mounts': { name: 'Twin Mounts', description: 'Keep four spring pads instead of two.' },
  'loaded-spring': {
    name: 'Loaded Spring',
    description:
      'Pads provide a stronger physical launch; all existing movement fittings remain active.',
  },
  'deep-reserve': {
    name: 'Deep Reserve',
    description: 'Store two separately earned, short-lived dodge charges.',
  },
  counterstep: {
    name: 'Counterstep',
    description:
      'A dodge burst sends one short round toward your aim. Its round cannot recharge this fitting.',
  },
};
export interface ShiftRunSave {
  version: 1;
  routes: number[];
  powers: number[];
  leases: number[];
  paid: number[];
  grants: string[];
  freeRerolls: number;
  repairs: number[];
  circuit?: { kind: ShiftCircuit; rooms: number[] };
  lease?: { morph: ShiftMorphId; stage: number; cleared: number[]; status: 'active' | 'due' };
  experiment?: {
    id: ExperimentId;
    progress: number;
    status: 'active' | 'ready' | 'complete';
    evolution?: string;
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const only = (v: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(v).every((k) => keys.includes(k));
const stages = (v: unknown, limit = 20): v is number[] =>
  Array.isArray(v) &&
  v.length <= limit &&
  new Set(v).size === v.length &&
  v.every((n) => Number.isInteger(n) && n >= 4 && n <= 19);
export function validShiftRunSave(
  raw: unknown,
  mods: readonly string[] = [],
  stage = 19,
): raw is ShiftRunSave {
  if (
    !object(raw) ||
    !only(raw, [
      'version',
      'routes',
      'powers',
      'leases',
      'paid',
      'grants',
      'freeRerolls',
      'repairs',
      'circuit',
      'lease',
      'experiment',
    ]) ||
    raw.version !== 1
  )
    return false;
  if (
    !['routes', 'powers', 'leases', 'paid', 'repairs'].every(
      (k) => stages(raw[k]) && (raw[k] as number[]).every((n) => n <= stage),
    )
  )
    return false;
  if (
    !['routes', 'powers', 'leases'].every(
      (k) =>
        (raw[k] as number[]).length <= 4 &&
        (raw[k] as number[]).every((n) => (SHIFT_JUNCTIONS as readonly number[]).includes(n)),
    )
  )
    return false;
  if (
    !Array.isArray(raw.grants) ||
    raw.grants.length > 1 ||
    !raw.grants.every(
      (id) => typeof id === 'string' && Object.hasOwn(EXPERIMENTS, id) && mods.includes(id),
    )
  )
    return false;
  if (
    !Number.isInteger(raw.freeRerolls) ||
    Number(raw.freeRerolls) < 0 ||
    Number(raw.freeRerolls) > 4
  )
    return false;
  if (
    raw.circuit !== undefined &&
    (!object(raw.circuit) ||
      !only(raw.circuit, ['kind', 'rooms']) ||
      !(SHIFT_CIRCUITS as readonly unknown[]).includes(raw.circuit.kind) ||
      !stages(raw.circuit.rooms, 3) ||
      !(raw.circuit.rooms as number[]).every((n) => n <= stage))
  )
    return false;
  if (raw.lease !== undefined) {
    const l = raw.lease;
    if (
      !object(l) ||
      !only(l, ['morph', 'stage', 'cleared', 'status']) ||
      !isShiftMorph(String(l.morph)) ||
      !Number.isInteger(l.stage) ||
      !(SHIFT_JUNCTIONS as readonly unknown[]).includes(l.stage) ||
      Number(l.stage) > stage ||
      !stages(l.cleared, 2) ||
      !(l.cleared as number[]).every((n) => n >= Number(l.stage) && n <= stage) ||
      !['active', 'due'].includes(String(l.status)) ||
      (l.status === 'due') !== ((l.cleared as number[]).length === 2) ||
      mods.some(isShiftMorph)
    )
      return false;
  }
  if (raw.experiment !== undefined) {
    const e = raw.experiment;
    if (
      !object(e) ||
      !only(e, ['id', 'progress', 'status', 'evolution']) ||
      !Object.hasOwn(EXPERIMENTS, String(e.id)) ||
      !mods.includes(String(e.id)) ||
      !Number.isInteger(e.progress) ||
      Number(e.progress) < 0 ||
      Number(e.progress) > 3 ||
      !['active', 'ready', 'complete'].includes(String(e.status))
    )
      return false;
    if ((e.status === 'active') !== Number(e.progress) < 3) return false;
    if (
      e.status === 'complete'
        ? !(EXPERIMENTS[e.id as ExperimentId].outcomes as readonly unknown[]).includes(e.evolution)
        : e.evolution !== undefined
    )
      return false;
    if (raw.grants.length && raw.grants[0] !== e.id) return false;
  } else if (raw.grants.length) return false;
  return true;
}
export function shiftBonus(save: { shiftRun?: ShiftRunSave }) {
  return save.shiftRun?.grants.length ?? 0;
}
function initial(): ShiftRunSave {
  return {
    version: 1,
    routes: [],
    powers: [],
    leases: [],
    paid: [],
    grants: [],
    freeRerolls: 0,
    repairs: [],
  };
}
function ordinary(g: Game) {
  const l = g.level;
  return (
    !g.escape &&
    !g.detour &&
    !g.overtime &&
    !l.boss &&
    !l.annex &&
    !l.uprising &&
    !l.freight &&
    !l.crossing &&
    !l.maintenance &&
    !l.floodgate &&
    !l.sortingPit &&
    !l.shutdown &&
    !l.story &&
    !l.courier &&
    !g.hunts.kind
  );
}
export class ShiftRun {
  readonly game: Game;
  state: ShiftRunSave | null = null;
  entryKills = 0;
  entryTime = 0;
  shutter: { body: Matter.Body; open: boolean; at: Vec } | null = null;
  lamp: {
    body: Matter.Body;
    at: Vec;
    hp: number;
    phase: 'idle' | 'warning' | 'recover';
    timer: number;
    aim: Vec;
  } | null = null;
  repairNode: Vec | null = null;
  constructor(g: Game) {
    this.game = g;
  }
  get enabled() {
    const g = this.game;
    return shiftCampaign(g.seed) && !/^RF-D/.test(g.seed) && !g.practice && !g.workshop.active;
  }
  start(save?: { shiftRun?: ShiftRunSave }) {
    this.state =
      this.enabled &&
      validShiftRunSave(save?.shiftRun, this.game.mods, this.game.overtime ? 19 : this.game.stage)
        ? structuredClone(save!.shiftRun!)
        : this.enabled
          ? initial()
          : null;
    this.clearDevices();
  }
  fitted() {
    if (this.state?.lease && this.game.mods.some(isShiftMorph)) delete this.state.lease;
  }
  finishLap() {
    if (this.state) delete this.state.lease;
    this.clearDevices();
  }
  snapshot() {
    return this.state ? structuredClone(this.state) : undefined;
  }
  get leasedMorph(): ShiftMorphId | null {
    return this.state?.lease?.morph ?? null;
  }
  get rewardWindow() {
    const g = this.game;
    return (
      g.mode === 'upgrade' &&
      !g.uprising.choices.length &&
      !g.uprising.pendingPayment &&
      !g.hunts.rewarding &&
      !g.courierReward &&
      !g.welderReward &&
      !g.auditorReward
    );
  }
  get leaseDue() {
    return this.rewardWindow && this.state?.lease?.status === 'due';
  }
  get evolutionDue() {
    return this.rewardWindow && this.experimentReady;
  }
  get experimentReady() {
    return this.state?.experiment?.status === 'ready';
  }
  hasEvolution(id: string) {
    return this.state?.experiment?.status === 'complete' && this.state.experiment.evolution === id;
  }
  get freeReroll() {
    return !!this.state && this.state.freeRerolls > 0;
  }
  spendReroll() {
    if (!this.freeReroll) return false;
    this.state!.freeRerolls--;
    return true;
  }
  get junction() {
    const g = this.game;
    return (
      ['playing', 'shift-office'].includes(g.mode) &&
      this.enabled &&
      !!this.state &&
      ordinary(g) &&
      (SHIFT_JUNCTIONS as readonly number[]).includes(g.stage) &&
      g.player.position.x < 330 &&
      g.kills === this.entryKills &&
      !g.clear
    );
  }
  get circuit() {
    const c = this.state?.circuit;
    return c && ordinary(this.game) && (c.rooms.includes(this.game.stage) || c.rooms.length < 3)
      ? c.kind
      : null;
  }
  private clearDevices() {
    const g = this.game;
    for (const b of [this.shutter?.body, this.lamp?.body])
      if (b) {
        Composite.remove(g.engine.world, b);
        g.terrain = g.terrain.filter((t) => t !== b);
      }
    this.shutter = this.lamp = null;
    this.repairNode = null;
  }
  resetRoom() {
    this.clearDevices();
    const g = this.game;
    this.entryKills = g.kills;
    this.entryTime = g.time;
    if (!this.enabled || !this.state) return;
    const circuit = this.circuit;
    if (!circuit) return;
    const rooms = this.state.circuit!.rooms;
    let installed = false;
    if (circuit === 'transport') {
      const lift = this.safeHazard('lift');
      if (lift) {
        g.hazards.spawn(lift).permanent = true;
        installed = true;
      }
      const ventX = [
        1360,
        1120,
        820,
        580,
        ...Array.from({ length: 24 }, (_, i) => 340 + i * 60),
      ].find((x) => this.spaceClear(x - 60, 490, 120, 248));
      if (ventX) {
        installed = true;
        g.pressure.items.push({
          x: ventX,
          y: 738,
          dir: { x: 0, y: -1 },
          valve: { x: ventX - 70, y: 714 },
          width: 84,
          length: 240,
          offset: 0,
          overpressure: true,
          phase: 'ready',
          timer: 2,
          launched: new Set(),
          manual: false,
        });
      }
    } else if (circuit === 'reclamation') {
      const crusher = this.safeHazard('crusher');
      if (crusher) g.hazards.spawn(crusher).permanent = true;
      this.repairNode = { x: 245, y: 721 };
      installed = true;
    } else {
      const x = [850, 1100, 1450, 600, ...Array.from({ length: 24 }, (_, i) => 450 + i * 50)].find(
        (x) =>
          !g.level.solids.some(
            (s) => s.x < x + 25 && s.x + s.w > x - 25 && s.y < 740 && s.y + s.h > 580,
          ) &&
          ![g.player, ...g.enemies.map((e) => e.body), ...g.props.bodies].some(
            (b) =>
              b.bounds.min.x < x + 28 &&
              b.bounds.max.x > x - 28 &&
              b.bounds.min.y < 740 &&
              b.bounds.max.y > 580,
          ),
      );
      if (x !== undefined) {
        const body = Bodies.rectangle(x, 660, 20, 160, { isStatic: true, label: 'shift-shutter' });
        this.shutter = { body, open: false, at: { x: x - 48, y: 719 } };
        installed = true;
        g.terrain.push(body);
        Composite.add(g.engine.world, body);
      }
      const lampAt = { x: 1550, y: 460 };
      const body = Bodies.rectangle(lampAt.x, lampAt.y, 36, 26, {
        isStatic: true,
        label: 'shift-lamp',
      });
      if (
        !Matter.Query.collides(Bodies.rectangle(lampAt.x, lampAt.y, 44, 34), [
          ...g.solidBodies,
          g.player,
          ...g.enemies.map((e) => e.body),
        ]).length
      ) {
        this.lamp = { body, at: lampAt, hp: 65, phase: 'idle', timer: 1, aim: { x: 0, y: 1 } };
        installed = true;
        g.terrain.push(body);
        Composite.add(g.engine.world, body);
      }
    }
    // A crowded authored room cannot spend a powered-room charge without a device.
    if (installed && !rooms.includes(g.stage)) rooms.push(g.stage);
  }
  private spaceClear(x: number, y: number, w: number, h: number) {
    const g = this.game;
    for (const m of [...g.shiftRoutes.rotors, ...g.shiftRoutes.mirrors]) {
      const p = m.body.position,
        r = Math.max(...m.body.vertices.map((v) => Math.hypot(v.x - p.x, v.y - p.y))) + 4;
      if (x < p.x + r && x + w > p.x - r && y < p.y + r && y + h > p.y - r) return false;
    }
    const center = { x: x + w / 2, y: y + h / 2 };
    return !Matter.Query.collides(
      Bodies.rectangle(center.x, center.y, w, h),
      g.solidBodies.filter((b) => b !== g.terrain[0]),
    ).length;
  }
  private safeHazard(kind: 'lift' | 'crusher'): HazardPlacement | undefined {
    const g = this.game;
    for (const x of [560, 920, 1280, 1610, ...Array.from({ length: 36 }, (_, i) => 300 + i * 40)]) {
      const p: HazardPlacement =
        kind === 'lift'
          ? { kind, x, y: 670, w: 132, h: 18, travel: 130 }
          : { kind, x, y: 460, w: 104, h: 32, travel: 248 };
      const top = kind === 'lift' ? p.y - p.travel : p.y,
        bottom = kind === 'crusher' ? p.y + p.h + p.travel : p.y + p.h;
      if (!this.spaceClear(x - p.w / 2 - 30, top - 45, p.w + 60, bottom - top + 80)) continue;
      if (g.hazards.items.some((h) => Math.abs(h.placement.x - x) < 200)) continue;
      if (g.enemies.some((e) => Math.abs(e.body.position.x - x) < 100)) continue;
      return p;
    }
  }
  useRepair() {
    const g = this.game,
      s = this.state;
    if (
      !this.enabled ||
      !s ||
      !['playing', 'shift-office'].includes(g.mode) ||
      !this.repairNode ||
      g.hp >= 100 ||
      distance(g.player.position, this.repairNode) >= 90 ||
      s.repairs.includes(g.stage)
    )
      return false;
    s.repairs.push(g.stage);
    g.hp = Math.min(100, g.hp + 8);
    g.onSound('loaded');
    g.save();
    return true;
  }
  openOffice() {
    if (!this.junction || this.game.mode !== 'playing') return false;
    this.game.setMode('shift-office');
    this.game.onSound('loaded');
    return true;
  }
  closeOffice() {
    if (this.game.mode === 'shift-office') this.game.setMode('playing');
    this.game.save();
  }
  interact() {
    const g = this.game;
    if (!this.enabled || g.hitStop > 0 || !this.state || g.mode !== 'playing') return false;
    if (this.junction && distance(g.player.position, { x: 220, y: 721 }) < 90 && g.grounded)
      return this.openOffice();
    if (this.useRepair()) return true;
    const s = this.shutter;
    if (s && distance(g.player.position, s.at) < 65) {
      if (s.open) {
        const occupied = [g.player, ...g.enemies.map((e) => e.body), ...g.props.bodies].some(
          (b) =>
            b.bounds.max.x > s.body.bounds.min.x - 5 &&
            b.bounds.min.x < s.body.bounds.max.x + 5 &&
            b.bounds.max.y > s.body.bounds.min.y &&
            b.bounds.min.y < s.body.bounds.max.y,
        );
        if (occupied) return false;
      }
      s.open = !s.open;
      s.body.isSensor = s.open;
      if (s.open) g.terrain = g.terrain.filter((b) => b !== s.body);
      else if (!g.terrain.includes(s.body)) g.terrain.push(s.body);
      g.onSound('loaded');
      return true;
    }
    return false;
  }
  chooseRoute(kind: import('./shift-routes.ts').ShiftRouteId) {
    const g = this.game,
      s = this.state;
    if (
      !this.junction ||
      !s ||
      s.routes.includes(g.stage) ||
      !g.shiftRoutes.choices().includes(kind)
    )
      return false;
    if (!g.shiftRoutes.enter(kind)) return false;
    s.routes.push(g.stage);
    g.loadRoom();
    g.setMode('playing');
    g.save();
    return true;
  }
  chooseCircuit(kind: ShiftCircuit) {
    const g = this.game,
      s = this.state;
    if (
      !this.junction ||
      !s ||
      s.powers.includes(g.stage) ||
      !(SHIFT_CIRCUITS as readonly string[]).includes(kind)
    )
      return false;
    s.powers.push(g.stage);
    s.circuit = { kind, rooms: [] };
    g.loadRoom();
    g.setMode('playing');
    g.save();
    return true;
  }
  leaseChoices() {
    const g = this.game;
    if (
      !this.junction ||
      !this.state ||
      this.state.leases.includes(g.stage) ||
      this.state.lease ||
      g.mods.some(isShiftMorph)
    )
      return [];
    return SHIFT_MORPHS.filter((id) => availableMods(g.mods, true).some((m) => m.id === id)).filter(
      (_id, i) => i < 4,
    );
  }
  borrow(morph: ShiftMorphId) {
    if (!this.state || !this.leaseChoices().includes(morph)) return false;
    this.state.leases.push(this.game.stage);
    this.state.lease = { morph, stage: this.game.stage, cleared: [], status: 'active' };
    this.game.onSound('upgrade');
    this.game.save();
    return true;
  }
  returnLease() {
    if (!this.state?.lease || !this.leaseDue) return false;
    delete this.state.lease;
    this.game.hp = Math.min(100, this.game.hp + 12);
    this.game.onSound('loaded');
    this.game.save();
    return true;
  }
  keepLease() {
    const g = this.game,
      l = this.state?.lease;
    if (
      !l ||
      !this.leaseDue ||
      this.evolutionDue ||
      !availableMods(g.mods, true).some((m) => m.id === l.morph)
    )
      return false;
    const mod = availableMods(g.mods, true).find((m) => m.id === l.morph)!;
    delete this.state!.lease;
    g.offers = [mod];
    g.chooseMod(mod.id);
    return g.mods.includes(mod.id);
  }
  experimentChoices(): ExperimentId[] {
    return this.junction && this.state && !this.state.experiment
      ? (Object.keys(EXPERIMENTS) as ExperimentId[])
      : [];
  }
  beginExperiment(id: ExperimentId) {
    const g = this.game,
      s = this.state;
    if (!s || !this.experimentChoices().includes(id)) return false;
    if (!g.mods.includes(id)) {
      if (!availableMods(g.mods, true).some((m) => m.id === id)) return false;
      g.mods.push(id);
      s.grants.push(id);
      g.gun = getGun(g.mods, g.startingGun);
    }
    s.experiment = { id, progress: 0, status: 'active' };
    g.onSound('upgrade');
    g.save();
    return true;
  }
  progress(event: 'rebound' | 'pad' | 'slip') {
    const e = this.state?.experiment,
      g = this.game;
    if (
      !this.enabled ||
      !e ||
      e.status !== 'active' ||
      g.mode !== 'playing' ||
      EXPERIMENTS[e.id].event !== event
    )
      return;
    e.progress = Math.min(3, e.progress + 1);
    if (e.progress === 3) {
      e.status = 'ready';
      g.onSound('loaded');
    }
    g.save();
  }
  evolve(id: string) {
    const e = this.state?.experiment;
    if (
      !this.evolutionDue ||
      !e ||
      e.status !== 'ready' ||
      !(EXPERIMENTS[e.id].outcomes as readonly string[]).includes(id)
    )
      return false;
    e.status = 'complete';
    e.evolution = id;
    this.game.onSound('upgrade');
    this.game.save();
    return true;
  }
  roomCleared() {
    const s = this.state,
      g = this.game;
    if (!this.enabled || !s || g.escape || g.overtime || g.detour || g.hunts.kind) return;
    const l = s.lease;
    if (l && l.status === 'active' && !l.cleared.includes(g.stage)) {
      l.cleared.push(g.stage);
      if (l.cleared.length >= 2) l.status = 'due';
    }
    if (ordinary(g) && g.shiftRoutes.bonus && !s.paid.includes(g.stage)) {
      s.paid.push(g.stage);
      s.freeRerolls = Math.min(4, s.freeRerolls + g.shiftRoutes.bonus);
    }
  }
  offers(offers: Mod[]) {
    if (this.game.shiftRoutes.kind !== 'rework-loop') return offers;
    const morphs = availableMods(this.game.mods, true).filter((m) => isShiftMorph(m.id));
    return morphs.length
      ? [
          ...sample(morphs, 2, seeded(this.game.seed + ':rework-morph:' + this.game.stage)),
          ...offers.filter((m) => !isShiftMorph(m.id)).slice(0, 1),
        ]
      : offers;
  }
  terrainHit(s: Shot, body: Matter.Body) {
    const l = this.lamp;
    if (!l || l.body !== body || !s.friendly || s.fragment || s.damage <= 0) return;
    l.hp -= s.damage;
    if (l.hp <= 0) {
      Composite.remove(this.game.engine.world, l.body);
      this.game.terrain = this.game.terrain.filter((b) => b !== l.body);
      this.game.onSound('armor');
    }
  }
  tick(dt: number, input: Input) {
    const g = this.game,
      l = this.lamp;
    if (
      !this.enabled ||
      !l ||
      l.hp <= 0 ||
      g.clear ||
      g.mode !== 'playing' ||
      g.hitStop > 0 ||
      dt <= 0
    )
      return;
    l.timer -= dt;
    if (l.phase === 'idle' && l.timer <= 0) {
      if (
        g.player.position.x > 1050 &&
        !firstSolid(
          l.at,
          g.player.position,
          { x: 2, y: 2 },
          g.solidBodies.filter((b) => b !== l.body),
        )
      ) {
        l.aim = direction(l.at, g.player.position);
        l.phase = 'warning';
        l.timer = 0.95;
        g.soundAt('lock', l.at, 'shift-lamp');
      }
    } else if (l.phase === 'warning' && l.timer <= 0) {
      const start = { x: l.at.x + l.aim.x * 36, y: l.at.y + l.aim.y * 36 };
      g.addShot({
        pos: start,
        vel: { x: l.aim.x * 8, y: l.aim.y * 8 },
        damage: 14,
        life: 3,
        friendly: false,
        radius: 5,
        bounces: 0,
        pierce: 0,
        fragment: false,
        split: false,
        damageCause: { type: 'shot', enemy: 'shooter' },
        source: { ...l.at },
      });
      l.phase = 'recover';
      l.timer = 2.5;
      g.soundAt('enemy-shot', l.at, 'shift-lamp');
    } else if (l.phase === 'recover' && l.timer <= 0) {
      l.phase = 'idle';
      l.timer = 0.7;
    }
    void input;
  }
}
