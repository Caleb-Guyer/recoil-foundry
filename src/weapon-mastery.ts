import Matter from 'matter-js';
import type { Enemy, Game, Shot } from './game.ts';
import { isBoss } from './enemies.ts';

// Provenance follows actual travel, never the upgrades currently equipped.
export interface WeaponTrace {
  banked?: boolean;
  portaled?: boolean;
}
export function shotTrace(s: Shot): WeaponTrace | undefined {
  return s.friendly && !s.allied && !s.reflected ? s.weaponTrace : undefined;
}
export function markShot(s: Shot, kind: keyof WeaponTrace) {
  if (s.friendly && !s.allied && !s.reflected) s.weaponTrace = { ...s.weaponTrace, [kind]: true };
}

// Room-local evidence. Continue reconstructs the fight, so it also starts fresh.
export class WeaponMastery {
  private damage = new Map<Enemy, { total: number; banked: number }>();
  private defeated = new Set<Enemy>();
  private airborne = 0;
  private deliveries = 0;
  private game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.damage.clear();
    this.defeated.clear();
    this.airborne = this.deliveries = 0;
  }
  private active(e: Enemy) {
    return (
      this.game.commendations.eligible &&
      this.game.enemies.includes(e) &&
      e.spawn <= 0 &&
      !e.allied &&
      !e.workshopTarget &&
      e.kind !== 'sentry' &&
      e.eventRole !== 'relay'
    );
  }
  grounded() {
    const g = this.game,
      p = g.player;
    // Check contact after physics too: the cached movement flag can be a frame old.
    return (
      !!g.counterweights.supporting(p) ||
      (p.velocity.y >= -1 &&
        Matter.Query.ray(
          g.solidBodies,
          { x: p.position.x, y: p.bounds.max.y - 2 },
          { x: p.position.x, y: p.bounds.max.y + 5 },
          18,
        ).length > 0)
    );
  }
  sampleGround() {
    if (this.airborne && this.grounded()) this.airborne = 0;
  }
  hit(e: Enemy, loss: number, trace?: WeaponTrace) {
    if (!this.active(e) || !isBoss(e.kind) || !(loss > 0) || !Number.isFinite(loss)) return;
    const record = this.damage.get(e) ?? { total: 0, banked: 0 };
    record.total += loss;
    if (trace?.banked) record.banked += loss;
    this.damage.set(e, record);
  }
  killed(e: Enemy, trace?: WeaponTrace) {
    if (!this.active(e) || this.defeated.has(e)) return;
    this.defeated.add(e);
    const record = this.damage.get(e);
    if (isBoss(e.kind) && record && record.banked > 0 && record.banked + 1e-7 >= record.total / 2)
      this.game.commendations.award('bank-job');
    this.damage.delete(e);
    if (this.grounded()) this.airborne = 0;
    else if (++this.airborne >= 6) this.game.commendations.award('air-traffic');
    if (trace?.portaled && ++this.deliveries >= 4)
      this.game.commendations.award('special-delivery');
  }
}
