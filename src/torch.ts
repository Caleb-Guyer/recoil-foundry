import Matter from 'matter-js';
import type { Game, Enemy, Shot } from './game.ts';
import type { Prop } from './props.ts';
import { firstSolid } from './collisions.ts';
import { portalVector } from './portals.ts';
import { clamp, direction, distance, segmentBox, type Vec } from './rules.ts';
import { isBoss } from './enemies.ts';

export const TORCH = {
  range: 1100,
  radius: 1.5,
  output: 0.78,
  thrust: 1.2,
  heatTime: 1.5,
  heatBonus: 0.75,
  segments: 12,
};
export interface TorchSegment {
  a: Vec;
  b: Vec;
  dir: Vec;
  gain: number;
  body?: Matter.Body;
  normal?: Vec;
  enemy?: Enemy;
  prop?: Prop;
  cable?: Prop;
  anchor?: Enemy;
}
const add = (p: Vec, d: Vec, n: number): Vec => ({ x: p.x + d.x * n, y: p.y + d.y * n });
const shielded = (e: Enemy, d: Vec) => e.elite === 'shielded' && -d.x * e.facing > 0.45;

// Trace first, damage afterwards. Cutting a surface never lets the same step
// hit something that was behind it. Every segment uses actual convex hulls.
export function traceTorch(g: Game, rear = false): TorchSegment[] {
  let d = direction(g.player.position, g.aim);
  if (!d.x && !d.y) d = { x: 1, y: 0 };
  if (rear) d = { x: -d.x, y: -d.y };
  let from = { x: g.player.position.x, y: g.player.position.y - 3 },
    remaining = TORCH.range,
    banks = g.gun.bounces,
    pierce = g.gun.pierce,
    gain = 1;
  const result: TorchSegment[] = [],
    visited = new Set<Matter.Body>();
  const half = { x: TORCH.radius, y: TORCH.radius };
  for (let n = 0; n < TORCH.segments && remaining > 1; n++) {
    const end = add(from, d, remaining),
      enemies = g.enemies.filter((e) => e.hp > 0 && e.spawn <= 0 && !visited.has(e.body)),
      hit = firstSolid(from, end, half, [
        ...g.solidBodies,
        ...enemies.map((e) => e.body),
        ...g.enemies.filter((e) => e.crane && e.spawn <= 0).map((e) => e.crane!.body),
      ]),
      cable = g.cargo.trace(from, end, TORCH.radius),
      anchor = g.harpoons.trace(from, end, TORCH.radius),
      portal = g.portals.trace(from, end, half);
    const t = Math.min(hit?.t ?? 1, cable?.t ?? 1, anchor?.t ?? 1),
      through = portal && portal.t <= t + 1e-6,
      point = add(from, d, remaining * (through ? portal!.t : t));
    const segment: TorchSegment = { a: { ...from }, b: point, dir: { ...d }, gain };
    result.push(segment);
    remaining -= distance(from, point);
    if (through) {
      from = { ...portal!.pos };
      d = portalVector(d, portal!.entry, portal!.exit);
      remaining -= 1;
      continue;
    }
    if (cable && cable.t <= t) {
      segment.cable = cable.prop;
      segment.normal = cable.normal;
      break;
    }
    if (anchor && anchor.t <= t) {
      segment.anchor = anchor.enemy;
      segment.normal = anchor.normal;
      break;
    }
    if (!hit) break;
    segment.body = hit.body;
    segment.normal = hit.normal;
    const enemy = enemies.find((e) => e.body === hit.body),
      prop = g.props.items.find((p) => p.body === hit.body);
    if (enemy) {
      segment.enemy = enemy;
      visited.add(enemy.body);
      if (shielded(enemy, d) || pierce-- <= 0) break;
      gain *= 0.8;
      from = add(point, d, 0.5);
      remaining -= 0.5;
      continue;
    }
    if (prop) {
      segment.prop = prop;
      break;
    }
    if (banks-- <= 0 || !g.terrainBodies.includes(hit.body)) break;
    const dot = d.x * hit.normal.x + d.y * hit.normal.y;
    d = { x: d.x - 2 * dot * hit.normal.x, y: d.y - 2 * dot * hit.normal.y };
    gain *= 1 + g.gun.bankGrowth;
    from = add(point, hit.normal, 0.5);
    remaining -= 0.5;
  }
  return result;
}

export class TorchSystem {
  game: Game;
  active = false;
  segments: TorchSegment[] = [];
  rear: TorchSegment[] = [];
  heat = 0;
  target: number | undefined;
  private until = -1;
  private period = 0.22;
  private boost = 1;
  private recoilBoost = 1;
  private pulse: Shot | null = null;
  private processed = new Set<object>();
  private fracture = new Map<number, number>();
  private reflected = false;
  private wind = false;
  private split = false;
  private revision = -1;
  constructor(game: Game) {
    this.game = game;
  }
  get equipped() {
    return this.game.mods.includes('cutting-torch');
  }
  get discharge() {
    return this.active ? this.pulse?.discharge : undefined;
  }
  reset() {
    this.stop();
    this.until = -1;
    this.pulse = null;
    this.processed.clear();
    this.fracture.clear();
    this.revision = -1;
  }
  stop() {
    this.active = false;
    this.segments = [];
    this.rear = [];
    this.heat = 0;
    this.target = undefined;
    this.boost = 1;
    this.recoilBoost = 1;
  }
  beforeStep(dt: number, held: boolean) {
    const g = this.game;
    if (!this.equipped || !held || g.mode !== 'playing' || g.escape?.phase === 'extracting') {
      this.stop();
      return;
    }
    if (!(dt > 0) || !Number.isFinite(g.aim.x) || !Number.isFinite(g.aim.y)) {
      this.stop();
      return;
    }
    this.active = true;
    g.burstRemaining = 0;
    let d = direction(g.player.position, g.aim);
    if (!d.x && !d.y) d = { x: 1, y: 0 };
    // Pay shot-based charges at the gun's ordinary cadence, never each frame.
    if (g.time + 1e-8 >= this.until) {
      this.pulse = null;
      g.evolutions.settle();
      this.period = g.gun.interval * (g.gun.burstCount === 3 ? 3.1 / 3 : 1);
      this.until = g.time + this.period;
      g.shootAt = this.until;
      const landing = g.gun.landing && g.landingReady,
        capacitor = g.ballistics.discharge();
      g.landingReady = false;
      g.shotCount++;
      const evolution = g.evolutions.discharge(g.shotCount);
      // Redline remains responsive to actual speed during continuous thrust.
      this.boost =
        ((landing ? 2 : 1) * (capacitor ? 2 : 1) * evolution) / (1 + g.evolutions.redline);
      this.recoilBoost = landing ? 1.25 : 1;
      g.chargedFlash = landing || capacitor || evolution / (1 + g.evolutions.redline) > 1;
      this.pulse = {
        id: ++g.id,
        pos: { ...g.player.position },
        prev: { ...g.player.position },
        vel: { x: 0, y: 0 },
        damage: 0,
        life: this.period,
        friendly: true,
        radius: TORCH.radius,
        bounces: 0,
        pierce: 0,
        fragment: false,
        split: false,
        banks: 0,
        bankGrowth: 0,
        charged: g.chargedFlash,
        hits: new Set(),
        discharge: g.shotCount,
      };
      this.processed.clear();
      this.fracture.clear();
      this.reflected = this.wind = this.split = false;
      if (g.gun.backblast) g.fireBackblast(d, this.payload() * 0.8);
    }
    g.lastShot = g.time;
    g.muzzle = 0;
    const impulse =
      (g.gun.recoil / this.period) * dt * TORCH.thrust * (g.grounded ? 0.21 : 1) * this.recoilBoost;
    Matter.Body.setVelocity(g.player, {
      x: clamp(g.player.velocity.x - d.x * impulse, -23, 23),
      y: clamp(g.player.velocity.y - d.y * impulse, -21, 20),
    });
    // Ramjet still requires fast travel; a beam renews its launch, not its hits.
    g.salvage.launch(d, g.gun.recoil * (g.grounded ? 0.21 : 1));
    g.feedback(dt * (g.grounded ? 2 : 5), d);
  }
  private payload() {
    const g = this.game;
    return (
      g.gun.damage *
      g.gun.pellets *
      TORCH.output *
      this.boost *
      (g.grounded ? 1 : g.gun.airDamage) *
      (1 + g.evolutions.redline)
    );
  }
  afterStep(dt: number) {
    const g = this.game;
    if (!this.active || !this.equipped || g.mode !== 'playing' || !(dt > 0)) return;
    if (this.revision !== g.portals.revision) {
      this.heat = 0;
      this.target = undefined;
      this.revision = g.portals.revision;
    }
    this.segments = traceTorch(g);
    this.rear = g.gun.rearVolley ? traceTorch(g, true) : [];
    const target = this.segments.find((s) => s.enemy)?.enemy,
      eligible = target && !shielded(target, this.segments.find((s) => s.enemy === target)!.dir);
    if (!eligible || target.id !== this.target) {
      this.heat = 0;
      this.target = eligible ? target.id : undefined;
    }
    const old = this.heat;
    if (eligible && g.mods.includes('thermal-runaway'))
      this.heat = Math.min(1, this.heat + dt / TORCH.heatTime);
    const hot = 1 + (old + this.heat) * 0.5 * TORCH.heatBonus;
    const all = [...this.segments, ...this.rear],
      damaged = new Set<Matter.Body>();
    for (const segment of all) {
      if (g.mode !== 'playing') {
        this.stop();
        return;
      }
      const s = this.pulse!;
      s.pos = { ...segment.b };
      s.prev = { ...segment.a };
      s.vel = {
        x: segment.dir.x * g.gun.projectileSpeed,
        y: segment.dir.y * g.gun.projectileSpeed,
      };
      s.damage = this.payload() * segment.gain * (segment.enemy?.id === this.target ? hot : 1);
      const object = segment.body ?? segment.cable ?? segment.anchor;
      const first = object && !this.processed.has(object);
      if (first) this.processed.add(object!);
      if (segment.enemy && !damaged.has(segment.enemy.body)) {
        const e = segment.enemy;
        damaged.add(e.body);
        if (e.hp <= 0 || !g.enemies.includes(e)) continue;
        if (first) {
          this.fracture.set(e.id, g.ballistics.fracture(e, s));
          g.ballistics.consumeFracture(e, s);
        }
        const damage =
          ((s.damage * dt) / this.period) *
          (this.fracture.get(e.id) ?? 1) *
          (g.gun.execute && e.hp < e.maxHp * 0.3 ? 1.6 : 1);
        const blocked = g.hitEnemy(e, damage, add(e.body.position, segment.dir, -30), !!first);
        if (!blocked) {
          g.evolutions.hit(s);
          if (first) {
            g.ballistics.rivet(e, s);
            g.tethers.hit(e, s);
            g.arcs.hit(e, s);
            g.salvage.impact(s);
          }
          if (e.hp > 0 && !e.body.isStatic) {
            const force = (dt / this.period) * (isBoss(e.kind) ? 0.08 : 1);
            Matter.Body.setVelocity(e.body, {
              x: e.body.velocity.x + s.vel.x * 0.12 * force,
              y: e.body.velocity.y + s.vel.y * 0.09 * force,
            });
          }
        }
      } else if (first) {
        if (segment.cable) g.cargo.cut(segment.cable, s.damage);
        else if (segment.anchor) g.harpoons.hitAnchor(segment.anchor, s.damage);
        else if (segment.prop) g.props.hit(segment.prop, s.damage, s.vel);
        else if (segment.body) {
          g.counterweights.hit(segment.body, segment.b, s.vel, s.damage);
          g.breaches.hitBody(segment.body, s.damage, s.vel);
          g.destruction.hitBody(segment.body, s.damage, s.vel);
        }
      }
      if (first && !this.split) {
        g.splitShot(s, segment.normal);
        this.split = s.split;
      }
      if (first && !segment.enemy) g.salvage.impact(s, segment.body, segment.normal);
      if (!this.wind) g.salvage.trace(s, segment.a, segment.b);
      // One reflection per ordinary discharge; solids/cables/portals already
      // terminate each traced segment, so the beam never reflects through cover.
      if (!this.reflected && g.mods.includes('countershot')) {
        const hits = g.shots
          .filter((b) => !b.friendly && b.life > 0 && !b.blade && b.radius <= 5)
          .flatMap((b) => {
            const r = b.radius + TORCH.radius,
              h = segmentBox(
                segment.a,
                segment.b,
                { x: b.pos.x - r, y: b.pos.y - r },
                { x: b.pos.x + r, y: b.pos.y + r },
              );
            const point = h
              ? add(segment.a, segment.dir, distance(segment.a, segment.b) * h.t)
              : segment.a;
            return h &&
              h.t < 1 - 1e-6 &&
              !firstSolid(point, b.pos, { x: 0, y: 0 }, [
                ...g.solidBodies,
                ...g.enemies.filter((e) => e.spawn <= 0).map((e) => e.body),
              ])
              ? [{ b, t: h.t }]
              : [];
          })
          .sort((a, b) => a.t - b.t);
        if (hits[0]) {
          g.ballistics.reflectRound(hits[0].b, { ...hits[0].b.pos });
          this.reflected = true;
        }
      }
    }
    this.wind = true;
    g.evolutions.settle();
  }
}
