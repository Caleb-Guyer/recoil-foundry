import Matter from 'matter-js';
import type { Game } from './game.ts';
import { conveyorPlacements, type Conveyor } from './conveyor-layout.ts';
import { hazardBounds } from './hazard-layouts.ts';
import { clamp } from './rules.ts';

const { Body } = Matter;
const hull = (b: Matter.Body) => ({
  left: Math.min(...b.vertices.map((v) => v.x)),
  right: Math.max(...b.vertices.map((v) => v.x)),
  top: Math.min(...b.vertices.map((v) => v.y)),
  bottom: Math.max(...b.vertices.map((v) => v.y)),
});
interface Ride {
  belt: Conveyor;
  carry: number;
  relative: number;
  friction: number;
}

export class ConveyorSystem {
  game: Game;
  items: Conveyor[] = [];
  private rides = new Map<Matter.Body, Ride>();
  private pending = new Map<Matter.Body, Ride>();
  private released = new Set<Matter.Body>();
  constructor(game: Game) {
    this.game = game;
  }
  clear() {
    this.items = [];
    this.rides.clear();
    this.pending.clear();
    this.released.clear();
  }
  reset() {
    this.clear();
    const g = this.game;
    if (g.escape) return;
    this.items = conveyorPlacements(
      g.level,
      g.roomSeed,
      g.stage,
      g.hazards.items.map((h) => hazardBounds(h.placement, 44)),
      g.props.items
        .filter((p) => p.body.isStatic)
        .map((p) => {
          const b = hull(p.body);
          return { x: b.left, y: b.top, w: b.right - b.left, h: b.bottom - b.top };
        }),
    );
  }
  private actors() {
    const g = this.game;
    return [
      g.player,
      ...g.enemies.filter((e) => e.spawn <= 0 && e.hp > 0).map((e) => e.body),
      ...g.props.bodies,
    ];
  }
  private supports() {
    const actors = this.actors();
    const supported = new Map<Matter.Body, Conveyor>();
    for (const b of actors) {
      if (b.velocity.y < -0.1) continue;
      const box = hull(b);
      const belt = this.items.find(
        (c) =>
          Math.abs(box.bottom - c.y) < 3 &&
          Math.min(box.right, c.x + c.w) - Math.max(box.left, c.x) >
            Math.min(12, (box.right - box.left) * 0.4),
      );
      if (belt) supported.set(b, belt);
    }
    // Move supported stacks together; static cover never transmits belt motion.
    for (const [base, belt] of supported) {
      if (base.isStatic) continue;
      for (const b of actors)
        if (!b.isStatic && !supported.has(b) && this.game.hazards.supported(b, base))
          supported.set(b, belt);
    }
    return supported;
  }
  beginStep() {
    if (!this.items.length) return;
    this.pending.clear();
    const supported = this.supports();
    for (const [b, belt] of supported) {
      if (b.isStatic) {
        const enemy = this.game.enemies.find((e) => e.body === b);
        if (!enemy || (enemy.kind !== 'shooter' && enemy.kind !== 'sniper')) continue;
        Body.setStatic(b, false);
        this.released.add(b);
      }
      const previous = this.rides.get(b);
      const carry = previous?.belt === belt ? previous.carry : 0;
      Body.setVelocity(b, { x: b.velocity.x - carry, y: b.velocity.y });
      this.pending.set(b, {
        belt,
        carry: carry + (belt.speed - carry) * 0.35,
        relative: 0,
        friction: b.friction,
      });
    }
    // Dislodged gun emplacements brake on landing, but remain physical bodies.
    for (const b of this.released) {
      if (!this.game.enemies.some((e) => e.body === b)) {
        this.released.delete(b);
        continue;
      }
      if (this.game.solidBodies.some((s) => s !== b && this.game.hazards.supported(b, s)))
        Body.setVelocity(b, { x: b.velocity.x * 0.72, y: b.velocity.y });
    }
    this.rides.clear();
  }
  beforeStep() {
    for (const [b, ride] of this.pending) {
      // Include this frame's jump/recoil: leaving a belt retains its momentum.
      ride.relative = b.velocity.x;
      // The drive supplies traction. Ordinary static-floor friction would
      // fight that motion and tip upright cargo, so suspend it for this step.
      b.friction = 0;
      Body.setVelocity(b, { x: clamp(b.velocity.x + ride.carry, -23, 23), y: b.velocity.y });
    }
  }
  afterStep() {
    if (!this.pending.size) return;
    const supported = this.supports();
    for (const [b, ride] of this.pending) {
      b.friction = ride.friction;
      if (supported.get(b) !== ride.belt) continue;
      // Only subtract motion that survived collision resolution next frame.
      // A wall can stop a carried body without creating a reverse impulse.
      const carry = clamp(
        b.velocity.x - ride.relative,
        Math.min(0, ride.carry),
        Math.max(0, ride.carry),
      );
      this.rides.set(b, { ...ride, carry });
    }
    this.pending.clear();
  }
}
