import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import { clamp, distance, type Vec } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { isBoss } from './enemies.ts';
import { breakSquad } from './squads.ts';

const { Body, Bodies, Composite, Events } = Matter;
export const WRECK_LIFE = 0.75;
export const WRECK_LIMIT = 8;
export const FLASH_RADIUS = 118;
export const FLASH_LIFE = 0.2;
export interface Wreck {
  enemy: Enemy;
  body: Matter.Body;
  corpse: boolean;
  until: number;
}
export class SalvageEvolutionSystem {
  game: Game;
  wrecks: Wreck[] = [];
  flashes: { pos: Vec; at: number }[] = [];
  private velocities = new Map<Matter.Body, Vec>();
  private contacts: { wreck: Wreck; other: Matter.Body; speed: number; from: Vec }[] = [];
  private flashing = false;
  constructor(game: Game) {
    this.game = game;
    const collision = (event: Matter.IEventCollision<Matter.Engine>) => {
      if (game.mode !== 'playing') return;
      for (const pair of event.pairs)
        for (const wreck of this.wrecks) {
          const a = pair.bodyA === wreck.body,
            b = pair.bodyB === wreck.body;
          if (!a && !b) continue;
          const other = a ? pair.bodyB : pair.bodyA;
          if (other.isSensor || other === game.player) continue;
          const v = this.velocities.get(wreck.body),
            w = this.velocities.get(other) ?? other.velocity;
          if (!v) continue;
          const n = pair.collision.normal;
          const speed = ((v.x - w.x) * n.x + (v.y - w.y) * n.y) * (a ? -1 : 1);
          if (speed >= 5)
            this.contacts.push({ wreck, other, speed, from: { ...wreck.body.position } });
        }
    };
    Events.on(game.engine, 'collisionStart', collision);
    Events.on(game.engine, 'collisionActive', collision);
  }
  get bodies() {
    return this.wrecks.filter((w) => w.corpse).map((w) => w.body);
  }
  reset() {
    for (const w of [...this.wrecks]) this.finish(w);
    this.contacts = [];
    this.velocities.clear();
    this.flashes = [];
    this.flashing = false;
  }
  private corpse(e: Enemy) {
    const p = e.body.position;
    const body = Bodies.fromVertices(p.x, p.y, [e.body.vertices.map((v) => ({ x: v.x, y: v.y }))], {
      label: 'salvage-wreck',
      friction: 0.05,
      frictionAir: 0.015,
      inertia: Infinity,
    });
    Composite.add(this.game.engine.world, body);
    return body;
  }
  throwEnemy(e: Enemy, direction: Vec, speed: number) {
    const g = this.game;
    if (
      !g.mods.includes('wrecking-ball') ||
      isBoss(e.kind) ||
      e.elite === 'volatile' ||
      ['charger', 'scrapper', 'harpooner', 'borer'].includes(e.kind)
    )
      return false;
    const old = this.wrecks.find((w) => w.enemy === e);
    if (old) this.finish(old);
    if (this.wrecks.length >= WRECK_LIMIT) this.finish(this.wrecks[0]);
    g.tethers.disrupt(e.body);
    g.harpoons.disrupt(e.body);
    g.sappers.disrupt(e.body);
    g.ballistics.pins.delete(e.id);
    breakSquad(g, e);
    const corpse = e.hp <= 0;
    const body = corpse ? this.corpse(e) : e.body;
    if (body.isStatic) Body.setStatic(body, false);
    const launchSpeed = clamp(speed, 12, 21);
    Body.setVelocity(body, { x: direction.x * launchSpeed, y: direction.y * launchSpeed - 2 });
    if (!corpse) {
      e.state = 'recover';
      e.timer = 0.5;
    }
    this.wrecks.push({ enemy: e, body, corpse, until: g.time + WRECK_LIFE });
    return true;
  }
  carried(e: Enemy) {
    return this.wrecks.some((w) => !w.corpse && w.enemy === e && w.until > this.game.time);
  }
  teleported(body: Matter.Body, velocity: Vec) {
    if (this.wrecks.some((w) => w.body === body)) {
      this.velocities.set(body, { ...velocity });
      this.contacts = this.contacts.filter((hit) => hit.wreck.body !== body);
    }
  }
  crush(body: Matter.Body) {
    const wreck = this.wrecks.find((w) => w.corpse && w.body === body);
    if (!wreck) return;
    this.finish(wreck);
    this.game.burst(body.position, 6, '#acb4ac', 2);
    this.game.onSound('crash');
  }
  private finish(w: Wreck) {
    if (w.corpse) Composite.remove(this.game.engine.world, w.body);
    else if (w.enemy.hp > 0) {
      w.enemy.state = 'recover';
      w.enemy.timer = 0.35;
    }
    this.wrecks = this.wrecks.filter((x) => x !== w);
  }
  // Runs after the defeated enemy has been removed. A killing ram can still
  // throw its hull, and killing a living thrown enemy preserves its flight.
  killed(e: Enemy) {
    const g = this.game;
    const wreck = this.wrecks.find((w) => !w.corpse && w.enemy === e);
    if (wreck) {
      const velocity = { ...wreck.body.velocity };
      wreck.body = this.corpse(e);
      wreck.corpse = true;
      Body.setVelocity(wreck.body, velocity);
    }
    if (!g.mods.includes('flashpoint') || this.flashing || isBoss(e.kind) || !g.salvage.burning(e))
      return;
    const pos = { ...e.body.position };
    const blockers = [
      ...g.solidBodies,
      ...g.enemies.flatMap((e) => (e.crane ? [e.crane.body] : [])),
    ];
    const visible = (p: Vec, ignore?: Matter.Body) =>
      !firstSolid(
        pos,
        p,
        { x: 0, y: 0 },
        blockers.filter((b) => b !== e.body && b !== wreck?.body && b !== ignore),
      );
    // Snapshot every recipient before consuming fire or breaking cover.
    const targets = g.enemies.filter(
      (other) =>
        other.hp > 0 &&
        other.spawn <= 0 &&
        distance(pos, other.body.position) < FLASH_RADIUS &&
        visible(other.body.position),
    );
    const props = g.props.items.filter(
      (p) => distance(pos, p.body.position) < FLASH_RADIUS && visible(p.body.position, p.body),
    );
    g.salvage.cinders = g.salvage.cinders.filter(
      (f) => distance(pos, f.pos) > FLASH_RADIUS || !visible(f.pos),
    );
    this.flashes.push({ pos, at: g.time });
    if (this.flashes.length > 8) this.flashes.shift();
    g.onSound('flashpoint');
    g.feedback(2);
    this.flashing = true;
    try {
      for (const other of targets) {
        if (g.mode !== 'playing') break;
        g.hitEnemy(other, 44 * (1 - distance(pos, other.body.position) / (FLASH_RADIUS * 2)), pos);
      }
      for (const prop of props) {
        if (g.mode !== 'playing') break;
        if (!g.props.items.includes(prop)) continue;
        g.props.hit(prop, 28, { x: prop.body.position.x - pos.x, y: prop.body.position.y - pos.y });
        if (prop.kind === 'canister') prop.detonateAt = Math.min(prop.detonateAt, g.time + 0.35);
      }
    } finally {
      this.flashing = false;
    }
  }
  beforeStep() {
    const g = this.game;
    this.contacts = [];
    this.velocities.clear();
    this.flashes = this.flashes.filter((f) => g.time - f.at < FLASH_LIFE);
    for (const w of [...this.wrecks])
      if (
        w.until <= g.time ||
        w.body.position.y > 900 ||
        (!w.corpse && !g.enemies.includes(w.enemy))
      )
        this.finish(w);
    if (this.wrecks.length)
      for (const b of Composite.allBodies(g.engine.world))
        this.velocities.set(b, { ...b.velocity });
  }
  afterStep() {
    const g = this.game;
    for (const { wreck, other, speed, from } of this.contacts) {
      if (g.mode !== 'playing' || !this.wrecks.includes(wreck)) continue;
      const target = g.enemies.find((e) => e.body === other && e.spawn <= 0 && e.hp > 0);
      const prop = g.props.items.find((p) => p.body === other);
      if (!target && !prop && !g.terrainBodies.includes(other)) continue;
      const corpse = wreck.corpse;
      const reachesTarget =
        target &&
        !firstSolid(
          from,
          target.body.position,
          { x: 0, y: 0 },
          g.solidBodies.filter((b) => b !== wreck.body),
        );
      this.finish(wreck);
      const amount = clamp(speed * 4, 24, 76);
      if (target && reachesTarget) g.hitEnemy(target, amount, from);
      if (prop) {
        // Consume the shared enemy/prop contact so it cannot apply damage twice.
        prop.hits.set(wreck.enemy.id, g.time);
        g.props.strike(prop, amount, this.velocities.get(wreck.body) ?? { x: 0, y: 0 });
      }
      if (!corpse && wreck.enemy.hp > 0) g.hitEnemy(wreck.enemy, amount * 0.4, other.position);
      g.onSound('crash');
      g.feedback(2);
    }
    this.contacts = [];
  }
}
