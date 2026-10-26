import Matter from 'matter-js';
import type { Enemy, Game, Shot } from './game.ts';
import type { Prop } from './props.ts';
import type { Portal } from './portals.ts';
import type { WireAnchor } from './tripwire.ts';
import type { GrindSaw } from './grindshot.ts';
import type { TorchSegment } from './torch.ts';
import { traceTorch, TORCH } from './torch.ts';
import { firstSolid, sweepBox } from './collisions.ts';
import { wireCrossing, TRIPWIRE } from './tripwire.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';
import { dormant } from './stasis.ts';

export const SHIFT_FUSIONS = {
  caught: 3,
  catchLife: 3,
  gateLife: 8,
  mills: 4,
  millLife: 0.85,
  cometBalls: 3,
  cometProps: 3,
  ghosts: 4,
};
interface Captured {
  shot: Shot;
  until: number;
}
export interface GateSnare {
  a: WireAnchor;
  b: WireAnchor;
  portals: Portal[];
  segments: { a: Vec; b: Vec }[];
  armed: number;
  until: number;
  damage: number;
}
export interface Windmill {
  center: Vec;
  pos: Vec;
  angle: number;
  spin: number;
  radius: number;
  life: number;
  damage: number;
  hits: Set<number>;
  trail: Vec[];
}
interface GhostRay {
  dir: Vec;
  damage: number;
  radius: number;
  range: number;
  banks: number;
  pierce: number;
}
interface GhostVolley {
  ally: Enemy;
  origin: Vec;
  forward: Vec;
  at: number;
  shots: Shot[];
  rays: Map<number, GhostRay>;
  pulse?: number;
}
interface Comet {
  shot: Shot;
  props: Set<Prop>;
}
const nearest = (a: Vec, b: Vec, p: Vec): Vec => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return { x: a.x + dx * t, y: a.y + dy * t };
};
const crosses = (a: Vec, b: Vec, c: Vec, d: Vec) => {
  const u = { x: b.x - a.x, y: b.y - a.y },
    v = { x: d.x - c.x, y: d.y - c.y },
    den = u.x * v.y - u.y * v.x;
  if (Math.abs(den) < 1e-8)
    return distance(nearest(a, b, c), c) < 5 || distance(nearest(a, b, d), d) < 5;
  const q = { x: c.x - a.x, y: c.y - a.y },
    t = (q.x * v.y - q.y * v.x) / den,
    w = (q.x * u.y - q.y * u.x) / den;
  return t >= 0 && t <= 1 && w >= 0 && w <= 1;
};

/** Room-local secondary energy. None of these effects acquire charges or produce their own primary procs. */
export class ShiftFusions {
  readonly game: Game;
  captured: Captured[] = [];
  gate: GateSnare | null = null;
  mills: Windmill[] = [];
  ghosts: GhostVolley[] = [];
  comets = new Map<number, Comet>();
  ghostEffects: { a: Vec; b: Vec; at: number }[] = [];
  hot: { link: NonNullable<Game['tethers']['link']>; energy: number; until: number } | null = null;
  private starts = new Map<Matter.Body, Vec>();
  private cover = new Map<Matter.Body, Vec[]>();
  private volleys = 0;
  private beamSeen = -1;
  constructor(game: Game) {
    this.game = game;
  }
  has(id: string) {
    return this.game.mods.includes(id);
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
    this.captured = [];
    this.gate = null;
    this.mills = [];
    this.ghosts = [];
    this.comets.clear();
    this.ghostEffects = [];
    this.hot = null;
    this.starts.clear();
    this.cover.clear();
    this.volleys = 0;
    this.beamSeen = -1;
  }
  private get blockers() {
    const g = this.game;
    return [
      ...g.solidBodies,
      ...g.enemies.flatMap((e) => (e.crane && e.spawn <= 0 ? [e.crane.body] : [])),
    ];
  }
  private clear(a: Vec, b: Vec, ignore: Matter.Body[] = []) {
    return !firstSolid(
      a,
      b,
      { x: 1, y: 1 },
      this.blockers.filter((b) => !ignore.includes(b)),
    );
  }
  capture(shot: Shot) {
    const g = this.game;
    if (
      !this.active ||
      !this.has('catch-chamber') ||
      !this.has('suspension') ||
      this.captured.length >= SHIFT_FUSIONS.caught ||
      !shot.reflected ||
      shot.echo ||
      shot.allied ||
      shot.blade ||
      shot.radius > 5
    )
      return false;
    const copy = structuredClone(shot);
    copy.counter = 0;
    copy.stasis = undefined;
    copy.recall = undefined;
    copy.vector = undefined;
    copy.shell = undefined;
    copy.massDriver = undefined;
    copy.tripwire = undefined;
    copy.mutationShell = undefined;
    copy.angler = undefined;
    copy.enemyAmmo = undefined;
    copy.echo = true;
    copy.fragment = true;
    copy.reflected = true;
    copy.life = 1.4;
    copy.damage = Math.min(24, copy.damage);
    this.captured.push({ shot: copy, until: g.time + SHIFT_FUSIONS.catchLife });
    shot.life = 0;
    g.burst(shot.pos, 5, '#b5d9ee', 2);
    return true;
  }
  caughtPosition(index: number) {
    const g = this.game,
      angle = -Math.PI * 0.8 + index * 0.4;
    return g.lineEnd(
      g.player.position,
      {
        x: g.player.position.x + Math.cos(angle) * 35,
        y: g.player.position.y + Math.sin(angle) * 35,
      },
      3,
    );
  }
  releaseCaptured() {
    const g = this.game;
    if (!this.active) return;
    const stock = this.captured.splice(0);
    stock.forEach((entry, index) => {
      if (entry.until <= g.time || g.shots.length >= 180) return;
      const s = entry.shot,
        pos = this.caughtPosition(index),
        d = direction(pos, g.aim);
      if (!d.x && !d.y) d.x = 1;
      s.id = ++g.id;
      s.pos = { ...pos };
      s.prev = { ...pos };
      s.vel = { x: d.x * 24, y: d.y * 24 };
      s.hits.clear();
      s.trace = { bank: false, pierce: s.pierce > 0, points: [{ ...pos }] };
      g.shots.push(s);
    });
    if (stock.length) g.onSound('loaded');
  }
  linkGate(a: WireAnchor, b: WireAnchor) {
    const g = this.game;
    if (!this.active || !this.has('gate-snare') || !g.portals.linked) return false;
    const [p, q] = g.portals.pair as [Portal, Portal];
    for (const [entry, exit] of [
      [p, q],
      [q, p],
    ]) {
      const from = { x: entry.pos.x + entry.normal.x * 6, y: entry.pos.y + entry.normal.y * 6 },
        to = { x: exit.pos.x + exit.normal.x * 6, y: exit.pos.y + exit.normal.y * 6 };
      const length = distance(a.pos, from) + distance(to, b.pos);
      if (
        length < TRIPWIRE.min ||
        length > 900 ||
        !this.clear(a.pos, from) ||
        !this.clear(to, b.pos)
      )
        continue;
      this.gate = {
        a,
        b,
        portals: [entry, exit],
        segments: [
          { a: { ...a.pos }, b: from },
          { a: to, b: { ...b.pos } },
        ],
        armed: g.time + TRIPWIRE.arm,
        until: g.time + SHIFT_FUSIONS.gateLife,
        damage:
          Math.min(260, (a.damage + b.damage) * 0.5 * TRIPWIRE.damage) *
          0.8 *
          (1 +
            (g.mods.includes('tension')
              ? clamp((length - TRIPWIRE.min) / (600 - TRIPWIRE.min), 0, 1) * TRIPWIRE.tension
              : 0)),
      };
      g.tripwires.wires = [];
      g.onSound('tripwire-link');
      return true;
    }
    return false;
  }
  private gateValid(gate: GateSnare) {
    const g = this.game;
    return (
      this.has('gate-snare') &&
      g.portals.linked &&
      gate.until > g.time &&
      gate.portals.every((p) => g.portals.pair.includes(p)) &&
      [gate.a, gate.b].every(
        (a) =>
          g.terrainBodies.includes(a.body) &&
          distance(a.body.position, a.origin) < 0.01 &&
          Math.abs(a.body.angle - a.angle) < 0.0001,
      ) &&
      gate.segments.every((s) => this.clear(s.a, s.b))
    );
  }
  suppressAllyFire(e: Enemy) {
    return this.has('ghost-shift') && e.allied === true && e.rebootUntil !== undefined;
  }
  private allies() {
    return this.game.factions.allies
      .filter(
        (e) =>
          this.suppressAllyFire(e) && e.hp > 0 && e.spawn <= 0 && e.rebootUntil! > this.game.time,
      )
      .slice(0, 2);
  }
  recordVolley(afterId: number, origin: Vec, forward: Vec) {
    const g = this.game;
    if (!this.active || !this.has('ghost-shift') || ++this.volleys % 4) return;
    const allies = this.allies(),
      shots = g.shots.filter(
        (s) => s.id > afterId && s.friendly && !s.allied && !s.fragment && !s.echo && !s.reflected,
      );
    if (!allies.length || !shots.length) return;
    for (const ally of allies) {
      if (this.ghosts.length >= SHIFT_FUSIONS.ghosts) break;
      const copy = structuredClone(shots);
      for (const s of copy) {
        s.damage *= 0.6 / allies.length;
        if (s.shell) s.shell.damage *= 0.6 / allies.length;
      }
      this.ghosts.push({
        ally,
        origin: { ...origin },
        forward: { ...forward },
        at: g.time + 0.42,
        shots: copy,
        rays: new Map(),
      });
    }
  }
  /** Receives only actual lit beam energy, once per fixed step. Returns the direct-fire share. */
  beamSample(segments: TorchSegment[], damage: number, pulse: number) {
    const g = this.game;
    if (!this.active || !(damage > 0) || !Number.isFinite(damage)) return 1;
    if (this.has('ghost-shift')) {
      if (this.beamSeen !== pulse) {
        this.beamSeen = pulse;
        this.volleys++;
        if (this.volleys % 4 === 0) {
          const allies = this.allies();
          for (const ally of allies)
            if (this.ghosts.length < SHIFT_FUSIONS.ghosts)
              this.ghosts.push({
                ally,
                origin: { ...g.player.position },
                forward: direction(g.player.position, g.aim),
                at: g.time + 0.42,
                shots: [],
                rays: new Map(),
                pulse,
              });
        }
      }
      const pending = this.ghosts.filter((v) => v.pulse === pulse),
        count = Math.max(1, pending.length);
      const baseRange = TORCH.range * g.toolroom.rangeScale;
      const morphRange =
        (g as Game & { shiftMorphs?: { beamRange(base: number): number } }).shiftMorphs?.beamRange(
          baseRange,
        ) ?? baseRange;
      for (const v of pending) {
        v.at = g.time + 0.42;
        for (const s of segments.filter((s) => s.muzzle).slice(0, 108)) {
          const id = s.ray ?? 0,
            old = v.rays.get(id);
          const amount = (damage * s.gain * 0.6) / count;
          if (old) {
            old.damage += amount;
            old.range = Math.max(old.range, morphRange);
          } else
            v.rays.set(id, {
              dir: { ...s.dir },
              damage: amount,
              radius: 1.5,
              range: morphRange,
              banks: g.gun.bounces,
              pierce:
                (
                  g as Game & { shiftMorphs?: { beamPierce(base: number): number } }
                ).shiftMorphs?.beamPierce(g.gun.pierce + g.torch.extraPierce) ??
                g.gun.pierce + g.torch.extraPierce,
            });
        }
      }
    }
    const link = g.tethers.link;
    if (
      !this.has('hot-wire') ||
      !link ||
      !g.tethers.clearPath(link.a, link.b) ||
      !segments.some((s) => crosses(s.a, s.b, link.a.body.position, link.b.body.position))
    )
      return 1;
    const energy = segments.filter((s) => s.muzzle).reduce((n, s) => n + damage * s.gain * 0.25, 0);
    if (energy <= 0) return 1;
    if (this.hot?.link !== link) this.hot = { link, energy: 0, until: g.time + 0.28 };
    this.hot!.energy = Math.min(200, this.hot!.energy + energy);
    this.hot!.until = g.time + 0.28;
    return 0.75;
  }
  catchSaw(saw: GrindSaw) {
    const g = this.game;
    if (
      !this.active ||
      !this.has('windmill') ||
      this.mills.length >= SHIFT_FUSIONS.mills ||
      saw.life <= 0
    )
      return false;
    const gust = g.salvage.gusts.find(
      (f) =>
        g.time - f.at <= g.salvage.windLife && distance(nearest(f.a, f.b, saw.pos), saw.pos) < 36,
    );
    if (!gust) return false;
    const edge = saw.body.vertices[saw.edge],
      next = saw.body.vertices[(saw.edge + 1) % saw.body.vertices.length],
      tangent = direction(edge, next);
    const d = { x: tangent.y, y: -tangent.x },
      center = { x: saw.pos.x + d.x * 32, y: saw.pos.y + d.y * 32 };
    if (!this.clear(saw.pos, center, [saw.body])) return false;
    this.mills.push({
      center,
      pos: { ...saw.pos },
      angle: Math.atan2(saw.pos.y - center.y, saw.pos.x - center.x),
      spin: -saw.dir,
      radius: clamp(distance(center, saw.pos), 24, 56),
      life: Math.min(saw.life, SHIFT_FUSIONS.millLife),
      damage: saw.damage * 0.8,
      hits: new Set(saw.hits),
      trail: [{ ...saw.pos }],
    });
    saw.life = 0;
    g.onSound('grind');
    return true;
  }
  private expendable(p: Prop) {
    return (
      p.hp > 0 &&
      !p.body.isStatic &&
      ['crate', 'cover', 'rubble'].includes(p.kind) &&
      !p.uprising &&
      !p.hunt &&
      !p.auditCase &&
      !p.cargo &&
      !p.charge &&
      !p.welded
    );
  }
  comet(s: Shot, dt: number) {
    const g = this.game;
    if (
      !this.active ||
      !this.has('scrap-comet') ||
      !s.massDriver ||
      s.echo ||
      s.fragment ||
      s.reflected ||
      dormant(s) ||
      s.life <= 0
    )
      return;
    let c = this.comets.get(s.id);
    if (!c) {
      if (this.comets.size >= SHIFT_FUSIONS.cometBalls) return;
      c = { shot: s, props: new Set() };
    }
    for (const p of [...c.props])
      if (
        !g.props.items.includes(p) ||
        !this.expendable(p) ||
        distance(p.body.position, s.pos) > 260
      )
        c.props.delete(p);
    const claimed = new Set([...this.comets.values()].flatMap((c) => [...c.props]));
    const candidates = g.props.items
      .filter(
        (p) =>
          this.expendable(p) &&
          !claimed.has(p) &&
          distance(p.body.position, s.pos) < 150 &&
          this.clear(s.pos, p.body.position, [p.body]),
      )
      .sort((a, b) => distance(a.body.position, s.pos) - distance(b.body.position, s.pos));
    if (!c.props.size && !candidates.length) return;
    this.comets.set(s.id, c);
    for (const p of candidates) {
      if (c.props.size >= SHIFT_FUSIONS.cometProps) break;
      c.props.add(p);
      s.vel.x *= 0.8;
      s.vel.y *= 0.8;
      s.bounces = Math.max(0, s.bounces - 1);
    }
    for (const p of c.props) {
      if (!this.clear(s.pos, p.body.position, [p.body])) continue;
      const d = direction(p.body.position, s.pos),
        speed = Math.min(11, distance(p.body.position, s.pos) * 0.12),
        scale = clamp(dt * 60, 0, 1);
      const target = { x: s.vel.x * 0.6 + d.x * speed, y: s.vel.y * 0.6 + d.y * speed };
      Matter.Body.setVelocity(p.body, {
        x: clamp(p.body.velocity.x + (target.x - p.body.velocity.x) * 0.35 * scale, -18, 18),
        y: clamp(p.body.velocity.y + (target.y - p.body.velocity.y) * 0.35 * scale, -18, 18),
      });
    }
  }
  releaseComet(s: Shot) {
    const c = this.comets.get(s.id);
    if (!c) return;
    this.comets.delete(s.id);
    const g = this.game;
    if (!this.active) return;
    let i = 0;
    for (const p of c.props) {
      if (!g.props.items.includes(p) || !this.expendable(p)) continue;
      const angle = Math.atan2(s.vel.y, s.vel.x) + (i++ - (c.props.size - 1) / 2) * 0.32;
      Matter.Body.setVelocity(p.body, {
        x: clamp(Math.cos(angle) * 15, -18, 18),
        y: clamp(Math.sin(angle) * 15 - 2, -18, 18),
      });
    }
  }
  beforeStep(dt: number) {
    if (!this.active || !(dt > 0) || !Number.isFinite(dt)) return;
    this.starts.clear();
    this.cover.clear();
    for (const e of this.game.enemies) this.starts.set(e.body, { ...e.body.position });
    for (const b of this.blockers)
      this.cover.set(
        b,
        b.vertices.map((v) => ({ x: v.x, y: v.y })),
      );
  }
  private sweptBlock(a: Vec, b: Vec, ignore: Matter.Body[] = []) {
    return this.blockers
      .filter((body) => !ignore.includes(body))
      .some((body) => {
        const old = this.cover.get(body);
        if (!old || old.every((v, i) => body.vertices[i] && distance(v, body.vertices[i]) < 0.01))
          return false;
        const vertices = Matter.Vertices.hull([...old, ...body.vertices] as Matter.Vertex[]);
        return !!firstSolid(a, b, { x: 1, y: 1 }, [
          { ...body, vertices, bounds: Matter.Bounds.create(vertices) },
        ]);
      });
  }
  private ghost(v: GhostVolley) {
    const g = this.game,
      ally = v.ally;
    if (
      !this.allies().includes(ally) ||
      Matter.Query.point(this.blockers, ally.body.position).length
    )
      return;
    const from = { x: ally.body.position.x, y: ally.body.position.y - 3 },
      target = g.factions.combatTarget(ally),
      d = direction(from, target);
    const angle = Math.atan2(d.y, d.x) - Math.atan2(v.forward.y, v.forward.x),
      rotate = (p: Vec) => ({
        x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
        y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
      });
    for (const template of v.shots) {
      if (g.shots.length >= 180) break;
      const s = structuredClone(template),
        offset = rotate({ x: s.pos.x - v.origin.x, y: s.pos.y - v.origin.y });
      s.pos = g.lineEnd(from, { x: from.x + offset.x, y: from.y + offset.y }, s.radius);
      s.prev = { ...s.pos };
      s.vel = rotate(s.vel);
      s.id = ++g.id;
      s.echo = true;
      s.allied = true;
      s.rebooted = true;
      s.counter = 0;
      s.stasis = undefined;
      s.tripwire = undefined;
      s.discharge = undefined;
      s.vector = undefined;
      s.recall = undefined;
      s.hits.clear();
      if (s.trace) s.trace.points = [{ ...s.pos }];
      g.shots.push(s);
    }
    for (const ray of v.rays.values()) {
      const dir = rotate(ray.dir),
        segments = traceTorch(
          g,
          false,
          0,
          TORCH.segments,
          { used: false },
          {
            from,
            dir,
            remaining: ray.range,
            banks: ray.banks,
            pierce: ray.pierce,
            gain: 1,
            radius: ray.radius,
          },
        );
      const seen = new Set<Enemy>();
      for (const s of segments) {
        if (this.ghostEffects.length < 216)
          this.ghostEffects.push({ a: { ...s.a }, b: { ...s.b }, at: g.time });
        if (s.enemy && !seen.has(s.enemy)) {
          seen.add(s.enemy);
          g.hitEnemy(
            s.enemy,
            ray.damage * s.gain,
            { x: s.b.x - s.dir.x * 24, y: s.b.y - s.dir.y * 24 },
            true,
            false,
            false,
          );
        } else if (s.prop) g.props.hit(s.prop, ray.damage * s.gain, s.dir, undefined, false, false);
      }
    }
    g.burst(from, 3, '#8dcdf1', 2);
    g.onSound('echo-shot');
  }
  afterStep(dt: number) {
    const g = this.game;
    if (!this.active || !(dt > 0) || !Number.isFinite(dt)) return;
    dt = Math.min(dt, 0.1);
    this.captured = this.captured.filter((c) => c.until > g.time);
    this.ghostEffects = this.ghostEffects.filter((e) => g.time - e.at < 0.14);
    for (const [id, c] of this.comets)
      if (c.shot.life <= 0 || !g.shots.includes(c.shot)) this.comets.delete(id);
    const due = this.ghosts.filter((v) => v.at <= g.time);
    this.ghosts = this.ghosts.filter((v) => v.at > g.time);
    for (const v of due) this.ghost(v);
    if (this.gate) {
      const gate = this.gate;
      if (
        !this.gateValid(gate) ||
        gate.segments.some((s, i) =>
          this.sweptBlock(s.a, s.b, [i === 0 ? gate.a.body : gate.b.body, gate.portals[i].body]),
        )
      )
        this.gate = null;
      else if (g.time >= gate.armed) {
        let triggered = false;
        for (const s of gate.segments) {
          for (const e of g.enemies.filter((e) => e.hp > 0 && e.spawn <= 0)) {
            const hit = wireCrossing(s.a, s.b, e.body, this.starts.get(e.body) ?? e.body.position);
            if (!hit) continue;
            this.gate = null;
            g.demolition.detonate(
              {
                pos: hit.point,
                damage: gate.damage,
                radius: TRIPWIRE.radius,
                launch: g.gun.blastSurf ? 8 : 0,
                kind: 'tripwire',
              },
              e,
            );
            triggered = true;
            break;
          }
          if (triggered) break;
        }
      }
    }
    if (this.hot) {
      const h = this.hot,
        l = h.link,
        a = l.a.body.position,
        b = l.b.body.position;
      if (
        l.a.hp <= 0 ||
        l.b.hp <= 0 ||
        !g.enemies.includes(l.a) ||
        !g.enemies.includes(l.b) ||
        g.tethers.link !== l ||
        g.time >= h.until ||
        !g.tethers.clearPath(l.a, l.b) ||
        this.sweptBlock(a, b)
      )
        this.hot = null;
      else if (h.energy > 0) {
        const touched = g.enemies.filter(
          (e) =>
            e !== l.a &&
            e !== l.b &&
            e.hp > 0 &&
            e.spawn <= 0 &&
            wireCrossing(a, b, e.body, this.starts.get(e.body) ?? e.body.position) &&
            this.clear(nearest(a, b, e.body.position), e.body.position),
        );
        if (touched.length) {
          const energy = h.energy;
          h.energy = 0;
          for (const e of touched)
            g.hitEnemy(
              e,
              energy / touched.length,
              nearest(a, b, e.body.position),
              true,
              false,
              false,
            );
        }
      }
    }
    for (const m of this.mills) {
      m.life -= dt;
      if (m.life <= 0) continue;
      let remaining = dt;
      while (remaining > 1e-6 && m.life > 0) {
        const step = Math.min(remaining, 1 / 120);
        remaining -= step;
        m.angle += step * 9 * m.spin;
        const next = {
            x: m.center.x + Math.cos(m.angle) * m.radius,
            y: m.center.y + Math.sin(m.angle) * m.radius,
          },
          block = firstSolid(m.pos, next, { x: 7, y: 7 }, this.blockers);
        if (this.sweptBlock(m.pos, next)) {
          m.life = 0;
          break;
        }
        for (const e of g.enemies.filter((e) => e.hp > 0 && e.spawn <= 0 && !m.hits.has(e.id))) {
          const hit = sweepBox(m.pos, next, { x: 7, y: 7 }, e.body);
          if (hit && (!block || hit.t < block.t)) {
            m.hits.add(e.id);
            if (g.hitEnemy(e, m.damage, m.pos, true, false, false)) m.life = 0;
          }
        }
        if (block) {
          m.life = 0;
          break;
        }
        m.pos = next;
        m.trail.push({ ...next });
        if (m.trail.length > 8) m.trail.shift();
      }
    }
    this.mills = this.mills.filter((m) => m.life > 0);
  }
}
