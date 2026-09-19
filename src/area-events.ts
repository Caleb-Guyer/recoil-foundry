import Matter from 'matter-js';
import { freightSelected } from './freight-layout.ts';
import type { Enemy, Game } from './game.ts';
import { ENEMY_STATS } from './enemies.ts';
import { areaIndex, clamp, direction, distance, MOD_REQUIRES, seeded } from './rules.ts';
import type { Checkpoint, Mod, Vec } from './rules.ts';

import {
  TURF_RED_COUNT,
  TURF_BLUE_COUNT,
  TURF_SPACING,
  TURF_FORMATIONS,
  planTurfFormation,
  type TurfKind,
  type TurfFormation,
  type TurfSites,
} from './turf-formations.ts';
export { TURF_RED_COUNT, TURF_BLUE_COUNT, TURF_SPACING } from './turf-formations.ts';

const { Body, Query, Composite } = Matter;
export const AREA_EVENTS = {
  blackout: { name: 'Blackout' },
  turf: { name: 'Turf War' },
  lockdown: { name: 'Lockdown' },
} as const;
export type AreaEventKind = keyof typeof AREA_EVENTS;
export type EventRole = 'relay' | 'commander';
export interface AreaEventSave {
  kind: AreaEventKind;
  area: number;
  room?: number;
  relays: number[];
  caches: number[];
  commander: boolean;
  rerolls: number;
}
export function planAreaEvent(seed: string): AreaEventSave | null {
  const rng = seeded(seed + ':area-event-v1');
  if (rng() >= 0.75) return null;
  const kind = (Object.keys(AREA_EVENTS) as AreaEventKind[])[Math.floor(rng() * 3)];
  const area = 1 + Math.floor(rng() * 3);
  let room = kind === 'blackout' ? area * 4 + Math.floor(rng() * 3) : undefined;
  // The freight shaft owns three moving-lift boarding waves. Place the
  // one-room outage before it instead of trapping its power box downstairs.
  if (room !== undefined && freightSelected(seed, room)) room = area * 4;
  return {
    kind,
    area,
    ...(room !== undefined ? { room } : {}),
    relays: [],
    caches: [],
    commander: false,
    rerolls: 0,
  };
}
export function validAreaEvent(value: unknown, stage: number, atReward: boolean): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const s = value as AreaEventSave;
  if (
    !Object.hasOwn(AREA_EVENTS, s.kind) ||
    !Number.isInteger(s.area) ||
    s.area < 1 ||
    s.area > 3 ||
    (s.room !== undefined &&
      (s.kind !== 'blackout' ||
        !Number.isInteger(s.room) ||
        areaIndex(s.room) !== s.area ||
        s.room % 4 === 3)) ||
    typeof s.commander !== 'boolean' ||
    !Number.isInteger(s.rerolls) ||
    s.rerolls < 0 ||
    s.rerolls > 3
  )
    return false;
  for (const list of [s.relays, s.caches]) {
    if (
      !Array.isArray(list) ||
      list.length > 3 ||
      new Set(list).size !== list.length ||
      list.some(
        (n) =>
          !Number.isInteger(n) ||
          areaIndex(n) !== s.area ||
          n % 4 === 3 ||
          n > stage ||
          (n === stage && !atReward),
      )
    )
      return false;
  }
  return (
    (s.kind === 'blackout' || s.relays.length === 0) &&
    (s.room === undefined || (s.relays.length <= 1 && s.relays.every((n) => n === s.room))) &&
    (s.kind === 'turf' || (s.caches.length === 0 && s.rerolls === 0)) &&
    s.rerolls <= s.caches.length &&
    (!s.commander || (s.kind === 'lockdown' && stage >= s.area * 4))
  );
}
export const TURF_TEST_SEEDS: Record<TurfFormation, string> = {
  ground: 'TURF-80-1',
  crossfire: 'TURF-80-0',
  air: 'TURF-80-10',
};
export function eventTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let unknown = false;
  p.forEach((_, key) => {
    if (!['test', 'event', 'formation', 'v'].includes(key)) unknown = true;
  });
  if (
    p.get('test') !== 'events' ||
    p.getAll('test').length !== 1 ||
    p.getAll('event').length !== 1 ||
    unknown
  )
    return null;
  const kind = p.get('event') as AreaEventKind;
  if (!Object.hasOwn(AREA_EVENTS, kind)) return null;
  const formation = p.get('formation') as TurfFormation | null;
  if (
    p.has('formation') &&
    (kind !== 'turf' ||
      p.getAll('formation').length !== 1 ||
      !Object.hasOwn(TURF_FORMATIONS, formation ?? ''))
  )
    return null;
  return {
    version: 6,
    seed: formation
      ? TURF_TEST_SEEDS[formation]
      : (kind === 'turf' ? 'EVENTS-78-' : 'EVENTS-77-') + kind,
    stage: 4,
    hp: 100,
    mods: ['magnum', 'ricochet', 'airshot', 'light'],
    kills: 0,
    elapsed: 0,
    areaEvent: {
      kind,
      area: 1,
      ...(kind === 'blackout' ? { room: 4 } : {}),
      relays: [],
      caches: [],
      commander: false,
      rerolls: 0,
    },
  };
}

export class AreaEventSystem {
  game: Game;
  state: AreaEventSave | null = null;
  active: AreaEventKind | null = null;
  site: Vec = { x: 1000, y: 724 };
  allies: Enemy[] = [];
  formation: TurfFormation | null = null;
  departingAt: number | null = null;
  cacheReady = false;
  cacheTaken = false;
  hunted = false;
  pending = false;
  releaseAt = 0;
  powered = false;
  contactAt = new Map<number, number>();
  constructor(game: Game) {
    this.game = game;
  }
  start(save?: Checkpoint) {
    this.state = save?.areaEvent
      ? structuredClone(save.areaEvent)
      : save
        ? null
        : planAreaEvent(this.game.seed);
  }
  get encounter(): AreaEventKind | null {
    const g = this.game,
      s = this.state;
    if (
      !s ||
      g.practice ||
      g.workshop.active ||
      g.escape ||
      g.overtime ||
      g.detour ||
      g.level?.boss ||
      g.level?.shutdown ||
      g.level?.freight ||
      areaIndex(g.stage) !== s.area
    )
      return null;
    if (s.kind === 'blackout' && g.stage !== (s.room ?? s.area * 4)) return null;
    return s.kind;
  }
  get dark() {
    return this.active === 'blackout' && !this.powered;
  }
  get waiting() {
    return this.game.waves.held || this.pending;
  }
  get terminalReady() {
    return this.active === 'lockdown' && !this.hunted && !this.game.enemies.length;
  }
  clear() {
    for (const e of this.allies) Composite.remove(this.game.engine.world, e.body);
    this.allies = [];
    this.formation = null;
    this.contactAt.clear();
    this.departingAt = null;
    this.active = null;
    this.pending = false;
    this.powered = false;
  }
  reset(cleared: boolean) {
    this.clear();
    const g = this.game,
      s = this.state;
    this.active = this.encounter;
    if (!s || !this.active) return;
    this.site = this.findSite();
    this.cacheReady = this.cacheTaken = this.hunted = false;
    this.powered = cleared || s.relays.includes(g.stage);
    if (cleared) return;
    if (this.active === 'blackout') {
      g.waves.held = true;
      const relay = this.spawn('shooter', this.site);
      if (relay) {
        relay.eventRole = 'relay';
        relay.spawn = 0;
        relay.hp = relay.maxHp = 1;
        relay.body.isSensor = true;
      }
    } else if (this.active === 'lockdown') {
      g.waves.held = true;
    } else {
      this.spawnTurf();
    }
  }
  turfSites(kind: TurfKind, allied: boolean): Vec[] {
    const g = this.game,
      { w, h } = ENEMY_STATS[kind],
      result: Vec[] = [];
    const middle = g.worldWidth / 2,
      min = allied ? 55 : middle + w / 2 + 5,
      max = allied ? middle - w / 2 - 5 : g.worldWidth - 55;
    const supports = g.terrain.filter(
      (b) => b.bounds.max.x - b.bounds.min.x > 70 && b.bounds.min.y >= 100 && b.bounds.min.y <= 740,
    );
    const candidates: Vec[] = [];
    for (let x = min; x <= max; x += 25) {
      if (kind === 'flyer') {
        for (let y = 140; y <= 660; y += 80) candidates.push({ x, y });
      } else
        for (const b of supports) {
          if (x - w / 2 - 4 >= b.bounds.min.x && x + w / 2 + 4 <= b.bounds.max.x)
            candidates.push({ x, y: b.bounds.min.y - h / 2 - 1 });
        }
    }
    for (const p of candidates) {
      if (distance(p, g.player.position) < (allied ? 55 : 480)) continue;
      if ([...g.enemies, ...this.allies].some((e) => distance(p, e.body.position) < TURF_SPACING))
        continue;
      if (
        Query.region(g.solidBodies, {
          min: { x: p.x - w / 2 - 5, y: p.y - h / 2 - 5 },
          max: { x: p.x + w / 2 + 5, y: p.y + h / 2 - 0.25 },
        }).length
      )
        continue;
      result.push(p);
    }
    return result;
  }
  turfSpot(kind: TurfKind, allied = false): Vec | undefined {
    const g = this.game,
      actors = allied ? this.allies : g.enemies;
    // Farthest-point placement fills separate lanes and heights, rather than
    // exhausting one row of a grid or crowding the nearest authored anchor.
    return this.turfSites(kind, allied).sort((a, b) => {
      const score = (p: Vec) =>
        Math.min(
          ...actors.map((e) => distance(p, e.body.position)),
          distance(p, g.player.position),
        );
      return score(b) - score(a) || a.x - b.x || a.y - b.y;
    })[0];
  }
  spawnTurf() {
    const g = this.game;
    const sites = (allied: boolean): TurfSites => ({
      runner: this.turfSites('runner', allied),
      shooter: this.turfSites('shooter', allied),
      flyer: this.turfSites('flyer', allied),
    });
    const redSites = sites(false),
      blueSites = sites(true);
    const seed = g.roomSeed + ':turf-formation:' + g.stage + ':' + (g.route ?? 'main');
    const rng = seeded(seed);
    const choices = (Object.keys(TURF_FORMATIONS) as TurfFormation[])
      .flatMap((formation) => {
        const red = planTurfFormation(formation, redSites, g.worldWidth, false, seed);
        if (!red) return [];
        const separated = Object.fromEntries(
          Object.entries(blueSites).map(([kind, points]) => [
            kind,
            points.filter((p) => red.every((other) => distance(p, other) >= TURF_SPACING)),
          ]),
        ) as TurfSites;
        const blue = planTurfFormation(formation, separated, g.worldWidth, true, seed);
        if (!blue) return [];
        // Favor ground pushes in low rooms, crossfire on layered perches, and
        // air battles in open rooms. Only complete, safely placed rosters qualify.
        const weight =
          formation === 'ground'
            ? 3 + redSites.runner.filter((p) => p.y >= 580).length / 25
            : formation === 'crossfire'
              ? 4 + redSites.shooter.filter((p) => p.y < 620).length / 25
              : 0.5 + redSites.flyer.length / 800;
        return [{ formation, red, blue, rank: -Math.log(Math.max(rng(), 0.000001)) / weight }];
      })
      .sort((a, b) => a.rank - b.rank);
    const selected = choices[0];
    if (selected) {
      this.formation = selected.formation;
      for (const unit of selected.red) this.spawn(unit.kind, unit);
      for (const unit of selected.blue) this.spawnAlly(unit.kind, unit);
      return;
    }
    // Future unusually crowded layouts still get a safe simultaneous battle.
    // Supported units go first; free airspace supplies any remaining slots.
    this.formation = 'air';
    for (const allied of [false, true]) {
      const count = allied ? TURF_BLUE_COUNT : TURF_RED_COUNT;
      for (let i = 0; i < count; i++) {
        const preferred: TurfKind = i < 2 ? 'shooter' : i < 4 ? 'runner' : 'flyer';
        const spot = this.turfSpot(preferred, allied);
        const kind = spot ? preferred : 'flyer';
        const p = spot ?? this.turfSpot('flyer', allied);
        if (p) {
          if (allied) this.spawnAlly(kind, p);
          else this.spawn(kind, p);
        }
      }
    }
  }
  spawnAlly(kind: TurfKind, p: Vec) {
    const ally = this.spawn(kind, p);
    if (!ally) return;
    this.game.enemies = this.game.enemies.filter((e) => e !== ally);
    ally.allied = true;
    ally.aim = { x: 1, y: 0 };
    this.allies.push(ally);
  }
  findSite(): Vec {
    const g = this.game,
      candidates: Vec[] = [];
    for (let x = 540; x <= 1720; x += 40) {
      if (
        !Query.region(g.solidBodies, { min: { x: x - 45, y: 642 }, max: { x: x + 45, y: 738 } })
          .length
      )
        candidates.push({ x, y: 724 });
    }
    const rng = seeded(g.roomSeed + ':event-site:' + g.stage);
    return candidates[Math.floor(rng() * candidates.length)] ?? { x: 1840, y: 724 };
  }
  free(p: Vec, margin = 28) {
    const g = this.game;
    return (
      distance(p, g.player.position) > 95 &&
      !Query.region(
        [...g.solidBodies, ...g.enemies.map((e) => e.body), ...this.allies.map((e) => e.body)],
        { min: { x: p.x - margin, y: p.y - margin }, max: { x: p.x + margin, y: p.y + margin } },
      ).length
    );
  }
  *battleSites() {
    for (const y of [260, 420, 160, 580, 690])
      for (let x = 620; x <= 1820; x += 135) {
        const p = { x, y };
        if (this.free(p, 34)) yield p;
      }
  }
  spawn(kind: 'shooter' | 'flyer' | 'runner', pos: Vec) {
    const g = this.game,
      count = g.enemies.length;
    g.spawnEnemy(kind, pos.x, pos.y);
    return g.enemies.length > count ? g.enemies.at(-1)! : undefined;
  }
  input(jump: boolean) {
    const g = this.game;
    if (
      !jump ||
      g.mode !== 'playing' ||
      !this.terminalReady ||
      distance(g.player.position, this.site) > 65
    )
      return false;
    this.hunted = this.pending = true;
    this.releaseAt = g.time + 1.1;
    g.waves.release();
    g.onSound('reinforce');
    return true;
  }
  update(dt: number) {
    const g = this.game;
    if (!this.active || g.mode !== 'playing') return;
    if (this.active === 'turf') {
      if (!g.enemies.length && !g.mutations.pending.length && this.departingAt === null) {
        this.departingAt = g.time;
        this.cacheReady = true;
        g.shots = g.shots.filter((s) => !s.allied);
      }
      if (this.cacheReady && !this.cacheTaken && distance(g.player.position, this.site) < 58) {
        this.cacheTaken = true;
        const s = this.state!;
        if (!s.caches.includes(g.stage)) {
          s.caches.push(g.stage);
          if (/^RF-D\d+-/.test(g.seed)) g.hp = Math.min(100, g.hp + 16);
          else s.rerolls++;
          g.onSound('upgrade');
        }
      }
    }
    if (this.pending && g.time >= this.releaseAt && g.enemies.length < 12) {
      const p = this.arrival();
      if (!p) return;
      const e = this.spawn('flyer', p);
      if (e) {
        e.eventRole = 'commander';
        e.hp = e.maxHp = 340 + this.state!.area * 85;
        e.timer = 1.3;
        this.pending = false;
        // Escort the commander in addition to the room's reserved forces.
        for (const x of [this.site.x - 150, this.site.x + 150]) {
          const guard = this.arrival(clamp(x, 320, 1780));
          if (guard) this.spawn('flyer', guard);
        }
      }
    }
  }
  beforeStep(dt: number) {
    const g = this.game;
    for (const e of [...this.allies]) {
      if (this.departingAt !== null) {
        if (e.body.isStatic) Body.setStatic(e.body, false);
        if (e.kind === 'flyer')
          Body.applyForce(e.body, e.body.position, { x: 0, y: -e.body.mass * 0.001 });
        Body.setVelocity(e.body, { x: -4, y: e.kind === 'flyer' ? -5 : e.body.velocity.y });
        if (e.body.position.x < 28 || e.body.position.y < 28 || g.time - this.departingAt > 3)
          this.removeAlly(e);
      } else g.updateEnemy(e, dt);
    }
  }
  contact(e: Enemy) {
    if (
      this.active !== 'turf' ||
      this.departingAt !== null ||
      this.game.time < (this.contactAt.get(e.id) ?? 0)
    )
      return;
    const g = this.game;
    const other = (e.allied ? g.enemies : this.allies).find(
      (a) => a.hp > 0 && a.spawn <= 0 && Query.collides(e.body, [a.body]).length,
    );
    if (!other) return;
    this.contactAt.set(e.id, g.time + 0.65);
    if (other.allied) this.hitAlly(other, e.splitChild ? 9 : 15);
    else g.hitEnemy(other, 15, e.body.position, true, false, false);
  }
  combatTarget(e: Enemy): Vec {
    const g = this.game;
    if (e.allied) {
      const live = g.enemies.filter((a) => a.hp > 0 && a.spawn <= 0);
      const visible = live.filter(
        (a) => distance(g.lineEnd(e.body.position, a.body.position), a.body.position) < 1,
      );
      return (
        [...(visible.length ? visible : live)].sort(
          (a, b) =>
            distance(e.body.position, a.body.position) - distance(e.body.position, b.body.position),
        )[0]?.body.position ?? e.body.position
      );
    }
    if (
      this.active !== 'turf' ||
      e.squad ||
      e.elite ||
      !['runner', 'flyer', 'shooter'].includes(e.kind)
    )
      return g.player.position;
    // Ordinary gunmen return fire at closer, visible blue combatants. Other
    // enemy archetypes keep their authored player-facing attacks and tells.
    let target = g.player.position,
      nearest = distance(e.body.position, target);
    for (const ally of this.allies) {
      const p = ally.body.position,
        d = distance(e.body.position, p);
      if (
        ally.spawn <= 0 &&
        ally.hp > 0 &&
        d < nearest &&
        distance(g.lineEnd(e.body.position, p), p) < 1
      ) {
        target = p;
        nearest = d;
      }
    }
    return target;
  }
  removeAlly(e: Enemy) {
    Composite.remove(this.game.engine.world, e.body);
    this.allies = this.allies.filter((a) => a !== e);
  }
  hitAlly(e: Enemy, damage: number) {
    if (!this.allies.includes(e) || e.spawn > 0 || this.departingAt !== null) return;
    e.hp -= damage;
    e.flash = 0.08;
    if (e.hp <= 0) {
      this.game.burst(e.body.position, 12, '#7cbfff', 3);
      this.removeAlly(e);
    }
  }
  arrival(x = this.site.x): Vec | null {
    for (const y of [this.site.y - 110, 480, 340, 180]) {
      const p = { x, y };
      if (this.free(p)) return p;
    }
    // A moved crate or dense opening cannot permanently block the required wave.
    return this.battleSites().next().value ?? null;
  }
  updateEnemy(e: Enemy, dt: number): boolean {
    if (e.eventRole === 'relay') return true;
    if (e.eventRole !== 'commander') return false;
    const g = this.game,
      p = e.body.position,
      t = g.player.position;
    e.timer -= dt;
    const d = direction(p, t),
      side = Math.sin(g.time * 0.8 + e.id) > 0 ? 1 : -1;
    Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
    Body.setVelocity(e.body, {
      x: clamp((t.x + side * 260 - p.x) * 0.016, -4.2, 4.2),
      y: clamp((clamp(t.y - 180, 180, 550) - p.y) * 0.035, -3, 3),
    });
    if (e.timer > 0.65) e.aim = d;
    if (e.timer <= 0.65 && e.timer + dt > 0.65) g.onSound('aim-warn');
    if (e.timer <= 0) {
      const a = Math.atan2(e.aim.y, e.aim.x),
        count = e.attacks % 2 ? 5 : 3;
      for (let i = 0; i < count; i++) g.enemyShot(e, a + (i - (count - 1) / 2) * 0.16, 10.5, 21);
      e.attacks++;
      e.timer = 1.55;
    }
    if (Query.collides(g.player, [e.body]).length)
      g.damagePlayer(24, p, { type: 'contact', enemy: e.kind });
    if (p.y > 900) g.hitEnemy(e, 9999);
    return true;
  }
  killed(e: Enemy, _credited: boolean) {
    const g = this.game,
      s = this.state;
    if (!s || !this.active) return;
    if (e.eventRole === 'relay' && !this.powered) {
      this.powered = true;
      if (!s.relays.includes(g.stage)) s.relays.push(g.stage);
      g.waves.release();
      g.onSound('reinforce');
    }
    if (e.eventRole === 'commander') s.commander = true;
  }
  get clearance() {
    return (
      !!this.state?.commander &&
      !this.game.overtime &&
      areaIndex(this.game.stage) === this.state.area
    );
  }
  get freeReroll() {
    return (this.state?.rerolls ?? 0) > 0;
  }
  spendReroll() {
    if (this.freeReroll) this.state!.rerolls--;
  }
  get roomHeal() {
    return (
      this.state?.room !== undefined
        ? this.state.relays.length === 1
        : this.state?.relays.length === 3
    )
      ? 6
      : 0;
  }
  preferRewards(offers: Mod[], candidates: Mod[], excluded: string[] = []) {
    if (!offers.length || !this.state?.commander || areaIndex(this.game.stage) !== this.state.area)
      return offers;
    const followups = candidates.filter((m) => MOD_REQUIRES[m.id] && !excluded.includes(m.id));
    if (!followups.length || offers.some((m) => MOD_REQUIRES[m.id])) return offers;
    const rng = seeded(
      this.game.layoutSeed + ':clearance:' + this.game.stage + ':' + excluded.join(','),
    );
    const selected = followups[Math.floor(rng() * followups.length)];
    const result = [...offers];
    // Keep the boss's guaranteed salvage slot intact.
    const index = offers[0].id === this.game.earnedSalvage ? (offers.length > 1 ? 1 : -1) : 0;
    if (index >= 0) result[index] = selected;
    return result;
  }
}
