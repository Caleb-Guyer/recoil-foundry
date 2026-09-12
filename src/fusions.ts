import Matter from 'matter-js';
import type { Game, Shot } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp, direction, distance } from './rules.ts';
import { isBoss } from './enemies.ts';
import { closestBlastPoint } from './demolition.ts';
import { FUSE_TIME } from './ballistics.ts';

export const RAIL_RECOIL = 1.65;
export const ORBIT_LIMIT = 24;
export const ORBIT_TIME = 1.25;
export const IMPLOSION_RADIUS = 170;
export interface StoredRound {
  shot: Shot;
  at: number;
}

export class FusionSystem {
  game: Game;
  orbit: StoredRound[] = [];
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.orbit = [];
  }
  has(id: string) {
    return this.game.mods.includes(id);
  }
  fireRail(d: Vec, damage: number) {
    const g = this.game,
      radius = 5.5;
    const origin = { x: g.player.position.x, y: g.player.position.y - 3 };
    const muzzle = { x: origin.x + d.x * 26, y: origin.y + d.y * 26 };
    const pos = g.lineEnd(origin, muzzle, radius);
    if (distance(pos, muzzle) > 0.01) {
      pos.x -= d.x * 0.5;
      pos.y -= d.y * 0.5;
    }
    const speed = Math.max(72, g.gun.projectileSpeed * 1.6);
    g.addShot({
      pos,
      vel: { x: d.x * speed, y: d.y * speed },
      damage: damage * g.gun.pellets * g.gun.lanes * (g.gun.rearVolley ? 2 : 1),
      life: 1.4,
      friendly: true,
      radius,
      bounces: g.gun.bounces,
      pierce: g.gun.pierce + 4,
      bankGrowth: g.gun.bankGrowth,
      fragment: false,
      split: false,
      charged: true,
      rail: true,
      discharge: g.gun.deadlock ? g.shotCount : undefined,
    });
    g.burst(pos, 5, '#c6e6eb', 4, d);
  }
  catch(s: Shot) {
    const g = this.game;
    if (!this.has('orbit') || !s.recall?.returning || s.fragment || s.echo || s.orbitReleased)
      return;
    this.expire();
    if (this.orbit.length >= ORBIT_LIMIT) return;
    const shot = structuredClone(s);
    shot.pierce = s.recall.pierce + (g.ballistics.has('homecoming') ? 2 : 0);
    shot.recall = undefined;
    shot.waypoints = undefined;
    shot.discharge = undefined;
    shot.hits.clear();
    shot.orbitReleased = true;
    this.orbit.push({ shot, at: g.time });
  }
  expire() {
    this.orbit = this.orbit.filter((round) => this.game.time - round.at < ORBIT_TIME);
  }
  position(round: StoredRound): Vec {
    const g = this.game;
    const angle = round.shot.id * 2.399963 + g.time * 3;
    const origin = { x: g.player.position.x, y: g.player.position.y - 3 };
    const desired = { x: origin.x + Math.cos(angle) * 36, y: origin.y + Math.sin(angle) * 36 };
    const pos = g.lineEnd(origin, desired, round.shot.radius);
    if (distance(pos, desired) > 0.01) {
      const d = direction(origin, desired);
      pos.x -= d.x * 0.5;
      pos.y -= d.y * 0.5;
    }
    return pos;
  }
  release(d: Vec) {
    const g = this.game;
    this.expire();
    const count = Math.min(this.orbit.length, Math.max(0, 180 - g.shots.length));
    for (let i = 0; i < count; i++) {
      const round = this.orbit.shift()!,
        s = round.shot;
      const a = Math.atan2(d.y, d.x) + (i - (count - 1) / 2) * 0.012;
      const speed = Math.max(30, Math.hypot(s.vel.x, s.vel.y));
      s.pos = this.position(round);
      s.prev = { ...s.pos };
      s.vel = { x: Math.cos(a) * speed, y: Math.sin(a) * speed };
      s.id = ++g.id;
      s.life = 1.4;
      if (s.trace) s.trace.points = [{ ...s.pos }];
      // Keep the caught payload and remaining counter/bank charges. This is
      // one extra flight, not another discharge or another recall cycle.
      g.shots.push(s);
    }
    if (count) g.onSound('echo-shot');
  }
  beforeStep(dt: number) {
    const g = this.game;
    if (g.mode !== 'playing' || g.hitStop > 0 || g.escape?.phase === 'extracting') return;
    this.expire();
    if (!this.has('implosion') || !g.ballistics.shells.length) return;
    g.ballistics.positionShells();
    const bodies = [
      ...g.enemies.filter((e) => e.hp > 0 && e.spawn <= 0 && !isBoss(e.kind)).map((e) => e.body),
      ...g.props.items
        .filter(
          (p) =>
            (!p.cargo || p.cargo.state === 'loose') &&
            !g.magnets.items.some((m) => m.held === p) &&
            !g.enemies.some((e) => e.scrapper?.held === p),
        )
        .map((p) => p.body),
    ];
    for (const body of bodies) {
      if (body.isStatic) continue;
      let best = 0,
        toward: Vec | undefined;
      for (const s of g.ballistics.shells) {
        if (s.body === body || s.at <= g.time) continue;
        const point = closestBlastPoint(s.pos, body),
          range = distance(s.pos, point);
        if (range > IMPLOSION_RADIUS || distance(g.lineEnd(s.pos, point, 0, body), point) > 0.1)
          continue;
        const age = clamp(1 - (s.at - g.time) / FUSE_TIME, 0, 1);
        const strength = (0.35 + age * 0.55) * (1 - range / IMPLOSION_RADIUS);
        // Only the strongest field acts on a body; pellet storms cannot
        // multiply the force or juggle a boss out of its attack cycle.
        if (strength > best) {
          best = strength;
          toward = direction(body.position, s.pos);
        }
      }
      if (!toward) continue;
      const v = body.velocity;
      const along = v.x * toward.x + v.y * toward.y;
      const push = Math.max(0, Math.min(best * dt * 60, 9 - along));
      Matter.Body.setVelocity(body, { x: v.x + toward.x * push, y: v.y + toward.y * push });
    }
  }
}
