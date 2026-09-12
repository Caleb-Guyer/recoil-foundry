import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { bodyHalf } from './portals.ts';
import { CROSSING } from './crossing-layout.ts';
const { Bodies, Body, Composite } = Matter;
export interface FreightCar {
  body: Matter.Body;
  hits: Set<number>;
  crushAt: Map<number, number>;
}
const hull = (b: Matter.Body) => {
  const half = bodyHalf(b);
  return {
    left: b.position.x - half.x,
    right: b.position.x + half.x,
    top: b.position.y - half.y,
    bottom: b.position.y + half.y,
  };
};

export class CrossingSystem {
  game: Game;
  active = false;
  cars: FreightCar[] = [];
  phase: 'idle' | 'warning' | 'passing' = 'idle';
  timer = 1;
  direction = 1;
  blocked = false;
  private pulse = 0;
  private riders = new Map<Matter.Body, Vec>();
  constructor(game: Game) {
    this.game = game;
  }
  get bodies() {
    return this.cars.map((c) => c.body);
  }
  clear() {
    for (const body of this.bodies) Composite.remove(this.game.engine.world, body);
    this.cars = [];
    this.active = false;
    this.phase = 'idle';
    this.timer = 1;
    this.pulse = 0;
    this.blocked = false;
    this.riders.clear();
  }
  reset() {
    this.clear();
    this.active = !!this.game.level.crossing;
    this.direction = this.game.level.mirrored ? -1 : 1;
  }
  beginStep(dt: number) {
    const g = this.game;
    if (!this.active || g.mode !== 'playing') return;
    if (g.clear && this.phase !== 'passing') {
      this.phase = 'idle';
      return;
    }
    this.pulse -= dt;
    if (this.phase === 'passing') {
      if (this.pulse <= 0 && !this.blocked) {
        g.onSound('train-roll');
        this.pulse = 0.45;
      }
      return;
    }
    this.timer -= dt;
    if (this.phase === 'warning' && this.pulse <= 0) {
      g.onSound(this.timer > 1.1 ? 'train-warn' : 'train-near');
      this.pulse = this.timer > 1.1 ? 0.65 : 0.35;
    }
    if (this.timer > 0) return;
    if (this.phase === 'idle') {
      this.phase = 'warning';
      this.timer = CROSSING.tell;
      this.pulse = 0;
      g.onSound('train-horn');
    } else this.depart();
  }
  private depart() {
    this.phase = 'passing';
    for (let i = 0; i < 2; i++) {
      const x = -CROSSING.width / 2 - 12 - i * (CROSSING.width + CROSSING.gap);
      const body = Bodies.rectangle(
        this.direction === 1 ? x : 2000 - x,
        CROSSING.top + CROSSING.height / 2,
        CROSSING.width,
        CROSSING.height,
        {
          isStatic: true,
          friction: 0,
          frictionStatic: 0,
          label: 'freight-car',
        },
      );
      this.cars.push({ body, hits: new Set(), crushAt: new Map() });
      Composite.add(this.game.engine.world, body);
    }
  }
  private actors() {
    const g = this.game;
    return [
      g.player,
      ...g.enemies.filter((e) => e.hp > 0).map((e) => e.body),
      ...g.props.bodies,
      ...g.salvageEvolutions.bodies,
    ];
  }
  private supported(actor: Matter.Body, support: Matter.Body) {
    const a = hull(actor),
      b = hull(support);
    return (
      actor.velocity.y >= -0.1 &&
      Math.abs(a.bottom - b.top) < 3 &&
      a.right > b.left + 2 &&
      a.left < b.right - 2
    );
  }
  private impact(car: FreightCar, actor: Matter.Body, pinned = false) {
    const g = this.game,
      d = { x: this.direction, y: 0 };
    if (g.clear || g.mode !== 'playing') return;
    const prop = g.props.items.find((p) => p.body === actor);
    const enemy = g.enemies.find((e) => e.body === actor);
    if (enemy && enemy.spawn > 0) {
      if (actor.isStatic) Body.setStatic(actor, false);
      return;
    }
    if (pinned) {
      if (g.time < (car.crushAt.get(actor.id) ?? 0)) return;
      car.crushAt.set(actor.id, g.time + 0.5);
      if (prop) g.props.strike(prop, 180, d);
      else if (enemy) g.hitEnemy(enemy, 32, d);
      return;
    }
    if (car.hits.has(actor.id)) return;
    car.hits.add(actor.id);
    car.crushAt.set(actor.id, g.time + 0.5);
    if (actor === g.player) g.damagePlayer(24, car.body.position);
    else if (enemy) g.hitEnemy(enemy, 80, d);
    else if (prop) g.props.strike(prop, 30, d);
    if (g.mode !== 'playing') return;
    // Gunners have a finite dynamic hull underneath their anchored pose.
    if (enemy && enemy.hp > 0 && actor.isStatic) Body.setStatic(actor, false);
    if (!actor.isStatic)
      Body.setVelocity(actor, {
        x: this.direction * Math.max(6, actor.velocity.x * this.direction),
        y: Math.min(actor.velocity.y, -2),
      });
    g.onSound('train-impact');
    g.feedback(2);
  }
  private safeMove(
    body: Matter.Body,
    dx: number,
    ignored: Set<Matter.Body>,
    actors: Matter.Body[],
  ) {
    const half = bodyHalf(body);
    const blockers = [...this.game.solidBodies, ...actors].filter(
      (b) => b !== body && !ignored.has(b) && !this.bodies.includes(b),
    );
    const hit = firstSolid(
      body.position,
      { x: body.position.x + dx, y: body.position.y },
      { x: Math.max(0.1, half.x + 0.3), y: Math.max(0.1, half.y - 0.2) },
      blockers,
    );
    return hit ? Math.max(0, hit.t - 0.01) : 1;
  }
  beforeStep(dt: number) {
    const g = this.game;
    if (!this.active || this.phase !== 'passing' || g.mode !== 'playing') return;
    const dx = this.direction * CROSSING.speed * dt;
    let actors = this.actors();
    const riders = new Set(actors.filter((a) => this.cars.some((c) => this.supported(a, c.body))));
    for (const support of riders)
      for (const actor of actors)
        if (!riders.has(actor) && this.supported(actor, support)) riders.add(actor);
    for (const actor of riders)
      if (actor.isStatic && g.enemies.some((e) => e.body === actor)) Body.setStatic(actor, false);
    // A jump inherits one frame-speed of the car; firing and portal travel keep their own momentum.
    for (const [actor, last] of this.riders) {
      if (
        !riders.has(actor) &&
        actors.includes(actor) &&
        actor.velocity.y < -0.1 &&
        Math.hypot(actor.position.x - last.x, actor.position.y - last.y) < 50
      )
        Body.setVelocity(actor, {
          x: clamp(actor.velocity.x + (this.blocked ? 0 : dx), -23, 23),
          y: actor.velocity.y,
        });
    }
    const pushes = new Map<Matter.Body, number>();
    const contacts = new Map<Matter.Body, FreightCar>();
    for (const car of this.cars) {
      const c = hull(car.body),
        edge = this.direction > 0 ? c.right : c.left;
      for (const actor of actors) {
        if (riders.has(actor)) continue;
        const a = hull(actor),
          near = this.direction > 0 ? a.left : a.right;
        const gap = (near - edge) * this.direction;
        if (
          a.bottom <= c.top + 0.5 ||
          a.top >= c.bottom - 0.5 ||
          gap > Math.abs(dx) ||
          (actor.position.x - car.body.position.x) * this.direction < 0
        )
          continue;
        this.impact(car, actor);
        if (g.mode !== 'playing') return;
        pushes.set(actor, Math.max(pushes.get(actor) ?? 0, Math.abs(dx) - gap + 0.3));
        contacts.set(actor, car);
      }
    }
    actors = this.actors();
    for (const actor of pushes.keys()) if (!actors.includes(actor)) pushes.delete(actor);
    // Propagate a shove through adjacent crates/actors before moving any hull.
    for (let i = 0; i < actors.length; i++) {
      let changed = false;
      for (const [actor, amount] of pushes) {
        const a = hull(actor);
        for (const other of actors) {
          if (actor === other || riders.has(other)) continue;
          const b = hull(other);
          if (
            a.bottom <= b.top + 0.2 ||
            a.top >= b.bottom - 0.2 ||
            (other.position.x - actor.position.x) * this.direction <= 0
          )
            continue;
          const gap = this.direction > 0 ? b.left - a.right : a.left - b.right;
          const needed = amount - gap + 0.3;
          if (needed > (pushes.get(other) ?? 0)) {
            pushes.set(other, needed);
            contacts.set(other, contacts.get(actor)!);
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
    let fraction = 1;
    const moving = new Set(pushes.keys());
    for (const [actor, amount] of pushes) {
      const safe = actor.isStatic
        ? 0
        : this.safeMove(actor, amount * this.direction, moving, actors);
      if (safe < 1) this.impact(contacts.get(actor)!, actor, true);
      if (g.mode !== 'playing') return;
      fraction = Math.min(fraction, safe);
    }
    this.blocked = fraction < 0.99;
    for (const [actor, amount] of pushes)
      if (actors.includes(actor))
        Body.setPosition(actor, {
          x: actor.position.x + amount * this.direction * fraction,
          y: actor.position.y,
        });
    this.riders.clear();
    for (const actor of riders) {
      if (!actors.includes(actor) || actor.isStatic) continue;
      const safe = this.safeMove(actor, dx * fraction, riders, actors);
      Body.setPosition(actor, { x: actor.position.x + dx * fraction * safe, y: actor.position.y });
      this.riders.set(actor, { ...actor.position });
    }
    for (const car of this.cars)
      Body.setPosition(car.body, {
        x: car.body.position.x + dx * fraction,
        y: car.body.position.y,
      });
    if (
      this.cars.every((c) =>
        this.direction > 0 ? hull(c.body).left > 2020 : hull(c.body).right < -20,
      )
    ) {
      for (const body of this.bodies) Composite.remove(g.engine.world, body);
      this.cars = [];
      this.riders.clear();
      this.phase = 'idle';
      this.timer = CROSSING.rest;
      this.direction *= -1;
    }
  }
}
