import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { PressurePlacement } from './pressure-layouts.ts';
import { clamp, segmentBox, type Vec } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { isBoss } from './enemies.ts';
import { dropWallcrawler } from './wallcrawler.ts';
import { breakSquad } from './squads.ts';
const { Body } = Matter;

export const PRESSURE = {
  warn: 1,
  burst: 0.42,
  recharge: 4.2,
  ready: 1.8,
  radius: 13,
  impulse: 16,
};
export interface PressureVent extends PressurePlacement {
  phase: 'recharge' | 'ready' | 'warn' | 'burst';
  timer: number;
  launched: Set<Matter.Body>;
}
const along = (v: PressurePlacement, distance: number, across = 0): Vec => ({
  x: v.x + v.dir.x * distance - v.dir.y * across,
  y: v.y + v.dir.y * distance + v.dir.x * across,
});

export class PressureSystem {
  game: Game;
  items: PressureVent[] = [];
  airborne = new Map<Enemy, number>();
  constructor(game: Game) {
    this.game = game;
  }
  clear() {
    this.items = [];
    this.airborne.clear();
  }
  reset() {
    this.clear();
    for (const p of this.game.level.vents ?? []) this.spawn(p);
  }
  spawn(p: PressurePlacement) {
    const v: PressureVent = {
      ...p,
      dir: { ...p.dir },
      valve: { ...p.valve },
      phase: 'recharge',
      timer: 2.5 + p.offset,
      launched: new Set(),
    };
    this.items.push(v);
    return v;
  }
  staggered(e: Enemy) {
    return (this.airborne.get(e) ?? 0) > this.game.time;
  }
  trigger(v: PressureVent) {
    if (this.game.mode !== 'playing' || v.phase !== 'ready' || !this.items.includes(v))
      return false;
    v.phase = 'warn';
    v.timer = PRESSURE.warn;
    this.game.onSound('pressure-warn');
    return true;
  }
  trace(from: Vec, to: Vec, radius = 0) {
    let nearest: { t: number; normal: Vec; vent: PressureVent } | undefined;
    for (const v of this.items) {
      const r = PRESSURE.radius + radius;
      const h = segmentBox(
        from,
        to,
        { x: v.valve.x - r, y: v.valve.y - r },
        { x: v.valve.x + r, y: v.valve.y + r },
      );
      if (h && (!nearest || h.t < nearest.t)) nearest = { ...h, vent: v };
    }
    return nearest;
  }
  // Rendering and physics share parallel, cover-clipped lanes. Crates and
  // tilted machinery obstruct the jet at their actual convex surfaces.
  reach(v: PressurePlacement, across = 0, ignore?: Matter.Body) {
    const from = along(v, 0, across),
      to = along(v, v.length, across);
    const hit = firstSolid(
      from,
      to,
      { x: 0, y: 0 },
      this.game.solidBodies.filter((b) => b !== ignore),
    );
    return v.length * (hit?.t ?? 1);
  }
  exposed(v: PressureVent, b: Matter.Body) {
    const dx = b.position.x - v.x,
      dy = b.position.y - v.y;
    const depth = dx * v.dir.x + dy * v.dir.y;
    const across = -dx * v.dir.y + dy * v.dir.x;
    const halfAlong = Math.max(
      ...b.vertices.map((p) =>
        Math.abs((p.x - b.position.x) * v.dir.x + (p.y - b.position.y) * v.dir.y),
      ),
    );
    const halfAcross = Math.max(
      ...b.vertices.map((p) =>
        Math.abs(-(p.x - b.position.x) * v.dir.y + (p.y - b.position.y) * v.dir.x),
      ),
    );
    if (
      depth + halfAlong <= 0 ||
      depth - halfAlong >= v.length ||
      Math.abs(across) >= v.width / 2 + halfAcross
    )
      return false;
    const lane = clamp(across, -v.width / 2 + 1, v.width / 2 - 1);
    // Test the actual target hull, not its center or an expanded bounding box.
    // A prop partly in a jet can move, but a nearby wall still shields it.
    const from = along(v, 0, lane),
      end = along(v, v.length, lane);
    const hit = firstSolid(from, end, { x: 0, y: 0 }, [b]);
    return !!hit && hit.t * v.length <= this.reach(v, lane, b) + 0.01;
  }
  beforeStep(dt: number) {
    const g = this.game;
    if (g.mode !== 'playing' || !(dt > 0)) return;
    for (const [e, until] of this.airborne)
      if (until <= g.time || e.hp <= 0 || !g.enemies.includes(e)) this.airborne.delete(e);
    for (const v of this.items) {
      v.timer = Math.max(0, v.timer - dt);
      if (v.timer <= 1e-8) {
        if (v.phase === 'recharge') {
          v.phase = 'ready';
          v.timer = PRESSURE.ready;
        } else if (v.phase === 'ready' && !g.clear) this.trigger(v);
        else if (v.phase === 'warn') {
          v.phase = 'burst';
          v.timer = PRESSURE.burst;
          v.launched.clear();
          g.onSound('pressure-burst');
        } else if (v.phase === 'burst') {
          v.phase = 'recharge';
          v.timer = PRESSURE.recharge;
          v.launched.clear();
        }
      }
      if (v.phase !== 'burst') continue;
      const actors = [
        g.player,
        ...g.enemies.filter((e) => e.hp > 0 && e.spawn <= 0).map((e) => e.body),
        ...g.props.bodies,
        ...g.salvageEvolutions.bodies,
      ];
      // Decide exposure before moving anything: the same cover shields every
      // target for this step, regardless of its order in the actor array.
      const exposed = actors.filter((b) => !v.launched.has(b) && this.exposed(v, b));
      for (const b of exposed) this.launch(v, b);
    }
  }
  private launch(v: PressureVent, b: Matter.Body) {
    const g = this.game,
      e = g.enemies.find((e) => e.body === b);
    // Anchored machines and armed volatile enemies retain their warned attacks.
    if (e && (isBoss(e.kind) || (e.elite === 'volatile' && e.state === 'windup'))) return;
    if (e && (g.ballistics.pinned(e) || g.salvageEvolutions.carried(e))) return;
    if (b.isStatic && (!e || !['shooter', 'sniper'].includes(e.kind))) return;
    v.launched.add(b);
    const heavy = e && ['charger', 'scrapper', 'harpooner', 'borer'].includes(e.kind);
    if (e && !heavy) {
      g.harpoons.disrupt(b);
      g.sappers.disrupt(b);
      breakSquad(g, e);
      dropWallcrawler(g, e);
      if (e.angler) e.angler.plan = undefined;
      e.state = 'recover';
      e.timer = Math.max(e.timer, 0.65);
      this.airborne.set(e, g.time + 0.42);
    }
    if (b.isStatic) Body.setStatic(b, false);
    const massFactor = clamp(g.player.mass / b.mass, 0.55, 1.15);
    const impulse = PRESSURE.impulse * (b === g.player ? 1 : massFactor) * (heavy ? 0.2 : 1);
    const speed = b.velocity.x * v.dir.x + b.velocity.y * v.dir.y;
    const added = Math.max(0, Math.min(impulse, 20 - speed));
    Body.setVelocity(b, { x: b.velocity.x + v.dir.x * added, y: b.velocity.y + v.dir.y * added });
    const prop = g.props.items.find((p) => p.body === b);
    if (prop) {
      g.magnets.release(b);
      if (prop.kind === 'canister') prop.armedAt = Math.min(prop.armedAt, g.time + 0.18);
    }
    if (b === g.player) {
      g.jumpCut = true;
      if (v.dir.y < 0) {
        g.grounded = false;
        g.coyote = 0;
      }
      g.feedback(1.4, v.dir);
    }
  }
}
