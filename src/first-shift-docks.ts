import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { BossRemasterCue } from './boss-remaster-cues.ts';
import { updateLoader } from './area-boss-ai.ts';
import { updateCrane, CRANE_HEAD, CRANE_LOCK } from './crane-ai.ts';
import { firstSolid } from './collisions.ts';
import { bossMuzzle, bossPhase, flakAngles } from './enemies.ts';
import { clamp, direction } from './rules.ts';

export const FIRST_SHIFT_DOCKS = {
  ramTell: 1.15,
  hookTell: 1.25,
  flakTell: 1.1,
  loaderLock: 0.55,
  flakLock: 0.5,
  transition: 1.15,
  linkedOpening: 0.5,
  loaderRecovery: 1.65,
  craneRecovery: 1.8,
} as const;

type DocksState = Enemy['state'];
/** New encounter sequencing around the existing physical hull/path drivers. */
abstract class FirstShiftDocks {
  readonly game: Game;
  readonly enemy: Enemy;
  private phaseValue: number;
  private stateValue: DocksState = 'idle';
  private timeLeft = 0.4;
  private timeTotal = 0.4;
  private stopped = false;
  private chainActive = false;
  private chainLeft = 0;
  private chainIndex = 0;
  private terminal: readonly BossRemasterCue[] = [];
  protected abstract readonly kind: 'loader' | 'crane';
  protected abstract drive(): void;
  constructor(game: Game, enemy: Enemy) {
    this.game = game;
    this.enemy = enemy;
    this.phaseValue = bossPhase(enemy.hp, enemy.maxHp, !!game.overtime);
    this.sync();
  }
  get phase() {
    return this.phaseValue;
  }
  get state() {
    return this.stateValue;
  }
  get remaining() {
    return Math.max(0, this.timeLeft);
  }
  get duration() {
    return this.timeTotal;
  }
  get cancelled() {
    return this.stopped;
  }
  get move() {
    if (this.phaseValue === 2)
      return this.kind === 'loader' ? 'freight-combination' : 'hook-cascade';
    if (this.phaseValue === 1) return this.kind === 'loader' ? 'return-ram' : 'crosscut';
    return this.enemy.attack === 'flak'
      ? 'salvo'
      : this.kind === 'loader'
        ? 'ram'
        : this.enemy.attack;
  }
  get cues(): readonly BossRemasterCue[] {
    if (this.stopped || this.enemy.hp <= 0 || !this.game.enemies.includes(this.enemy)) return [];
    if (this.terminal.length) return this.terminal;
    if (this.stateValue !== 'windup' && this.stateValue !== 'rush') return [];
    const e = this.enemy,
      g = this.game;
    const active = this.stateValue === 'rush';
    const progress = active ? 1 : clamp(1 - this.timeLeft / Math.max(this.timeTotal, 0.001), 0, 1);
    if (e.attack === 'flak') {
      const from = bossMuzzle(e);
      return this.angles().map((angle) => ({
        kind: 'segment' as const,
        from,
        to: g.lineEnd(
          from,
          { x: from.x + Math.cos(angle) * 2400, y: from.y + Math.sin(angle) * 2400 },
          5,
        ),
        width: 10,
        progress,
        active: false,
        locked: this.timeLeft <= FIRST_SHIFT_DOCKS.flakLock,
      }));
    }
    if (this.kind === 'crane' && e.crane) {
      const obstruction = firstSolid(
        e.crane.from,
        e.crane.to,
        { x: CRANE_HEAD.w / 2, y: CRANE_HEAD.h / 2 },
        g.solidBodies,
      );
      const endpoint = obstruction
        ? {
            x: e.crane.from.x + (e.crane.to.x - e.crane.from.x) * obstruction.t,
            y: e.crane.from.y + (e.crane.to.y - e.crane.from.y) * obstruction.t,
          }
        : e.crane.to;
      return [
        {
          kind: 'hull',
          from: { ...e.crane.from },
          to: { ...endpoint },
          halfWidth: CRANE_HEAD.w / 2,
          halfHeight: CRANE_HEAD.h / 2,
          progress,
          active,
          locked: active || this.timeLeft <= CRANE_LOCK,
        },
      ];
    }
    const from = { ...e.body.position };
    const to = { x: from.x + e.aim.x * 15 * (active ? this.remaining : 1.3) * 60, y: from.y };
    // The native ram probes one pixel above the tread so resting floor contact
    // cannot masquerade as a frontal obstacle. The drawn hull retains all68px.
    const contact = firstSolid(from, to, { x: 56, y: 33 }, g.solidBodies);
    const end = contact ? { x: from.x + (to.x - from.x) * contact.t, y: from.y } : to;
    return [
      {
        kind: 'hull',
        from,
        to: end,
        halfWidth: 56,
        halfHeight: 34,
        progress,
        active,
        locked: active || this.timeLeft <= FIRST_SHIFT_DOCKS.loaderLock,
      },
    ];
  }
  cancel() {
    this.stopped = true;
    this.chainActive = false;
    this.chainLeft = 0;
    this.terminal = [];
  }
  private sync() {
    this.enemy.phase = this.phaseValue;
    this.enemy.state = this.stateValue;
    this.enemy.timer = this.timeLeft;
  }
  private setState(state: DocksState, duration: number) {
    this.stateValue = state;
    this.timeLeft = this.timeTotal = duration;
    this.sync();
  }
  private angles() {
    return flakAngles(Math.atan2(this.enemy.aim.y, this.enemy.aim.x), this.phaseValue >= 1);
  }
  private beginFlak() {
    const e = this.enemy;
    e.attack = 'flak';
    if (e.crane) e.crane.hit = false;
    e.aim = direction(bossMuzzle(e), this.game.player.position);
    this.setState('windup', FIRST_SHIFT_DOCKS.flakTell);
    this.game.soundAt('lock', e.body.position, `enemy:${e.id}`);
  }
  private beginAttack() {
    if (!this.chainActive) {
      this.chainActive = true;
      this.chainLeft = this.phaseValue;
      this.chainIndex = 0;
    }
    // Charging off a high shelf would leave the marked ground-height corridor.
    // The ordinary anti-air cannon handles those physical standing positions.
    if (
      this.kind === 'loader' &&
      this.enemy.attack !== 'flak' &&
      this.enemy.body.position.y + 34 < 730
    ) {
      this.beginFlak();
      return;
    }
    this.setState(
      'windup',
      this.enemy.attack === 'flak'
        ? FIRST_SHIFT_DOCKS.flakTell
        : this.kind === 'loader'
          ? FIRST_SHIFT_DOCKS.ramTell
          : FIRST_SHIFT_DOCKS.hookTell,
    );
  }
  private finishAttack() {
    if (this.kind === 'loader') this.enemy.attacks++;
    if (this.chainLeft > 0) {
      this.chainLeft--;
      this.chainIndex++;
      this.setState('recover', FIRST_SHIFT_DOCKS.linkedOpening);
    } else {
      this.chainActive = false;
      this.setState(
        'recover',
        this.kind === 'loader' ? FIRST_SHIFT_DOCKS.loaderRecovery : FIRST_SHIFT_DOCKS.craneRecovery,
      );
    }
  }
  update(dt: number) {
    const g = this.game,
      e = this.enemy;
    if (this.stopped) return;
    if (e.hp <= 0 || !g.enemies.includes(e)) {
      this.cancel();
      return;
    }
    if (g.mode !== 'playing' || g.hitStop > 0 || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this.terminal = [];
    const nextPhase = bossPhase(e.hp, e.maxHp, !!g.overtime);
    if (nextPhase > this.phaseValue) {
      this.phaseValue = nextPhase;
      this.chainActive = false;
      this.chainLeft = 0;
      e.loaderClimb = e.loaderDrop = undefined;
      if (e.crane) {
        e.crane.route = [];
        e.crane.hit = false;
      }
      Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.2, y: e.body.velocity.y });
      this.setState('transition', FIRST_SHIFT_DOCKS.transition);
      g.soundAt('phase', e.body.position, `enemy:${e.id}`);
      g.feedback(3);
      return;
    }
    this.timeLeft -= dt;
    this.sync();
    if (this.stateValue === 'transition') {
      Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.5, y: e.body.velocity.y });
      if (this.timeLeft <= 0) this.setState('recover', 0.55);
      return;
    }
    if (
      this.stateValue === 'recover' &&
      this.timeLeft <= 0 &&
      this.kind === 'loader' &&
      this.chainActive &&
      this.phaseValue >= 2 &&
      this.chainIndex === 1
    ) {
      this.beginFlak();
      return;
    }
    if (this.stateValue === 'windup' && e.attack === 'flak') {
      Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.5, y: e.body.velocity.y });
      if (this.timeLeft > FIRST_SHIFT_DOCKS.flakLock)
        e.aim = direction(bossMuzzle(e), g.player.position);
      if (this.timeLeft <= 0) {
        for (const angle of this.angles()) g.enemyShot(e, angle, 10, 18, bossMuzzle(e));
        if (this.kind === 'crane') e.attacks++;
        g.soundAt('enemy', e.body.position, `enemy:${e.id}`);
        this.finishAttack();
      }
      return;
    }
    if (
      this.kind === 'loader' &&
      this.stateValue === 'windup' &&
      this.timeLeft > FIRST_SHIFT_DOCKS.loaderLock
    )
      e.aim = { x: Math.sign(g.player.position.x - e.body.position.x) || e.aim.x || 1, y: 0 };
    const before = this.stateValue;
    const lastCue =
      before === 'rush' ? this.cues.map((cue) => ({ ...cue, active: true, progress: 1 })) : [];
    this.drive();
    const after = e.state;
    this.stateValue = after;
    this.timeLeft = e.timer;
    e.phase = this.phaseValue;
    if (after !== before) {
      if (after === 'windup') this.beginAttack();
      else if (after === 'rush') this.timeTotal = this.timeLeft;
      else if (after === 'recover' && before === 'rush') {
        this.terminal = lastCue;
        this.finishAttack();
      } else this.timeTotal = Math.max(0.001, this.timeLeft);
    }
    this.sync();
  }
}
export class LoaderRemaster extends FirstShiftDocks {
  protected readonly kind = 'loader' as const;
  protected drive() {
    updateLoader(this.game, this.enemy);
  }
}
export class CraneRemaster extends FirstShiftDocks {
  protected readonly kind = 'crane' as const;
  protected drive() {
    updateCrane(this.game, this.enemy);
  }
}
