import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp, direction, distance, segmentBox } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { disruptScrapperBody } from './scrapper.ts';

export const HARPOON_TELL = 0.95;
export const HARPOON_LOCK = 0.55;
export const HARPOON_SPEED = 15;
export const HARPOON_RANGE = 840;
export const HARPOON_DURATION = 3.4;
export const HARPOON_DAMAGE = 12;
export const HARPOON_ANCHOR_HP = 18;
export const HARPOON_RECOVER = 1.4;
export interface HarpoonRig {
  phase: 'ready' | 'aim' | 'flight' | 'latched';
  origin: Vec;
  head: Vec;
  velocity: Vec;
  travel: number;
  target: Matter.Body | null;
  local: Vec;
  length: number;
  expires: number;
  anchorHp: number;
}
export const createHarpooner = (): HarpoonRig => ({
  phase: 'ready',
  origin: { x: 0, y: 0 },
  head: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  travel: 0,
  target: null,
  local: { x: 0, y: 0 },
  length: 0,
  expires: 0,
  anchorHp: HARPOON_ANCHOR_HP,
});
export function harpoonMuzzle(e: Enemy): Vec {
  return { x: e.body.position.x + e.aim.x * 26, y: e.body.position.y - 5 + e.aim.y * 26 };
}
export class HarpoonSystem {
  game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  get active() {
    return this.game.enemies.find((e) => e.hp > 0 && e.harpoon && e.harpoon.phase !== 'ready');
  }
  clear() {
    for (const e of this.game.enemies) if (e.harpoon) this.release(e, false);
  }
  release(e: Enemy, cue = true) {
    const rig = e.harpoon;
    if (!rig || rig.phase === 'ready') return;
    const attached = rig.phase === 'latched';
    rig.phase = 'ready';
    rig.target = null;
    if (e.hp > 0) {
      e.state = 'recover';
      e.timer = HARPOON_RECOVER;
    }
    if (cue && this.game.mode === 'playing') {
      this.game.onSound('harpoon-break');
      if (attached) this.game.burst(harpoonMuzzle(e), 5, '#ead4a4', 2);
    }
  }
  disrupt(body: Matter.Body) {
    for (const e of this.game.enemies)
      if (e.harpoon && (e.body === body || e.harpoon.target === body)) this.release(e);
  }
  updateEnemy(e: Enemy) {
    const g = this.game,
      rig = e.harpoon!,
      p = e.body.position;
    if (rig.phase === 'flight' || rig.phase === 'latched') return;
    if (rig.phase === 'aim') {
      Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.7, y: e.body.velocity.y });
      if (e.timer > HARPOON_LOCK) {
        e.aim = direction({ x: p.x, y: p.y - 5 }, g.player.position);
        rig.origin = { ...p };
      }
      if (distance(p, rig.origin) > 22) {
        this.release(e);
        return;
      }
      if (e.timer <= 0) {
        const muzzle = harpoonMuzzle(e);
        // A close wall may occupy the gun after the warning began.
        if (distance(g.lineEnd({ x: p.x, y: p.y - 5 }, muzzle, 4), muzzle) > 0.1) {
          this.release(e);
          return;
        }
        rig.phase = 'flight';
        rig.head = muzzle;
        rig.travel = 0;
        rig.velocity = { x: e.aim.x * HARPOON_SPEED, y: e.aim.y * HARPOON_SPEED };
        rig.expires = g.time + 1.25;
        e.state = 'rush';
        e.attacks++;
        g.onSound('harpoon-fire');
      }
      return;
    }
    if (e.state === 'recover') {
      // Keep external recoil and falling momentum through the recovery.
      if (e.timer <= 0) {
        e.state = 'idle';
        e.timer = 0.5;
      }
      return;
    }
    const range = distance(p, g.player.position);
    const origin = { x: p.x, y: p.y - 5 };
    const visible = distance(g.lineEnd(origin, g.player.position, 4), g.player.position) < 1;
    if (range > 680 || !visible) g.updateRunner(e, direction(p, g.player.position), range);
    else Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.88, y: e.body.velocity.y });
    e.facing = Math.sign(g.player.position.x - p.x) || e.facing;
    e.aim = direction(origin, g.player.position);
    if (
      e.timer <= 0 &&
      range < 780 &&
      visible &&
      !this.active &&
      Math.abs(e.body.velocity.y) < 1.2
    ) {
      e.state = 'windup';
      e.timer = HARPOON_TELL;
      rig.phase = 'aim';
      e.aim = direction(origin, g.player.position);
      rig.origin = { ...p };
      rig.anchorHp = HARPOON_ANCHOR_HP;
      g.onSound('harpoon-lock');
    }
  }
  private sync(e: Enemy) {
    const rig = e.harpoon!,
      target = rig.target;
    if (!target) return;
    const a = target.angle,
      p = target.position;
    rig.head = {
      x: p.x + rig.local.x * Math.cos(a) - rig.local.y * Math.sin(a),
      y: p.y + rig.local.x * Math.sin(a) + rig.local.y * Math.cos(a),
    };
  }
  private valid(e: Enemy) {
    const g = this.game,
      rig = e.harpoon!;
    if (e.state !== 'rush' || e.hp <= 0 || g.time >= rig.expires) return false;
    if (rig.target && rig.target !== g.player && !g.props.bodies.includes(rig.target)) return false;
    this.sync(e);
    const start = harpoonMuzzle(e);
    const blockers = g.solidBodies.filter((b) => b !== rig.target);
    return (
      distance(start, rig.head) < 1000 && !firstSolid(start, rig.head, { x: 1, y: 1 }, blockers)
    );
  }
  beforeStep(dt: number) {
    const g = this.game;
    if (g.mode !== 'playing' || g.hitStop > 0) return;
    for (const e of g.enemies) {
      const rig = e.harpoon;
      if (!rig || (rig.phase !== 'latched' && rig.phase !== 'flight')) continue;
      if (!this.valid(e)) {
        this.release(e);
        continue;
      }
      if (rig.phase !== 'latched' || !rig.target) continue;
      const a = e.body,
        b = rig.target;
      if (b.isStatic) {
        this.release(e);
        continue;
      }
      rig.length = Math.max(70, rig.length - 70 * dt);
      const start = harpoonMuzzle(e),
        d = direction(start, rig.head),
        span = distance(start, rig.head);
      if (span <= rig.length) continue;
      const separating = (b.velocity.x - a.velocity.x) * d.x + (b.velocity.y - a.velocity.y) * d.y;
      const reducedMass = (a.mass * b.mass) / (a.mass + b.mass);
      const impulse =
        clamp((span - rig.length) * 0.018 + Math.max(0, separating) * 0.14, 0, 2.1) *
        reducedMass *
        dt *
        60;
      // Equal momentum goes into both bodies. Matter still resolves their
      // contacts; no position snapping, rooted winch or bilateral rigid rope.
      Matter.Body.setVelocity(a, {
        x: a.velocity.x + (d.x * impulse) / a.mass,
        y: a.velocity.y + (d.y * impulse) / a.mass,
      });
      Matter.Body.setVelocity(b, {
        x: b.velocity.x - (d.x * impulse) / b.mass,
        y: b.velocity.y - (d.y * impulse) / b.mass,
      });
    }
  }
  afterStep(dt: number) {
    const g = this.game;
    if (g.mode !== 'playing') return;
    for (const e of [...g.enemies]) {
      const rig = e.harpoon;
      if (!rig || (rig.phase !== 'flight' && rig.phase !== 'latched')) continue;
      if (!this.valid(e)) {
        this.release(e);
        continue;
      }
      if (rig.phase === 'latched') continue;
      const from = rig.head,
        delta = { x: rig.velocity.x * dt * 60, y: rig.velocity.y * dt * 60 };
      const end = { x: from.x + delta.x, y: from.y + delta.y };
      const hit = firstSolid(from, end, { x: 4, y: 4 }, [
        ...g.solidBodies,
        g.player,
        ...g.enemies.filter((other) => other !== e && other.spawn <= 0).map((other) => other.body),
        ...g.enemies.flatMap((other) => (other.crane ? [other.crane.body] : [])),
      ]);
      const portal = g.portals.trace(from, end, { x: 4, y: 4 });
      if (portal && (!hit || portal.t <= hit.t + 1e-6)) {
        this.release(e);
        continue;
      }
      rig.head = { x: from.x + delta.x * (hit?.t ?? 1), y: from.y + delta.y * (hit?.t ?? 1) };
      rig.travel += distance(from, rig.head);
      if (hit) {
        const prop = g.props.items.find((p) => p.body === hit.body);
        if (
          hit.body !== g.player &&
          (!prop || prop.body.isStatic || (prop.cargo && prop.cargo.state !== 'loose'))
        ) {
          this.release(e);
          continue;
        }
        rig.target = hit.body;
        const a = -hit.body.angle,
          x = rig.head.x - hit.body.position.x,
          y = rig.head.y - hit.body.position.y;
        rig.local = { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) };
        rig.length = Math.max(70, distance(harpoonMuzzle(e), rig.head));
        rig.expires = g.time + HARPOON_DURATION;
        rig.phase = 'latched';
        if (prop) {
          disruptScrapperBody(g, prop.body);
          g.magnets.release(prop.body);
          g.props.hit(prop, 0, rig.velocity);
        } else g.damagePlayer(HARPOON_DAMAGE, e.body.position);
        if (g.mode !== 'playing') return;
        g.onSound('harpoon-catch');
      } else if (rig.travel >= HARPOON_RANGE) this.release(e);
    }
  }
  trace(from: Vec, to: Vec, radius: number) {
    const e = this.active;
    if (!e || e.harpoon?.phase !== 'latched') return null;
    const p = harpoonMuzzle(e),
      r = 9 + radius;
    const hit = segmentBox(from, to, { x: p.x - r, y: p.y - r }, { x: p.x + r, y: p.y + r });
    return hit ? { ...hit, enemy: e } : null;
  }
  hitAnchor(e: Enemy, damage: number) {
    if (e.harpoon?.phase !== 'latched' || damage <= 0) return;
    e.harpoon.anchorHp -= damage;
    if (e.harpoon.anchorHp <= 0) this.release(e);
  }
  blast(origin: Vec, damage: number, radius: number, accepts: (p: Vec) => boolean = () => true) {
    const e = this.active;
    if (!e || e.harpoon?.phase !== 'latched') return;
    const p = harpoonMuzzle(e),
      range = Math.max(0, distance(origin, p) - 9);
    if (range <= radius && accepts(p) && distance(this.game.lineEnd(origin, p), p) < 0.1)
      this.hitAnchor(e, damage * (1 - (0.65 * range) / radius));
  }
}
