import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { BossRemasterCue } from './boss-remaster-cues.ts';
import { bossPhase, ENEMY_STATS } from './enemies.ts';
import { firstSolid } from './collisions.ts';
import { groundBossTarget } from './ground-boss-hunt.ts';
import { clearKiln, kilnMuzzle } from './kiln-ai.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';

export const FIRST_SHIFT_FURNACE = {
  stampTell: 1.25,
  heatTell: 1.3,
  flakTell: 1.15,
  lock: 0.6,
  transition: 1.2,
  pressRecover: 1.65,
  kilnRecover: 1.65,
  heatLife: 1.4,
  heatWidth: 112,
  crushDamage: 30,
  flakDamage: 18,
  heatDamage: 18,
} as const;
export type FurnaceState = 'idle' | 'windup' | 'active' | 'recover' | 'return' | 'transition';
interface HeatPatch {
  x: number;
  y: number;
  width: number;
  support: Matter.Body;
}
type PressMove = 'stamp' | 'flak';
type KilnMove = 'ember' | 'grate' | 'flak';

abstract class FurnaceBoss {
  readonly game: Game;
  readonly enemy: Enemy;
  phase: number;
  state: FurnaceState = 'idle';
  remaining = 0.45;
  duration = 0.45;
  cancelled = false;
  protected count = 0;
  protected angles: number[] = [];
  constructor(game: Game, enemy: Enemy) {
    this.game = game;
    this.enemy = enemy;
    this.phase = bossPhase(enemy.hp, enemy.maxHp, !!game.overtime);
    enemy.phase = this.phase;
  }
  get progress() {
    return clamp(1 - this.remaining / Math.max(this.duration, 0.001), 0, 1);
  }
  abstract get cues(): readonly BossRemasterCue[];
  protected abstract clearAttack(): void;
  cancel() {
    this.cancelled = true;
    this.clearAttack();
    this.remaining = 0;
  }
  protected setState(state: FurnaceState, duration: number) {
    this.state = state;
    this.remaining = this.duration = duration;
    this.enemy.state = state === 'active' ? 'rush' : state;
    this.enemy.timer = duration;
  }
  protected ready(dt: number) {
    const g = this.game,
      e = this.enemy;
    if (this.cancelled) return false;
    if (e.hp <= 0 || !g.enemies.includes(e)) {
      this.cancel();
      return false;
    }
    if (g.mode !== 'playing' || g.hitStop > 0 || !Number.isFinite(dt) || dt <= 0) return false;
    const phase = bossPhase(e.hp, e.maxHp, !!g.overtime);
    if (phase > this.phase) {
      this.phase = e.phase = phase;
      this.count = 0;
      this.clearAttack();
      Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
      e.hunt = undefined;
      e.groundHunt = undefined;
      this.setState('transition', FIRST_SHIFT_FURNACE.transition);
      g.soundAt('phase', e.body.position, `enemy:${e.id}`);
      g.feedback(4);
      return false;
    }
    return true;
  }
  protected clock(dt: number) {
    this.remaining = Math.max(0, this.remaining - Math.min(dt, 0.1));
    this.enemy.timer = this.remaining;
  }
  protected projectileCues(from: Vec): readonly BossRemasterCue[] {
    if (this.state !== 'windup') return [];
    return this.angles.map((angle) => ({
      kind: 'segment' as const,
      from: { ...from },
      to: this.game.lineEnd(
        from,
        { x: from.x + Math.cos(angle) * 2400, y: from.y + Math.sin(angle) * 2400 },
        5,
      ),
      width: 10,
      progress: this.progress,
      active: false,
      locked: this.remaining <= FIRST_SHIFT_FURNACE.lock,
    }));
  }
  protected aimFlak(from: Vec) {
    const e = this.enemy;
    e.aim = direction(from, this.game.player.position);
    const aim = Math.atan2(e.aim.y, e.aim.x);
    const offsets =
      this.phase === 0
        ? [-0.16, 0, 0.16]
        : this.phase === 1
          ? [-0.28, 0, 0.28]
          : [-0.48, -0.24, 0, 0.24, 0.48];
    this.angles = offsets.map((offset) => aim + offset);
  }
  protected fireFlak(from: Vec) {
    for (const angle of this.angles)
      this.game.enemyShot(this.enemy, angle, 10, FIRST_SHIFT_FURNACE.flakDamage, from);
    this.game.soundAt('enemy', this.enemy.body.position, `enemy:${this.enemy.id}`);
    this.angles = [];
  }
}

/** Physical stamping rig. Every repeat is positioned and warned as a new attack. */
export class PressRemaster extends FurnaceBoss {
  move: PressMove = 'stamp';
  private followups: PressMove[] = [];
  private targetX = 1000;
  private top = 229;
  private bottom = 740;
  private settledFor = 0;
  private landed = false;
  protected clearAttack() {
    this.angles = [];
    this.followups = [];
    this.landed = false;
  }
  get cues(): readonly BossRemasterCue[] {
    if (this.cancelled || this.enemy.hp <= 0 || !this.game.enemies.includes(this.enemy)) return [];
    if (this.move === 'flak') return this.projectileCues(this.muzzle());
    if (this.state !== 'windup' && this.state !== 'active') return [];
    return [
      {
        kind: 'lane',
        x: this.targetX,
        width: ENEMY_STATS.press.w,
        top: this.top,
        bottom: this.bottom,
        progress: this.progress,
        active: this.state === 'active',
        locked: this.state === 'active' || this.remaining <= FIRST_SHIFT_FURNACE.lock,
      },
    ];
  }
  private muzzle() {
    return { x: this.enemy.body.position.x, y: this.enemy.body.position.y - 38 };
  }
  private moveHull(vx: number, vy: number) {
    const e = this.enemy,
      p = e.body.position;
    const to = { x: p.x + vx, y: p.y + vy };
    const hit = firstSolid(p, to, { x: 59.95, y: 30.95 }, this.game.solidBodies);
    const fraction = hit ? Math.max(0, hit.t - 0.002) : 1;
    Matter.Body.setVelocity(e.body, { x: vx * fraction, y: vy * fraction });
  }
  private surface() {
    const from = { x: this.targetX, y: 260 };
    const hit = firstSolid(from, { x: from.x, y: 709 }, { x: 59.95, y: 31 }, this.game.solidBodies);
    this.bottom = hit ? 260 + (709 - 260) * hit.t + 31 : 740;
  }
  private trackStamp() {
    const g = this.game;
    this.targetX = clamp(g.player.position.x, 70, g.worldWidth - 70);
    this.enemy.target = { x: this.targetX, y: 740 };
    this.surface();
  }
  private warn(move: PressMove) {
    this.move = move;
    this.landed = false;
    this.settledFor = 0;
    this.angles = [];
    this.enemy.attack = move === 'stamp' ? 'slam' : 'flak';
    this.setState(
      'windup',
      move === 'stamp' ? FIRST_SHIFT_FURNACE.stampTell : FIRST_SHIFT_FURNACE.flakTell,
    );
    if (move === 'stamp') {
      this.top = Math.min(229, this.enemy.body.position.y - 31);
      this.trackStamp();
    } else this.aimFlak(this.muzzle());
    this.game.soundAt('lock', this.enemy.body.position, `enemy:${this.enemy.id}`);
  }
  private beginCycle() {
    const index = this.count++;
    const double = this.phase >= 2 && index % 2 === 0;
    const move: PressMove = index % 2 === 0 || double ? 'stamp' : 'flak';
    this.followups = double
      ? ['flak', 'stamp']
      : this.phase >= 1 && index % 3 === 0
        ? ['flak']
        : [];
    if (this.game.overtime && this.phase >= 1 && !this.followups.length) this.followups = ['stamp'];
    this.warn(move);
  }
  private recover() {
    this.landed = false;
    this.enemy.attacks++;
    this.setState('recover', FIRST_SHIFT_FURNACE.pressRecover - (this.game.overtime ? 0.1 : 0));
  }
  private continueCycle() {
    const next = this.followups.shift();
    if (next) this.warn(next);
    else this.setState('idle', 0.35);
  }
  private returnOverhead() {
    const g = this.game,
      p = this.enemy.body.position;
    const overhead = g.solidBodies.filter(
      (b) =>
        b.bounds.min.x < p.x + 60 &&
        b.bounds.max.x > p.x - 60 &&
        b.bounds.max.y <= p.y &&
        b.bounds.max.y > p.y - 65 &&
        b.bounds.min.y < p.y - 31,
    );
    if (overhead.length) {
      const exits = [
        Math.min(...overhead.map((b) => b.bounds.min.x)) - 68,
        Math.max(...overhead.map((b) => b.bounds.max.x)) + 68,
      ]
        .filter((x) => x >= 65 && x <= g.worldWidth - 65)
        .sort((a, b) => Math.abs(a - p.x) - Math.abs(b - p.x));
      this.moveHull(clamp(((exits[0] ?? p.x) - p.x) * 0.18, -9, 9), 0);
      return;
    }
    this.moveHull(0, -Math.min(10, Math.max(0, p.y - 260)));
    if (p.y <= 263) {
      Matter.Body.setVelocity(this.enemy.body, { x: 0, y: 0 });
      this.continueCycle();
    }
  }
  private crush(dt: number) {
    const g = this.game,
      e = this.enemy,
      p = e.body.position;
    const travel = 20 * Math.min(dt, 0.1) * 60;
    const to = { x: p.x, y: Math.min(p.y + travel, this.bottom - 31) };
    const contact = firstSolid(p, to, { x: 59.95, y: 31 }, g.solidBodies);
    const next = { x: p.x, y: p.y + (to.y - p.y) * (contact?.t ?? 1) };
    const player = g.player.position;
    if (
      player.x + 13 > this.targetX - 60 &&
      player.x - 13 < this.targetX + 60 &&
      player.y + 18 > this.top &&
      player.y - 18 < this.bottom &&
      player.x + 13 > p.x - 60 &&
      player.x - 13 < p.x + 60 &&
      player.y + 18 > p.y - 31 &&
      player.y - 18 < next.y + 31
    )
      g.damagePlayer(FIRST_SHIFT_FURNACE.crushDamage, p, { type: 'slam', enemy: 'press' });
    if (contact || to.y >= this.bottom - 31 - 0.01 || this.remaining <= 0) {
      Matter.Body.setPosition(e.body, { x: next.x, y: next.y - 0.05 });
      Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
      // Keep this exact active column through the last damaging collision frame.
      this.landed = true;
      const prop = contact && g.props.items.find((prop) => prop.body === contact.body);
      if (prop) g.props.strike(prop, 144, { x: 0, y: 1 });
      if (contact) g.destruction.hitBody(contact.body, 144, { x: 0, y: 1 });
      g.soundAt('slam', e.body.position, `enemy:${e.id}`);
      g.feedback(5);
    } else Matter.Body.setVelocity(e.body, { x: 0, y: 20 });
  }
  update(dt: number) {
    if (!this.ready(dt)) return;
    const g = this.game,
      e = this.enemy,
      p = e.body.position;
    dt = Math.min(dt, 0.1);
    Matter.Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
    if (this.state === 'active' && this.landed) {
      this.recover();
      return;
    }
    if (this.state === 'transition') {
      Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.4, y: e.body.velocity.y * 0.4 });
      this.clock(dt);
      if (!this.remaining) this.setState('return', 3);
      return;
    }
    if (this.state === 'return') {
      this.returnOverhead();
      return;
    }
    if (this.state === 'recover') {
      Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
      this.clock(dt);
      if (!this.remaining) {
        if (p.y > 265) this.setState('return', 3);
        else this.continueCycle();
      }
      return;
    }
    if (this.state === 'idle') {
      this.moveHull(
        clamp((g.player.position.x - p.x) * 0.04, -6, 6),
        clamp((260 - p.y) * 0.15, -8, 8),
      );
      this.clock(dt);
      if (!this.remaining) this.beginCycle();
      return;
    }
    if (this.state === 'windup') {
      if (this.move === 'stamp') {
        if (this.remaining > FIRST_SHIFT_FURNACE.lock) this.trackStamp();
        this.moveHull(
          clamp((this.targetX - p.x) * 0.28, -11, 11),
          clamp((260 - p.y) * 0.18, -8, 8),
        );
      } else {
        Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.4, y: e.body.velocity.y * 0.4 });
        if (this.remaining > FIRST_SHIFT_FURNACE.lock) this.aimFlak(this.muzzle());
      }
      this.clock(dt);
      if (this.remaining) return;
      if (this.move === 'stamp') {
        if (Math.abs(this.targetX - p.x) > 3 || Math.abs(p.y - 260) > 6) {
          this.settledFor += dt;
          if (this.settledFor > 1.2) this.warn('flak');
          return;
        }
        const settled = { x: this.targetX, y: 260 };
        if (firstSolid(p, settled, { x: 59.95, y: 30.95 }, g.solidBodies)) {
          this.warn('flak');
          return;
        }
        // Correct only the final sub-frame alignment, as in the native Press.
        Matter.Body.setPosition(e.body, settled);
        Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
        this.setState('active', 1);
        g.soundAt('press', p, `enemy:${e.id}`);
      } else {
        this.fireFlak(this.muzzle());
        this.setState('active', 0.2);
      }
      return;
    }
    this.clock(dt);
    if (this.move === 'stamp') this.crush(dt);
    else if (!this.remaining) this.recover();
  }
}

/** The boiler marks supported metal, then drives players between dry routes and clear firing lanes. */
export class KilnRemaster extends FurnaceBoss {
  move: KilnMove = 'ember';
  private followups: KilnMove[] = [];
  private patches: HeatPatch[] = [];
  private lockedMuzzle: Vec | null = null;
  constructor(game: Game, enemy: Enemy) {
    super(game, enemy);
    clearKiln(enemy);
  }
  protected clearAttack() {
    this.angles = [];
    this.followups = [];
    this.patches = [];
    this.lockedMuzzle = null;
    clearKiln(this.enemy);
  }
  get cues(): readonly BossRemasterCue[] {
    if (this.cancelled || this.enemy.hp <= 0 || !this.game.enemies.includes(this.enemy)) return [];
    if (this.move === 'flak') return this.projectileCues(kilnMuzzle(this.enemy));
    if (this.state !== 'windup' && this.state !== 'active') return [];
    return this.patches
      .filter((patch) => this.game.terrainBodies.includes(patch.support))
      .map((patch) => ({
        kind: 'lane' as const,
        x: patch.x,
        width: patch.width,
        top: patch.y - 10,
        bottom: patch.y + 2,
        progress: this.progress,
        active: this.state === 'active',
        locked: this.state === 'active' || this.remaining <= FIRST_SHIFT_FURNACE.lock,
      }));
  }
  private surface(x: number, feet: number): Matter.Body | undefined {
    return this.game.terrainBodies
      .filter(
        (b) =>
          b.isStatic &&
          b.bounds.min.x < x &&
          b.bounds.max.x > x &&
          b.bounds.min.y >= feet - 4 &&
          b.bounds.min.y <= 740,
      )
      .sort((a, b) => a.bounds.min.y - b.bounds.min.y)[0];
  }
  private planHeat() {
    const g = this.game;
    const center = clamp(g.player.position.x, 90, g.worldWidth - 90);
    const offsets = this.move === 'ember' ? [0] : this.phase >= 2 ? [-260, 0, 260] : [-220, 220];
    this.patches = [];
    for (const offset of offsets) {
      const x = clamp(center + offset, 90, g.worldWidth - 90);
      const support = this.surface(x, this.move === 'grate' ? 740 : g.player.position.y + 18);
      if (!support) continue;
      const left = Math.max(support.bounds.min.x, x - FIRST_SHIFT_FURNACE.heatWidth / 2);
      const right = Math.min(support.bounds.max.x, x + FIRST_SHIFT_FURNACE.heatWidth / 2);
      if (right - left >= 20 && !this.patches.some((p) => Math.abs(p.x - (left + right) / 2) < 40))
        this.patches.push({
          x: (left + right) / 2,
          y: support.bounds.min.y,
          width: right - left,
          support,
        });
    }
  }
  private warn(move: KilnMove) {
    this.move = move;
    this.patches = [];
    this.angles = [];
    this.lockedMuzzle = null;
    this.enemy.attack = move === 'flak' ? 'flak' : 'mortar';
    this.setState(
      'windup',
      move === 'flak' ? FIRST_SHIFT_FURNACE.flakTell : FIRST_SHIFT_FURNACE.heatTell,
    );
    if (move === 'flak') this.aimFlak(kilnMuzzle(this.enemy));
    else this.planHeat();
    this.game.soundAt('kiln-wind', this.enemy.body.position, `enemy:${this.enemy.id}`);
  }
  private beginCycle() {
    const index = this.count++;
    const moves: readonly KilnMove[] =
      this.phase === 0
        ? ['ember', 'flak']
        : this.phase === 1
          ? ['grate', 'flak', 'ember', 'flak']
          : ['ember', 'grate', 'flak'];
    const move = moves[index % moves.length];
    this.followups = this.phase >= 2 && index % 3 === 0 ? ['flak', 'grate'] : [];
    if (this.game.overtime && !this.followups.length)
      this.followups = [move === 'flak' ? 'ember' : 'flak'];
    this.warn(move);
  }
  private finish() {
    this.patches = [];
    this.angles = [];
    this.enemy.attacks++;
    this.setState(
      'recover',
      this.followups.length
        ? 0.5
        : FIRST_SHIFT_FURNACE.kilnRecover - (this.game.overtime ? 0.1 : 0),
    );
  }
  private heatDamage() {
    const g = this.game,
      p = g.player.position;
    for (const patch of this.patches) {
      if (!g.terrainBodies.includes(patch.support)) continue;
      if (
        p.x + 13 <= patch.x - patch.width / 2 ||
        p.x - 13 >= patch.x + patch.width / 2 ||
        p.y + 18 <= patch.y - 10 ||
        p.y - 18 >= patch.y + 2
      )
        continue;
      const from = {
        x: clamp(p.x, patch.x - patch.width / 2, patch.x + patch.width / 2),
        y: patch.y - 8,
      };
      if (distance(g.lineEnd(from, p), p) < 0.1)
        g.damagePlayer(
          FIRST_SHIFT_FURNACE.heatDamage,
          { x: patch.x, y: patch.y },
          { type: 'heat', enemy: 'kiln' },
        );
    }
  }
  private approach() {
    const g = this.game,
      e = this.enemy,
      p = e.body.position;
    const target = groundBossTarget(g, e, 62);
    const dx = target - p.x,
      sign = Math.sign(dx) || 1;
    const blocked = firstSolid(p, { x: p.x + sign * 26, y: p.y }, { x: 58, y: 39 }, g.solidBodies);
    Matter.Body.setVelocity(e.body, {
      x: e.body.velocity.x + ((Math.abs(dx) < 10 ? 0 : sign * 2.8) - e.body.velocity.x) * 0.12,
      y: e.body.velocity.y,
    });
    if (g.enemyGrounded(e) && blocked) Matter.Body.setVelocity(e.body, { x: sign * 5.2, y: -13.5 });
  }
  update(dt: number) {
    if (!this.ready(dt)) return;
    const g = this.game,
      e = this.enemy;
    dt = Math.min(dt, 0.1);
    if (this.state === 'transition') {
      Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.5, y: e.body.velocity.y });
      this.clock(dt);
      if (!this.remaining) this.setState('recover', 0.5);
      return;
    }
    if (this.state === 'recover') {
      Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.5, y: e.body.velocity.y });
      this.clock(dt);
      if (!this.remaining) {
        const next = this.followups.shift();
        if (next) this.warn(next);
        else this.setState('idle', 0.25);
      }
      return;
    }
    if (this.state === 'idle') {
      this.approach();
      this.clock(dt);
      if (!this.remaining && g.enemyGrounded(e)) this.beginCycle();
    } else if (this.state === 'windup') {
      Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.4, y: e.body.velocity.y });
      if (this.remaining > FIRST_SHIFT_FURNACE.lock) {
        if (this.move === 'flak') this.aimFlak(kilnMuzzle(e));
        else this.planHeat();
      } else if (this.move === 'flak' && !this.lockedMuzzle) this.lockedMuzzle = kilnMuzzle(e);
      this.clock(dt);
      if (!this.remaining) {
        if (this.move === 'flak') {
          if (this.lockedMuzzle && distance(kilnMuzzle(e), this.lockedMuzzle) > 12) {
            this.warn('flak');
            return;
          }
          this.fireFlak(kilnMuzzle(e));
          this.setState('active', 0.2);
        } else {
          this.setState('active', FIRST_SHIFT_FURNACE.heatLife);
          this.heatDamage();
          g.soundAt('kiln-fire', e.body.position, `enemy:${e.id}`);
        }
      }
    } else {
      Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.4, y: e.body.velocity.y });
      if (this.remaining <= 0) {
        this.finish();
        return;
      }
      this.clock(dt);
      if (this.move !== 'flak') this.heatDamage();
      // Do not erase the active heat on its last damage frame.
    }
    if (Matter.Query.collides(g.player, [e.body]).length)
      g.damagePlayer(30, e.body.position, { type: 'contact', enemy: 'kiln' });
  }
}
