import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { BossRemasterCue } from './boss-remaster-cues.ts';
import { bossHasLane, huntBoss } from './boss-hunt.ts';
import { bossPhase } from './enemies.ts';
import { clamp, direction } from './rules.ts';

export type CondenserMove = 'pressure' | 'purge' | 'front' | 'cascade';
export type CondenserState = 'idle' | 'windup' | 'active' | 'recover' | 'transition';
export const CONDENSER_REMASTER = {
  pressureTell: 1.12,
  purgeTell: 1.3,
  frontTell: 1.45,
  lock: 0.42,
  frontLife: 0.35,
  transition: 1.15,
  recover: 1.4,
  linkedOpening: 0.4,
  damage: 21,
  frontTop: 684,
  floor: 740,
} as const;
const CYCLES: readonly (readonly CondenserMove[])[] = [
  ['pressure', 'purge', 'pressure'],
  ['front', 'pressure', 'purge', 'front'],
  ['cascade', 'front', 'pressure', 'cascade', 'purge'],
];
interface FrontLane {
  x: number;
  width: number;
}

/** Opt-in AI; the owning system selects the new Campaign/Practice identity. */
export class CondenserRemaster {
  readonly game: Game;
  readonly enemy: Enemy;
  private phaseValue: number;
  private stateValue: CondenserState = 'recover';
  private moveValue: CondenserMove = 'pressure';
  private shotType: 'pressure' | 'purge' | 'front' = 'pressure';
  private timeLeft = 0.45;
  private timeTotal = 0.45;
  private cycle = 0;
  private angles: number[] = [];
  private lanes: FrontLane[] = [];
  private linked = false;
  private stopped = false;
  private frontHit = false;
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
  get attack() {
    return this.moveValue;
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
  get cues(): readonly BossRemasterCue[] {
    if (this.stopped || !['windup', 'active'].includes(this.stateValue)) return [];
    const active = this.stateValue === 'active';
    const progress = active ? 1 : clamp(1 - this.timeLeft / this.timeTotal, 0, 1);
    const locked = this.shotType !== 'pressure' || this.timeLeft <= CONDENSER_REMASTER.lock;
    if (this.shotType === 'front')
      return this.lanes.map((lane) => ({
        kind: 'lane' as const,
        x: lane.x + lane.width / 2,
        width: lane.width,
        top: CONDENSER_REMASTER.frontTop,
        bottom: CONDENSER_REMASTER.floor,
        progress,
        active,
        locked: true,
      }));
    const from = this.enemy.body.position;
    return this.angles.map((angle) => ({
      kind: 'segment' as const,
      from: { ...from },
      to: this.game.lineEnd(
        from,
        { x: from.x + Math.cos(angle) * 2400, y: from.y + Math.sin(angle) * 2400 },
        5,
      ),
      width: 10,
      progress,
      active: false,
      locked,
    }));
  }
  get warnings() {
    return this.cues;
  }
  get snapshot() {
    return {
      phase: this.phase,
      state: this.state,
      attack: this.attack,
      remaining: this.remaining,
      duration: this.duration,
      cancelled: this.cancelled,
      cues: this.cues,
    };
  }
  cancel() {
    this.stopped = true;
    this.angles = [];
    this.lanes = [];
    this.linked = false;
    this.timeLeft = 0;
  }
  private sync() {
    this.enemy.phase = this.phaseValue;
    this.enemy.state = this.stateValue === 'active' ? 'followup' : this.stateValue;
    this.enemy.timer = this.remaining;
  }
  private setState(state: CondenserState, duration: number) {
    this.stateValue = state;
    this.timeLeft = duration;
    this.timeTotal = duration;
    this.sync();
  }
  private pressureAngles() {
    const d = direction(this.enemy.body.position, this.game.player.position);
    this.enemy.aim = d;
    const aim = Math.atan2(d.y, d.x);
    // Pressure retains finite ordinary bullets, which can be stopped by cover.
    const spread = this.phaseValue === 0 ? [-0.18, 0, 0.18] : [-0.3, -0.15, 0, 0.15, 0.3];
    return spread.map((offset) => aim + offset);
  }
  private frontLanes(): FrontLane[] {
    const pool = (this.game.level.coolant ?? []).filter((p) => p.w >= 90);
    const candidates = pool.length
      ? pool.map((p) => ({ x: p.x, width: p.w }))
      : [
          { x: 560, width: 400 },
          { x: 1220, width: 300 },
        ];
    const chosen = candidates
      .slice()
      .sort(
        (a, b) =>
          Math.abs(a.x + a.width / 2 - this.game.player.position.x) -
          Math.abs(b.x + b.width / 2 - this.game.player.position.x),
      );
    return chosen.slice(0, this.phaseValue >= 2 ? 2 : 1).map((lane) => {
      const x = clamp(lane.x, 80, this.game.worldWidth - 170);
      return { x, width: Math.max(90, Math.min(lane.width, this.game.worldWidth - 80 - x)) };
    });
  }
  private beginWindup(type: 'pressure' | 'purge' | 'front') {
    this.shotType = type;
    this.angles = [];
    this.lanes = [];
    this.frontHit = false;
    Matter.Body.setVelocity(this.enemy.body, { x: 0, y: 0 });
    if (type === 'pressure') {
      this.enemy.attack = 'aimed';
      this.angles = this.pressureAngles();
    } else if (type === 'purge') {
      this.enemy.attack = 'ring';
      const rotation = (this.cycle * Math.PI) / 11 + (this.phaseValue * Math.PI) / 12;
      this.angles = Array.from(
        { length: 16 },
        (_, i) => rotation + (i * Math.PI) / 8 + Math.PI / 16,
      ).filter((_, i) => i % 4 !== 0);
      this.enemy.aim = { x: Math.cos(rotation), y: Math.sin(rotation) };
    } else {
      this.enemy.attack = 'sweep';
      this.lanes = this.frontLanes();
      this.enemy.aim = direction(this.enemy.body.position, this.game.player.position);
    }
    this.setState(
      'windup',
      type === 'pressure'
        ? CONDENSER_REMASTER.pressureTell
        : type === 'purge'
          ? CONDENSER_REMASTER.purgeTell
          : CONDENSER_REMASTER.frontTell,
    );
    this.game.soundAt('lock', this.enemy.body.position, `enemy:${this.enemy.id}`);
  }
  private finish() {
    this.angles = [];
    this.lanes = [];
    this.cycle++;
    this.enemy.attacks++;
    this.linked = false;
    this.setState('recover', CONDENSER_REMASTER.recover);
  }
  private frontDamage() {
    if (this.frontHit) return;
    const p = this.game.player.position;
    // Matter broadphase bounds include velocity padding; use the visible hull.
    const hit = this.lanes.find(
      (lane) =>
        p.x + 13 > lane.x &&
        p.x - 13 < lane.x + lane.width &&
        p.y + 18 > CONDENSER_REMASTER.frontTop &&
        p.y - 18 < CONDENSER_REMASTER.floor,
    );
    if (!hit) return;
    const before = this.game.hp;
    this.game.damagePlayer(
      CONDENSER_REMASTER.damage,
      { x: hit.x + hit.width / 2, y: CONDENSER_REMASTER.floor },
      { type: 'coolant', enemy: 'condenser' },
    );
    this.frontHit = this.game.hp < before;
  }
  private release() {
    if (this.shotType === 'front') {
      this.setState('active', CONDENSER_REMASTER.frontLife);
      this.game.soundAt('pulse', this.enemy.body.position, `enemy:${this.enemy.id}`);
      this.frontDamage();
      return;
    }
    for (const angle of this.angles)
      this.game.enemyShot(
        this.enemy,
        angle,
        this.shotType === 'purge' ? 7.8 : 10.2,
        CONDENSER_REMASTER.damage,
      );
    this.game.soundAt(
      this.shotType === 'purge' ? 'pulse' : 'cooling-shot',
      this.enemy.body.position,
      `enemy:${this.enemy.id}`,
    );
    this.angles = [];
    if (this.moveValue === 'cascade' && !this.linked) {
      this.linked = true;
      this.setState('recover', CONDENSER_REMASTER.linkedOpening);
    } else this.finish();
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
    if (phase > this.phaseValue) {
      this.phaseValue = phase;
      this.cycle = 0;
      this.linked = false;
      this.angles = [];
      this.lanes = [];
      e.hunt = undefined;
      this.setState('transition', CONDENSER_REMASTER.transition);
      g.soundAt('phase', e.body.position, `enemy:${e.id}`);
      g.feedback(3);
      return;
    }
    // Retain the final damaging pulse rectangle until that frame has rendered.
    if (this.stateValue === 'active' && this.timeLeft <= 0) {
      this.finish();
      return;
    }
    if (this.stateValue === 'idle' || this.stateValue === 'recover') {
      huntBoss(g, e);
      if (this.stateValue === 'recover')
        Matter.Body.setVelocity(e.body, {
          x: e.body.velocity.x * 0.55,
          y: e.body.velocity.y * 0.55,
        });
    } else
      Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.25, y: e.body.velocity.y * 0.25 });
    if (
      this.stateValue === 'windup' &&
      this.shotType === 'pressure' &&
      this.timeLeft > CONDENSER_REMASTER.lock
    )
      this.angles = this.pressureAngles();
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.sync();
    if (this.stateValue === 'active') {
      this.frontDamage();
      return;
    }
    if (this.timeLeft > 0) return;
    if (this.stateValue === 'transition') {
      this.setState('recover', 0.5);
    } else if (this.stateValue === 'recover') {
      if (this.linked) this.beginWindup('pressure');
      else this.setState('idle', 0.15);
    } else if (this.stateValue === 'windup') this.release();
    else {
      const move = CYCLES[this.phaseValue][this.cycle % CYCLES[this.phaseValue].length];
      if (move !== 'front' && !bossHasLane(g, e)) return;
      this.moveValue = move;
      this.beginWindup(move === 'cascade' ? 'purge' : move);
    }
  }
}
