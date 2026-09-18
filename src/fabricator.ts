import Matter from 'matter-js';
import type { Game, Enemy } from './game.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';

const { Body, Bodies, Composite, Query } = Matter;
export const FABRICATOR_BUILD = 2.2;
export const FABRICATOR_LIMIT = 2;
export const SENTRY_TELL = 0.85;
export const SENTRY_LOCK = 0.35;
export interface FabricatorRig {
  built: number;
  frame?: number;
  origin?: Vec;
  searchAt: number;
}
export interface SentryRig {
  owner: number;
  ready: boolean;
  origin: Vec;
}
export const createFabricator = (): FabricatorRig => ({ built: 0, searchAt: 0 });
export const sentryMuzzle = (e: Enemy): Vec => ({ x: e.body.position.x, y: e.body.position.y - 8 });

export class FabricatorSystem {
  enabled = true;
  game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  clear() {
    for (const e of [...this.game.enemies]) if (e.sentry) this.remove(e);
    for (const e of this.game.enemies) if (e.fabricator) e.fabricator.frame = undefined;
    this.game.shots = this.game.shots.filter((s) => !s.sentryOwner || s.friendly);
  }
  private remove(e: Enemy) {
    const g = this.game;
    e.hp = 0;
    g.tethers.disrupt(e.body);
    g.harpoons.disrupt(e.body);
    Composite.remove(g.engine.world, e.body);
    g.enemies = g.enemies.filter((other) => other !== e);
    g.burst(e.body.position, 7, '#a7b7b0', 2);
  }
  interrupt(e: Enemy) {
    const rig = e.fabricator;
    if (!rig || rig.frame === undefined) return;
    const frame = this.game.enemies.find((other) => other.id === rig.frame);
    rig.frame = undefined;
    rig.origin = undefined;
    if (frame) this.remove(frame);
    e.state = 'recover';
    e.timer = 1.3;
    this.game.onSound('fabricator-break');
  }
  disrupt(body: Matter.Body) {
    const e = this.game.enemies.find((other) => other.body === body);
    if (!e) return;
    if (e.fabricator) this.interrupt(e);
    if (e.sentry) {
      if (!e.sentry.ready) {
        const owner = this.game.enemies.find((other) => other.id === e.sentry!.owner);
        if (owner) this.interrupt(owner);
      } else {
        e.state = 'recover';
        e.timer = 0.6;
      }
    }
  }
  killed(e: Enemy) {
    const g = this.game;
    if (e.fabricator) {
      for (const child of [...g.enemies]) if (child.sentry?.owner === e.id) this.remove(child);
      g.shots = g.shots.filter((s) => s.sentryOwner !== e.id || s.friendly);
      e.fabricator.frame = undefined;
      g.onSound('fabricator-down');
    }
    if (e.sentry) {
      const owner = g.enemies.find((other) => other.id === e.sentry!.owner);
      if (owner?.fabricator?.frame === e.id) {
        owner.fabricator.frame = undefined;
        owner.fabricator.origin = undefined;
        owner.state = 'recover';
        owner.timer = 1.3;
      }
    }
  }
  supported(e: Enemy) {
    const p = e.body.position;
    return (
      Math.abs(e.body.velocity.y) < 1 &&
      this.game.terrain.some(
        (b) =>
          b.isStatic &&
          b.bounds.min.x <= p.x - 18 &&
          b.bounds.max.x >= p.x + 18 &&
          Math.abs(b.bounds.min.y - e.body.bounds.max.y) < 2,
      )
    );
  }
  private clearSpace(pos: Vec, ignore?: Enemy) {
    const g = this.game;
    const probe = Bodies.rectangle(pos.x, pos.y - 2, 46, 32);
    return !Query.collides(probe, [
      ...g.solidBodies,
      g.player,
      ...g.enemies.filter((e) => e !== ignore).map((e) => e.body),
    ]).length;
  }
  findSite(e: Enemy): Vec | undefined {
    const g = this.game,
      p = e.body.position;
    if (!this.supported(e)) return;
    const side = Math.sign(g.player.position.x - p.x) || -1;
    for (const offset of [72, 112, 156, 196])
      for (const sign of [side, -side]) {
        const x = p.x + offset * sign;
        if (x < 360 || x > g.worldWidth - 240) continue;
        const support = g.terrain.find(
          (b) =>
            b.isStatic &&
            b.bounds.min.x <= x - 26 &&
            b.bounds.max.x >= x + 26 &&
            Math.abs(b.bounds.min.y - e.body.bounds.max.y) < 2,
        );
        if (!support) continue;
        const pos = { x, y: support.bounds.min.y - 16 };
        if (
          distance(pos, g.player.position) < 150 ||
          g.level.coolant?.some((s) => x + 26 > s.x && x - 26 < s.x + s.w && pos.y + 18 >= s.y) ||
          g.level.magnets?.some((m) => Math.abs(m.x - x) < 75) ||
          g.waves.doors.some((d) => d.state !== 'spent' && distance(d.spawn, pos) < 80) ||
          !this.clearSpace(pos)
        )
          continue;
        const muzzle = { x, y: pos.y - 8 };
        if (
          distance(g.lineEnd(muzzle, g.player.position, 4), g.player.position) > 1 ||
          distance(g.lineEnd(p, pos, 4), pos) > 1
        )
          continue;
        return pos;
      }
  }
  updateBuilder(e: Enemy) {
    const g = this.game,
      rig = e.fabricator!,
      p = e.body.position;
    if (rig.frame !== undefined) {
      const frame = g.enemies.find((other) => other.id === rig.frame);
      if (
        !frame ||
        !rig.origin ||
        distance(p, rig.origin) > 18 ||
        !this.supported(e) ||
        !this.supported(frame) ||
        distance(frame.body.position, frame.sentry!.origin) > 8 ||
        !this.clearSpace(frame.body.position, frame) ||
        distance(g.lineEnd(p, frame.body.position, 3), frame.body.position) > 1
      ) {
        this.interrupt(e);
        return;
      }
      Body.setVelocity(e.body, { x: e.body.velocity.x * 0.65, y: e.body.velocity.y });
      if (e.timer <= 0) {
        frame.sentry!.ready = true;
        frame.timer = 0.6;
        frame.state = 'idle';
        rig.built++;
        rig.frame = undefined;
        rig.origin = undefined;
        e.state = 'recover';
        e.timer = 2.2;
        g.onSound('fabricator-ready');
      }
      return;
    }
    if (e.state === 'recover') {
      Body.setVelocity(e.body, { x: e.body.velocity.x * 0.7, y: e.body.velocity.y });
      if (e.timer <= 0) e.state = 'idle';
      return;
    }
    if (rig.built < FABRICATOR_LIMIT && e.timer <= 0 && g.time >= rig.searchAt) {
      rig.searchAt = g.time + 0.3;
      const site = this.findSite(e);
      if (site) {
        const child = g.spawnEnemy('sentry', site.x, site.y);
        if (child) {
          child.sentry = { owner: e.id, ready: false, origin: { ...site } };
          child.spawn = 0;
          child.timer = 0;
          child.hp = child.maxHp = Math.ceil(child.maxHp * 0.65);
          rig.frame = child.id;
          rig.origin = { ...p };
          e.facing = Math.sign(site.x - p.x) || e.facing;
          e.state = 'windup';
          e.timer = FABRICATOR_BUILD;
          Body.setVelocity(e.body, { x: 0, y: e.body.velocity.y });
          g.onSound('fabricator-build');
          return;
        }
      }
    }
    // Seek a firing lane by walking and hopping through the same solid world as other enemies.
    const d = direction(p, g.player.position),
      range = distance(p, g.player.position);
    e.facing = Math.sign(d.x) || e.facing;
    if (
      rig.built >= FABRICATOR_LIMIT &&
      range < 310 &&
      distance(g.lineEnd(p, g.player.position), g.player.position) < 1
    ) {
      Body.setVelocity(e.body, { x: e.body.velocity.x * 0.7, y: e.body.velocity.y });
    } else {
      g.updateRunner(e, d, range);
      Body.setVelocity(e.body, { x: clamp(e.body.velocity.x, -1.8, 1.8), y: e.body.velocity.y });
    }
  }
  updateSentry(e: Enemy) {
    const g = this.game,
      rig = e.sentry;
    if (!rig || !g.enemies.some((other) => other.id === rig.owner && other.hp > 0)) {
      this.remove(e);
      return;
    }
    Body.setVelocity(e.body, { x: e.body.velocity.x * 0.85, y: e.body.velocity.y });
    if (!rig.ready) return;
    const from = sentryMuzzle(e),
      target = g.player.position;
    const lane =
      this.supported(e) &&
      distance(from, target) < 1300 &&
      distance(g.lineEnd(from, target, 4), target) < 1;
    if (e.state === 'windup') {
      if (!this.supported(e) || distance(e.body.position, rig.origin) > 8) {
        e.state = 'recover';
        e.timer = 0.6;
        return;
      }
      if (e.timer > SENTRY_LOCK) e.aim = direction(from, target);
      if (e.timer <= 0) {
        g.enemyShot(e, Math.atan2(e.aim.y, e.aim.x), 10.5, 17, from);
        e.attacks++;
        e.state = 'recover';
        e.timer = 1.25;
        g.onSound('enemy');
      }
    } else if (e.timer <= 0 && lane) {
      e.state = 'windup';
      e.timer = SENTRY_TELL;
      rig.origin = { ...e.body.position };
      e.aim = direction(from, target);
      g.onSound('aim-warn');
    }
  }
}
