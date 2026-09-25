import type { Enemy, Game, Shot } from './game.ts';
import type { EnemyKind } from './levels.ts';
import { distance, type Vec } from './rules.ts';
import { closestBlastPoint } from './demolition.ts';
import { SPOOF } from './subversion-rules.ts';
export { SPOOF } from './subversion-rules.ts';

export const primaryGunShot = (s: Shot) =>
  s.friendly && !s.allied && !s.fragment && !s.echo && !s.reflected;
// Patrol AI accepts faction targets. Specialized industrial machines resist
// conversion and take feedback instead; never run player-only AI as blue.
export const REBOOT_KINDS: readonly EnemyKind[] = [
  'runner',
  'shooter',
  'flyer',
  'hopper',
  'switchman',
];
interface Feedback {
  enemy: Enemy;
  damage: number;
  at: number;
}
interface Pulse extends Feedback {
  overload: boolean;
}
export class SpoofSystem {
  readyAt = 0;
  reboots = 0;
  pending: { kind: EnemyKind; pos: Vec }[] = [];
  feedback = new Map<number, Feedback>();
  pulses: Pulse[] = [];
  effects: { pos: Vec; outline: Vec[]; at: number }[] = [];
  mark: { enemy: Enemy; until: number } | null = null;
  readonly game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  get equipped() {
    return this.game.mods.includes('spoof');
  }
  get stats() {
    const mods = this.game.mods,
      cross = mods.includes('cross-talk'),
      orders = mods.includes('standing-orders');
    return {
      duration: cross ? SPOOF.crossDuration : orders ? SPOOF.ordersDuration : SPOOF.duration,
      health: cross ? SPOOF.crossHealth : orders ? SPOOF.ordersHealth : SPOOF.health,
      damage: cross ? SPOOF.crossDamage : 1,
      cooldown: cross ? SPOOF.crossCooldown : SPOOF.cooldown,
      limit: cross ? 2 : 1,
      roomLimit: cross ? SPOOF.crossRoomLimit : SPOOF.roomLimit,
      rate: cross ? 0.16 : orders ? 0.18 : 0.12,
      cap: cross ? 32 : orders ? 36 : 24,
      split: cross,
      overload: mods.includes('dead-switch'),
      priority: mods.includes('priority-target'),
    };
  }
  clear() {
    this.readyAt = this.reboots = 0;
    this.pending = [];
    this.feedback.clear();
    this.pulses = [];
    this.effects = [];
    this.mark = null;
    for (const e of [...this.game.factions.allies])
      if (e.rebootUntil !== undefined) this.game.factions.removeAlly(e);
  }
  // Room-clear cleanup must not replenish the room's conversion budget.
  endCombat() {
    this.pending = [];
    this.feedback.clear();
    this.pulses = [];
    this.mark = null;
    for (const e of [...this.game.factions.allies])
      if (e.rebootUntil !== undefined) this.game.factions.removeAlly(e);
  }
  target() {
    const g = this.game,
      mark = this.mark;
    return mark && mark.until > g.time && mark.enemy.hp > 0 && g.enemies.includes(mark.enemy)
      ? mark.enemy
      : null;
  }
  alliedDamage(e: Enemy, damage: number, rebooted: boolean, scale = 1) {
    return damage * scale * (rebooted && this.target() === e ? SPOOF.priorityDamage : 1);
  }
  canReboot(e: Enemy) {
    return (
      REBOOT_KINDS.includes(e.kind) &&
      !e.elite &&
      !e.squad &&
      !e.mutation &&
      !e.splitChild &&
      !e.eventRole &&
      !e.courier &&
      !e.workshopTarget &&
      !e.sentry
    );
  }
  hit(e: Enemy, previousHp: number, primary: boolean) {
    const g = this.game;
    if (
      !primary ||
      !this.equipped ||
      g.mode !== 'playing' ||
      e.allied ||
      e.spawn > 0 ||
      previousHp <= 0 ||
      e.eventRole === 'relay' ||
      e.courier ||
      e.sentry ||
      e.splitChild
    )
      return;
    const damage = Math.max(0, previousHp - Math.max(0, e.hp));
    if (damage <= 0) return;
    const s = this.stats;
    if (s.priority && e.hp > 0) this.mark = { enemy: e, until: g.time + SPOOF.markDuration };
    if (!this.canReboot(e)) {
      if (e.hp <= 0) {
        this.feedback.delete(e.id);
        return;
      }
      if (!this.feedback.has(e.id) && this.feedback.size >= SPOOF.feedbackLimit) return;
      const f = this.feedback.get(e.id) ?? {
        enemy: e,
        damage: 0,
        at: g.time + SPOOF.feedbackDelay,
      };
      const bonus = this.target() === e ? SPOOF.priorityFeedback : 1;
      f.damage = Math.min(s.cap * bonus, f.damage + damage * s.rate * bonus);
      this.feedback.set(e.id, f);
      return;
    }
    const allies = g.factions.allies.filter((a) => a.rebootUntil !== undefined).length;
    if (
      e.hp > 0 ||
      this.reboots >= s.roomLimit ||
      g.time < this.readyAt ||
      allies + this.pending.length >= s.limit ||
      !g.combatEnemyCount
    )
      return;
    // Replace only after death rewards and on-kill effects resolve on the original.
    this.pending.push({ kind: e.kind, pos: { ...e.body.position } });
    this.readyAt = g.time + s.cooldown;
    this.reboots++;
  }
  overload(pos: Vec, damage: number, credited: boolean) {
    const g = this.game;
    if (g.mode !== 'playing' || !this.equipped || !g.combatEnemyCount) return;
    // Capture exposure first. No props, player or blue actors are blast targets.
    const targets = g.enemies
      .filter((e) => e.hp > 0 && e.spawn <= 0 && !e.courier && e.eventRole !== 'relay')
      .flatMap((e) => {
        const p = closestBlastPoint(pos, e.body),
          d = distance(pos, p);
        return d <= SPOOF.overloadRadius && distance(g.lineEnd(pos, p), p) < 0.1
          ? [{ e, amount: 1 - (0.5 * d) / SPOOF.overloadRadius }]
          : [];
      });
    for (const { e, amount } of targets) {
      if (g.mode !== 'playing') break;
      // No primary hook, upgrade procs or conversion recursion from an overload.
      g.hitEnemy(e, damage * amount, pos, true, false, credited);
    }
    const outline = Array.from({ length: 32 }, (_, i) => {
      const a = (i / 32) * Math.PI * 2;
      return g.lineEnd(pos, {
        x: pos.x + Math.cos(a) * SPOOF.overloadRadius,
        y: pos.y + Math.sin(a) * SPOOF.overloadRadius,
      });
    });
    this.effects.push({ pos: { ...pos }, outline, at: g.time });
    if (this.effects.length > 12) this.effects.shift();
    g.burst(pos, 10, '#79bdff', 3);
    g.onSound('aftershock');
  }
  expired(e: Enemy) {
    if (e.rebootUntil !== undefined && this.stats.overload && this.game.mode === 'playing')
      this.overload(e.body.position, SPOOF.overloadDamage, false);
  }
  update() {
    const g = this.game;
    if (!this.equipped || g.mode !== 'playing') return;
    this.effects = this.effects.filter((f) => g.time - f.at < 0.32);
    if (!this.target()) this.mark = null;
    if (!g.combatEnemyCount && !g.waves.pending) {
      this.endCombat();
      return;
    }
    const s = this.stats;
    for (const { kind, pos } of this.pending.splice(0)) {
      const ally = g.factions.spawn(kind, pos);
      if (!ally) continue;
      ally.hp = ally.maxHp = Math.ceil(ally.maxHp * s.health);
      ally.spawn = 0.25;
      ally.timer = 0.7;
      ally.rebootDuration = s.duration;
      ally.rebootDamage = s.damage;
      ally.rebootUntil = g.time + s.duration + ally.spawn;
      g.burst(pos, 16, '#6bb7ff', 2.8);
      g.onSound('upgrade');
    }
    for (const [id, f] of this.feedback) {
      if (!g.enemies.includes(f.enemy) || f.enemy.hp <= 0) this.feedback.delete(id);
      else if (g.time >= f.at) {
        this.feedback.delete(id);
        this.pulses.push({
          ...f,
          damage: f.damage / (s.split ? 2 : 1),
          at: g.time,
          overload: false,
        });
        if (s.split && this.pulses.length < SPOOF.pulseLimit)
          this.pulses.push({
            ...f,
            damage: f.damage / 2,
            at: g.time + SPOOF.secondDelay,
            overload: s.overload,
          });
      }
    }
    // Old delayed second pulses can coexist with the next accumulation window.
    this.pulses = this.pulses.slice(0, SPOOF.pulseLimit);
    const due = this.pulses.filter((p) => p.at <= g.time);
    this.pulses = this.pulses.filter(
      (p) => p.at > g.time && p.enemy.hp > 0 && g.enemies.includes(p.enemy),
    );
    for (const p of due) {
      if (g.mode !== 'playing' || !g.enemies.includes(p.enemy) || p.enemy.hp <= 0) continue;
      const pos = { ...p.enemy.body.position };
      g.hitEnemy(p.enemy, p.damage, g.player.position, true, false);
      g.burst(pos, 5, '#6bb7ff', 2);
      if (p.overload) this.overload(pos, p.damage * SPOOF.feedbackOverload, true);
    }
  }
}
