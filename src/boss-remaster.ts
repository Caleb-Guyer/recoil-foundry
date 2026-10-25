import { rivalShiftFans, rivalShiftBelts } from './rival-shift-layout.ts';
import { TurbineRemaster } from './turbine-remaster.ts';
import { ReclamationInterceptorRemaster } from './reclamation-interceptor-remaster.ts';
import { rivalShiftTestIdentity } from './rival-shift-test.ts';
import { LoaderRemaster, CraneRemaster } from './first-shift-docks.ts';
import { PressRemaster, KilnRemaster } from './first-shift-furnace.ts';
import { firstShiftTestIdentity } from './first-shift-test.ts';
import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { BossRemasterVisual } from './boss-remaster-cues.ts';
import type { MagnetPlacement } from './reclamation-layouts.ts';
import { CondenserRemaster } from './condenser-remaster.ts';
import { SorterRemaster } from './sorter-remaster.ts';
import { remasterMagnets, remasterPools, type RemasteredBoss } from './boss-remaster-layout.ts';
import { bossRemasterTestIdentity } from './boss-remaster-test.ts';
import { clamp } from './rules.ts';

const STARTUP = 1.25,
  DESTRUCTION = 1.2;
/** Owns only the revised encounter; native damage, rewards and room exits remain authoritative. */
export class BossRemasterSystem {
  readonly game: Game;
  enemy: Enemy | null = null;
  rig:
    | TurbineRemaster
    | ReclamationInterceptorRemaster
    | CondenserRemaster
    | SorterRemaster
    | LoaderRemaster
    | CraneRemaster
    | PressRemaster
    | KilnRemaster
    | null = null;
  private kind: RemasteredBoss | null = null;
  private began = 0;
  private destroyedAt: number | null = null;
  private wreck = { x: 0, y: 0 };
  private phase = 0;
  private arenaPhase = -1;
  private coolantEnabled = false;
  private magnetsEnabled = false;
  private pendingMagnets: MagnetPlacement[] | null = null;
  constructor(game: Game) {
    this.game = game;
  }
  owns(enemy: Enemy) {
    return this.enemy === enemy && !!this.rig;
  }
  get waiting() {
    return this.destroyedAt !== null && this.game.time - this.destroyedAt < DESTRUCTION;
  }
  get visual(): BossRemasterVisual | null {
    if (!this.kind || !this.enemy || !this.rig) return null;
    const age = this.game.time - this.began;
    if (this.destroyedAt !== null) {
      const elapsed = this.game.time - this.destroyedAt;
      if (elapsed >= DESTRUCTION) return null;
      return {
        kind: this.kind,
        center: this.wreck,
        phase: this.phase,
        stage: 'destroyed',
        progress: clamp(elapsed / DESTRUCTION, 0, 1),
        age: elapsed,
        warnings: [],
      };
    }
    const startup = age < STARTUP;
    const transition = this.rig.state === 'transition';
    return {
      kind: this.kind,
      center: { ...this.enemy.body.position },
      phase: this.rig.phase,
      stage: startup ? 'startup' : transition ? 'transition' : 'combat',
      progress: startup
        ? clamp(age / STARTUP, 0, 1)
        : transition
          ? clamp(1 - this.rig.remaining / this.rig.duration, 0, 1)
          : 1,
      age,
      exposed: this.enemy.state === 'recover',
      warnings: startup ? [] : this.rig.cues,
    };
  }
  clear() {
    this.stopBelts();
    if (this.kind === 'turbine') this.game.crosswind.clear();
    if (this.rig && 'cancel' in this.rig) this.rig.cancel();
    this.enemy = null;
    this.rig = null;
    this.kind = null;
    this.destroyedAt = null;
    this.pendingMagnets = null;
    this.arenaPhase = -1;
  }
  reset(cleared = false) {
    this.clear();
    const g = this.game,
      kind = g.level.bossRemaster;
    if (cleared || !kind) return;
    const enemy = g.enemies.find((e) => e.kind === kind && !e.allied);
    if (!enemy) return;
    const fixture =
      g.testRun?.seed === g.seed && g.testRun.stage === g.stage
        ? (rivalShiftTestIdentity(g.seed) ??
          firstShiftTestIdentity(g.seed) ??
          bossRemasterTestIdentity(g.seed))
        : null;
    if (fixture && fixture.boss === kind) {
      const fullOvertime = 'ng' in fixture && fixture.ng && fixture.phase === 1;
      enemy.hp = enemy.maxHp * (fullOvertime ? 1 : [1, 0.6, 0.25][fixture.phase]);
    }
    this.enemy = enemy;
    this.kind = kind;
    this.rig =
      kind === 'turbine'
        ? new TurbineRemaster(g, enemy)
        : kind === 'boss'
          ? new ReclamationInterceptorRemaster(g, enemy)
          : kind === 'condenser'
            ? new CondenserRemaster(g, enemy)
            : kind === 'sorter'
              ? new SorterRemaster(g, enemy)
              : kind === 'loader'
                ? new LoaderRemaster(g, enemy)
                : kind === 'crane'
                  ? new CraneRemaster(g, enemy)
                  : kind === 'press'
                    ? new PressRemaster(g, enemy)
                    : new KilnRemaster(g, enemy);
    this.phase = this.rig.phase;
    this.began = g.time;
    this.coolantEnabled = !!g.level.coolant?.length;
    this.magnetsEnabled = !!g.level.magnets?.length;
    this.applyArena(this.phase);
    this.stopBelts();
    enemy.state = 'transition';
  }
  private ownRounds() {
    const g = this.game;
    g.shots = g.shots.filter((s) => s.friendly || s.damageCause?.enemy !== this.kind);
  }
  private stopBelts() {
    if (this.kind === 'sorter' || this.kind === 'boss')
      for (const belt of this.game.conveyors.items) belt.speed = 0;
  }
  private applyArena(phase: number) {
    if (this.arenaPhase === phase) return;
    const g = this.game;
    this.arenaPhase = phase;
    if (this.kind === 'turbine') {
      g.level.fans = rivalShiftFans(phase, g.level.mirrored);
      g.crosswind.reset(); // Every new shaft retains its full rest and warning.
    }
    if (this.kind === 'boss') {
      g.conveyors.clear();
      g.conveyors.items = rivalShiftBelts(phase, g.level.mirrored);
    }
    if (this.kind === 'condenser' && this.coolantEnabled)
      g.level.coolant = remasterPools(phase, g.level.mirrored);
    if (this.kind === 'sorter') {
      const speeds = phase === 0 ? [1.3, -1.3] : phase === 1 ? [-1.6, 1.6] : [2, -2];
      g.conveyors.clear();
      g.conveyors.items = [
        { x: 650, y: 740, w: 230, speed: speeds[0] },
        { x: 1120, y: 740, w: 280, speed: speeds[1] },
      ].map((b) => ({
        ...b,
        x: g.level.mirrored ? 2000 - b.x - b.w : b.x,
        speed: g.level.mirrored ? -b.speed : b.speed,
      }));
      this.pendingMagnets = this.magnetsEnabled ? remasterMagnets(phase, g.level.mirrored) : [];
      this.applyMagnets();
    }
  }
  private applyMagnets() {
    const g = this.game;
    if (!this.pendingMagnets || g.magnets.items.some((m) => m.held || m.phase !== 'rest')) return;
    g.level.magnets = this.pendingMagnets;
    g.magnets.reset(); // Every newly activated magnet begins its entire native warning.
    this.pendingMagnets = null;
  }
  tryUpdate(enemy: Enemy, dt: number) {
    if (!this.owns(enemy)) return false;
    const g = this.game,
      rig = this.rig!;
    if (g.time - this.began < STARTUP) {
      if (this.kind !== 'loader' && this.kind !== 'kiln')
        Matter.Body.applyForce(enemy.body, enemy.body.position, {
          x: 0,
          y: -enemy.body.mass * 0.001,
        });
      Matter.Body.setVelocity(enemy.body, {
        x: enemy.body.velocity.x * 0.4,
        y:
          this.kind === 'loader' || this.kind === 'kiln'
            ? enemy.body.velocity.y
            : enemy.body.velocity.y * 0.4,
      });
      enemy.state = 'transition';
      return true;
    }
    rig.update(dt);
    if (rig.phase !== this.phase) {
      this.phase = rig.phase;
      this.ownRounds();
      this.stopBelts();
      if (this.kind === 'turbine') g.crosswind.clear();
    }
    if (rig.state !== 'transition') {
      if (this.arenaPhase !== this.phase) this.applyArena(this.phase);
      else if (this.kind === 'boss') {
        const belts = rivalShiftBelts(this.phase, g.level.mirrored);
        g.conveyors.items.forEach((b, i) => (b.speed = belts[i]?.speed ?? 0));
      } else if (this.kind === 'sorter') {
        const speeds = this.phase === 0 ? [1.3, -1.3] : this.phase === 1 ? [-1.6, 1.6] : [2, -2];
        g.conveyors.items.forEach((b, i) => (b.speed = speeds[i] * (g.level.mirrored ? -1 : 1)));
      }
    }
    return true;
  }
  afterStep() {
    if (this.rig && this.destroyedAt === null) this.applyMagnets();
  }
  defeated(enemy: Enemy) {
    if (!this.owns(enemy) || this.destroyedAt !== null) return;
    this.destroyedAt = this.game.time;
    this.wreck = { ...enemy.body.position };
    if (this.rig && 'cancel' in this.rig) this.rig.cancel();
    this.ownRounds();
    this.stopBelts();
    this.pendingMagnets = null;
    if (this.kind === 'turbine') this.game.crosswind.clear();
    this.game.soundAt('slam', enemy.body.position, `enemy:${enemy.id}`);
  }
}
