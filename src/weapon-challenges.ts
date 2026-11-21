import type { Enemy, Game } from './game.ts';
import type { KillSource } from './commendations.ts';
import type { ExperimentalWeapon } from './experimental-weapons.ts';
import { isBoss } from './enemies.ts';
import { isHunt } from './hunt-rules.ts';
import type { MeleeWeapon } from './starting-guns.ts';
import { distance, STAGES, type Vec } from './rules.ts';
import { WEAPON_CHALLENGE_TARGETS } from './weapon-challenge-rules.ts';
export { WEAPON_CHALLENGE_TARGETS } from './weapon-challenge-rules.ts';

export interface WeaponChallengeProgress {
  readonly current: number;
  readonly best: number;
  readonly target: number;
  readonly complete: boolean;
  readonly active: boolean;
}
interface Flight {
  origin: Vec;
  previous: Vec;
  lift: number;
  distance: number;
}

/** Evidence belongs to this reconstructed room, never a saved enemy roster.
 * Profile bests are informational; only a completed attempt grants a license. */
export class WeaponChallenges {
  private game: Game;
  private close = 0;
  private streak = 0;
  private held = false;
  private needsRelease = false;
  private ground: Vec | null = null;
  private flight: Flight | null = null;
  private killed = new Set<Enemy>();
  private best: Record<ExperimentalWeapon, number> = {
    bellows: 0,
    'debt-collector': 0,
    switchjack: 0,
  };
  private completed = new Set<ExperimentalWeapon | MeleeWeapon>();

  constructor(game: Game) {
    this.game = game;
  }
  get eligible() {
    const g = this.game;
    return g.commendations.eligible && !g.recoil.active && !g.maintenance.active && !g.escape;
  }
  private realEnemy(e: Enemy) {
    return (
      this.game.enemies.includes(e) &&
      !e.allied &&
      !e.workshopTarget &&
      e.spawn <= 0 &&
      e.kind !== 'sentry' &&
      e.eventRole !== 'relay' &&
      e.recoilTarget === undefined
    );
  }
  private get combat() {
    return (
      this.eligible &&
      !this.game.clear &&
      this.game.enemies.some((e) => this.realEnemy(e) && e.hp > 0)
    );
  }
  progress(gun: ExperimentalWeapon): WeaponChallengeProgress {
    const current =
      gun === 'bellows'
        ? this.close
        : gun === 'debt-collector'
          ? this.streak
          : this.flight && this.flight.lift >= 0.5
            ? Math.min(WEAPON_CHALLENGE_TARGETS.switchjack, Math.floor(this.flight.distance))
            : 0;
    return {
      current,
      best: this.best[gun],
      target: WEAPON_CHALLENGE_TARGETS[gun],
      complete: this.completed.has(gun),
      active:
        this.eligible &&
        (gun === 'debt-collector' ? this.held : gun === 'switchjack' ? !!this.flight : this.combat),
    };
  }
  reset() {
    this.close = this.streak = 0;
    this.held = this.needsRelease = false;
    this.ground = this.flight = null;
    this.killed.clear();
    this.best = { bellows: 0, 'debt-collector': 0, switchjack: 0 };
    this.completed.clear();
  }
  pause() {
    this.held = false;
    this.needsRelease = true;
    this.streak = 0;
    this.teleported();
  }
  teleported() {
    this.ground = this.flight = null;
  }
  damaged() {
    // A fresh hold must begin after the accepted hit, not silently continue the
    // old trigger gesture. The flight must also be injury-free through landing.
    this.pause();
  }
  input(fire: boolean) {
    if (!this.eligible) {
      this.pause();
      return;
    }
    if (!fire) {
      this.held = false;
      this.needsRelease = false;
      this.streak = 0;
    } else if (!this.held && !this.needsRelease) {
      this.held = true;
      this.streak = 0;
    }
    // Sample before input applies a jump/recoil so the real takeoff has a
    // measured origin. A resumed airborne room cannot invent its own takeoff.
    if (!this.flight && this.combat && this.game.commendations.weapons.grounded())
      this.ground = { ...this.game.player.position };
  }
  private record(gun: ExperimentalWeapon, value: number, complete = false) {
    if (!this.eligible || this.completed.has(gun)) return;
    const bounded = Math.min(WEAPON_CHALLENGE_TARGETS[gun], Math.max(0, value));
    // Ten visible flight milestones at most, plus the separate safe landing.
    const current = gun === 'switchjack' && !complete ? Math.floor(bounded / 50) * 50 : bounded;
    if (current <= this.best[gun] && !complete) return;
    this.best[gun] = Math.max(this.best[gun], current);
    if (complete) this.completed.add(gun);
    this.game.onWeaponChallengeProgress(gun, current, complete);
  }
  private license(tool: MeleeWeapon) {
    if (this.completed.has(tool)) return;
    this.completed.add(tool);
    this.game.onWeaponChallengeProgress(tool, 1, true);
  }
  defeated(e: Enemy, source?: KillSource) {
    if (
      !this.eligible ||
      !(e.hp <= 0) ||
      !this.realEnemy(e) ||
      this.killed.has(e) ||
      source === 'cleanup'
    )
      return;
    this.killed.add(e);
    const g = this.game;
    const range = distance(g.player.position, e.body.position);
    if (!g.quickShift.state && !g.gauntlet.state) {
      if (range <= 120) this.license('katana');
      if (
        !g.overtime &&
        !/^RF-D/.test(g.seed) &&
        g.level.boss &&
        !g.detour &&
        isBoss(e.kind) &&
        !isHunt(e.kind) &&
        e.kind !== 'welder' &&
        e.kind !== 'auditor'
      ) {
        if (g.startingGun === 'katana') this.license('hammer');
        if (
          g.startingGun === 'hammer' &&
          g.stage === STAGES - 1 &&
          (e.kind === 'boss' || e.kind === 'interceptor')
        )
          this.license('spear');
      }
    }
    if (range <= 180) {
      this.close = Math.min(WEAPON_CHALLENGE_TARGETS.bellows, this.close + 1);
      this.record('bellows', this.close, this.close === WEAPON_CHALLENGE_TARGETS.bellows);
    }
    if (this.held && !this.needsRelease) {
      this.streak = Math.min(WEAPON_CHALLENGE_TARGETS['debt-collector'], this.streak + 1);
      this.record(
        'debt-collector',
        this.streak,
        this.streak === WEAPON_CHALLENGE_TARGETS['debt-collector'],
      );
    }
  }
  recoiled(lift: number) {
    if (!this.eligible || this.game.grounded || !Number.isFinite(lift) || lift <= 0) return;
    if (!this.flight && this.ground && this.combat)
      this.flight = {
        origin: { ...this.ground },
        previous: { ...this.ground },
        lift: 0,
        distance: 0,
      };
    if (this.flight) this.flight.lift += lift;
  }
  afterStep() {
    if (!this.eligible) {
      this.teleported();
      return;
    }
    // Empty/cleared rooms cannot begin a combat flight. Discard the old takeoff
    // before a later wave can reuse it, and avoid querying inactive geometry.
    if (!this.flight && !this.combat) {
      this.ground = null;
      return;
    }
    const g = this.game,
      grounded = g.commendations.weapons.grounded();
    const p = g.player.position;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.y > 900) {
      this.teleported();
      return;
    }
    if (this.flight) {
      // A nonphysical reposition must not turn an old flight into a completed
      // crossing, even if its caller forgot the explicit teleport hook.
      if (distance(this.flight.previous, p) > 100) {
        this.teleported();
        return;
      }
      this.flight.previous = { ...p };
      this.flight.distance = Math.max(this.flight.distance, Math.abs(p.x - this.flight.origin.x));
      if (this.flight.lift >= 0.5) this.record('switchjack', this.flight.distance);
      if (grounded) {
        if (this.flight.lift >= 0.5 && this.flight.distance >= WEAPON_CHALLENGE_TARGETS.switchjack)
          this.record('switchjack', WEAPON_CHALLENGE_TARGETS.switchjack, true);
        this.flight = null;
      }
    } else if (!grounded && this.ground && this.combat) {
      this.flight = { origin: { ...this.ground }, previous: { ...p }, lift: 0, distance: 0 };
    }
    if (grounded) this.ground = this.combat ? { ...g.player.position } : null;
  }
}
