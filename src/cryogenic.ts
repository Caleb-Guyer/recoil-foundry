import Matter from 'matter-js';
import type { Game, Enemy, Shot } from './game.ts';
import { clamp, direction, distance } from './rules.ts';
import { isBoss } from './enemies.ts';
import { breakSquad } from './squads.ts';
import { releaseScrapper } from './scrapper.ts';

export const COLD = {
  threshold: 48,
  freeze: 0.55,
  immunity: 1.6,
  recharge: 0.7,
  decay: 18,
  radius: 150,
  bonusCap: 48,
};
export interface ColdState {
  cold: number;
  touched: number;
  frozen: number;
  immune: number;
  ready: boolean;
}
export class CryogenicSystem {
  game: Game;
  states = new Map<number, ColdState>();
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.states.clear();
  }
  eligible(s: Shot) {
    return (
      this.game.mods.includes('coolant-rounds') &&
      s.friendly &&
      !s.fragment &&
      !s.reflected &&
      !s.echo
    );
  }
  blocked(e: Enemy, s: Shot) {
    return e.elite === 'shielded' && direction(s.vel, { x: 0, y: 0 }).x * e.facing > 0.45;
  }
  state(e: Enemy) {
    let state = this.states.get(e.id);
    if (!state) {
      state = { cold: 0, touched: this.game.time, frozen: 0, immune: 0, ready: false };
      this.states.set(e.id, state);
    }
    return state;
  }
  update(dt: number) {
    for (const [id, state] of this.states) {
      if (!this.game.enemies.some((e) => e.id === id && e.hp > 0)) {
        this.states.delete(id);
        continue;
      }
      if (this.game.time - state.touched > 0.8)
        state.cold = Math.max(0, state.cold - COLD.decay * dt);
      if (this.game.time - state.touched > 3) state.ready = false;
    }
  }
  slow(e: Enemy) {
    if (isBoss(e.kind)) return 1;
    const state = this.states.get(e.id);
    return state ? 1 - 0.35 * clamp(state.cold / COLD.threshold, 0, 1) : 1;
  }
  frozen(e: Enemy) {
    if (isBoss(e.kind) || (this.states.get(e.id)?.frozen ?? 0) <= this.game.time) return false;
    // Keep gravity, machinery and collisions live. Freezing never makes a body static.
    Matter.Body.setVelocity(e.body, { x: 0, y: Math.max(0, e.body.velocity.y) });
    return true;
  }
  damage(e: Enemy, s: Shot, damage: number) {
    if (!this.eligible(s) || this.blocked(e, s)) return damage;
    const state = this.state(e),
      g = this.game;
    if (isBoss(e.kind)) {
      if (!state.ready) return damage;
      state.ready = false;
      state.immune = g.time + COLD.recharge;
      const bonus = g.mods.includes('icebreaker')
        ? 1.2
        : g.mods.includes('cold-snap')
          ? 0.9
          : g.mods.includes('deep-freeze')
            ? 0.85
            : 0.6;
      this.burst(e);
      return damage + Math.min(COLD.bonusCap, damage * bonus);
    }
    if (state.frozen > g.time && g.mods.includes('icebreaker')) {
      state.frozen = 0;
      this.burst(e);
      const a = Math.atan2(s.vel.y, s.vel.x);
      for (let i = -1; i <= 1; i++) {
        const angle = a + i * 0.65;
        const fragment = g.addShot({
          pos: { ...s.pos },
          vel: { x: Math.cos(angle) * 18, y: Math.sin(angle) * 18 },
          damage: Math.min(8, damage * 0.16),
          life: 0.35,
          friendly: true,
          radius: 2,
          bounces: 0,
          pierce: 0,
          fragment: true,
          split: true,
        });
        fragment?.hits.add(e.id);
      }
      return damage + Math.min(COLD.bonusCap, damage * 1.2);
    }
    if (
      g.mods.includes('cold-snap') &&
      state.immune <= g.time &&
      state.cold + Math.min(24, damage) >= COLD.threshold
    ) {
      state.cold = 0;
      state.immune = g.time + COLD.recharge;
      this.burst(e);
      return damage + Math.min(COLD.bonusCap, damage * 0.9);
    }
    return damage;
  }
  hit(e: Enemy, s: Shot) {
    if (!this.eligible(s) || e.hp <= 0 || this.blocked(e, s)) return;
    const state = this.state(e),
      g = this.game;
    if (state.immune > g.time || state.ready) return;
    state.touched = g.time;
    state.cold = Math.min(COLD.threshold, state.cold + Math.min(24, s.damage));
    if (state.cold < COLD.threshold) return;
    if (isBoss(e.kind)) {
      state.ready = true;
      state.cold = 0;
    } else if (g.mods.includes('deep-freeze')) {
      state.cold = 0;
      state.frozen = g.time + COLD.freeze;
      state.immune = state.frozen + COLD.immunity;
      breakSquad(g, e);
      releaseScrapper(g, e);
      g.burst(e.body.position, 5, '#a3e6ec', 1.5);
    }
  }
  private burst(e: Enemy) {
    const g = this.game;
    g.burst(e.body.position, 7, '#a3e6ec', 3);
    if (!g.mods.includes('cold-front')) return;
    for (const other of g.enemies) {
      if (
        other === e ||
        other.hp <= 0 ||
        other.spawn > 0 ||
        distance(e.body.position, other.body.position) > COLD.radius
      )
        continue;
      if (distance(g.lineEnd(e.body.position, other.body.position), other.body.position) > 1)
        continue;
      const state = this.state(other);
      if (state.immune > g.time || state.ready) continue;
      // Spreading cannot itself trigger damage, another spread, or a freeze.
      state.cold = Math.min(COLD.threshold - 1, state.cold + 24);
      state.touched = g.time;
    }
  }
}
