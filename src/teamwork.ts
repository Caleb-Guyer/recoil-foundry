import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import { isBoss } from './enemies.ts';
import { firstSolid } from './collisions.ts';
import { clamp, distance, type Vec } from './rules.ts';

export type SupportKind = 'repairer' | 'relay';
export const SUPPORT = {
  range: 430,
  tell: 1.25,
  cooldown: 3.5,
  repair: 8,
  budget: 48,
  charges: 3,
  boost: 1.3,
  ready: 2.2,
};
export interface SupportRig {
  phase: 'idle' | 'windup' | 'repair' | 'ready' | 'spent';
  target?: number;
  timer: number;
  remaining: number;
}
export const isSupport = (kind: string): kind is SupportKind =>
  kind === 'repairer' || kind === 'relay';
export const createSupport = (kind: SupportKind): SupportRig => ({
  phase: 'idle',
  timer: 1,
  remaining: kind === 'repairer' ? SUPPORT.budget : SUPPORT.charges,
});

const pointDistance = (p: Vec, a: Vec, b: Vec) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    size = dx * dx + dy * dy;
  const t = size ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / size, 0, 1) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
};
export function crossesSupport(from: Vec, to: Vec, a: Vec, b: Vec, radius: number) {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    ex = b.x - a.x,
    ey = b.y - a.y;
  const cross = dx * ey - dy * ex;
  if (Math.abs(cross) > 1e-9) {
    const px = a.x - from.x,
      py = a.y - from.y;
    const t = (px * ey - py * ex) / cross,
      u = (px * dy - py * dx) / cross;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  return (
    Math.min(
      pointDistance(from, a, b),
      pointDistance(to, a, b),
      pointDistance(a, from, to),
      pointDistance(b, from, to),
    ) <=
    radius + 2
  );
}

export class TeamworkSystem {
  game: Game;
  enabled = false;
  sources = new Set<Enemy>();
  constructor(game: Game) {
    this.game = game;
  }
  clear() {
    for (const e of this.game.enemies)
      if (e.support) {
        e.support.target = undefined;
        e.support.phase = 'idle';
        e.support.timer = 1;
      }
    this.sources.clear();
  }
  private live(e: Enemy) {
    const g = this.game;
    return (
      e.hp > 0 &&
      e.spawn <= 0 &&
      !e.allied &&
      !e.rebootUntil &&
      !e.eventRole &&
      !e.courier &&
      !e.workshopTarget &&
      g.enemies.includes(e) &&
      !g.cryogenic.frozen(e) &&
      !g.ballistics.pinned(e) &&
      !g.salvageEvolutions.carried(e) &&
      !g.tethers.staggered(e) &&
      !g.pressure.staggered(e) &&
      !g.massDriver.staggered(e)
    );
  }
  private eligible(e: Enemy, kind: SupportKind) {
    return (
      this.live(e) &&
      !isBoss(e.kind) &&
      !isSupport(e.kind) &&
      !e.elite &&
      !e.mutation &&
      !e.squad &&
      !e.sentry &&
      (kind === 'repairer'
        ? e.hp < e.maxHp
        : ['shooter', 'sniper', 'flyer', 'sifter', 'skimmer'].includes(e.kind))
    );
  }
  clearPath(a: Enemy, b: Enemy) {
    return (
      distance(a.body.position, b.body.position) <= SUPPORT.range &&
      !firstSolid(a.body.position, b.body.position, { x: 2, y: 2 }, this.game.solidBodies)
    );
  }
  partner(e: Enemy) {
    const rig = e.support;
    if (!rig || rig.target === undefined || !isSupport(e.kind) || !this.live(e)) return;
    const target = this.game.enemies.find((other) => other.id === rig.target);
    if (target && this.eligible(target, e.kind) && this.clearPath(e, target)) return target;
  }
  private finish(e: Enemy, broken = false) {
    const rig = e.support!;
    rig.target = undefined;
    rig.phase = rig.remaining > 0 ? 'idle' : 'spent';
    rig.timer = SUPPORT.cooldown;
    e.state = 'recover';
    if (broken) {
      this.game.burst(e.body.position, 5, '#a8d9c3', 1.5);
      this.game.onSound('support-break');
    }
  }
  disrupt(e: Enemy) {
    for (const owner of this.sources)
      if (owner.support?.target !== undefined && (owner === e || owner.support.target === e.id))
        this.finish(owner, true);
    if (e.support) this.sources.delete(e);
  }
  tick(dt: number) {
    const g = this.game;
    if (g.mode !== 'playing' || dt <= 0) return;
    const owners = [...this.sources].filter((e) => e.hp > 0 && g.enemies.includes(e));
    for (const owner of owners) {
      const rig = owner.support!;
      if (rig.target !== undefined && !this.partner(owner)) this.finish(owner);
    }
    for (const e of owners) {
      const rig = e.support!;
      if (!this.live(e) || !isSupport(e.kind) || rig.phase === 'spent') continue;
      rig.timer -= dt * g.cryogenic.slow(e);
      if (rig.timer > 0) continue;
      if (rig.phase === 'idle') {
        if (owners.some((other) => other.support?.target !== undefined)) continue;
        const target = g.enemies
          .filter(
            (other) => this.eligible(other, e.kind as SupportKind) && this.clearPath(e, other),
          )
          .sort(
            (a, b) =>
              distance(e.body.position, a.body.position) -
                distance(e.body.position, b.body.position) || a.id - b.id,
          )[0];
        if (!target) {
          rig.timer = 0.3;
          continue;
        }
        rig.target = target.id;
        rig.phase = 'windup';
        rig.timer = SUPPORT.tell;
        e.state = 'windup';
        g.onSound(e.kind === 'repairer' ? 'repair-warn' : 'relay-warn');
      } else if (rig.phase === 'ready') this.finish(e);
      else {
        const target = this.partner(e);
        if (!target) {
          this.finish(e);
          continue;
        }
        if (e.kind === 'relay') {
          rig.phase = 'ready';
          rig.timer = SUPPORT.ready;
        } else {
          const amount = Math.min(SUPPORT.repair, rig.remaining, target.maxHp - target.hp);
          target.hp += amount;
          rig.remaining -= amount;
          rig.phase = 'repair';
          rig.timer = 0.7;
          g.burst(target.body.position, 3, '#a8d9c3', 1);
          g.onSound('repair-pulse');
          if (rig.remaining <= 0 || target.hp >= target.maxHp) this.finish(e);
        }
      }
    }
  }
  move(e: Enemy) {
    const g = this.game,
      p = e.body.position;
    Matter.Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
    const target = this.partner(e);
    // Flight changes velocity only; the ordinary Matter hull still meets walls and props.
    const aim = target
      ? { x: target.body.position.x - e.facing * 100, y: target.body.position.y - 85 }
      : e.target;
    Matter.Body.setVelocity(e.body, {
      x: clamp((aim.x - p.x) * 0.012, -1.5, 1.5),
      y: clamp((aim.y - p.y) * 0.02, -1.8, 1.8),
    });
    if (p.y > 900) g.hitEnemy(e, 9999);
  }
  cutAlong(from: Vec, to: Vec, radius: number, friendly: boolean) {
    if (this.game.mode !== 'playing' || !friendly) return;
    for (const e of this.sources) {
      const partner = this.partner(e);
      if (partner && crossesSupport(from, to, e.body.position, partner.body.position, radius))
        this.finish(e, true);
    }
  }
  takeCharge(e: Enemy) {
    if (this.game.mode !== 'playing') return false;
    const owner = [...this.sources].find(
      (other) =>
        other.kind === 'relay' &&
        other.support?.phase === 'ready' &&
        other.support.target === e.id &&
        this.partner(other) === e,
    );
    if (!owner) return false;
    owner.support!.remaining--;
    this.finish(owner);
    return true;
  }
}
