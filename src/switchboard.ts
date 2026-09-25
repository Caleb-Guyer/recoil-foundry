import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import { clamp, direction, distance, segmentBox, type Vec } from './rules.ts';
import { sweepBox } from './collisions.ts';
import { bossHuntTarget } from './boss-hunt.ts';
import { annexPoint } from './annex-layout.ts';
import { SIGNAL_PORTS } from './switchboard-layout.ts';

export const SIGNAL = {
  record: 0.6,
  lock: 0.8,
  recovery: 2.1,
  cooldown: 7.5,
  opening: 1.4,
  speed: 11.6,
  damage: 26,
  life: 3.15,
  half: 17,
};
export type SignalKind = 'sweep' | 'ground' | 'playback';
export interface SignalPlan {
  slot: number;
  kind: SignalKind;
  origin: Vec;
  marks: Vec[];
  angles: number[];
  delay: number;
  sent: number;
  locked: boolean;
  cut: boolean;
  done: boolean;
  escape: Vec | null;
}
export interface SwitchboardRig {
  plans: SignalPlan[];
  elapsed: number;
  wait: number;
  cooldown: number;
  opening: number;
  interruptions: number;
  fired: number;
}
export const createSwitchboard = (): SwitchboardRig => ({
  plans: [],
  elapsed: 0,
  wait: 1.5,
  cooldown: 0,
  opening: 0,
  interruptions: 0,
  fired: 0,
});
export const signalGap = (p: SignalPlan) => (p.kind === 'playback' ? 0.24 : 0.16);
export const signalFireAt = (p: SignalPlan, shot = p.sent) =>
  p.delay + SIGNAL.record + SIGNAL.lock + shot * signalGap(p);
export function signalPoint(g: Game, slot: number, part: 'port' | 'junction') {
  return annexPoint(g.level.mirrored, SIGNAL_PORTS[slot][part]);
}
export function signalAngles(kind: SignalKind, origin: Vec, marks: Vec[]) {
  if (kind === 'playback') return marks.map((p) => Math.atan2(p.y - origin.y, p.x - origin.x));
  const mark = marks[0],
    target = kind === 'ground' ? { x: mark.x, y: 716 } : mark;
  const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
  return [-2, -1, 0, 1, 2].map((i) => angle + i * (kind === 'ground' ? 0.085 : 0.2));
}
// The chamfered hull can settle a pixel inside the navigation clearance box.
// Back away under ordinary physics before asking for another route; never warp
// through the platform or disable collisions to reach the player.
export function signalUnstick(g: Game, e: Enemy): Vec | null {
  const p = e.body.position;
  let best: { amount: number; dir: Vec } | undefined;
  for (const b of g.solidBodies) {
    const min = { x: b.bounds.min.x - 45, y: b.bounds.min.y - 38 };
    const max = { x: b.bounds.max.x + 45, y: b.bounds.max.y + 38 };
    if (p.x <= min.x || p.x >= max.x || p.y <= min.y || p.y >= max.y) continue;
    for (const [amount, dir] of [
      [p.x - min.x, { x: -1, y: 0 }],
      [max.x - p.x, { x: 1, y: 0 }],
      [p.y - min.y, { x: 0, y: -1 }],
      [max.y - p.y, { x: 0, y: 1 }],
    ] as const)
      if (!best || amount < best.amount) best = { amount, dir };
  }
  return best?.dir ?? null;
}
function segmentDistance(p: Vec, a: Vec, b: Vec) {
  const x = b.x - a.x,
    y = b.y - a.y;
  const t = clamp(((p.x - a.x) * x + (p.y - a.y) * y) / (x * x + y * y || 1), 0, 1);
  return Math.hypot(p.x - a.x - x * t, p.y - a.y - y * t);
}
// A conservative escape corridor: ordinary movement or one rising jump, with
// a clear player hull and enough separation from every still-pending lane.
export function signalEscape(g: Game, plans: SignalPlan[]): Vec | null {
  const from = { x: g.player.position.x, y: clamp(g.player.position.y - 1, 18.1, 721.9) };
  const lines = plans
    .filter((p) => !p.cut && !p.done)
    .flatMap((p) =>
      p.angles.slice(p.sent).map((a) => ({
        a: p.origin,
        b: g.lineEnd(
          p.origin,
          { x: p.origin.x + Math.cos(a) * 2300, y: p.origin.y + Math.sin(a) * 2300 },
          5,
        ),
      })),
    );
  for (const y of [0, -80, -150])
    for (const x of [-150, 150, -240, 240, -80, 80, 0]) {
      const to = { x: from.x + x, y: from.y + y };
      if (to.x < 20 || to.x > 1980 || to.y < 18 || to.y > 722) continue;
      if (g.solidBodies.some((b) => sweepBox(from, to, { x: 14, y: 18 }, b))) continue;
      if (lines.every((l) => segmentDistance(to, l.a, l.b) >= 34)) return to;
    }
  return null;
}
export class SwitchboardSystem {
  readonly game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  get enemy() {
    return this.game.enemies.find((e) => e.kind === 'switchboard' && e.hp > 0);
  }
  clear(e = this.enemy) {
    if (!e || e.kind !== 'switchboard') return;
    e.switchboard = undefined;
    this.game.shots = this.game.shots.filter((s) => s.signalOwner !== e.id || s.friendly);
  }
  portFor(kind: SignalKind, used: number[]) {
    const g = this.game,
      target = kind === 'ground' ? { x: g.player.position.x, y: 716 } : g.player.position;
    return [0, 1, 2]
      .filter((i) => !used.includes(i))
      .sort((a, b) => {
        const score = (slot: number) => {
          const p = signalPoint(g, slot, 'port');
          const blocked = distance(g.lineEnd(p, target, 5), target) > 1;
          return (
            (blocked ? 10000 : 0) +
            (kind === 'ground' && slot === 1 ? 4000 : 0) +
            (kind === 'sweep' && slot !== 1 ? 400 : 0) +
            distance(p, target)
          );
        };
        return score(a) - score(b);
      })[0];
  }
  begin(e: Enemy) {
    const g = this.game,
      r = e.switchboard!;
    const cycle: SignalKind[] = ['sweep', 'ground', 'playback'];
    const kinds = e.phase
      ? [cycle[e.attacks % 3], cycle[(e.attacks + 2) % 3]]
      : [cycle[e.attacks % 3]];
    r.plans = [];
    for (const [i, kind] of kinds.entries()) {
      const slot = this.portFor(
        kind,
        r.plans.map((p) => p.slot),
      );
      const origin = signalPoint(g, slot, 'port'),
        marks = [{ ...g.player.position }];
      r.plans.push({
        slot,
        kind,
        origin,
        marks,
        angles: signalAngles(kind, origin, marks),
        delay: i * 0.38,
        sent: 0,
        locked: false,
        cut: false,
        done: false,
        escape: null,
      });
    }
    r.elapsed = 0;
    e.state = 'windup';
    g.onSound('aim-warn');
  }
  update(e: Enemy, dt: number) {
    const g = this.game,
      r = (e.switchboard ??= createSwitchboard());
    r.cooldown = Math.max(0, r.cooldown - dt);
    r.opening = Math.max(0, r.opening - dt);
    Matter.Body.applyForce(e.body, e.body.position, { x: 0, y: -e.body.mass * 0.001 });
    const dest = bossHuntTarget(g, e, e.state === 'recover'),
      p = e.body.position;
    const speed = e.state === 'recover' || r.opening > 0 ? 1.5 : 3.8;
    Matter.Body.setVelocity(e.body, {
      x: clamp((dest.x - p.x) * 0.08, -speed, speed),
      y: clamp((dest.y - p.y) * 0.08, -speed, speed),
    });
    if (!e.hunt?.route.length) {
      const away = signalUnstick(g, e);
      if (away) {
        Matter.Body.setVelocity(e.body, { x: away.x * speed, y: away.y * speed });
        e.hunt = undefined;
      }
    }
    e.aim = direction(p, g.player.position);
    e.facing = Math.sign(e.aim.x) || e.facing;
    if (e.state === 'idle' || e.state === 'recover' || e.state === 'transition') {
      r.wait -= dt;
      if (r.wait > 0) return;
      if (!e.phase && e.hp <= e.maxHp * 0.5 && e.attacks >= 3) {
        e.phase = 1;
        e.state = 'transition';
        r.wait = 1;
        r.plans = [];
        g.shots = g.shots.filter((s) => s.signalOwner !== e.id || s.friendly);
        g.onSound('phase');
        g.feedback(3);
        return;
      }
      this.begin(e);
      return;
    }
    r.elapsed += dt;
    for (const plan of r.plans) {
      if (plan.cut || plan.done || r.elapsed < plan.delay) continue;
      const age = r.elapsed - plan.delay;
      if (!plan.locked) {
        if (plan.kind === 'playback') {
          if (plan.marks.length < 3 && age >= plan.marks.length * 0.3)
            plan.marks.push({ ...g.player.position });
        } else plan.marks[0] = { ...g.player.position };
        plan.angles = signalAngles(plan.kind, plan.origin, plan.marks);
        if (age < SIGNAL.record || (plan.kind === 'playback' && plan.marks.length < 3)) continue;
        plan.locked = true;
        plan.escape = signalEscape(
          g,
          r.plans.filter((p) => p.locked),
        );
        if (!plan.escape) {
          plan.cut = true;
          continue;
        }
        g.onSound('lock');
      }
      if (r.elapsed < signalFireAt(plan)) continue;
      e.state = 'rush';
      const previous = g.shots.at(-1);
      g.enemyShot(e, plan.angles[plan.sent], SIGNAL.speed, SIGNAL.damage, plan.origin);
      const shot = g.shots.at(-1);
      if (shot && shot !== previous) {
        shot.signalOwner = e.id;
        shot.life = Math.min(shot.life, SIGNAL.life);
        shot.source = { ...plan.origin };
        if (shot.launch) shot.launch.pos = { ...plan.origin };
      }
      plan.sent++;
      r.fired++;
      g.onSound('enemy');
      if (plan.sent === plan.angles.length) plan.done = true;
    }
    if (r.plans.every((p) => p.done || p.cut)) {
      e.state = 'recover';
      e.attacks++;
      r.wait = SIGNAL.recovery;
      e.hunt = undefined;
    }
  }
  charging(e: Enemy, p: SignalPlan) {
    return (
      this.game.mode === 'playing' && e.spawn <= 0 && e.hp > 0 && !p.cut && !p.done && p.sent === 0
    );
  }
  trace(from: Vec, to: Vec, radius = 0) {
    const e = this.enemy,
      r = e?.switchboard;
    if (!e || !r || r.cooldown > 0) return null;
    let nearest: (NonNullable<ReturnType<typeof segmentBox>> & { slot: number }) | null = null;
    for (const p of r.plans) {
      if (!this.charging(e, p)) continue;
      const at = signalPoint(this.game, p.slot, 'junction'),
        half = SIGNAL.half + radius;
      const hit = segmentBox(
        from,
        to,
        { x: at.x - half, y: at.y - half },
        { x: at.x + half, y: at.y + half },
      );
      if (hit && (!nearest || hit.t < nearest.t)) nearest = { ...hit, slot: p.slot };
    }
    return nearest;
  }
  interrupt(slot: number) {
    const e = this.enemy,
      r = e?.switchboard,
      p = r?.plans.find((p) => p.slot === slot);
    if (!e || !r || !p || r.cooldown > 0 || !this.charging(e, p)) return false;
    p.cut = true;
    r.cooldown = SIGNAL.cooldown;
    r.opening = SIGNAL.opening;
    r.interruptions++;
    const at = signalPoint(this.game, slot, 'junction');
    this.game.hitEnemy(e, 70, at, true, false);
    this.game.burst(at, 12, '#e8bb76', 3);
    this.game.onSound('armor');
    return true;
  }
  blast(pos: Vec, radius: number, cone: (p: Vec) => boolean) {
    const e = this.enemy;
    if (!e?.switchboard) return;
    for (const plan of e.switchboard.plans) {
      const p = signalPoint(this.game, plan.slot, 'junction');
      if (
        distance(pos, p) <= radius &&
        cone(p) &&
        distance(this.game.lineEnd(pos, p), p) < 0.1 &&
        this.interrupt(plan.slot)
      )
        break;
    }
  }
}
