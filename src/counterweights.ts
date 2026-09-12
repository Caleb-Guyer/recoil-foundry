import Matter from 'matter-js';
import type { Game } from './game.ts';
import { COUNTERWEIGHT as CW, type CounterweightPlacement } from './counterweight-layouts.ts';
import { clamp, type Vec } from './rules.ts';
const { Bodies, Body, Constraint, Composite } = Matter;
export interface Counterweight {
  body: Matter.Body;
  joint: Matter.Constraint;
  placement: CounterweightPlacement;
  soundAt: number;
}
export class CounterweightSystem {
  items: Counterweight[] = [];
  game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  get bodies() {
    return this.items.map((p) => p.body);
  }
  owns(body: Matter.Body) {
    return this.items.some((p) => p.body === body);
  }
  clear() {
    for (const p of this.items) {
      Composite.remove(this.game.engine.world, p.joint);
      Composite.remove(this.game.engine.world, p.body);
    }
    this.items = [];
  }
  reset() {
    this.clear();
    for (const p of this.game.level.counterweights ?? []) this.spawn(p);
  }
  spawn(placement: CounterweightPlacement) {
    const { x, y, w } = placement;
    const body = Bodies.rectangle(x, y, w, CW.h, {
      friction: 0.65,
      frictionStatic: 0.8,
      frictionAir: 0.045,
      restitution: 0,
      label: 'counterweight',
    });
    Body.setMass(body, CW.mass);
    const joint = Constraint.create({
      pointA: { x, y },
      bodyB: body,
      pointB: { x: 0, y: 0 },
      length: 0,
      stiffness: 1,
      damping: 0.1,
    });
    const item = { body, joint, placement: { ...placement }, soundAt: -100 };
    this.items.push(item);
    Composite.add(this.game.engine.world, [body, joint]);
    return item;
  }
  // Only these reserved moving perches release static gunners and cover. Once
  // released, their normal physical bodies can land, slide and fall off the deck.
  movingPerch(body: Matter.Body) {
    return this.items.some(
      ({ placement: p }) =>
        Math.abs(body.position.x - p.x) < p.w / 2 + 16 &&
        Math.abs(body.bounds.max.y - (p.y - CW.h / 2)) < (p.w / 2) * Math.sin(CW.angle) + 8,
    );
  }
  supporting(body: Matter.Body) {
    for (const p of this.items) {
      const b = p.body,
        c = Math.cos(b.angle),
        s = Math.sin(b.angle);
      const local = body.vertices.map((v) => ({
        x: (v.x - b.position.x) * c + (v.y - b.position.y) * s,
        y: -(v.x - b.position.x) * s + (v.y - b.position.y) * c,
      }));
      const foot = local.reduce((a, v) => (v.y > a.y ? v : a));
      const dx = body.position.x - b.position.x;
      if (
        Math.abs(foot.y + CW.h / 2) > 5 ||
        Math.abs(foot.x) > p.placement.w / 2 + 5 ||
        body.position.y > b.position.y + Math.sin(b.angle) * dx
      )
        continue;
      const velocity = {
        x: b.velocity.x - b.angularVelocity * (body.position.y - b.position.y),
        y: b.velocity.y + b.angularVelocity * dx,
      };
      if (body.velocity.y < velocity.y - 1.2) continue;
      return { item: p, velocity };
    }
  }
  beforeStep() {
    if (!this.items.length) return;
    const g = this.game;
    for (const actor of [...g.enemies.map((e) => e.body), ...g.props.bodies])
      if (actor.isStatic && this.movingPerch(actor)) Body.setStatic(actor, false);
    for (const { body } of this.items) {
      if (body.isStatic) continue;
      // A damped bearing gently recenters an empty beam. Weight and collision
      // impulses remain Matter's job; no actor is repositioned or given a fake launch.
      body.torque -= body.angle * body.inertia * 0.000002;
      Body.setAngularVelocity(body, clamp(body.angularVelocity, -CW.speed, CW.speed));
    }
  }
  afterIntegrate() {
    for (const p of this.items) {
      const b = p.body;
      if (Math.abs(b.angle) > CW.angle) {
        const angle = clamp(b.angle, -CW.angle, CW.angle),
          speed = b.angularVelocity;
        Body.setAngle(b, angle);
        if (speed * angle > 0) Body.setAngularVelocity(b, 0);
        if (Math.abs(speed) > 0.006 && this.game.time - p.soundAt > 0.8) {
          p.soundAt = this.game.time;
          this.game.onSound('counterweight-stop');
        }
      }
    }
  }
  afterStep() {
    // Contacts can add angular velocity after integration; bound the next sweep.
    for (const { body } of this.items)
      Body.setAngularVelocity(body, clamp(body.angularVelocity, -CW.speed, CW.speed));
  }
  hit(body: Matter.Body | undefined, point: Vec, velocity: Vec, damage: number) {
    if (!body || !this.owns(body)) return;
    const scale = 0.000012 * clamp(damage / 24, 0, 2);
    Body.applyForce(body, point, { x: velocity.x * scale, y: velocity.y * scale });
  }
}
