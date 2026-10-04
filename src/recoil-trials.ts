import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import { areaIndex } from './rules.ts';
import { AIR_TARGETS, trialEntry, trialExit } from './recoil-trial-layouts.ts';
import {
  recoilTrialCheckpoint,
  loadRecoilProfile,
  type RecoilTrialKind,
  type RecoilTrialResult,
  type RecoilTrialSave,
} from './recoil-trial-rules.ts';
import type { StartingGun } from './starting-guns.ts';
const { Body, Composite } = Matter;

export class RecoilTrials {
  state: RecoilTrialSave | null = null;
  practice: { kind: RecoilTrialKind; gun: StartingGun } | null = null;
  result: RecoilTrialResult | null = null;
  waypoint = 0;
  attempts = 0;
  flying = false;
  targets: Enemy[] = [];
  startedAt = 0;
  startedShots = 0;
  private reported = false;
  onComplete: (result: RecoilTrialResult) => void = () => {};
  game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  get scheduled() {
    const g = this.game;
    return (
      !!this.state &&
      this.state.stage === g.stage &&
      !g.overtime &&
      !g.practice &&
      !g.workshop.active &&
      !g.escape
    );
  }
  get active() {
    return this.scheduled && this.game.detour && !!this.game.level.recoilTrial;
  }
  get kind() {
    return this.state!.kind;
  }
  get exit() {
    return trialExit(this.kind);
  }
  get done() {
    return this.kind === 'airborne'
      ? this.targets.length === 3 && this.targets.every((e) => e.hp <= 0)
      : this.waypoint === this.game.level.route.length;
  }
  get atExit() {
    if (!this.active || !this.done) return false;
    const g = this.game,
      p = g.player.position,
      door = this.exit;
    return g.grounded && Math.abs(p.x - door.x) < 74 && Math.abs(p.y - (door.floor - 18)) < 8;
  }
  get timeMs() {
    return (
      this.result?.timeMs ??
      (this.state?.spent ?? 0) + Math.max(0, Math.round((this.game.time - this.startedAt) * 1000))
    );
  }
  get shots() {
    return (
      this.result?.shots ??
      (this.state?.shots ?? 0) + Math.max(0, this.game.shotCount - this.startedShots)
    );
  }
  snapshot() {
    return this.state
      ? { ...this.state, ...(this.active ? { spent: this.timeMs, shots: this.shots } : {}) }
      : null;
  }
  reset(cleared: boolean) {
    this.waypoint = 0;
    this.attempts = 0;
    this.flying = false;
    this.targets = [];
    this.result = null;
    this.reported = false;
    this.startedAt = this.game.time;
    this.startedShots = this.game.shotCount;
    if (!this.active) return;
    this.state!.clean ??= true;
    const g = this.game;
    if (this.kind === 'cargo')
      g.hazards.items.forEach((h, i) => {
        h.phase = i * 1.1;
        const top =
          h.placement.y - (h.placement.travel * (1 - Math.cos((h.phase * Math.PI) / 4))) / 2;
        Body.setPosition(h.body, { x: h.placement.x, y: top + h.placement.h / 2 });
      });
    if (this.kind === 'airborne') this.spawnTargets();
    if (cleared) {
      this.waypoint = g.level.route.length;
      this.targets.forEach((e) => {
        e.hp = 0;
        Composite.remove(g.engine.world, e.body);
      });
      g.enemies = [];
      this.result = {
        kind: this.kind,
        gun: g.startingGun,
        mods: [...g.mods],
        timeMs: Math.max(1, this.state!.spent ?? 1),
        shots: this.state!.shots ?? 0,
        clean: this.state!.clean === true,
      };
      this.reported = true;
    }
    Body.setPosition(
      g.player,
      cleared ? { x: this.exit.x, y: this.exit.floor - 18 } : trialEntry(this.kind),
    );
    Body.setVelocity(g.player, { x: 0, y: 0 });
  }
  private spawnTargets() {
    const g = this.game;
    for (const e of this.targets) {
      Composite.remove(g.engine.world, e.body);
      g.enemies = g.enemies.filter((other) => other !== e);
    }
    this.targets = AIR_TARGETS.map((p, index) => {
      const e = g.spawnEnemy('runner', p.x, p.y)!;
      e.recoilTarget = index;
      e.workshopTarget = { home: { ...p }, moving: false };
      e.hp = e.maxHp = 1;
      e.spawn = 0;
      e.timer = Infinity;
      Body.setStatic(e.body, true);
      e.body.collisionFilter.mask = 0;
      return e;
    });
  }
  canHitTarget(e: Enemy) {
    return (
      this.active &&
      this.kind === 'airborne' &&
      this.flying &&
      !this.game.grounded &&
      this.targets.includes(e)
    );
  }
  afterStep() {
    if (!this.active || this.game.clear) return;
    const g = this.game,
      p = g.player.position;
    if (this.kind === 'launch') {
      const point = g.level.route[this.waypoint];
      if (point && g.grounded && Math.abs(p.x - point.x) < 94 && Math.abs(p.y - point.y) < 12) {
        this.waypoint++;
        g.onSound('loaded');
      }
    } else if (this.kind === 'cargo') {
      const platform = g.hazards.items[this.waypoint];
      if (platform && g.grounded && g.hazards.supported(g.player, platform.body)) {
        this.waypoint++;
        g.onSound('loaded');
      }
      if (p.x > 330 && p.x < 1660 && p.y > 700) {
        this.state!.clean = false;
        this.attempts++;
        this.waypoint = 0;
        Body.setPosition(g.player, trialEntry(this.kind));
        Body.setVelocity(g.player, { x: 0, y: 0 });
        g.grounded = false;
        g.shots = [];
        g.trail = [];
        g.onSound('land');
        g.save();
      }
    } else if (!this.done) {
      if (!g.grounded && p.y < 622) this.flying = true;
      if (g.grounded && this.flying) {
        this.flying = false;
        this.state!.clean = false;
        this.attempts++;
        g.shots = [];
        this.spawnTargets();
        g.onSound('loaded');
        g.save();
      }
    }
  }
  damaged() {
    if (this.active && !this.game.clear && this.state!.clean !== false) {
      this.state!.clean = false;
      if (this.game.hp > 0) this.game.save();
    }
  }
  completed() {
    const g = this.game;
    if (this.reported || !this.active || !g.clear || !this.atExit || g.hp <= 0) return;
    this.reported = true;
    this.result = {
      kind: this.kind,
      gun: g.startingGun,
      mods: [...g.mods],
      timeMs: Math.max(1, this.timeMs),
      shots: this.shots,
      clean: this.state!.clean === true,
    };
    if (!g.testRun || this.practice) this.onComplete(structuredClone(this.result));
  }
  abandon() {
    const g = this.game;
    if (!this.active || this.practice || !['playing', 'paused'].includes(g.mode) || g.clear)
      return false;
    g.detours.push(areaIndex(g.stage));
    g.missedUpgrades++;
    g.detour = false;
    g.route = null;
    g.stage++;
    g.loadRoom();
    g.setMode('playing');
    g.save();
    return true;
  }
  startPractice(kind: RecoilTrialKind, gun: StartingGun, profile: unknown) {
    if (!loadRecoilProfile(profile).clears.includes(kind)) return false;
    const save = recoilTrialCheckpoint(kind, gun);
    this.game.start(save.seed, save, null, save);
    this.practice = { kind, gun };
    this.game.onChange();
    return true;
  }
}
