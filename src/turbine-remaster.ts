import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { BossRemasterCue } from './boss-remaster-cues.ts';
import { bossHasLane, bossHuntTarget, huntBoss } from './boss-hunt.ts';
import { bossPhase } from './enemies.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';
import { applyTurbineWind } from './turbine.ts';

export type TurbineRemasterMove = 'gust' | 'sweep' | 'crosswind' | 'overdrive';
export type TurbineRemasterState =
  | 'idle'
  | 'windup'
  | 'active'
  | 'reposition'
  | 'recover'
  | 'transition';
export const TURBINE_REMASTER = {
  gustTell: 1.25,
  sweepTell: 1.15,
  lock: 0.5,
  gustDuration: 1.85,
  sweepDuration: 0.9,
  recover: 1.65,
  linkedOpening: 0.5,
  transition: 1.2,
  relocationTime: 1.7,
  bladeDamage: 22,
  bladeRadius: 11,
  bladeSpacing: 0.16,
  windRange: 850,
} as const;
const CYCLES: readonly (readonly TurbineRemasterMove[])[] = [
  ['gust', 'sweep', 'gust'],
  ['crosswind', 'sweep', 'gust', 'crosswind'],
  ['overdrive', 'crosswind', 'sweep', 'overdrive'],
];
type Strike = 'gust' | 'sweep';
interface RotorRound {
  angle: number;
  at: number;
  fired: boolean;
}

/** Version-owned rotor rig. Native wind, blade collision and vulnerability remain authoritative. */
export class TurbineRemaster {
  readonly game: Game;
  readonly enemy: Enemy;
  phase: number;
  state: TurbineRemasterState = 'recover';
  move: TurbineRemasterMove = 'gust';
  remaining = 0.45;
  duration = 0.45;
  private strike: Strike = 'gust';
  private origin: Vec;
  private rounds: RotorRound[] = [];
  private followups: Strike[] = [];
  private cycle = 0;
  private activeAge = 0;
  private stopped = false;
  private relocateNext = false;
  private flank = 1;

  constructor(game: Game, enemy: Enemy) {
    this.game = game;
    this.enemy = enemy;
    this.origin = { ...enemy.body.position };
    this.phase = bossPhase(enemy.hp, enemy.maxHp, !!game.overtime);
    this.flank = game.level.mirrored ? -1 : 1;
    this.sync();
  }
  get attack() {
    return this.move;
  }
  get cancelled() {
    return this.stopped;
  }
  get progress() {
    return clamp(1 - this.remaining / Math.max(0.001, this.duration), 0, 1);
  }
  get cues(): readonly BossRemasterCue[] {
    if (this.stopped || (this.state !== 'windup' && this.state !== 'active')) return [];
    const locked = this.state === 'active' || this.remaining <= TURBINE_REMASTER.lock;
    const pending = this.rounds.filter((round) => !round.fired);
    // Both gust waves reuse these lanes. Keep one visible mark until the last
    // pending blade in that lane has released, without doubling its opacity.
    return pending
      .filter(
        (round, i) =>
          pending.findIndex((other) => Math.abs(round.angle - other.angle) < 0.0001) === i,
      )
      .map((round) => ({
        kind: 'segment' as const,
        from: { ...this.origin },
        to: this.game.lineEnd(
          this.origin,
          {
            x: this.origin.x + Math.cos(round.angle) * 2400,
            y: this.origin.y + Math.sin(round.angle) * 2400,
          },
          TURBINE_REMASTER.bladeRadius,
        ),
        width: TURBINE_REMASTER.bladeRadius * 2,
        active: false,
        fireIn:
          this.state === 'active'
            ? Math.max(0, round.at - this.activeAge)
            : this.remaining + round.at,
        locked,
        progress: this.state === 'active' ? 1 : this.progress,
      }));
  }
  get warnings() {
    return this.cues;
  }
  get snapshot() {
    return {
      phase: this.phase,
      state: this.state,
      move: this.move,
      strike: this.strike,
      remaining: this.remaining,
      duration: this.duration,
      origin: { ...this.origin },
      activeAge: this.activeAge,
      rounds: this.rounds.map((round) => ({ ...round })),
      followups: [...this.followups],
      cancelled: this.stopped,
      cues: this.cues,
    };
  }
  cancel() {
    this.stopped = true;
    this.rounds = [];
    this.followups = [];
    this.remaining = 0;
    this.clearWind();
  }
  private clearWind() {
    if (this.enemy.turbine) {
      this.enemy.turbine.active = 0;
      this.enemy.turbine.angles = [];
      this.enemy.turbine.sent = 0;
    }
  }
  private sync() {
    const e = this.enemy;
    e.phase = this.phase;
    e.state = this.state === 'active' ? 'rush' : this.state === 'reposition' ? 'idle' : this.state;
    e.attack = this.strike;
    e.timer = Math.max(0, this.remaining);
    if (e.turbine) {
      // Native art keeps the exact cover-clipped airflow, while custom cues own blades.
      e.turbine.origin = { ...this.origin };
      e.turbine.angles = [];
      e.turbine.active = this.state === 'active' && this.strike === 'gust' ? this.activeAge : 0;
      e.turbine.sent = this.rounds.filter((round) => round.fired).length;
    }
  }
  private setState(state: TurbineRemasterState, duration: number) {
    this.state = state;
    this.remaining = this.duration = duration;
    if (state !== 'active') this.activeAge = 0;
    this.sync();
  }
  private target() {
    const e = this.enemy;
    this.origin = { ...e.body.position };
    e.aim = direction(this.origin, this.game.player.position);
    const aim = Math.atan2(e.aim.y, e.aim.x);
    const count = this.phase === 0 ? 3 : 5;
    const spread = this.strike === 'gust' ? 0.18 : this.phase === 0 ? 0.3 : 0.27;
    const reverse = (this.cycle + (this.game.level.mirrored ? 1 : 0)) % 2 === 1;
    const waves = this.strike === 'gust' ? 2 : 1;
    this.rounds = Array.from({ length: count * waves }, (_, index) => {
      const position = index % count;
      const lane = reverse ? count - 1 - position : position;
      return {
        angle: aim + (lane - (count - 1) / 2) * spread,
        at:
          (this.strike === 'gust' ? 0.25 : 0) +
          Math.floor(index / count) * 0.85 +
          position * TURBINE_REMASTER.bladeSpacing,
        fired: false,
      };
    });
    this.sync();
  }
  private warn(strike: Strike) {
    this.strike = strike;
    this.clearWind();
    Matter.Body.setVelocity(this.enemy.body, { x: 0, y: 0 });
    this.setState(
      'windup',
      strike === 'gust' ? TURBINE_REMASTER.gustTell : TURBINE_REMASTER.sweepTell,
    );
    this.target();
    this.game.soundAt('turbine-wind', this.enemy.body.position, `enemy:${this.enemy.id}`);
  }
  private beginCycle() {
    const sequence = CYCLES[this.phase];
    this.move = sequence[this.cycle % sequence.length];
    this.cycle++;
    this.followups =
      this.move === 'overdrive'
        ? this.game.overtime
          ? ['sweep', 'gust', 'sweep']
          : ['sweep', 'gust']
        : this.move === 'crosswind'
          ? this.game.overtime
            ? ['sweep', 'gust']
            : ['sweep']
          : [];
    this.warn(this.move === 'sweep' ? 'sweep' : 'gust');
  }
  private finishStrike() {
    this.clearWind();
    this.rounds = [];
    this.relocateNext = this.followups.length > 0;
    if (!this.relocateNext) this.enemy.attacks++;
    this.setState(
      'recover',
      this.relocateNext
        ? TURBINE_REMASTER.linkedOpening
        : TURBINE_REMASTER.recover + (this.phase === 2 ? 0.15 : 0),
    );
    this.game.soundAt('turbine-open', this.enemy.body.position, `enemy:${this.enemy.id}`);
  }
  private relocate() {
    const e = this.enemy;
    this.flank *= -1;
    e.hunt = undefined;
    bossHuntTarget(this.game, e, true, this.flank);
    this.setState('reposition', TURBINE_REMASTER.relocationTime);
  }
  private moveToLane() {
    const e = this.enemy,
      target = bossHuntTarget(this.game, e, true, this.flank),
      p = e.body.position;
    Matter.Body.setVelocity(e.body, {
      x: clamp((target.x - p.x) * 0.12, -5.8, 5.8),
      y: clamp((target.y - p.y) * 0.12, -4.8, 4.8),
    });
    return distance(p, target) < 30 && bossHasLane(this.game, e);
  }
  private release() {
    this.activeAge = 0;
    this.setState(
      'active',
      this.strike === 'gust' ? TURBINE_REMASTER.gustDuration : TURBINE_REMASTER.sweepDuration,
    );
    this.game.soundAt(
      this.strike === 'gust' ? 'turbine-gust' : 'turbine-cut',
      this.enemy.body.position,
      `enemy:${this.enemy.id}`,
    );
    this.fireDue();
  }
  private fireDue() {
    for (const round of this.rounds) {
      if (round.fired || round.at > this.activeAge + 1e-8) continue;
      this.game.enemyShot(
        this.enemy,
        round.angle,
        9.6 + this.phase * 0.5,
        TURBINE_REMASTER.bladeDamage,
        this.origin,
        true,
      );
      round.fired = true;
    }
    this.sync();
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
    dt = Math.min(0.1, dt);
    Matter.Body.applyForce(e.body, e.body.position, { x: 0, y: -e.body.mass * 0.001 });
    const phase = bossPhase(e.hp, e.maxHp, !!g.overtime);
    if (phase > this.phase) {
      this.phase = phase;
      this.cycle = 0;
      this.followups = [];
      this.rounds = [];
      this.relocateNext = false;
      this.clearWind();
      e.hunt = undefined;
      Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
      this.setState('transition', TURBINE_REMASTER.transition);
      g.soundAt('phase', e.body.position, `enemy:${e.id}`);
      g.feedback(3);
      return;
    }
    if (this.state === 'idle') huntBoss(g, e);
    else if (this.state === 'reposition') {
      if (this.moveToLane()) this.remaining = Math.min(this.remaining, 0.05);
    } else {
      // A locked wind cone and every blade share one physical commitment.
      // Recoil impulses cannot move its muzzle through a wall after the warning locks.
      Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
      if (
        this.state === 'active' ||
        (this.state === 'windup' && this.remaining <= TURBINE_REMASTER.lock)
      )
        Matter.Body.setPosition(e.body, this.origin);
    }
    if (this.state === 'windup' && this.remaining > TURBINE_REMASTER.lock) this.target();
    this.remaining = Math.max(0, this.remaining - dt);
    this.sync();
    if (this.state === 'active') {
      this.activeAge = Math.min(this.duration, this.activeAge + dt);
      this.sync();
      if (this.strike === 'gust') applyTurbineWind(g, e, dt);
      this.fireDue();
      if (this.remaining <= 0) this.finishStrike();
      return;
    }
    if (this.remaining > 0) return;
    if (this.state === 'windup') this.release();
    else if (this.state === 'transition') this.setState('recover', 0.5);
    else if (this.state === 'recover') {
      if (this.relocateNext) this.relocate();
      else this.setState('idle', 0.1);
    } else if (this.state === 'reposition') {
      if (bossHasLane(g, e)) this.warn(this.followups.shift()!);
      else {
        // Find a reachable ordinary lane rather than firing indefinitely into solid shelves.
        e.hunt = undefined;
        this.setState('idle', 0);
      }
    } else if (bossHasLane(g, e)) {
      if (this.followups.length) this.warn(this.followups.shift()!);
      else this.beginCycle();
    }
  }
}
