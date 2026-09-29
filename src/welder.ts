import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { Prop } from './props.ts';
import { clamp, direction, distance, segmentBox, type Vec } from './rules.ts';
import type { WelderSave } from './welder-rules.ts';
import { groundBossTarget } from './ground-boss-hunt.ts';

const { Body, Query } = Matter;
export const WELD_TELL = 1.25;
export const WELD_LIFE = 2.6;
export const WELDER_OPENING = 2.2;
export interface WeldSeam {
  a: Vec;
  b: Vec;
  normal: Vec;
  support: Matter.Body;
  age: number;
  ignited: boolean;
}
export interface WeldBarrier {
  x: number;
  y: number;
  age: number;
  support: Matter.Body;
}
export interface WelderRig {
  attack: 'seam' | 'cover' | 'arc';
  jumpAt: number;
  stepAt: number;
}

export class WelderSystem {
  game: Game;
  state: WelderSave | null = null;
  seams: WeldSeam[] = [];
  barriers: WeldBarrier[] = [];
  private deployment: { owner: Enemy; walls: Set<Prop>; broken: Set<Prop> } | null = null;
  private hotWork: Enemy | null = null;
  constructor(game: Game) {
    this.game = game;
  }
  clear() {
    this.deployment = null;
    this.hotWork = null;
    this.seams = [];
    this.barriers = [];
    for (const p of [...this.game.props.items]) if (p.welded) this.game.props.remove(p);
  }
  killed(e: Enemy, credited: boolean) {
    if (e.kind !== 'welder') return;
    if (
      credited &&
      e === this.hotWork &&
      e.spawn <= 0 &&
      !e.allied &&
      this.state?.stage === this.game.stage &&
      this.state.status === 'scheduled'
    )
      this.game.commendations.award('hot-work');
    this.clear();
    if (
      credited &&
      e.spawn <= 0 &&
      this.game.mode === 'playing' &&
      this.game.hp > 0 &&
      !this.game.practice &&
      !this.game.workshop.active &&
      this.state?.stage === this.game.stage &&
      this.state.status === 'scheduled'
    ) {
      this.state.status = 'defeated';
      this.game.save();
    }
  }
  brokenBarrier(prop: Prop) {
    const d = this.deployment;
    if (
      !d ||
      !d.walls.has(prop) ||
      prop.hp > 0 ||
      this.game.time >= (prop.expires ?? 0) ||
      d.owner.hp <= 0 ||
      d.owner.spawn > 0 ||
      d.owner.allied ||
      !this.game.enemies.includes(d.owner) ||
      !this.game.commendations.eligible
    )
      return;
    d.broken.add(prop);
    // Only two actually spawned walls in the same deployment qualify. A
    // cancelled warning, expiry, replacement or cleanup never enters this set.
    if (d.walls.size === 2 && d.broken.size === 2) this.hotWork = d.owner;
  }
  private floor(point: Vec) {
    return this.game.terrain
      .filter(
        (b) =>
          b.isStatic &&
          b.bounds.min.y >= point.y - 2 &&
          b.bounds.min.y <= 740 &&
          point.x >= b.bounds.min.x + 34 &&
          point.x <= b.bounds.max.x - 34,
      )
      .sort((a, b) => a.bounds.min.y - b.bounds.min.y)[0];
  }
  private seam(point: Vec) {
    const support = this.floor(
      this.game.adaptiveBosses
        ? { ...point, x: clamp(point.x, 34, this.game.worldWidth - 34) }
        : point,
    );
    if (!support) return;
    const x = clamp(point.x, 70, this.game.worldWidth - 70),
      y = support.bounds.min.y - 2;
    const edge = this.game.adaptiveBosses ? 8 : 40;
    const a = { x: Math.max(edge, support.bounds.min.x + 8, x - 95), y };
    const b = { x: Math.min(this.game.worldWidth - edge, support.bounds.max.x - 8, x + 95), y };
    if (b.x - a.x < 45 || this.seams.some((s) => distance(s.a, a) < 120)) return;
    this.seams.push({ a, b, normal: { x: 0, y: -1 }, support, age: 0, ignited: false });
  }
  traceSeams(e: Enemy) {
    this.seams = [];
    const p = this.game.player.position;
    this.seam(p);
    this.seam({ x: clamp(p.x + Math.sign(p.x - e.body.position.x || 1) * 280, 180, 1800), y: p.y });
    // One nearby vertical face can heat up too. Never wrap a line around a corner:
    // each fixed segment is visible for its entire warning before it can hurt.
    const face = this.game.terrain
      .filter(
        (b) =>
          b.bounds.min.y < p.y && b.bounds.max.y > p.y && b.bounds.max.y - b.bounds.min.y >= 80,
      )
      .flatMap((support) => [
        { support, x: support.bounds.min.x - 2, normal: { x: -1, y: 0 } },
        { support, x: support.bounds.max.x + 2, normal: { x: 1, y: 0 } },
      ])
      .filter((f) => f.x > 50 && f.x < 1950 && Math.abs(f.x - p.x) < 120)
      .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (face)
      this.seams.push({
        a: { x: face.x, y: Math.max(face.support.bounds.min.y + 5, p.y - 65) },
        b: { x: face.x, y: Math.min(face.support.bounds.max.y - 5, p.y + 65) },
        normal: face.normal,
        support: face.support,
        age: 0,
        ignited: false,
      });
  }
  barrierFree(b: WeldBarrier) {
    const g = this.game;
    return (
      g.terrain.includes(b.support) &&
      b.x > 300 &&
      b.x < 1700 &&
      !Query.region(
        [
          ...g.solidBodies.filter((p) => p !== b.support),
          g.player,
          ...g.enemies.map((e) => e.body),
        ],
        { min: { x: b.x - 32, y: b.y - 56 }, max: { x: b.x + 32, y: b.y + 40 } },
      ).length &&
      !g.waves.doors.some((d) => distance(d.spawn, b) < 100) &&
      !g.hazards.items.some(
        ({ placement: h }) =>
          b.x + 40 > h.x - h.w / 2 &&
          b.x - 40 < h.x + h.w / 2 &&
          b.y + 42 > h.y - (h.kind === 'lift' ? h.travel : 0) &&
          b.y - 42 < h.y + h.h + (h.travel ?? 0),
      )
    );
  }
  planBarriers(e: Enemy) {
    const g = this.game;
    this.deployment = { owner: e, walls: new Set(), broken: new Set() };
    this.barriers = [];
    for (const p of [...g.props.items]) if (p.welded) g.props.remove(p);
    for (const offset of [-145, 145]) {
      const x = e.body.position.x + offset;
      const support = this.floor({ x, y: e.body.bounds.max.y - 3 });
      if (!support) continue;
      const b = { x, y: support.bounds.min.y - 42, support, age: 0 };
      if (this.barrierFree(b)) this.barriers.push(b);
    }
  }
  updateEnemy(e: Enemy, dt: number) {
    const g = this.game,
      p = e.body.position;
    const rig = (e.welder ??= { attack: 'seam', jumpAt: 0, stepAt: 0 });
    e.timer -= dt;
    if (e.state === 'idle') {
      const blockedLane = distance(g.lineEnd(p, g.player.position, 7), g.player.position) > 1;
      const targetX =
        g.adaptiveBosses && (blockedLane || (e.groundHunt && !g.enemyGrounded(e)))
          ? groundBossTarget(g, e, 0)
          : g.player.position.x;
      const d = direction(p, g.adaptiveBosses ? { x: targetX, y: p.y } : g.player.position);
      e.facing = Math.sign(d.x) || e.facing;
      Body.setVelocity(e.body, {
        x:
          p.x < 65 || p.x > g.worldWidth - 65
            ? -Math.sign(p.x - 1000) * 3
            : e.body.velocity.x + (d.x * 2.5 - e.body.velocity.x) * 0.09,
        y: e.body.velocity.y,
      });
      const grounded = g.enemyGrounded(e);
      if (
        grounded &&
        g.time >= rig.jumpAt &&
        (Query.ray(g.solidBodies, p, { x: p.x + e.facing * 75, y: p.y }, 45).length ||
          (g.player.position.y < p.y - 70 && distance(p, g.player.position) < 400))
      ) {
        Body.setVelocity(e.body, { x: e.facing * 4, y: -12 });
        rig.jumpAt = g.time + 1.1;
      }
      if (grounded && g.time >= rig.stepAt && Math.abs(e.body.velocity.x) > 0.6) {
        rig.stepAt = g.time + 0.55;
        g.onSound('welder-step');
      }
      if (e.timer <= 0) {
        rig.attack = (['seam', 'arc', 'cover', 'seam', 'arc'] as const)[e.attacks++ % 5];
        if (g.adaptiveBosses && rig.attack === 'seam' && g.player.position.y < p.y - 180)
          rig.attack = 'arc';
        e.state = 'windup';
        e.timer = WELD_TELL;
        e.aim = direction(p, g.player.position);
        if (rig.attack === 'seam') this.traceSeams(e);
        if (rig.attack === 'cover') this.planBarriers(e);
        g.onSound('weld-warn');
      }
    } else {
      Body.setVelocity(e.body, { x: e.body.velocity.x * 0.8, y: e.body.velocity.y });
      if (e.state === 'windup' && e.timer <= 0) {
        if (rig.attack === 'arc') {
          const angle = Math.atan2(e.aim.y, e.aim.x);
          for (const spread of [-0.22, -0.11, 0, 0.11, 0.22])
            g.enemyShot(e, angle + spread, 10, 22);
          g.onSound('weld-fire');
        }
        e.state = 'recover';
        e.timer = WELDER_OPENING;
        g.onSound('weld-vent');
      } else if (e.state === 'recover' && e.timer <= 0) {
        e.state = 'idle';
        e.timer = 1.4;
      }
    }
    if (e.state !== 'recover' && Query.collides(g.player, [e.body]).length)
      g.damagePlayer(24, p, { type: 'contact', enemy: 'welder' });
  }
  update(dt: number) {
    const g = this.game;
    if (g.mode !== 'playing') return;
    for (const s of this.seams) {
      s.age += dt;
      if (!g.terrain.includes(s.support)) {
        s.age = 99;
        continue;
      }
      if (s.age < WELD_TELL || s.age >= WELD_TELL + WELD_LIFE) continue;
      if (!s.ignited) {
        s.ignited = true;
        g.onSound('weld-fire');
      }
      const box = g.player.bounds;
      if (
        segmentBox(
          s.a,
          s.b,
          { x: box.min.x - 7, y: box.min.y - 7 },
          { x: box.max.x + 7, y: box.max.y + 7 },
        )
      ) {
        g.damagePlayer(
          22,
          { x: g.player.position.x - s.normal.x * 30, y: g.player.position.y - s.normal.y * 30 },
          { type: 'weld', enemy: 'welder' },
        );
        if (g.mode !== 'playing') return;
      }
    }
    this.seams = this.seams.filter((s) => s.age < WELD_TELL + WELD_LIFE);
    for (const b of this.barriers) {
      b.age += dt;
      if (b.age < WELD_TELL || !this.barrierFree(b)) continue;
      const p: Prop = g.props.spawn('cover', b.x, b.y);
      p.welded = true;
      p.expires = g.time + 6;
      p.hp = p.maxHp = 110;
      this.deployment?.walls.add(p);
    }
    // An occupied warning cancels instead of becoming a delayed, invisible trap.
    this.barriers = this.barriers.filter((b) => b.age < WELD_TELL);
  }
}
