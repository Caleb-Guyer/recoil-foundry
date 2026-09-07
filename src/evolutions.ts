import Matter from 'matter-js';
import type { Game, Shot } from './game.ts';
import { clamp } from './rules.ts';

export const REDLINE_MAX = 0.5;
export const REDLINE_SPEED = 18;
export const DEADLOCK_STEP = 0.12;
export const DEADLOCK_CAP = 5;
export const SLINGSHOT_DAMAGE = 1.5;
export const SLINGSHOT_SPEED = 1.25;

// Temporary combat state belongs to the room, never the saved build.
export class EvolutionSystem {
  game: Game;
  slingReady = false;
  streak = 0;
  private discharges: { id: number; hit: boolean }[] = [];
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.slingReady = false;
    this.streak = 0;
    this.discharges = [];
  }
  get redline() {
    const v = this.game.player.velocity;
    return this.game.gun.redline
      ? REDLINE_MAX * clamp(Math.hypot(v.x, v.y) / REDLINE_SPEED, 0, 1)
      : 0;
  }
  travel() {
    if (!this.game.mods.includes('slingshot') || this.slingReady) return;
    this.slingReady = true;
    const v = this.game.player.velocity;
    Matter.Body.setVelocity(this.game.player, {
      x: clamp(v.x * SLINGSHOT_SPEED, -23, 23),
      y: clamp(v.y * SLINGSHOT_SPEED, -21, 20),
    });
  }
  discharge(id: number) {
    const damage =
      (1 + this.redline) *
      (this.slingReady ? SLINGSHOT_DAMAGE : 1) *
      (this.game.gun.deadlock ? 1 + this.streak * DEADLOCK_STEP : 1);
    this.slingReady = false;
    if (this.game.gun.deadlock) this.discharges.push({ id, hit: false });
    return damage;
  }
  hit(shot: Shot) {
    const discharge = this.discharges.find((d) => d.id === shot.discharge);
    if (discharge) discharge.hit = true;
  }
  settle() {
    if (!this.discharges.length) return;
    const live = new Set(this.game.shots.filter((s) => s.life > 0).map((s) => s.discharge));
    // Resolve in firing order: a slow banked round must not reset a newer hit
    // out of order. One pellet or piercing hit qualifies the entire discharge.
    while (this.discharges.length) {
      const first = this.discharges[0];
      if (!first.hit && live.has(first.id)) break;
      this.streak = first.hit ? Math.min(DEADLOCK_CAP, this.streak + 1) : 0;
      this.discharges.shift();
    }
  }
}
