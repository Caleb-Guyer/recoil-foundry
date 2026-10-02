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
  reservoirShots = 0;
  reservoirReady = false;
  game: Game;
  charges = new Map<number, Charge>();
  effects: ArcEffect[] = [];
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.reservoirShots = 0;
    this.reservoirReady = false;
    this.charges.clear();
    this.effects = [];
  }
  update() {
    const g = this.game;
    if (g.mode !== 'playing' || g.hitStop > 0) return;
    if (g.grounded) this.land();
    for (const [id, charge] of this.charges)
      if (charge.until <= g.time || charge.enemy.hp <= 0 || !g.enemies.includes(charge.enemy))
        this.charges.delete(id);
    this.effects = this.effects.filter((f) => g.time - f.at < ARC_EFFECT_LIFE);
  }
  land() {
    this.reservoirShots = 0;
    this.reservoirReady = false;
  }
  recoiled() {
    const g = this.game;
    if (
      g.mode !== 'playing' ||
      g.grounded ||
      !g.mods.includes('static-reservoir') ||
      !g.mods.includes('arc-coil') ||
      this.reservoirReady
    )
      return;
    if (++this.reservoirShots >= 3) {
      this.reservoirReady = true;
      this.reservoirShots = 0;
      g.burst(g.player.position, 4, '#b9e4ed', 1.5);
    }
  }
  hit(enemy: Enemy, shot: Shot) {
    const g = this.game;
    if (
      g.mode !== 'playing' ||
      !g.mods.includes('arc-coil') ||
      enemy.spawn > 0 ||
      enemy.allied ||
      !shot.friendly ||
      shot.allied ||
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
    if (g.mods.includes('short-circuit')) {
      const extra = this.extraPlan(enemy, charge.damage * 0.4, new Set([enemy.body]));
      if (enemy.hp > 0) {
        const d = direction({ x: 0, y: 0 }, shot.vel);
        g.hitEnemy(enemy, charge.damage * 0.4, {
          x: enemy.body.position.x - d.x * 30,
          y: enemy.body.position.y - d.y * 30,
        });
        g.burst(enemy.body.position, 5, '#c5e5da', 3);
        g.onSound('arc');
      }
      this.applyPlan(extra);
      return;
    }
    // The three actual round payloads determine the arc. Pellets cannot each
    // borrow the full gun's damage; temporary bonuses apply only once.
    this.discharge(enemy, charge.damage * 0.4);
  }
  private grounded(e: Enemy) {
    const p = e.body;
    if (p.velocity.y < -1) return false;
    return !!firstSolid(
      { x: p.position.x, y: p.bounds.max.y - 1 },
      { x: p.position.x, y: p.bounds.max.y + 18 },
      { x: 0, y: 0 },
      this.game.solidBodies,
    );
  }
  private extraPlan(source: Enemy, damage: number, visited: Set<Matter.Body>) {
    const g = this.game,
      plan: { from: Vec; target: Node; damage: number }[] = [];
    const from = { ...source.body.position };
    const blockers = [
      ...g.solidBodies,
      ...g.enemies.flatMap((e) => (e.crane ? [e.crane.body] : [])),
    ];
    const cable = g.tethers.link;
    const peer =
      cable &&
      cable.until > g.time &&
      (cable.a === source ? cable.b : cable.b === source ? cable.a : null);
    if (
      g.mods.includes('conductive-tether') &&
      peer &&
      peer.hp > 0 &&
      peer.spawn <= 0 &&
      !peer.allied &&
      g.enemies.includes(peer) &&
      distance(from, peer.body.position) <= 640 &&
      g.tethers.clearPath(source, peer) &&
      !firstSolid(
        from,
        peer.body.position,
        { x: 0, y: 0 },
        blockers.filter((b) => b !== source.body && b !== peer.body),
      )
    ) {
      plan.push({
        from,
        target: { body: peer.body, pos: { ...peer.body.position }, enemy: peer },
        damage: damage * 0.35,
      });
      visited.add(peer.body);
    }
    if (this.reservoirReady && g.mods.includes('static-reservoir')) {
      this.reservoirReady = false;
      this.reservoirShots = 0;
      const peer = g.enemies
        .filter(
          (e) =>
            e.hp > 0 &&
            e.spawn <= 0 &&
            !e.allied &&
            !visited.has(e.body) &&
            distance(from, e.body.position) <= ARC_RANGE &&
            !firstSolid(
              from,
              e.body.position,
              { x: 0, y: 0 },
              blockers.filter((b) => b !== source.body && b !== e.body),
            ),
        )
        .sort(
          (a, b) =>
            distance(from, a.body.position) - distance(from, b.body.position) || a.id - b.id,
        )[0];
      if (peer)
        plan.push({
          from,
          target: { body: peer.body, pos: { ...peer.body.position }, enemy: peer },
          damage: damage * 0.5,
        });
    }
    return plan;
  }
  private applyPlan(plan: { from: Vec; target: Node; damage: number }[]) {
    const g = this.game;
    let sounded = false;
    for (const [hop, step] of plan.entries()) {
      if (g.mode !== 'playing') break;
      const { target, from } = step;
      if (target.enemy && (target.enemy.hp <= 0 || !g.enemies.includes(target.enemy))) continue;
      if (target.prop && !g.props.items.includes(target.prop)) continue;
      this.effects.push({ a: from, b: { ...target.pos }, at: g.time, hop: Math.min(hop, 3) });
      if (this.effects.length > ARC_EFFECT_LIMIT) this.effects.shift();
      if (!sounded) {
        g.onSound('arc');
        sounded = true;
      }
      if (target.enemy) {
        if (g.hitEnemy(target.enemy, step.damage, from)) break;
        if (target.enemy.hp <= 0) this.charges.delete(target.enemy.id);
      } else if (target.prop) {
        g.props.hit(target.prop, step.damage, direction(from, target.pos), undefined, false, true);
        if (target.prop.kind === 'canister')
          target.prop.detonateAt = Math.min(target.prop.detonateAt, g.time + 0.45);
      }
    }
  }
  private discharge(source: Enemy, damage: number) {
    const g = this.game,
      dischargeDamage = damage;
    const nodes: Node[] = [
      ...g.enemies
        .filter((e) => e.hp > 0 && e.spawn <= 0 && !e.allied)
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
    if (g.mods.includes('ground-fault')) {
      if (this.grounded(source)) {
        const foot = { x: source.body.position.x, y: source.body.bounds.max.y - 3 };
        const targets = g.enemies
          .filter(
            (e) =>
              e !== source &&
              e.hp > 0 &&
              e.spawn <= 0 &&
              !e.allied &&
              this.grounded(e) &&
              distance(source.body.position, e.body.position) <= 190 &&
              Math.abs(source.body.bounds.max.y - e.body.bounds.max.y) <= 28 &&
              !firstSolid(
                foot,
                { x: e.body.position.x, y: e.body.bounds.max.y - 3 },
                { x: 0, y: 0 },
                blockers.filter((b) => b !== source.body && b !== e.body),
              ),
          )
          .sort(
            (a, b) =>
              distance(source.body.position, a.body.position) -
                distance(source.body.position, b.body.position) || a.id - b.id,
          )
          .slice(0, 3);
        for (const target of targets) {
          plan.push({
            from: { ...source.body.position },
            target: { body: target.body, pos: { ...target.body.position }, enemy: target },
            damage: damage * 0.75,
          });
          visited.add(target.body);
        }
      }
    }
    // Plan against intact cover before applying damage. Breaking a prop must
    // never let this same discharge reach a target through the opening.
    for (
      let hop = 0;
      hop < (g.mods.includes('ground-fault') ? 0 : g.mods.includes('daisy-chain') ? 3 : 1);
      hop++
    ) {
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
    const extras = this.extraPlan(source, dischargeDamage, visited);
    this.applyPlan(plan);
    this.applyPlan(extras);
  }
}
