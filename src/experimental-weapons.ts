import Matter from 'matter-js';
import type { Game, Input, Shot, Enemy } from './game.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { dormant } from './stasis.ts';
import { primaryGunShot } from './spoof.ts';
import { hazardBounds } from './hazard-layouts.ts';
import type { Prop } from './props.ts';

const { Body } = Matter;
export const EXPERIMENTAL_WEAPONS = {
  bellowsRange: 240,
  bellowsHalfAngle: 0.48,
  bellowsChargeTime: 0.7,
  bellowsScrapCap: 4,
  debtCap: 24,
  switchLife: 1.1,
  switchSpeed: 8.4,
  switchRange: 420,
  switchContactSlop: 0.2,
} as const;
export type ExperimentalWeapon = 'bellows' | 'debt-collector' | 'switchjack';
export type SwitchjackLandingReason =
  | 'ready'
  | 'too-close'
  | 'out-of-range'
  | 'boundary'
  | 'crusher'
  | 'obstructed';
export interface SwitchjackLandingPreview {
  readonly from: Vec;
  readonly to: Vec;
  readonly half: Vec;
  /** Safe for the next distinct press; needsRelease describes its trigger gesture. */
  readonly ready: boolean;
  readonly reason: SwitchjackLandingReason;
  readonly remainingLife: number;
  readonly distance: number;
  /** Recovery for launching the next bolt, never a restriction on taking this jump. */
  readonly launchCooldown: number;
  readonly needsRelease: boolean;
}
const LIGHT_ENEMIES = new Set(['runner', 'shooter', 'flyer', 'hopper', 'caller', 'switchman']);

/** Native Matter contacts rest a fraction of a unit inside a supporting face.
 * Permit only that shallow contact while departing or sliding along its face;
 * moving into it, a deep overlap, and every other solid retain the full hull. */
function departingContact(from: Vec, to: Vec, half: Vec, body: Matter.Body) {
  const axes: Vec[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  for (let i = 0; i < body.vertices.length; i++) {
    const a = body.vertices[i],
      b = body.vertices[(i + 1) % body.vertices.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length > 0) axes.push({ x: -(b.y - a.y) / length, y: (b.x - a.x) / length });
  }
  for (const axis of axes) {
    const projections = body.vertices.map((p) => p.x * axis.x + p.y * axis.y);
    const radius = half.x * Math.abs(axis.x) + half.y * Math.abs(axis.y);
    const low = Math.min(...projections) - radius,
      high = Math.max(...projections) + radius;
    const start = from.x * axis.x + from.y * axis.y;
    const delta = (to.x - from.x) * axis.x + (to.y - from.y) * axis.y;
    if (start >= low && start - low <= EXPERIMENTAL_WEAPONS.switchContactSlop && delta <= 0)
      return true;
    if (start <= high && high - start <= EXPERIMENTAL_WEAPONS.switchContactSlop && delta >= 0)
      return true;
  }
  return false;
}

/** Bounded native trigger mechanisms. Only durable weapon identity is saved;
 * pressure, recoil debt and the live beacon belong to the current combat room. */
export class ExperimentalWeapons {
  readonly game: Game;
  private held = false;
  private waitRelease = false;
  private charge = 0;
  private scrap = 0;
  private reserve = 0;
  private nextVent = -1;
  private releasePower = 1;
  private releaseCharge = 0;
  private liveBolt: Shot | null = null;
  private boltUntil = -1;
  private lastKind: ExperimentalWeapon | null = null;
  private blockedUntil = -1;
  private lastVentDirection: Vec | null = null;
  private pulls = new Map<Matter.Body, { force: number; enemy?: Enemy; prop?: Prop }>();
  /** Simulation-clock expiry, so paused indicators do not animate. */
  flash = -1;

  constructor(game: Game) {
    this.game = game;
  }
  get kind(): ExperimentalWeapon | null {
    const g = this.game;
    if (g.startingGun === 'debt-collector') return 'debt-collector';
    // Beam, seeker and stasis conversions explicitly replace this trigger / live bolt.
    // They cannot leave an invisible beacon or a stored release behind.
    if (
      g.torch.equipped ||
      g.shiftMorphs.equipped === 'seeker-rack' ||
      g.mods.includes('suspension')
    )
      return null;
    return g.startingGun === 'bellows' || g.startingGun === 'switchjack' ? g.startingGun : null;
  }
  get pressure() {
    return this.charge;
  }
  get scrapCount() {
    return this.scrap;
  }
  get debt() {
    return this.reserve / EXPERIMENTAL_WEAPONS.debtCap;
  }
  get bolt(): Shot | null {
    const s = this.liveBolt;
    return s && this.validBolt(s) ? s : null;
  }
  get holding() {
    return this.held && !this.waitRelease;
  }
  /** Live geometry only: reading a preview never spends or changes a bolt. */
  get landingPreview(): SwitchjackLandingPreview | null {
    const s = this.bolt;
    return s ? this.previewLanding(s) : null;
  }
  /** A failed-press pulse follows live safety and cannot leave a stale red state. */
  get blocked() {
    if (this.game.time >= this.blockedUntil) return false;
    const preview = this.landingPreview;
    return preview !== null && !preview.ready;
  }
  /** Actual paid kick, rather than the player's possibly changed current aim. */
  get ventDirection(): Vec | null {
    return this.kind === 'debt-collector' && this.game.time < this.flash && this.lastVentDirection
      ? { ...this.lastVentDirection }
      : null;
  }
  private get active() {
    const g = this.game;
    return (
      g.mode === 'playing' &&
      g.hp > 0 &&
      !g.shutdown.complete &&
      g.escape?.phase !== 'extracting' &&
      !g.finale.safe
    );
  }
  private aim() {
    const d = direction(this.game.player.position, this.game.aim);
    return d.x || d.y ? d : { x: 1, y: 0 };
  }
  reset() {
    if (this.game.startingGun === 'bellows' || this.game.startingGun === 'switchjack')
      this.game.fireBuffer = 0;
    if (this.liveBolt) this.liveBolt.life = 0;
    this.liveBolt = null;
    this.boltUntil = -1;
    this.held = this.waitRelease = false;
    this.charge = this.scrap = this.reserve = 0;
    this.nextVent = -1;
    this.releasePower = 1;
    this.releaseCharge = 0;
    this.blockedUntil = -1;
    this.lastVentDirection = null;
    this.flash = -1;
    this.lastKind = this.kind;
    this.pulls.clear();
  }
  pause() {
    const g = this.game;
    if (
      g.startingGun === 'bellows' ||
      g.startingGun === 'debt-collector' ||
      g.startingGun === 'switchjack'
    )
      g.torch.stop();
    this.reset();
    // A held button when returning from a menu is not a new trigger press.
    this.waitRelease = true;
  }
  private changedKind() {
    if (this.kind !== this.lastKind) this.reset();
  }
  input(dt: number, input: Input, rawFire = input.fire): boolean {
    this.pulls.clear();
    this.changedKind();
    const kind = this.kind;
    if (!kind) return false;
    if (!this.active || !Number.isFinite(dt) || dt <= 0) return true;
    const g = this.game;
    const trigger = kind === 'debt-collector' ? rawFire : input.fire;
    if (this.waitRelease) {
      this.held = trigger;
      if (!trigger) {
        this.waitRelease = false;
        this.held = false;
      }
      g.fireBuffer = 0;
      return true;
    }
    // Game.tick preserves brief press edges across impact hit-stop. Consume
    // that existing buffer once instead of dropping a tap before this controller runs.
    const bufferedPress = kind !== 'debt-collector' && g.fireBuffer > 0;
    const pressed = !!input.firePressed || bufferedPress || (trigger && !this.held);
    const released = this.held && !trigger;
    this.held = trigger;
    this.update();

    if (kind === 'debt-collector') {
      if (
        (!rawFire && !input.fire && this.reserve > 0 && g.burstRemaining === 0) ||
        (this.reserve >= EXPERIMENTAL_WEAPONS.debtCap && g.time >= this.nextVent)
      )
        this.vent();
      return false;
    }
    g.fireBuffer = 0;
    if (kind === 'switchjack' && pressed && this.bolt) {
      this.blockedUntil = -1;
      this.jumpToBolt();
      return true;
    }
    // A released Bellows salvo and a Switchjack salvo keep real Burst timings.
    if (g.burstRemaining > 0) {
      if (g.time >= g.burstAt) {
        g.burstRemaining--;
        g.burstAt = g.time + g.gun.interval * 0.3;
        g.fireRound();
      }
      return true;
    }
    if (kind === 'switchjack') {
      if (pressed) {
        this.blockedUntil = -1;
        if (this.bolt) this.jumpToBolt();
        else if (g.time >= g.shootAt) g.fire();
      }
      return true;
    }
    // A fast click still produces a useful low-pressure blast. Holding adds
    // power and suction, including while the previous blast cycles. Releasing
    // too early cancels that pressure rather than scheduling a surprise kick.
    if (input.fire || pressed) {
      if (this.charge === 0) g.onSound('bellows-inhale');
      const beforeCharge = this.charge;
      this.charge = clamp(
        this.charge + Math.min(dt, 1 / 20) / EXPERIMENTAL_WEAPONS.bellowsChargeTime,
        0.12,
        1,
      );
      if (beforeCharge < 1 && this.charge === 1) g.onSound('bellows-ready');
      this.intake(Math.min(dt, 1 / 20));
    }
    if (g.time < g.shootAt) {
      if (released || (pressed && !input.fire)) this.charge = 0;
      return true;
    }
    if ((released || (pressed && !input.fire)) && this.charge > 0) {
      this.releaseCharge = this.charge;
      this.releasePower = 0.65 + this.charge * 0.6 + this.scrap * 0.1;
      this.flash = g.time + 0.16;
      g.fire();
      this.charge = this.scrap = 0;
    }
    return true;
  }
  private intake(dt: number) {
    const g = this.game,
      origin = g.player.position,
      d = this.aim();
    const inCone = (p: Vec, ignore?: Prop) => {
      const length = distance(origin, p),
        toward = direction(origin, p);
      return (
        length > 1 &&
        length <= EXPERIMENTAL_WEAPONS.bellowsRange &&
        toward.x * d.x + toward.y * d.y >= Math.cos(EXPERIMENTAL_WEAPONS.bellowsHalfAngle) &&
        distance(g.lineEnd(origin, p, 0, ignore), p) < 0.1
      );
    };
    for (const e of g.enemies) {
      if (
        e.hp <= 0 ||
        e.spawn > 0 ||
        e.allied ||
        e.eventRole ||
        e.recoilTarget !== undefined ||
        !LIGHT_ENEMIES.has(e.kind) ||
        e.body.isStatic ||
        !inCone(e.body.position)
      )
        continue;
      this.pulls.set(e.body, { force: 0.1 * dt * 60, enemy: e });
    }
    for (const prop of [...g.props.items]) {
      if (
        !['rubble', 'crate'].includes(prop.kind) ||
        prop.body.isStatic ||
        prop.hunt ||
        prop.uprising ||
        prop.welded ||
        prop.auditCase ||
        prop.charge ||
        !inCone(prop.body.position, prop)
      )
        continue;
      if (
        prop.kind === 'rubble' &&
        distance(origin, prop.body.position) <= 45 &&
        this.scrap < EXPERIMENTAL_WEAPONS.bellowsScrapCap
      ) {
        this.scrap++;
        g.props.remove(prop);
        this.flash = g.time + 0.08;
      } else this.pulls.set(prop.body, { force: 0.16 * dt * 60, prop });
    }
    const v = g.player.velocity,
      tug = 0.035 * dt * 60;
    Body.setVelocity(g.player, {
      x: clamp(v.x + d.x * tug, -23, 23),
      y: clamp(v.y + d.y * tug, -21, 20),
    });
  }
  /** Enemy steering owns its native velocity earlier in the tick. Pay intake
   * after that steering, immediately before Matter integrates the actual body. */
  beforePhysics() {
    const g = this.game;
    if (this.kind !== 'bellows' || !this.active) {
      this.pulls.clear();
      return;
    }
    const origin = g.player.position,
      aim = this.aim();
    for (const [body, pull] of this.pulls) {
      if (
        body.isStatic ||
        (pull.enemy &&
          (!g.enemies.includes(pull.enemy) ||
            pull.enemy.hp <= 0 ||
            pull.enemy.spawn > 0 ||
            pull.enemy.allied ||
            pull.enemy.eventRole ||
            pull.enemy.recoilTarget !== undefined ||
            !LIGHT_ENEMIES.has(pull.enemy.kind))) ||
        (pull.prop &&
          (!g.props.items.includes(pull.prop) ||
            pull.prop.hunt ||
            pull.prop.uprising ||
            pull.prop.welded ||
            pull.prop.auditCase ||
            pull.prop.charge))
      )
        continue;
      const span = distance(origin, body.position),
        d = direction(origin, body.position);
      if (
        span > EXPERIMENTAL_WEAPONS.bellowsRange ||
        d.x * aim.x + d.y * aim.y < Math.cos(EXPERIMENTAL_WEAPONS.bellowsHalfAngle) ||
        distance(g.lineEnd(origin, body.position, 0, pull.prop), body.position) >= 0.1
      )
        continue;
      const v = body.velocity,
        limit = pull.enemy ? 12 : 18;
      Body.setVelocity(body, {
        x: clamp(v.x - d.x * pull.force, -limit, limit),
        y: clamp(v.y - d.y * pull.force, -limit, limit),
      });
    }
    this.pulls.clear();
  }
  /** Return true only when the native kick was banked rather than applied. */
  captureRecoil(_d: Vec, impulse: number): boolean {
    this.changedKind();
    if (
      this.kind !== 'debt-collector' ||
      !this.active ||
      this.waitRelease ||
      !Number.isFinite(impulse) ||
      impulse < 0
    )
      return false;
    const beforeReserve = this.reserve;
    this.reserve = Math.min(EXPERIMENTAL_WEAPONS.debtCap, this.reserve + impulse);
    const warning = EXPERIMENTAL_WEAPONS.debtCap * 0.8;
    const autoVent =
      this.reserve >= EXPERIMENTAL_WEAPONS.debtCap && this.game.time >= this.nextVent;
    if (beforeReserve < warning && this.reserve >= warning && !autoVent)
      this.game.onSound('debt-warning');
    if (autoVent) this.vent();
    return true;
  }
  private vent() {
    const g = this.game;
    if (!this.active || this.reserve <= 0) return;
    const impulse = this.reserve,
      d = this.aim(),
      beforeVelocity = { ...g.player.velocity };
    this.reserve = 0;
    this.nextVent = g.time + 0.16;
    const delta = g.shiftUpgrades.recoilDelta(d, impulse);
    Body.setVelocity(g.player, {
      x: clamp(g.player.velocity.x + delta.x, -23, 23),
      y: clamp(g.player.velocity.y + delta.y, -21, 20),
    });
    const paid = {
      x: g.player.velocity.x - beforeVelocity.x,
      y: g.player.velocity.y - beforeVelocity.y,
    };
    this.lastVentDirection =
      Math.hypot(paid.x, paid.y) > 1e-8 ? direction({ x: 0, y: 0 }, paid) : null;
    g.commendations.mastery.recoiled(beforeVelocity.y - g.player.velocity.y);
    g.salvage.launch(d, impulse);
    g.feedback(2.4, d);
    g.onHaptic('shot', Math.min(1, impulse / EXPERIMENTAL_WEAPONS.debtCap));
    g.onSound('debt-vent');
    this.flash = g.time + 0.2;
  }
  afterDischarge(beforeId: number) {
    const kind = this.kind,
      g = this.game;
    const shots = g.shots.filter((s) => s.id > beforeId && primaryGunShot(s));
    if (kind === 'bellows') {
      const range = 210 + this.releaseCharge * 80;
      for (const s of shots) {
        s.damage *= this.releasePower;
        if (s.shell) s.shell.damage *= this.releasePower;
        const speed = Math.hypot(s.vel.x, s.vel.y);
        if (speed > 0) s.life = Math.min(s.life, range / (speed * 60));
      }
    } else if (kind === 'switchjack' && !this.bolt && g.burstRemaining === g.gun.burstCount - 1) {
      const d = this.aim();
      const s = shots
        .filter((s) => !dormant(s) && !s.meltTransit)
        .sort((a, b) => {
          const da = direction({ x: 0, y: 0 }, a.vel),
            db = direction({ x: 0, y: 0 }, b.vel);
          return db.x * d.x + db.y * d.y - (da.x * d.x + da.y * d.y) || a.id - b.id;
        })[0];
      if (!s) return;
      this.liveBolt = s;
      this.boltUntil = g.time + EXPERIMENTAL_WEAPONS.switchLife;
      // The native gun profile already supplies the slow bolt. Keep its real
      // velocity so earned speed fittings and ammunition conversions still work.
      s.life = Math.min(s.life, EXPERIMENTAL_WEAPONS.switchLife);
      this.flash = g.time + 0.09;
    }
  }
  private validBolt(s: Shot) {
    return (
      this.kind === 'switchjack' &&
      this.active &&
      s.life > 0 &&
      this.game.time < this.boltUntil &&
      this.game.shots.includes(s) &&
      !s.hits.size &&
      !s.banks &&
      !dormant(s) &&
      !s.meltTransit &&
      !s.recall?.returning &&
      Number.isFinite(s.pos.x) &&
      Number.isFinite(s.pos.y)
    );
  }
  update() {
    this.changedKind();
    if (this.liveBolt && !this.validBolt(this.liveBolt)) {
      this.liveBolt = null;
      this.blockedUntil = -1;
    }
  }
  private previewLanding(s: Shot): SwitchjackLandingPreview {
    const g = this.game;
    const from = { ...g.player.position },
      to = { ...s.pos };
    const half = {
      x: Math.max(...g.player.vertices.map((v) => Math.abs(v.x - from.x))),
      y: Math.max(...g.player.vertices.map((v) => Math.abs(v.y - from.y))),
    };
    const bodies = [
      ...g.solidBodies,
      ...g.enemies.filter((e) => e.hp > 0 && e.spawn <= 0).map((e) => e.body),
      ...g.enemies.flatMap((e) => (e.crane && e.hp > 0 ? [e.crane.body] : [])),
      ...g.areaEvents.allies.filter((e) => e.hp > 0).map((e) => e.body),
      ...g.factions.allies.filter((e) => e.hp > 0).map((e) => e.body),
    ];
    const hazard = g.hazards.items.some((h) => {
      if (!h.visible || h.kind !== 'crusher') return false;
      const box = hazardBounds(h.placement);
      return (
        to.x + half.x > box.x &&
        to.x - half.x < box.x + box.w &&
        to.y + half.y > box.y &&
        to.y - half.y < box.y + box.h
      );
    });
    const span = distance(from, to);
    let reason: SwitchjackLandingReason = 'ready';
    if (span < 10) reason = 'too-close';
    else if (span > EXPERIMENTAL_WEAPONS.switchRange) reason = 'out-of-range';
    else if (
      to.x < half.x ||
      to.x > g.worldWidth - half.x ||
      to.y < g.worldTop + half.y ||
      to.y > 740 - half.y
    )
      reason = 'boundary';
    else if (hazard) reason = 'crusher';
    else if (
      firstSolid(
        from,
        to,
        half,
        bodies.filter((body) => !departingContact(from, to, half, body)),
      )
    )
      reason = 'obstructed';
    return {
      from,
      to,
      half,
      ready: reason === 'ready',
      reason,
      remainingLife: Math.max(0, Math.min(s.life, this.boltUntil - g.time)),
      distance: span,
      launchCooldown: Math.max(0, g.shootAt - g.time),
      needsRelease: this.held || this.waitRelease,
    };
  }
  private jumpToBolt() {
    const g = this.game,
      s = this.bolt,
      preview = this.landingPreview;
    if (!s || !preview) return;
    if (!preview.ready) {
      this.blockedUntil = g.time + 0.2;
      this.flash = g.time + 0.2;
      g.onSound('switchjack-blocked');
      return;
    }
    const { from, to } = preview;
    s.life = 0;
    this.liveBolt = null;
    const velocity = { ...g.player.velocity };
    g.grapnel.detach();
    g.stasis.teleported();
    g.harpoons.disrupt(g.player);
    g.tethers.disrupt(g.player);
    g.magnets.release(g.player);
    g.fabricators.disrupt(g.player);
    g.sappers.disrupt(g.player);
    Body.setPosition(g.player, to);
    Body.setVelocity(g.player, velocity);
    g.tripwires.teleported(g.player);
    g.fusions.storm.teleported(g.player);
    const warmStart = (g.player as Matter.Body & { positionImpulse: Vec }).positionImpulse;
    warmStart.x = warmStart.y = 0;
    g.trail = [];
    g.grounded = false;
    g.coyote = 0;
    g.jumpCut = true;
    g.landingSpeed = 0;
    g.feedback(1.4);
    g.burst(from, 5, '#81dcdf', 1.2);
    g.burst(to, 7, '#81dcdf', 1.8);
    g.onSound('switchjack-jump');
    this.blockedUntil = -1;
    this.flash = g.time + 0.18;
  }
}
