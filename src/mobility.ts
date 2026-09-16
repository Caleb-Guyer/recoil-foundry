import Matter from 'matter-js';
import type { Game, Input } from './game.ts';
import { firstSolid } from './collisions.ts';
import { clamp, distance, type Vec } from './rules.ts';

export const MOBILITY = { grip: 0.32, shotWindow: 0.24, brake: 0.25, launch: 1.35 };
export class MobilitySystem {
  game: Game;
  grip: { body: Matter.Body; normal: Vec; until: number } | null = null;
  lastWall: number | null = null;
  brakeUsed = false;
  launchReady = false;
  flash = 0;
  private held = false;
  private recoil: { at: number; direction: Vec } | null = null;
  private previous: Vec | null = null;
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.grip = null;
    this.lastWall = null;
    this.brakeUsed = this.launchReady = this.held = false;
    this.recoil = null;
    this.previous = null;
    this.flash = 0;
  }
  pause() {
    this.held = false;
  }
  shot(d: Vec) {
    const g = this.game;
    this.thrust(d);
    const boost = this.launchReady && !g.grounded ? MOBILITY.launch : 1;
    this.launchReady = false;
    return boost;
  }
  thrust(d: Vec) {
    this.grip = null;
    this.recoil = { at: this.game.time, direction: { x: -d.x, y: -d.y } };
  }
  update(input: Input) {
    const g = this.game,
      p = g.player;
    this.flash = Math.max(0, this.flash - 1 / 60);
    // A teleport cannot carry a grip across the room or manufacture a new jump.
    if (this.previous && distance(this.previous, p.position) > 90) {
      this.grip = null;
      this.recoil = null;
    }
    this.previous = { ...p.position };
    if (g.grounded) {
      this.brakeUsed = false;
      this.launchReady = false;
      this.recoil = null;
      const floor = firstSolid(
        p.position,
        { x: p.position.x, y: p.position.y + 28 },
        { x: 10, y: 16 },
        g.solidBodies,
      );
      if (floor && floor.body.id !== this.lastWall) this.lastWall = null;
      this.grip = null;
    }
    if (
      g.mods.includes('air-brake') &&
      this.held &&
      !input.fire &&
      !g.grounded &&
      !this.brakeUsed &&
      this.recoil &&
      g.lastShot >= g.jumpAt &&
      Math.hypot(p.velocity.x, p.velocity.y) >= 4
    ) {
      Matter.Body.setVelocity(p, {
        x: p.velocity.x * MOBILITY.brake,
        y: p.velocity.y * MOBILITY.brake,
      });
      this.brakeUsed = true;
      this.launchReady = true;
      this.flash = 0.18;
      g.burst(p.position, 5, '#b8ddc9', 1.5);
    }
    this.held = input.fire;
    if (!g.mods.includes('wallrunner') || g.grounded) return;
    const side = [-1, 1]
      .map((x) =>
        firstSolid(
          p.position,
          { x: p.position.x + x * 6, y: p.position.y },
          { x: 12, y: 14 },
          g.terrainBodies,
        ),
      )
      .find((hit) => hit && Math.abs(hit.normal.x) > 0.85);
    if (side && side.body.id !== this.lastWall && this.lastWall !== null) this.lastWall = null;
    if (
      this.grip &&
      (this.grip.until <= g.time ||
        !side ||
        side.body !== this.grip.body ||
        !g.terrainBodies.includes(this.grip.body))
    )
      this.grip = null;
    if (
      !this.grip &&
      side &&
      side.body.id !== this.lastWall &&
      this.recoil &&
      g.time - this.recoil.at <= MOBILITY.shotWindow &&
      this.recoil.direction.x * side.normal.x < -0.25
    ) {
      this.grip = { body: side.body, normal: side.normal, until: g.time + MOBILITY.grip };
      this.lastWall = side.body.id;
      g.burst(p.position, 4, '#b8ddc9', 1);
    }
    if (!this.grip) return;
    if (g.jumpBuffer > 0) {
      Matter.Body.setVelocity(p, {
        x: this.grip.normal.x * 11 + clamp(this.grip.body.velocity.x, -3, 3),
        y: -11.6,
      });
      this.grip = null;
      this.recoil = null;
      g.jumpBuffer = 0;
      g.jumpAt = g.time;
      g.jumpCut = false;
      // A wall jump is a real jump; repeated taps on the same wall cannot reset it.
      this.brakeUsed = false;
      this.launchReady = false;
      g.onSound('jump');
    } else
      Matter.Body.setVelocity(p, {
        x: this.grip.body.velocity.x,
        y: this.grip.body.velocity.y - 0.3,
      });
  }
}
