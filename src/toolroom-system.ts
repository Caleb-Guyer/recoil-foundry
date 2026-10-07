import type { Enemy, Game, Shot } from './game.ts';
import { isBoss } from './enemies.ts';
import { distance, type Vec } from './rules.ts';
import { primaryGunShot } from './spoof.ts';
import { TOOLROOM_IDS, type ToolroomId } from './toolroom-catalog.ts';

export interface ToolroomShot {
  discharge: number;
  origin: Vec;
}
interface Mark {
  until: number;
  last: number;
  bonus: number;
  staggerAt: number;
}
// Evidence and reserves are room-local. One discharge identity spans all rays,
// pellets and rear lanes. Secondary explosions/echoes cannot re-prime reserves.
export class ToolroomSystem {
  game: Game;
  marks = new Map<number, Mark>();
  followUntil = -1;
  cleanReady = false;
  impulseReady = true;
  startReady = true;
  patchSpent = 0;
  scrapSpent = 0;
  scrapReadyAt = -1;
  private lastDischarge = -Infinity;
  private killAt = -Infinity;
  private killCount = 0;
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.marks.clear();
    this.followUntil = this.scrapReadyAt = -1;
    this.cleanReady = false;
    this.impulseReady = this.startReady = true;
    this.patchSpent = this.scrapSpent = 0;
    this.lastDischarge = this.killAt = -Infinity;
    this.killCount = 0;
  }
  has(id: string) {
    return this.game.mods.includes(id);
  }
  get rangeScale() {
    return this.has('guide-vane') ? 1.2 : 1;
  }
  get groundScale() {
    return this.has('ground-anchor') ? 0.6 : 1;
  }
  get heatRate() {
    return this.has('thermal-budget') ? 1.25 : 1;
  }
  get plateTime() {
    return this.has('plate-retainer') ? 6 : 4;
  }
  get bankCap() {
    return this.has('bank-capacitor') ? 0.75 : 0.5;
  }
  land() {
    this.impulseReady = true;
  }
  recoil() {
    if (this.game.grounded || !this.impulseReady || !this.has('impulse-reserve')) return 1;
    this.impulseReady = false;
    return 1.25;
  }
  startHeat(heat: number) {
    if (!this.has('hot-start') || !this.startReady) return heat;
    this.startReady = false;
    return heat > 0 ? heat : 0.25;
  }
  discharge() {
    const g = this.game;
    let bonus = 0;
    if (this.has('opening-shot') && g.time - this.lastDischarge >= 0.9) bonus += 0.2;
    if (this.has('recoil-runner') && Math.hypot(g.player.velocity.x, g.player.velocity.y) >= 8)
      bonus += 0.15;
    if (this.has('follow-mark') && g.time <= this.followUntil) bonus += 0.2;
    if (this.has('clean-cycle') && this.cleanReady) bonus += 0.2;
    this.followUntil = -1;
    this.cleanReady = false;
    this.lastDischarge = g.time;
    return 1 + Math.min(0.4, bonus);
  }
  tag(s: Shot) {
    if (
      !primaryGunShot(s) ||
      s.orbitReleased ||
      !this.game.mods.some((id) => TOOLROOM_IDS.includes(id as ToolroomId))
    )
      return;
    s.toolroom = { discharge: this.game.shotCount, origin: { ...this.game.player.position } };
  }
  private eligible(e: Enemy, s: Shot) {
    return (
      !!s.toolroom &&
      primaryGunShot(s) &&
      !s.orbitReleased &&
      e.spawn <= 0 &&
      !e.allied &&
      e.kind !== 'sentry' &&
      e.eventRole !== 'relay' &&
      e.recoilTarget === undefined
    );
  }
  marked(id: number) {
    return this.has('surveyor') && (this.marks.get(id)?.until ?? -1) > this.game.time;
  }
  damage(e: Enemy, s: Shot, damage: number) {
    if (!(damage > 0) || !this.eligible(e, s)) return damage;
    const g = this.game,
      mark = this.marks.get(e.id),
      discharge = s.toolroom!.discharge;
    let bonus = 0;
    if (this.has('surveyor') && mark && mark.until > g.time) {
      if (mark.last !== discharge) mark.bonus = discharge;
      if (mark.bonus === discharge) bonus += 0.2;
    }
    if (this.has('far-sight') && distance(s.toolroom!.origin, e.body.position) >= 350)
      bonus += 0.15;
    return damage * (1 + bonus);
  }
  gunHit(e: Enemy, previousHp: number, s: Shot, blocked = false) {
    const g = this.game;
    if (g.mode !== 'playing' || previousHp <= 0 || blocked || !this.eligible(e, s)) return;
    const old = this.marks.get(e.id),
      discharge = s.toolroom!.discharge;
    if (e.hp <= 0) {
      if (this.has('follow-mark') && old && old.until > g.time && old.bonus === discharge)
        this.followUntil = g.time + 2;
      if (this.has('clean-cycle')) {
        this.killCount = g.time - this.killAt <= 2 ? this.killCount + 1 : 1;
        this.killAt = g.time;
        if (this.killCount >= 2) {
          this.cleanReady = true;
          this.killCount = 0;
        }
      }
      this.marks.delete(e.id);
      return;
    }
    if (!this.has('surveyor') && !this.has('stagger-coil')) return;
    const mark = old ?? { until: -1, last: -1, bonus: -1, staggerAt: -1 };
    mark.until = g.time + 1.5;
    mark.last = discharge;
    if (
      this.has('stagger-coil') &&
      s.charged &&
      !isBoss(e.kind) &&
      e.state === 'idle' &&
      g.time >= mark.staggerAt
    ) {
      e.timer += 0.25;
      mark.staggerAt = g.time + 2;
    }
    this.marks.set(e.id, mark);
  }
  scrap(s?: Shot) {
    const g = this.game;
    if (
      !this.has('reclamation') ||
      g.mode !== 'playing' ||
      !s ||
      !primaryGunShot(s) ||
      s.orbitReleased ||
      !(s.damage > 0) ||
      g.time < this.scrapReadyAt ||
      this.scrapSpent >= 10
    )
      return;
    const heal = Math.min(2, 10 - this.scrapSpent, 100 - g.hp);
    if (!(heal > 0)) return;
    g.hp += heal;
    this.scrapSpent += heal;
    this.scrapReadyAt = g.time + 4;
    g.burst(g.player.position, 4, '#b8ddc9', 1.2);
  }
  update(dt: number) {
    const g = this.game;
    for (const [id] of this.marks)
      if (!g.enemies.some((e) => e.id === id && e.hp > 0)) this.marks.delete(id);
    if (
      !this.has('field-patch') ||
      !(dt > 0) ||
      g.mode !== 'playing' ||
      g.workshop.active ||
      g.clear ||
      g.escape ||
      g.time - g.hurtAt < 6 ||
      !g.enemies.some((e) => e.spawn <= 0 && e.hp > 0)
    )
      return;
    const heal = Math.max(0, Math.min(dt, 10 - this.patchSpent, 100 - g.hp));
    this.patchSpent += heal;
    g.hp += heal;
  }
}
