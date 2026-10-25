import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import { bossPhase } from './enemies.ts';
import { huntBoss } from './boss-hunt.ts';
import { clamp, direction } from './rules.ts';
import type { BossRemasterCue } from './boss-remaster-cues.ts';

export type SorterRemasterMove = 'induction' | 'scrap' | 'magnet' | 'cascade';
export type SorterRemasterState = 'idle' | 'windup' | 'attack' | 'recover' | 'transition';
export const SORTER_REMASTER = {
  tell: 1.2,
  scrapTell: 1.1,
  magnetTell: 1.25,
  lock: 0.55,
  recover: 1.65,
  transition: 1.15,
  laneWidth: 84,
  sweepWidth: 72,
  sweepTop: 640,
  sweepBottom: 740,
  sweepDuration: 1.1,
  inductionDamage: 24,
  scrapDamage: 22,
} as const;

interface ScrapRound {
  angle: number;
  blade: boolean;
  speed: number;
}
interface SweepStrip {
  x: number;
  width: number;
}
const cycle: readonly (readonly SorterRemasterMove[])[] = [
  ['induction', 'scrap', 'induction', 'scrap'],
  ['magnet', 'scrap', 'induction', 'scrap'],
  ['cascade', 'scrap', 'magnet', 'cascade', 'scrap'],
];

/** A single deterministic encounter rig; its owner supplies version gating and startup. */
export class SorterRemaster {
  phase: number;
  state: SorterRemasterState = 'idle';
  move: SorterRemasterMove = 'induction';
  remaining = 0.35;
  duration = 0.35;
  private count = 0;
  private lanes: number[] = [];
  private rounds: ScrapRound[] = [];
  private followups: SorterRemasterMove[] = [];
  private pulse = 0;
  private sweepDirection = 1;
  private sweepStrip: SweepStrip | null = null;

  readonly game: Game;
  readonly enemy: Enemy;

  constructor(game: Game, enemy: Enemy) {
    this.game = game;
    this.enemy = enemy;
    this.phase = bossPhase(enemy.hp, enemy.maxHp, !!game.overtime);
    enemy.phase = this.phase;
  }
  get progress() {
    return clamp(1 - this.remaining / Math.max(this.duration, 0.001), 0, 1);
  }
  get cues(): readonly BossRemasterCue[] {
    if (this.enemy.hp <= 0 || !this.game.enemies.includes(this.enemy)) return [];
    const active = this.state === 'attack';
    const locked = active || this.remaining <= SORTER_REMASTER.lock;
    const base = { progress: this.progress, active, locked };
    if (this.state === 'windup' && this.move === 'magnet')
      return [
        {
          ...base,
          kind: 'segment',
          from: { x: 64, y: 690 },
          to: { x: this.game.worldWidth - 64, y: 690 },
          width: 100,
        },
      ];
    if (active && this.move === 'magnet' && this.sweepStrip)
      return [
        {
          ...base,
          kind: 'lane',
          x: this.sweepStrip.x,
          width: this.sweepStrip.width,
          top: SORTER_REMASTER.sweepTop,
          bottom: SORTER_REMASTER.sweepBottom,
        },
      ];
    if (
      (this.state === 'windup' && (this.move === 'induction' || this.move === 'cascade')) ||
      (active && this.pulse > 0 && (this.move === 'induction' || this.move === 'cascade'))
    )
      return this.lanes.map((x) => ({
        ...base,
        kind: 'lane' as const,
        x,
        width: SORTER_REMASTER.laneWidth,
        top: 50,
        bottom: 740,
      }));
    if (this.state === 'windup' && this.move === 'scrap') {
      const from = this.enemy.body.position;
      return this.rounds.map((round) => ({
        ...base,
        kind: 'segment' as const,
        from: { ...from },
        to: this.game.lineEnd(
          from,
          {
            x: from.x + Math.cos(round.angle) * 1600,
            y: from.y + Math.sin(round.angle) * 1600,
          },
          round.blade ? 11 : 5,
        ),
        width: round.blade ? 22 : 10,
      }));
    }
    return [];
  }
  private setState(state: SorterRemasterState, duration: number) {
    this.state = state;
    this.remaining = this.duration = duration;
    this.enemy.state = state === 'attack' ? 'rush' : state;
    // The remaster's exact primitives replace legacy fan/induction signals.
    this.enemy.attack = 'heavy';
    this.enemy.timer = duration;
    if (this.enemy.sorter) {
      this.enemy.sorter.lanes = [];
      this.enemy.sorter.pulse = 0;
    }
  }
  private target() {
    const g = this.game,
      e = this.enemy;
    e.aim = direction(e.body.position, g.player.position);
    if (this.move === 'induction' || this.move === 'cascade') {
      const x = clamp(g.player.position.x, 100, g.worldWidth - 100);
      const side = x < g.worldWidth / 2 ? 1 : -1;
      this.lanes = [x];
      if (this.move === 'cascade' || this.phase >= 1)
        this.lanes.push(clamp(x + side * 430, 100, g.worldWidth - 100));
      this.lanes = [...new Set(this.lanes)];
    } else if (this.move === 'scrap') {
      const aim = Math.atan2(e.aim.y, e.aim.x);
      const offsets =
        this.phase === 0
          ? [-0.27, 0, 0.27]
          : this.phase === 1
            ? [-0.3, 0, 0.3]
            : [-0.42, -0.21, 0.21, 0.42];
      this.rounds = offsets.map((offset) => ({
        angle: aim + offset,
        blade: this.phase >= 1,
        speed: this.phase >= 1 ? 8.8 : 10.8,
      }));
    }
  }
  private warn(move: SorterRemasterMove) {
    this.move = move;
    this.pulse = 0;
    this.sweepStrip = null;
    this.setState(
      'windup',
      move === 'magnet'
        ? SORTER_REMASTER.magnetTell
        : move === 'scrap'
          ? SORTER_REMASTER.scrapTell
          : SORTER_REMASTER.tell,
    );
    this.target();
    this.game.soundAt('lock', this.enemy.body.position, `enemy:${this.enemy.id}`);
  }
  private beginCycle() {
    const sequence = cycle[this.phase] ?? cycle[2];
    const move = sequence[this.count % sequence.length];
    this.sweepDirection = (this.count % 2 === 0 ? 1 : -1) * (this.game.level.mirrored ? -1 : 1);
    this.count++;
    this.followups =
      move === 'magnet' ? ['scrap'] : move === 'cascade' ? ['scrap', 'induction'] : [];
    this.warn(move);
  }
  private touches(left: number, top: number, right: number, bottom: number) {
    const p = this.game.player.position;
    // These are the real player's 26 x 36 hull extents, not velocity-expanded broadphase bounds.
    return p.x + 13 > left && p.x - 13 < right && p.y + 18 > top && p.y - 18 < bottom;
  }
  private strikeLanes() {
    const g = this.game;
    for (const x of this.lanes) {
      if (this.touches(x - 42, 50, x + 42, 740))
        g.damagePlayer(
          SORTER_REMASTER.inductionDamage,
          { x, y: g.player.position.y - 80 },
          { type: 'induction', enemy: 'sorter' },
        );
      for (const prop of [...g.props.items])
        if (Math.abs(prop.body.position.x - x) < 42 + 22) g.props.hit(prop, 65, { x: 0, y: -1 });
    }
    this.pulse = 0.22;
    g.soundAt('slam', this.enemy.body.position, `enemy:${this.enemy.id}`);
    g.feedback(4);
  }
  private discharge() {
    const g = this.game,
      e = this.enemy;
    if (this.move === 'magnet') {
      this.setState('attack', SORTER_REMASTER.sweepDuration);
      const x = this.sweepDirection > 0 ? 100 : g.worldWidth - 100;
      this.sweepStrip = { x, width: SORTER_REMASTER.sweepWidth };
      g.soundAt('pulse', e.body.position, `enemy:${e.id}`);
      return;
    }
    if (this.move === 'scrap') {
      for (const round of this.rounds)
        g.enemyShot(
          e,
          round.angle,
          round.speed,
          SORTER_REMASTER.scrapDamage,
          { ...e.body.position },
          round.blade,
        );
      g.soundAt('enemy', e.body.position, `enemy:${e.id}`);
    } else this.strikeLanes();
    this.setState('attack', 0.3);
  }
  private finishAttack() {
    this.sweepStrip = null;
    this.pulse = 0;
    const next = this.followups.shift();
    if (next) this.warn(next);
    else {
      this.enemy.attacks++;
      this.setState('recover', SORTER_REMASTER.recover + (this.phase >= 2 ? 0.2 : 0));
    }
  }
  private sweep(previousProgress: number) {
    const span = this.game.worldWidth - 200;
    const center = (t: number) =>
      this.sweepDirection > 0 ? 100 + span * t : this.game.worldWidth - 100 - span * t;
    const previous = center(previousProgress),
      current = center(this.progress);
    const left = Math.min(previous, current) - SORTER_REMASTER.sweepWidth / 2;
    const right = Math.max(previous, current) + SORTER_REMASTER.sweepWidth / 2;
    this.sweepStrip = { x: (left + right) / 2, width: right - left };
    if (this.touches(left, SORTER_REMASTER.sweepTop, right, SORTER_REMASTER.sweepBottom))
      this.game.damagePlayer(
        SORTER_REMASTER.inductionDamage,
        { x: this.sweepStrip.x, y: 690 },
        { type: 'induction', enemy: 'sorter' },
      );
  }
  update(dt: number) {
    const g = this.game,
      e = this.enemy;
    if (
      g.mode !== 'playing' ||
      g.hitStop > 0 ||
      e.hp <= 0 ||
      !g.enemies.includes(e) ||
      !Number.isFinite(dt) ||
      dt <= 0
    )
      return;
    dt = Math.min(dt, 0.1);
    Matter.Body.applyForce(e.body, e.body.position, { x: 0, y: -e.body.mass * 0.001 });
    const phase = bossPhase(e.hp, e.maxHp, !!g.overtime);
    if (phase > this.phase) {
      this.phase = e.phase = phase;
      this.count = 0;
      this.followups = [];
      this.lanes = [];
      this.rounds = [];
      this.sweepStrip = null;
      this.pulse = 0;
      this.setState('transition', SORTER_REMASTER.transition);
      e.hunt = undefined;
      g.soundAt('phase', e.body.position, `enemy:${e.id}`);
      g.feedback(4);
      return;
    }
    if (this.state === 'idle' || this.state === 'recover') huntBoss(g, e);
    else
      Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.45, y: e.body.velocity.y * 0.45 });
    // Retain the final swept strip for the frame that dealt damage; clear it on the next update.
    if (this.state === 'attack' && this.move === 'magnet' && this.remaining <= 0) {
      this.finishAttack();
      return;
    }
    const previousProgress = this.progress;
    this.remaining = Math.max(0, this.remaining - dt);
    e.timer = this.remaining;
    this.pulse = Math.max(0, this.pulse - dt);
    if (this.state === 'windup' && this.remaining > SORTER_REMASTER.lock) this.target();
    if (this.state === 'attack' && this.move === 'magnet') {
      this.sweep(previousProgress);
      if (this.remaining <= 0) return;
    }
    if (this.remaining > 0) return;
    if (this.state === 'windup') this.discharge();
    else if (this.state === 'attack') this.finishAttack();
    else if (this.state === 'transition' || this.state === 'recover') this.setState('idle', 0.3);
    else this.beginCycle();
  }
}
