import type Matter from 'matter-js';
import type { Enemy, Game, Shot } from './game.ts';
import type { Prop } from './props.ts';
import type { Vec } from './rules.ts';
import { direction, distance } from './rules.ts';
import { firstSolid } from './collisions.ts';

export const ARC_RANGE = 240;
export const ARC_CHARGE_LIFE = 4;
export const ARC_FALLOFF = 0.7;
export const ARC_EFFECT_LIFE = 0.16;
export const ARC_EFFECT_LIMIT = 24;
interface Charge {
  enemy: Enemy;
  hits: number;
  damage: number;
  until: number;
  flashAt: number;
}
interface Node {
  body: Matter.Body;
  pos: Vec;
  enemy?: Enemy;
  prop?: Prop;
}
export interface ArcEffect {
  a: Vec;
  b: Vec;
  at: number;
  hop: number;
}

export class ArcCoilSystem {
  game: Game;
  charges = new Map<number, Charge>();
  effects: ArcEffect[] = [];
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.charges.clear();
    this.effects = [];
  }
  update() {
    const g = this.game;
    if (g.mode !== 'playing' || g.hitStop > 0) return;
    for (const [id, charge] of this.charges)
      if (charge.until <= g.time || charge.enemy.hp <= 0 || !g.enemies.includes(charge.enemy))
        this.charges.delete(id);
    this.effects = this.effects.filter((f) => g.time - f.at < ARC_EFFECT_LIFE);
  }
  hit(enemy: Enemy, shot: Shot) {
    const g = this.game;
    if (
      g.mode !== 'playing' ||
      !g.mods.includes('arc-coil') ||
      enemy.spawn > 0 ||
      !shot.friendly ||
      shot.fragment ||
      shot.echo ||
      shot.reflected ||
      !(shot.damage > 0)
    )
      return;
    const stored = this.charges.get(enemy.id);
    const charge =
      stored && stored.until > g.time
        ? stored
        : {
            enemy,
            hits: 0,
            damage: 0,
            until: 0,
            flashAt: g.time,
          };
    charge.hits++;
    charge.damage += shot.damage;
    charge.until = g.time + ARC_CHARGE_LIFE;
    charge.flashAt = g.time;
    if (charge.hits < 3) {
      if (enemy.hp > 0) this.charges.set(enemy.id, charge);
      else this.charges.delete(enemy.id);
      return;
    }
    this.charges.delete(enemy.id);
    // The three actual round payloads determine the arc. Pellets cannot each
    // borrow the full gun's damage; temporary bonuses apply only once.
    this.discharge(enemy, charge.damage * 0.4);
  }
  private discharge(source: Enemy, damage: number) {
    const g = this.game;
    const nodes: Node[] = [
      ...g.enemies
        .filter((e) => e.hp > 0 && e.spawn <= 0)
        .map((enemy) => ({ body: enemy.body, pos: { ...enemy.body.position }, enemy })),
      ...g.props.items
        .filter((p) => ['crate', 'cover', 'cargo', 'canister'].includes(p.kind))
        .map((prop) => ({ body: prop.body, pos: { ...prop.body.position }, prop })),
    ];
    const blockers = [
      ...g.solidBodies,
      ...g.enemies.flatMap((e) => (e.crane ? [e.crane.body] : [])),
    ];
    const visited = new Set<Matter.Body>([source.body]);
    let previous: Node = { body: source.body, pos: { ...source.body.position }, enemy: source };
    const plan: { from: Vec; target: Node; damage: number }[] = [];
    // Plan against intact cover before applying damage. Breaking a prop must
    // never let this same discharge reach a target through the opening.
    for (let hop = 0; hop < (g.mods.includes('daisy-chain') ? 3 : 1); hop++) {
      const from = previous;
      const target = nodes
        .filter(
          (n) =>
            !visited.has(n.body) &&
            distance(from.pos, n.pos) <= ARC_RANGE &&
            !firstSolid(
              from.pos,
              n.pos,
              { x: 0, y: 0 },
              blockers.filter((b) => b !== from.body && b !== n.body),
            ),
        )
        .sort(
          (a, b) => distance(from.pos, a.pos) - distance(from.pos, b.pos) || a.body.id - b.body.id,
        )[0];
      if (!target) break;
      plan.push({ from: { ...from.pos }, target, damage });
      visited.add(target.body);
      previous = target;
      damage *= ARC_FALLOFF;
    }
    let sounded = false;
    for (const [hop, step] of plan.entries()) {
      if (g.mode !== 'playing') break;
      const { target, from } = step;
      if (target.enemy && (target.enemy.hp <= 0 || !g.enemies.includes(target.enemy))) break;
      if (target.prop && !g.props.items.includes(target.prop)) break;
      this.effects.push({ a: from, b: { ...target.pos }, at: g.time, hop });
      if (this.effects.length > ARC_EFFECT_LIMIT) this.effects.shift();
      if (!sounded) {
        g.onSound('arc');
        sounded = true;
      }
      if (target.enemy) {
        // Directional shields and boss armor keep their normal damage rules.
        // Shield contact consumes the arc and stops the rest of the chain.
        if (g.hitEnemy(target.enemy, step.damage, from)) break;
        if (target.enemy.hp <= 0) this.charges.delete(target.enemy.id);
      } else if (target.prop) {
        g.props.hit(target.prop, step.damage, direction(from, target.pos));
        if (target.prop.kind === 'canister')
          target.prop.detonateAt = Math.min(target.prop.detonateAt, g.time + 0.45);
      }
    }
  }
}
