import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import {
  areaIndex,
  clamp,
  direction,
  distance,
  MOD_REQUIRES,
  seeded,
  segmentBox,
} from './rules.ts';
import type { Checkpoint, Mod, Vec } from './rules.ts';

const { Body, Query } = Matter;
export const AREA_EVENTS = {
  blackout: { name: 'Blackout', hint: 'Break the relays. Restore the reserve supply.' },
  turf: { name: 'Turf War', hint: 'Two crews. Claim salvage by taking down two crew members.' },
  lockdown: {
    name: 'Lockdown',
    hint: 'Patrols inbound. Clear the room, then jump at the terminal.',
  },
} as const;
export type AreaEventKind = keyof typeof AREA_EVENTS;
export type EventRole = 'relay' | 'commander';
export interface AreaEventSave {
  kind: AreaEventKind;
  area: number;
  relays: number[];
  caches: number[];
  commander: boolean;
  rerolls: number;
}
export function planAreaEvent(seed: string): AreaEventSave | null {
  const rng = seeded(seed + ':area-event-v1');
  if (rng() >= 0.75) return null;
  const kind = (Object.keys(AREA_EVENTS) as AreaEventKind[])[Math.floor(rng() * 3)];
  return {
    kind,
    area: 1 + Math.floor(rng() * 3),
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
    (s.kind === 'turf' || (s.caches.length === 0 && s.rerolls === 0)) &&
    s.rerolls <= s.caches.length &&
    (!s.commander || (s.kind === 'lockdown' && stage >= s.area * 4))
  );
}
export function eventTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let unknown = false;
  p.forEach((_, key) => {
    if (!['test', 'event', 'v'].includes(key)) unknown = true;
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
  return {
    version: 6,
    seed: 'EVENTS-76-' + kind,
    stage: 4,
    hp: 100,
    mods: ['magnum', 'ricochet', 'airshot', 'light'],
    kills: 0,
    elapsed: 0,
    areaEvent: { kind, area: 1, relays: [], caches: [], commander: false, rerolls: 0 },
  };
}

export class AreaEventSystem {
  game: Game;
  state: AreaEventSave | null = null;
  active: AreaEventKind | null = null;
  site: Vec = { x: 1000, y: 710 };
  entered = 0;
  banner = '';
  bannerUntil = 0;
  crewCount = 0;
  crewKills = 0;
  cacheReady = false;
  cacheTaken = false;
  hunted = false;
  pending = false;
  patrolAt = 0;
  patrolWarned = false;
  patrolDone = false;
  beam: { from: Vec; to: Vec; until: number; warning: boolean; struck: Set<number> } | null = null;
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
  clear() {
    this.active = null;
    this.beam = null;
    this.pending = false;
    this.banner = '';
  }
  reset(cleared: boolean) {
    this.clear();
    const g = this.game,
      s = this.state;
    if (
      !s ||
      g.practice ||
      g.workshop.active ||
      g.escape ||
      g.overtime ||
      g.detour ||
      areaIndex(g.stage) !== s.area
    )
      return;
    this.active = s.kind;
    this.entered = g.time;
    this.crewCount = this.crewKills = 0;
    this.cacheReady = this.cacheTaken = this.hunted = this.patrolDone = this.patrolWarned = false;
    this.patrolAt = g.time + 10;
    if (!cleared && g.stage % 4 === 0)
      this.notice(AREA_EVENTS[s.kind].name + ' · ' + AREA_EVENTS[s.kind].hint, 6);
    if (g.level.boss || cleared) return;
    this.site = this.findSite();
    if (s.kind === 'blackout') {
      const relay = this.spawn('shooter', this.site);
      if (relay) {
        relay.eventRole = 'relay';
        relay.hp = relay.maxHp = 95 + s.area * 20;
        relay.timer = 2.2;
        relay.body.isSensor = true;
      }
    } else if (s.kind === 'turf') {
      for (const e of g.enemies) this.assignCrew(e);
      for (const [crew, x] of [640, 1500].entries()) {
        const p = this.arrival(x);
        if (p) {
          const e = this.spawn('flyer', p);
          if (e) e.crew = crew as 0 | 1;
        }
      }
    }
  }
  notice(text: string, seconds = 4) {
    this.banner = text;
    this.bannerUntil = this.game.time + seconds;
  }
  findSite(): Vec {
    const g = this.game;
    // Use clear floor with headroom. Never embed an objective in cover or machinery.
    const candidates: Vec[] = [];
    for (let x = 540; x <= 1720; x += 40) {
      const bounds = { min: { x: x - 45, y: 642 }, max: { x: x + 45, y: 738 } };
      if (!Query.region(g.solidBodies, bounds).length) candidates.push({ x, y: 724 });
    }
    const rng = seeded(g.roomSeed + ':event-site:' + g.stage);
    return candidates[Math.floor(rng() * candidates.length)] ?? { x: 1840, y: 724 };
  }
  spawn(kind: 'shooter' | 'flyer' | 'runner', pos: Vec) {
    const g = this.game,
      count = g.enemies.length;
    g.spawnEnemy(kind, pos.x, pos.y);
    return g.enemies.length > count ? g.enemies.at(-1)! : undefined;
  }
  assignCrew(e: Enemy) {
    if (
      this.active !== 'turf' ||
      this.game.level.boss ||
      e.eventRole ||
      e.squad ||
      e.elite ||
      e.crew !== undefined ||
      !['shooter', 'flyer', 'runner'].includes(e.kind)
    )
      return;
    e.crew = (this.crewCount++ % 2) as 0 | 1;
  }
  input(jump: boolean) {
    const g = this.game;
    if (
      !jump ||
      g.mode !== 'playing' ||
      !g.clear ||
      this.active !== 'lockdown' ||
      g.level.boss ||
      this.state?.commander ||
      this.hunted ||
      distance(g.player.position, this.site) > 65
    )
      return false;
    this.hunted = this.pending = true;
    g.clear = false;
    this.patrolDone = true;
    this.patrolAt = g.time + 1.1;
    this.notice('Commander inbound', 2.5);
    g.onSound('reinforce');
    return true;
  }
  update(dt: number) {
    const g = this.game;
    if (!this.active || g.level.boss || g.mode !== 'playing') return;
    if (this.beam && g.time > this.beam.until) this.beam = null;
    if (this.beam && !this.beam.warning) {
      const b = this.beam;
      // Recompute clipping every frame so moving crates shield both sides fairly.
      const end = g.lineEnd(b.from, b.to, 5);
      const hit = (body: Matter.Body) =>
        segmentBox(
          b.from,
          end,
          { x: body.bounds.min.x - 5, y: body.bounds.min.y - 5 },
          { x: body.bounds.max.x + 5, y: body.bounds.max.y + 5 },
        );
      if (!b.struck.has(-1) && hit(g.player)) {
        b.struck.add(-1);
        g.damagePlayer(19, b.from, { type: 'induction' });
      }
      for (const e of [...g.enemies])
        if (!e.eventRole && e.spawn <= 0 && !b.struck.has(e.id) && hit(e.body)) {
          b.struck.add(e.id);
          g.hitEnemy(e, 48, b.from, true, false, false);
        }
    }
    if (g.mode !== 'playing') return;
    if (
      this.active === 'turf' &&
      this.cacheReady &&
      !this.cacheTaken &&
      distance(g.player.position, this.site) < 58
    ) {
      this.cacheTaken = true;
      const s = this.state!;
      if (!s.caches.includes(g.stage)) {
        s.caches.push(g.stage);
        if (/^RF-D\d+-/.test(g.seed)) {
          g.hp = Math.min(100, g.hp + 16);
          this.notice('Salvage · +16 health');
        } else {
          s.rerolls++;
          this.notice('Salvage · one free reroll');
        }
        g.onSound('upgrade');
      }
    }
    if (this.active !== 'lockdown' || this.state?.commander) return;
    if (this.pending && g.time >= this.patrolAt) {
      if (g.enemies.length >= 12) return;
      const p = this.arrival();
      if (!p) return;
      const e = this.spawn('flyer', p);
      if (e) {
        e.crew = undefined;
        e.eventRole = 'commander';
        e.hp = e.maxHp = 340 + this.state!.area * 85;
        e.timer = 1.3;
        this.pending = false;
        g.clear = false;
      }
    } else if (!this.hunted && !g.clear && !this.patrolDone) {
      if (!this.patrolWarned && g.time >= this.patrolAt - 1.1) {
        this.patrolWarned = true;
        g.onSound('reinforce');
      }
      if (g.time >= this.patrolAt && g.enemies.length < 13) {
        const p = this.arrival();
        if (p && this.spawn('flyer', p)) this.patrolDone = true;
      }
    }
  }
  arrival(x = this.site.x): Vec | null {
    const g = this.game;
    for (const y of [this.site.y - 110, 480, 340, 180]) {
      const p = { x, y };
      if (distance(p, g.player.position) < 95) continue;
      if (
        !Query.region([...g.solidBodies, ...g.enemies.map((e) => e.body)], {
          min: { x: p.x - 24, y: p.y - 24 },
          max: { x: p.x + 24, y: p.y + 24 },
        }).length
      )
        return p;
    }
    return null;
  }
  updateEnemy(e: Enemy, dt: number): boolean {
    const g = this.game,
      p = e.body.position;
    if (e.eventRole === 'relay') {
      e.timer -= dt;
      if (e.state === 'idle' && e.timer <= 0) {
        e.aim = direction(p, g.player.position);
        e.state = 'windup';
        e.timer = 1;
        this.beam = {
          from: { ...p },
          to: { x: p.x + e.aim.x * 1600, y: p.y + e.aim.y * 1600 },
          warning: true,
          until: g.time + 1,
          struck: new Set(),
        };
        g.onSound('aim-warn');
      } else if (e.state === 'windup' && e.timer <= 0) {
        e.state = 'idle';
        e.timer = 3.6;
        this.beam = {
          from: { ...p },
          to: { x: p.x + e.aim.x * 1600, y: p.y + e.aim.y * 1600 },
          warning: false,
          until: g.time + 0.24,
          struck: new Set(),
        };
        g.onSound('enemy');
      }
      return true;
    }
    if (e.crew === undefined && e.eventRole !== 'commander') return false;
    e.timer -= dt;
    const opponent =
      e.crew === undefined
        ? undefined
        : g.enemies
            .filter(
              (other) =>
                other.crew !== undefined &&
                other.crew !== e.crew &&
                other.hp > 0 &&
                other.spawn <= 0 &&
                distance(g.lineEnd(p, other.body.position), other.body.position) < 1,
            )
            .sort((a, b) => distance(a.body.position, p) - distance(b.body.position, p))[0];
    const target =
      opponent && distance(opponent.body.position, p) < distance(g.player.position, p) * 1.3
        ? opponent.body.position
        : g.player.position;
    const d = direction(p, target),
      dist = distance(p, target);
    if (e.kind === 'runner') {
      g.updateRunner(e, d, dist);
      if (
        opponent &&
        target === opponent.body.position &&
        Query.collides(e.body, [opponent.body]).length &&
        g.time >= (e.crewMeleeAt ?? 0)
      ) {
        e.crewMeleeAt = g.time + 0.8;
        g.hitEnemy(opponent, 18, p, true, false, false);
      }
    } else if (e.kind === 'flyer') {
      Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
      const commander = e.eventRole === 'commander';
      const side = Math.sin(g.time * 0.8 + e.id) > 0 ? 1 : -1;
      const x = target.x + (commander ? side * 260 : -d.x * 260);
      Body.setVelocity(e.body, {
        x: clamp((x - p.x) * 0.016, -4.2, 4.2),
        y: clamp((clamp(target.y - 180, 180, 550) - p.y) * 0.035, -3, 3),
      });
    }
    if (e.kind !== 'runner') {
      if (e.timer > 0.65) e.aim = d;
      if (e.timer <= 0.65 && e.timer + dt > 0.65) g.onSound('aim-warn');
      if (e.timer <= 0) {
        const a = Math.atan2(e.aim.y, e.aim.x),
          commander = e.eventRole === 'commander';
        const count = commander ? (e.attacks % 2 ? 5 : 3) : e.kind === 'flyer' ? 3 : 1;
        for (let i = 0; i < count; i++)
          g.enemyShot(
            e,
            a + (i - (count - 1) / 2) * (commander ? 0.16 : 0.2),
            commander ? 10.5 : 8.5,
            commander ? 21 : 16,
          );
        e.attacks++;
        e.timer = commander ? 1.55 : 1.7;
      }
    }
    if (Query.collides(g.player, [e.body]).length)
      g.damagePlayer(e.eventRole ? 24 : 15, p, { type: 'contact', enemy: e.kind });
    if (p.y > 900) g.hitEnemy(e, 9999);
    return true;
  }
  killed(e: Enemy, credited: boolean) {
    const g = this.game,
      s = this.state;
    if (!s || !this.active) return;
    if (e.eventRole === 'relay') {
      this.beam = null;
      if (!s.relays.includes(g.stage)) {
        s.relays.push(g.stage);
        this.notice(
          s.relays.length === 3
            ? 'Reserve online · +6 health after each room'
            : `Relay restored · ${s.relays.length}/3`,
        );
      }
    }
    if (e.eventRole === 'commander') {
      s.commander = true;
      this.notice('Clearance acquired · patrols cancelled · follow-up rewards');
    }
    if (e.crew !== undefined && credited && ++this.crewKills >= 2 && !this.cacheReady) {
      this.cacheReady = true;
      this.notice('Salvage unlocked');
    }
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
    return this.state?.relays.length === 3 ? 6 : 0;
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
