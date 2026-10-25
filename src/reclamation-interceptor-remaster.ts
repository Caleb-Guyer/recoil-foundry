import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { BossRemasterCue } from './boss-remaster-cues.ts';
import { bossHasLane, bossHuntTarget, huntBoss } from './boss-hunt.ts';
import { bossPhase } from './enemies.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';

export type ReclamationInterceptorMove = 'salvo' | 'fork' | 'crosscut' | 'aperture';
export type ReclamationInterceptorState =
  | 'idle'
  | 'relocate'
  | 'windup'
  | 'active'
  | 'recover'
  | 'transition';
export const RECLAMATION_INTERCEPTOR_REMASTER = {
  salvoTell: 1.1,
  forkTell: 1.2,
  apertureTell: 1.3,
  lock: 0.48,
  roundSpacing: 0.17,
  recover: 1.35,
  transition: 1.2,
  relocate: 1.15,
  linkedOpening: 0.38,
  damage: 23,
} as const;
const CYCLES: readonly (readonly ReclamationInterceptorMove[])[] = [
  ['salvo', 'fork', 'salvo'],
  ['crosscut', 'fork', 'salvo', 'crosscut'],
  ['aperture', 'crosscut', 'fork', 'crosscut'],
];
interface Round {
  angle: number;
  at: number;
  speed: number;
}
/** The room-16 machine (kind `boss`), distinct from the final Reclaimer. */
export class ReclamationInterceptorRemaster {
  readonly game: Game;
  readonly enemy: Enemy;
  phase: number;
  state: ReclamationInterceptorState = 'recover';
  move: ReclamationInterceptorMove = 'salvo';
  remaining = 0.5;
  duration = 0.5;
  private cycle = 0;
  private salvoPart = 0;
  private rounds: Round[] = [];
  private sent = 0;
  private elapsed = 0;
  private stopped = false;
  private side = 0;
  private relocatingForAttack = false;
  private tracking = true;
  private origin: Vec;
  constructor(game: Game, enemy: Enemy) {
    this.game = game;
    this.enemy = enemy;
    this.origin = { ...enemy.body.position };
    this.phase = bossPhase(enemy.hp, enemy.maxHp, !!game.overtime);
    this.sync();
  }
  get attack() {
    return this.move;
  }
  get cancelled() {
    return this.stopped;
  }
  get progress() {
    return clamp(1 - this.remaining / Math.max(this.duration, 0.001), 0, 1);
  }
  get cues(): readonly BossRemasterCue[] {
    if (this.stopped || !['windup', 'active'].includes(this.state)) return [];
    const from = this.origin;
    const pending = this.state === 'active' ? this.rounds.slice(this.sent) : this.rounds;
    // Each lane describes an ordinary five-pixel projectile. Duplicate salvo
    // rounds share one warning, rather than stacking several glowing lines.
    const unique = pending.filter(
      (round, i) =>
        pending.findIndex((other) => Math.abs(round.angle - other.angle) < 0.0001) === i,
    );
    return unique.map((round) => ({
      kind: 'segment' as const,
      from: { ...from },
      to: this.game.lineEnd(
        from,
        { x: from.x + Math.cos(round.angle) * 2400, y: from.y + Math.sin(round.angle) * 2400 },
        5,
      ),
      width: 10,
      progress: this.state === 'active' ? 1 : this.progress,
      active: false,
      fireIn:
        this.state === 'active' ? Math.max(0, round.at - this.elapsed) : this.remaining + round.at,
      locked:
        !this.tracking ||
        this.state === 'active' ||
        this.remaining <= RECLAMATION_INTERCEPTOR_REMASTER.lock,
    }));
  }
  get snapshot() {
    return {
      phase: this.phase,
      state: this.state,
      attack: this.attack,
      remaining: this.remaining,
      duration: this.duration,
      salvoPart: this.salvoPart,
      pending: this.rounds.length - this.sent,
      cancelled: this.cancelled,
    };
  }
  cancel() {
    this.stopped = true;
    this.rounds = [];
    this.remaining = 0;
    this.relocatingForAttack = false;
    this.enemy.hunt = undefined;
    Matter.Body.setVelocity(this.enemy.body, { x: 0, y: 0 });
  }
  private sync() {
    this.enemy.phase = this.phase;
    this.enemy.timer = this.remaining;
    this.enemy.state =
      this.state === 'active' ? 'followup' : this.state === 'relocate' ? 'idle' : this.state;
    // Exact remaster segments replace the old aimed/fan/ring presentation.
    this.enemy.attack = 'heavy';
  }
  private setState(state: ReclamationInterceptorState, duration: number) {
    this.state = state;
    this.remaining = this.duration = duration;
    this.sync();
  }
  private target() {
    const e = this.enemy;
    this.origin = { ...e.body.position };
    e.aim = direction(this.origin, this.game.player.position);
    const aim = Math.atan2(e.aim.y, e.aim.x);
    if (this.move === 'aperture') {
      const rotation = aim + Math.PI / 16;
      this.rounds = Array.from({ length: 16 }, (_, i) => ({
        angle: rotation + (i * Math.PI) / 8,
        at: 0,
        speed: 8.2,
      })).filter((_, i) => i % 4 !== 0);
      return;
    }
    if (this.move === 'fork') {
      // The empty center is an actual escape route, not a decoration.
      const offsets =
        this.phase === 0 ? [-0.32, -0.16, 0.16, 0.32] : [-0.48, -0.3, -0.13, 0.13, 0.3, 0.48];
      this.rounds = offsets.map((offset) => ({ angle: aim + offset, at: 0, speed: 10.2 }));
      return;
    }
    const count = this.phase >= 2 || this.game.overtime ? 4 : 3;
    const spread = this.move === 'crosscut' && this.salvoPart > 0 ? [-0.18, 0, 0.18] : [0];
    this.rounds = Array.from({ length: count }, (_, i) =>
      spread.map((offset) => ({
        angle: aim + offset,
        at: i * RECLAMATION_INTERCEPTOR_REMASTER.roundSpacing,
        speed: 11.2,
      })),
    ).flat();
  }
  private warn() {
    this.sent = 0;
    this.elapsed = 0;
    this.tracking = this.move !== 'aperture';
    this.target();
    this.setState(
      'windup',
      this.move === 'aperture'
        ? RECLAMATION_INTERCEPTOR_REMASTER.apertureTell
        : this.move === 'fork'
          ? RECLAMATION_INTERCEPTOR_REMASTER.forkTell
          : RECLAMATION_INTERCEPTOR_REMASTER.salvoTell,
    );
    Matter.Body.setVelocity(this.enemy.body, { x: 0, y: 0 });
    this.game.soundAt('lock', this.enemy.body.position, `enemy:${this.enemy.id}`);
  }
  private relocate(forAttack: boolean) {
    this.relocatingForAttack = forAttack;
    this.enemy.hunt = undefined;
    this.side = this.enemy.body.position.x < this.game.player.position.x ? 1 : -1;
    this.setState('relocate', RECLAMATION_INTERCEPTOR_REMASTER.relocate);
  }
  private reposition() {
    const g = this.game,
      e = this.enemy;
    let target = bossHuntTarget(g, e, true, this.side);
    // A blocked flank can always fall back to a reachable firing angle. This
    // remains a native hull route; there is no teleport or collision bypass.
    if (distance(target, e.body.position) < 8 && !bossHasLane(g, e)) {
      e.hunt = undefined;
      this.side = 0;
      target = bossHuntTarget(g, e, true);
    }
    Matter.Body.setVelocity(e.body, {
      x: clamp((target.x - e.body.position.x) * 0.12, -6.4, 6.4),
      y: clamp((target.y - e.body.position.y) * 0.12, -4.8, 4.8),
    });
  }
  private finishAttack() {
    this.rounds = [];
    const count = this.move === 'crosscut' ? (this.game.overtime ? 3 : 2) : 1;
    if (this.salvoPart + 1 < count) {
      this.salvoPart++;
      this.setState('recover', RECLAMATION_INTERCEPTOR_REMASTER.linkedOpening);
      this.relocatingForAttack = true;
    } else {
      this.salvoPart = 0;
      this.cycle++;
      this.enemy.attacks++;
      this.relocatingForAttack = false;
      this.setState(
        'recover',
        RECLAMATION_INTERCEPTOR_REMASTER.recover + (this.phase === 2 ? 0.15 : 0),
      );
    }
  }
  private release() {
    while (this.sent < this.rounds.length && this.rounds[this.sent].at <= this.elapsed + 1e-8) {
      const round = this.rounds[this.sent++];
      this.game.enemyShot(
        this.enemy,
        round.angle,
        round.speed,
        RECLAMATION_INTERCEPTOR_REMASTER.damage,
        this.origin,
      );
      this.game.soundAt('enemy', this.enemy.body.position, `enemy:${this.enemy.id}`);
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
    Matter.Body.applyForce(e.body, e.body.position, { x: 0, y: -e.body.mass * 0.001 });
    const phase = bossPhase(e.hp, e.maxHp, !!g.overtime);
    if (phase > this.phase) {
      this.phase = phase;
      this.cycle = this.salvoPart = 0;
      this.rounds = [];
      this.relocatingForAttack = false;
      e.hunt = undefined;
      Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
      this.setState('transition', RECLAMATION_INTERCEPTOR_REMASTER.transition);
      g.soundAt('phase', e.body.position, `enemy:${e.id}`);
      g.feedback(3);
      return;
    }
    if (this.state === 'relocate') this.reposition();
    else if (this.state === 'idle') huntBoss(g, e);
    else {
      Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
      // A committed lane retains its muzzle as well as its angle. Outside
      // impulses cannot slide later salvo rounds away from the locked warning.
      if (
        this.state === 'active' ||
        (this.state === 'windup' &&
          (!this.tracking || this.remaining <= RECLAMATION_INTERCEPTOR_REMASTER.lock))
      )
        Matter.Body.setPosition(e.body, this.origin);
    }
    if (
      this.state === 'windup' &&
      this.tracking &&
      this.remaining > RECLAMATION_INTERCEPTOR_REMASTER.lock
    )
      this.target();
    this.remaining = Math.max(0, this.remaining - dt);
    this.sync();
    if (this.state === 'active') {
      this.elapsed += dt;
      this.release();
      if (this.sent === this.rounds.length && this.remaining <= 0) this.finishAttack();
      return;
    }
    if (this.remaining > 0) return;
    if (this.state === 'transition') this.setState('recover', 0.55);
    else if (this.state === 'recover') {
      if (this.relocatingForAttack) this.relocate(true);
      else this.setState('idle', 0.15);
    } else if (this.state === 'relocate') {
      if (bossHasLane(g, e)) {
        if (this.relocatingForAttack) this.warn();
        else this.setState('idle', 0.1);
      } else this.setState('idle', 0.15);
    } else if (this.state === 'windup') {
      this.setState('active', Math.max(0.22, this.rounds[this.rounds.length - 1]?.at + 0.1));
      this.release();
    } else if (!bossHasLane(g, e)) {
      // Seek around real cover instead of repeating harmless volleys into it.
      this.relocate(false);
    } else {
      this.move = CYCLES[this.phase][this.cycle % CYCLES[this.phase].length];
      this.salvoPart = 0;
      this.warn();
    }
  }
}
