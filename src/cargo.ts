import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Prop } from './props.ts';
import type { Vec } from './rules.ts';
import { clamp, segmentBox } from './rules.ts';
import { isBoss } from './enemies.ts';
import { cargoPlacement, CARGO_SIZE } from './cargo-layout.ts';
import type { CargoPlacement } from './cargo-layout.ts';
import { hazardBounds } from './hazard-layouts.ts';

export const CABLE_HP = 48;
export const CARGO_TELL = 0.65;
export const CARGO_BOSS_DAMAGE = 90;
export interface CargoRig {
  state: 'hanging' | 'warning' | 'loose';
  anchor: Vec;
  origin: Vec;
  cableHp: number;
  releaseAt: number;
  flash: number;
  impactAt: number;
  hits: Map<number, number>;
}

export class CargoSystem {
  game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  get items() {
    return this.game.props.items.filter((p) => p.cargo);
  }
  reset() {
    const g = this.game;
    for (const p of this.items) g.props.remove(p);
    const placement = cargoPlacement(
      g.level,
      g.roomSeed,
      g.stage,
      [
        ...g.hazards.items.map((h) => hazardBounds(h.placement, 44)),
        ...g.breaches.bodies.map((b) => ({
          x: b.bounds.min.x,
          y: b.bounds.min.y,
          w: b.bounds.max.x - b.bounds.min.x,
          h: b.bounds.max.y - b.bounds.min.y,
        })),
      ],
      g.props.items.map((p) => ({
        x: p.body.bounds.min.x,
        y: p.body.bounds.min.y,
        w: p.body.bounds.max.x - p.body.bounds.min.x,
        h: p.body.bounds.max.y - p.body.bounds.min.y,
      })),
    );
    if (placement) this.spawn(placement);
  }
  spawn(placement: CargoPlacement) {
    const p = this.game.props.spawn('cargo', placement.x, placement.y);
    p.cargo = {
      state: 'hanging',
      anchor: { x: placement.x, y: placement.anchorY },
      origin: { x: placement.x, y: placement.y },
      cableHp: CABLE_HP,
      releaseAt: Infinity,
      flash: 0,
      impactAt: -10,
      hits: new Map(),
    };
    Matter.Body.setStatic(p.body, true);
    return p;
  }
  trace(from: Vec, to: Vec, padding: number) {
    let nearest: { t: number; normal: Vec; prop: Prop } | null = null;
    for (const p of this.items) {
      const rig = p.cargo!;
      if (rig.state !== 'hanging') continue;
      const hit = segmentBox(
        from,
        to,
        { x: rig.anchor.x - 4 - padding, y: rig.anchor.y - padding },
        { x: rig.anchor.x + 4 + padding, y: rig.origin.y - CARGO_SIZE.h / 2 + padding },
      );
      if (hit && (!nearest || hit.t < nearest.t)) nearest = { ...hit, prop: p };
    }
    return nearest;
  }
  cut(prop: Prop, damage: number) {
    const g = this.game,
      rig = prop.cargo;
    if (
      g.mode !== 'playing' ||
      !this.items.includes(prop) ||
      rig?.state !== 'hanging' ||
      !(damage > 0)
    )
      return;
    rig.cableHp = Math.max(0, rig.cableHp - damage);
    rig.flash = 0.1;
    g.onSound('prop');
    if (rig.cableHp > 0) return;
    rig.state = 'warning';
    rig.releaseAt = g.time + CARGO_TELL;
    g.onSound('cargo-release');
  }
  update(dt: number) {
    const g = this.game;
    if (g.mode !== 'playing') return;
    for (const p of this.items) {
      const rig = p.cargo!;
      rig.flash = Math.max(0, rig.flash - dt);
      if (rig.state === 'warning' && g.time >= rig.releaseAt) {
        rig.state = 'loose';
        Matter.Body.setStatic(p.body, false);
        Matter.Body.setVelocity(p.body, { x: 0, y: 0 });
        g.burst({ x: rig.origin.x, y: rig.origin.y - CARGO_SIZE.h / 2 }, 6, '#c5a57a', 2);
      }
    }
  }
  impact(prop: Prop, other: Matter.Body, speed: number) {
    const g = this.game,
      rig = prop.cargo;
    if (rig?.state !== 'loose' || speed < 6 || Math.hypot(prop.velocity.x, prop.velocity.y) < 6)
      return false;
    if (g.time - (rig.hits.get(other.id) ?? -10) < 0.8) return true;
    rig.hits.set(other.id, g.time);
    const enemy = g.enemies.find((e) => e.body === other || e.crane?.body === other);
    if (enemy && enemy.spawn <= 0 && enemy.hp > 0)
      g.hitEnemy(enemy, Math.min(isBoss(enemy.kind) ? CARGO_BOSS_DAMAGE : 240, speed * 18));
    else if (other === g.player) g.damagePlayer(24, prop.body.position);
    else {
      const target = g.props.items.find((p) => p.body === other);
      if (target?.kind === 'canister') g.props.explode(target);
      else if (target) g.props.hit(target, clamp(speed * 9, 45, 120), prop.velocity);
      else {
        g.breaches.hitBody(other, clamp(speed * 9, 45, 120), prop.velocity);
        g.destruction.hitBody(other, clamp(speed * 9, 45, 120), prop.velocity);
      }
    }
    if (g.mode !== 'playing') return true;
    if (g.time - rig.impactAt > 0.3) {
      rig.impactAt = g.time;
      g.feedback(4.5);
      g.burst(
        { x: prop.body.position.x, y: prop.body.position.y + CARGO_SIZE.h / 2 },
        14,
        '#b1b7ad',
        3,
      );
      g.hitStop = Math.max(g.hitStop, 0.025);
      g.onSound('cargo-impact');
    }
    return true;
  }
}
