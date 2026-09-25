import type { Enemy, Game, Shot } from './game.ts';
import type { EnemyKind } from './levels.ts';
import { isBoss } from './enemies.ts';
import type { Vec } from './rules.ts';

// Prototype equipment: not in the released reward pool or player save schema.
export const SPOOF = { name: 'Spoof', path: 'Subversion', duration: 4, cooldown: 8, roomLimit: 4 };
export const primaryGunShot = (s: Shot) =>
  s.friendly && !s.allied && !s.fragment && !s.echo && !s.reflected;
const eligible = new Set<EnemyKind>(['runner', 'shooter', 'flyer', 'switchman']);
export class SpoofSystem {
  readyAt = 0;
  reboots = 0;
  pending: { kind: EnemyKind; pos: Vec } | null = null;
  feedback = new Map<number, { enemy: Enemy; damage: number; at: number }>();
  readonly game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  get equipped() {
    return this.game.annex.active && !!this.game.testRun?.annex?.spoof;
  }
  clear() {
    this.readyAt = this.reboots = 0;
    this.pending = null;
    this.feedback.clear();
    for (const e of [...this.game.factions.allies])
      if (e.rebootUntil !== undefined) this.game.factions.removeAlly(e);
  }
  hit(e: Enemy, previousHp: number, primary: boolean) {
    const g = this.game;
    if (
      !primary ||
      !this.equipped ||
      g.mode !== 'playing' ||
      e.allied ||
      e.spawn > 0 ||
      previousHp <= 0
    )
      return;
    const damage = Math.max(0, previousHp - Math.max(0, e.hp));
    if (damage <= 0) return;
    if (isBoss(e.kind)) {
      if (e.hp <= 0) {
        this.feedback.delete(e.id);
        return;
      }
      const f = this.feedback.get(e.id) ?? { enemy: e, damage: 0, at: g.time + 0.6 };
      f.damage = Math.min(24, f.damage + damage * 0.12);
      this.feedback.set(e.id, f);
      return;
    }
    if (
      e.hp > 0 ||
      !eligible.has(e.kind) ||
      e.elite ||
      e.squad ||
      e.mutation ||
      e.splitChild ||
      e.eventRole ||
      e.courier ||
      e.workshopTarget ||
      e.sentry ||
      this.pending ||
      this.reboots >= SPOOF.roomLimit ||
      g.time < this.readyAt ||
      g.factions.allies.some((a) => a.rebootUntil !== undefined) ||
      !g.enemies.length
    )
      return;
    // Defer the replacement until the death pipeline has finished. Death bloom,
    // credit and healing still see the defeated original, never its reboot.
    this.pending = { kind: e.kind, pos: { ...e.body.position } };
    this.readyAt = g.time + SPOOF.cooldown;
    this.reboots++;
  }
  update() {
    const g = this.game;
    if (!this.equipped || g.mode !== 'playing') return;
    if (!g.combatEnemyCount && !g.waves.pending) {
      this.clear();
      return;
    }
    if (this.pending) {
      const { kind, pos } = this.pending;
      this.pending = null;
      const ally = g.factions.spawn(kind, pos);
      if (ally) {
        ally.hp = ally.maxHp = Math.ceil(ally.maxHp * 0.65);
        ally.spawn = 0.25;
        ally.timer = 0.7;
        ally.rebootUntil = g.time + SPOOF.duration + ally.spawn;
        g.burst(pos, 16, '#6bb7ff', 2.8);
        g.onSound('upgrade');
      }
    }
    for (const [id, f] of this.feedback) {
      if (!g.enemies.includes(f.enemy) || f.enemy.hp <= 0) this.feedback.delete(id);
      else if (g.time >= f.at) {
        this.feedback.delete(id);
        g.hitEnemy(f.enemy, f.damage, g.player.position, true, false);
        g.burst(f.enemy.body.position, 5, '#6bb7ff', 2);
      }
    }
  }
}
