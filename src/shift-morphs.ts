import Matter from 'matter-js';
import type { Game, Input, Enemy, Shot } from './game.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';
import { enemyShielded } from './enemies.ts';
import { dormant } from './stasis.ts';
import { closestBlastPoint } from './demolition.ts';

export const SHIFT_MORPH_IDS = ['piston-lance', 'cable-saw', 'seeker-rack', 'foamcaster'] as const;
export type ShiftMorphId = (typeof SHIFT_MORPH_IDS)[number];
export const MORPH = {
  pistonReach: 190,
  cableReach: 150,
  paint: 0.32,
  locks: 4,
  foamLimit: 3,
  foamLife: 4.2,
  foamWidth: 84,
  foamHeight: 18,
};
interface Flight {
  kind: ShiftMorphId;
  anchor: Matter.Body;
  origin: Vec;
  previousHome: Vec;
  born: number;
  speed: number;
  phase: 'out' | 'return';
  offset: number;
  target?: Enemy;
  returnPaid: boolean;
}
interface Paint {
  enemy: Enemy;
  progress: number;
}
export interface FoamSupport {
  body: Matter.Body;
  surface: Matter.Body;
  born: number;
  until: number;
  width: number;
  normal: Vec;
  pos: Vec;
}
export class ShiftMorphs {
  readonly game: Game;
  flights = new Map<Shot, Flight>();
  locks: Paint[] = [];
  foams: FoamSupport[] = [];
  triggerHeld = false;
  private wasHeld = false;
  private cast: { targets: Enemy[]; until: number | null; started: boolean } | null = null;
  private salvoTargets: Enemy[] = [];
  private shotOrder = 0;
  private foamAt = -100;
  constructor(game: Game) {
    this.game = game;
  }
  get equipped(): ShiftMorphId | null {
    const chosen = SHIFT_MORPH_IDS.find((id) => this.game.mods.includes(id));
    const leased = (this.game as Game & { shiftRun?: { leasedMorph?: unknown } }).shiftRun
      ?.leasedMorph;
    return (
      chosen ?? (SHIFT_MORPH_IDS.includes(leased as ShiftMorphId) ? (leased as ShiftMorphId) : null)
    );
  }
  private get active() {
    const g = this.game;
    return (
      g.mode === 'playing' &&
      g.hitStop <= 0 &&
      !(g.finale.cinema?.waiting && !g.finale.cinema.combat)
    );
  }
  reset() {
    for (const f of this.foams) {
      Matter.Composite.remove(this.game.engine.world, f.body);
      this.game.terrain = this.game.terrain.filter((b) => b !== f.body);
    }
    this.foams = [];
    this.flights.clear();
    this.locks = [];
    this.cast = null;
    this.salvoTargets = [];
    this.shotOrder = 0;
    this.triggerHeld = this.wasHeld = false;
    this.foamAt = -100;
  }
  pause() {
    this.cast = null;
    this.locks = [];
    this.salvoTargets = [];
    this.wasHeld = this.triggerHeld = false;
  }
  private exposed(e: Enemy, from = this.game.player.position) {
    return (
      e.hp > 0 &&
      e.spawn <= 0 &&
      !e.allied &&
      !e.courier &&
      e.eventRole !== 'relay' &&
      this.game.enemies.includes(e) &&
      distance(from, e.body.position) < 1250 &&
      distance(this.game.lineEnd(from, e.body.position), e.body.position) < 1 &&
      !enemyShielded(e, direction(from, e.body.position))
    );
  }
  input(dt: number, input: Input): Input {
    if (!this.active || !Number.isFinite(dt) || dt <= 0)
      return this.equipped === 'seeker-rack'
        ? { ...input, fire: false, firePressed: false }
        : input;
    this.triggerHeld = input.fire;
    if (this.equipped !== 'seeker-rack') {
      this.wasHeld = input.fire;
      return input;
    }
    const g = this.game;
    this.locks = this.locks.filter((p) => this.exposed(p.enemy));
    if (input.fire && !this.cast) {
      const aim = direction(g.player.position, input.aim);
      const target = g.enemies
        .filter((e) => this.exposed(e))
        .filter((e) => {
          const d = direction(g.player.position, e.body.position);
          return d.x * aim.x + d.y * aim.y > Math.cos(0.2);
        })
        .sort(
          (a, b) => distance(a.body.position, input.aim) - distance(b.body.position, input.aim),
        )[0];
      if (target) {
        let p = this.locks.find((p) => p.enemy === target);
        if (!p && this.locks.length < MORPH.locks) {
          p = { enemy: target, progress: 0 };
          this.locks.push(p);
        }
        if (p) p.progress = Math.min(1, p.progress + Math.min(dt, 0.1) / MORPH.paint);
      }
    }
    if (!input.fire && this.wasHeld && !this.cast) {
      const targets = this.locks
        .filter((p) => p.progress >= 1 && this.exposed(p.enemy))
        .map((p) => p.enemy);
      this.locks = [];
      if (targets.length) {
        this.salvoTargets = targets;
        this.shotOrder = 0;
        this.cast = { targets, until: null, started: false };
      }
    }
    this.wasHeld = input.fire;
    if (!this.cast) return { ...input, fire: false, firePressed: false };
    const cast = this.cast,
      target =
        cast.targets.find((e) => this.exposed(e)) ?? (cast.started ? cast.targets[0] : undefined);
    if (!target) {
      this.cast = null;
      return { ...input, fire: false, firePressed: false };
    }
    if (cast.until === null) {
      if (g.time + dt < g.shootAt || g.burstRemaining > 0)
        return { ...input, fire: false, firePressed: false };
      const duration = g.torch.equipped
        ? g.mods.includes('charge-lens')
          ? g.torch.chargeDuration
          : g.gun.interval * (g.gun.burstCount === 3 ? 1.75 : 1)
        : dt;
      cast.until = g.time + Math.ceil(duration / dt) * dt;
    }
    const fire = g.time + 1e-8 < cast.until,
      first = !cast.started && fire;
    cast.started ||= fire;
    if (!fire) this.cast = null;
    return { ...input, fire, firePressed: first, aim: { ...target.body.position } };
  }
  prepare(s: Shot) {
    const kind = this.equipped,
      g = this.game;
    if (!kind || !s.friendly || s.fragment || s.reflected || dormant(s) || this.flights.has(s))
      return;
    let anchor = g.player;
    if (s.allied) {
      const ally = g.factions.allies
        .filter((e) => e.hp > 0 && e.rebootUntil !== undefined)
        .sort((a, b) => distance(a.body.position, s.pos) - distance(b.body.position, s.pos))[0];
      if (ally) anchor = ally.body;
    }
    const target =
      kind === 'seeker-rack'
        ? this.salvoTargets.filter((e) => this.exposed(e, anchor.position))[
            this.shotOrder++ % Math.max(1, this.salvoTargets.length)
          ]
        : undefined;
    this.flights.set(s, {
      kind,
      anchor,
      origin: { ...s.pos },
      previousHome: { ...anchor.position },
      born: g.time,
      speed: Math.max(8, Math.hypot(s.vel.x, s.vel.y)),
      phase: 'out',
      offset:
        Math.atan2(s.vel.y, s.vel.x) -
        Math.atan2(g.aim.y - anchor.position.y, g.aim.x - anchor.position.x),
      target,
      returnPaid: false,
    });
    const paid = s as Shot & { shiftMorphPaid?: ShiftMorphId };
    if ((kind === 'piston-lance' || kind === 'cable-saw') && paid.shiftMorphPaid !== kind) {
      paid.shiftMorphPaid = kind;
      s.pierce++;
      if (kind === 'piston-lance') {
        s.damage *= 1.25;
        if (s.shell) s.shell.damage *= 1.25;
      }
    }
    if (kind === 'piston-lance') s.life = Math.min(s.life, 0.65);
    if (kind === 'cable-saw') {
      s.life = Math.min(s.life, 0.95);
      s.radius = Math.max(s.radius, 7);
    }
  }
  updateShot(s: Shot, dt: number) {
    if (
      !this.active ||
      !Number.isFinite(dt) ||
      dt <= 0 ||
      s.life <= 0 ||
      dormant(s) ||
      s.meltTransit
    )
      return;
    if (!this.flights.has(s)) this.prepare(s);
    const f = this.flights.get(s);
    if (!f) return;
    if (distance(f.anchor.position, f.previousHome) > 95) {
      s.life = 0;
      return;
    }
    f.previousHome = { ...f.anchor.position };
    if (f.kind === 'seeker-rack') {
      const e = f.target;
      if (!e || !this.exposed(e, s.pos)) return;
      const speed = Math.hypot(s.vel.x, s.vel.y),
        a = Math.atan2(s.vel.y, s.vel.x),
        d = direction(s.pos, e.body.position),
        delta = Math.atan2(Math.sin(Math.atan2(d.y, d.x) - a), Math.cos(Math.atan2(d.y, d.x) - a)),
        angle = a + clamp(delta, -dt * 3.8, dt * 3.8);
      s.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
      return;
    }
    if (f.kind !== 'piston-lance' && f.kind !== 'cable-saw') return;
    const home = f.anchor.position,
      age = this.game.time - f.born,
      reach = f.kind === 'piston-lance' ? MORPH.pistonReach : MORPH.cableReach;
    if (
      f.phase === 'out' &&
      (distance(f.origin, s.pos) >= reach - 3 || age > (f.kind === 'piston-lance' ? 0.2 : 0.32))
    )
      f.phase = 'return';
    if (
      f.kind === 'cable-saw' &&
      this.triggerHeld &&
      age < 0.55 &&
      distance(home, s.pos) > reach * 0.7
    ) {
      const aim = direction(home, this.game.aim),
        angle = Math.atan2(aim.y, aim.x) + f.offset + Math.sin(age * 9) * 0.45;
      const to = { x: home.x + Math.cos(angle) * reach, y: home.y + Math.sin(angle) * reach },
        d = direction(s.pos, to),
        speed = Math.min(f.speed, distance(s.pos, to) / (dt * 60));
      s.vel = { x: d.x * speed, y: d.y * speed };
      return;
    }
    if (f.phase === 'return') {
      if (f.kind === 'cable-saw' && !f.returnPaid) {
        f.returnPaid = true;
        // Recall already owns its complete return leg. The morph never buys a third one.
        if (!s.recall) {
          s.hits.clear();
          s.damage *= 0.5;
          if (s.shell) s.shell.damage *= 0.5;
          s.fragment = true;
          s.echo = true;
          s.counter = 0;
          s.discharge = undefined;
          s.tripwire = undefined;
          s.vector = undefined;
          s.massDriver?.struck.clear();
          s.massDriver?.penetrating.clear();
        }
      }
      if (distance(s.pos, home) < 18) {
        s.life = 0;
        return;
      }
      const d = direction(s.pos, home),
        speed = Math.min(f.speed, distance(s.pos, home) / (dt * 60));
      s.vel = { x: d.x * speed, y: d.y * speed };
    } else {
      const remaining = Math.max(0, reach - distance(f.origin, s.pos)),
        speed = Math.hypot(s.vel.x, s.vel.y),
        limit = remaining / (dt * 60);
      if (speed > limit && speed > 0) {
        s.vel.x *= limit / speed;
        s.vel.y *= limit / speed;
      }
    }
  }
  beamGain() {
    return this.equipped === 'piston-lance' || this.equipped === 'cable-saw' ? 1.35 : 1;
  }
  beamPierce(base: number) {
    return base + Number(this.equipped === 'piston-lance' || this.equipped === 'cable-saw');
  }
  beamRange(base: number) {
    const id = this.equipped;
    if (id === 'piston-lance') {
      const cycle =
        (this.game.time % Math.max(0.12, this.game.gun.interval)) /
        Math.max(0.12, this.game.gun.interval);
      return Math.min(base, 60 + Math.sin(cycle * Math.PI) * 130);
    }
    if (id === 'cable-saw') return Math.min(base, MORPH.cableReach);
    return base;
  }
  beamDirection(base: Vec) {
    if (this.equipped !== 'cable-saw') return base;
    const angle = Math.sin(this.game.time * 9) * 0.45;
    return {
      x: base.x * Math.cos(angle) - base.y * Math.sin(angle),
      y: base.x * Math.sin(angle) + base.y * Math.cos(angle),
    };
  }
  beamOrigin(base: Vec) {
    return base;
  }
  terrainHit(s: Shot, body: Matter.Body | undefined, normal: Vec) {
    const g = this.game;
    if (
      !this.active ||
      this.equipped !== 'foamcaster' ||
      !body ||
      !g.terrainBodies.includes(body) ||
      !s.friendly ||
      s.fragment ||
      s.reflected ||
      s.echo ||
      s.allied ||
      g.time < this.foamAt
    )
      return;
    const n = direction({ x: 0, y: 0 }, normal);
    if (!n.x && !n.y) return;
    const contact = closestBlastPoint(s.pos, body);
    const pos = {
        x: contact.x + n.x * (MORPH.foamHeight / 2 + 0.5),
        y: contact.y + n.y * (MORPH.foamHeight / 2 + 0.5),
      },
      angle = Math.atan2(n.y, n.x) + Math.PI / 2;
    const probe = Matter.Bodies.rectangle(pos.x, pos.y, MORPH.foamWidth, MORPH.foamHeight, {
      isStatic: true,
      angle,
    });
    if (
      probe.bounds.min.x < 240 ||
      probe.bounds.max.x > g.worldWidth - 240 ||
      probe.bounds.min.y < g.worldTop + 8 ||
      probe.bounds.max.y > 740
    )
      return;
    const room = g.uprising.room;
    const areas = [
      ...(room?.evacuation ? [room.evacuation] : []),
      ...(room?.switches ?? []).map((p) => ({ x: p.x - 45, y: p.y - 45, w: 90, h: 90 })),
    ];
    if (
      areas.some(
        (a) =>
          probe.bounds.min.x < a.x + a.w &&
          probe.bounds.max.x > a.x &&
          probe.bounds.min.y < a.y + a.h &&
          probe.bounds.max.y > a.y,
      )
    )
      return;
    const others = [
      ...g.solidBodies,
      g.player,
      ...g.enemies.flatMap((e) => [e.body, ...(e.crane ? [e.crane.body] : [])]),
      ...g.factions.allies.map((e) => e.body),
    ];
    if (Matter.Query.collides(probe, others).length) return;
    if (this.foams.length >= MORPH.foamLimit) this.removeFoam(this.foams[0]);
    const support = Matter.Bodies.rectangle(pos.x, pos.y, 12, MORPH.foamHeight, {
      isStatic: true,
      angle,
      label: 'terrain',
    });
    Matter.Composite.add(g.engine.world, support);
    g.terrain.push(support);
    this.foams.push({
      body: support,
      surface: body,
      born: g.time,
      until: g.time + MORPH.foamLife,
      width: 12,
      normal: n,
      pos,
    });
    this.foamAt = g.time + 0.35;
    g.burst(pos, 5, '#a5cdb4', 2);
    g.onSound('prop');
  }
  private removeFoam(f: FoamSupport) {
    Matter.Composite.remove(this.game.engine.world, f.body);
    this.game.terrain = this.game.terrain.filter((b) => b !== f.body);
    this.foams = this.foams.filter((other) => other !== f);
  }
  tick(dt: number) {
    const g = this.game;
    if (!this.active || !Number.isFinite(dt) || dt <= 0) return;
    for (const [s] of this.flights) if (s.life <= 0 || !g.shots.includes(s)) this.flights.delete(s);
    for (const f of [...this.foams]) {
      if (g.time >= f.until || !g.terrainBodies.includes(f.surface)) {
        this.removeFoam(f);
        continue;
      }
      const width = Math.min(MORPH.foamWidth, f.width + 240 * Math.min(dt, 0.1));
      if (width === f.width) continue;
      const probe = Matter.Bodies.rectangle(f.pos.x, f.pos.y, width, MORPH.foamHeight, {
        isStatic: true,
        angle: f.body.angle,
      });
      if (
        Matter.Query.collides(probe, [
          ...g.solidBodies.filter((b) => b !== f.body),
          g.player,
          ...g.enemies.flatMap((e) => [e.body, ...(e.crane ? [e.crane.body] : [])]),
          ...g.factions.allies.map((e) => e.body),
        ]).length
      )
        continue;
      const angle = f.body.angle;
      Matter.Body.rotate(f.body, -angle);
      Matter.Body.scale(f.body, width / f.width, 1);
      Matter.Body.rotate(f.body, angle);
      f.width = width;
    }
  }
}
