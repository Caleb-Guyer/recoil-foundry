import Matter from 'matter-js';
import type { Game, Input } from './game.ts';
import { isBoss } from './enemies.ts';
import { closestBlastPoint } from './demolition.ts';
import { clamp, distance, type Vec } from './rules.ts';
import { isMeleeWeapon, type MeleeWeapon } from './starting-guns.ts';
import type { Prop } from './props.ts';

interface Swing {
  weapon: MeleeWeapon;
  aim: Vec;
  reach: number;
  halfAngle: number;
  damage: number;
  until: number;
  struck: Set<Matter.Body>;
  parried: boolean;
  triggered: boolean;
  sampledAt: number;
}

export class MeleeCombat {
  private readonly game: Game;
  private swing: Swing | null = null;
  private held = false;
  private waitRelease = false;
  private riposte = false;
  charge = 0;

  constructor(game: Game) {
    this.game = game;
  }
  reset(waitRelease = false) {
    this.swing = null;
    this.held = this.riposte = false;
    this.waitRelease = waitRelease;
    this.charge = 0;
  }
  input(dt: number, input: Input) {
    const g = this.game;
    if (!isMeleeWeapon(g.startingGun)) return false;
    const buffered = g.fireBuffer > 0;
    g.fireBuffer = 0;
    if (this.waitRelease) {
      if (!input.fire) this.waitRelease = false;
      return true;
    }
    if (g.startingGun === 'spear') {
      if (input.fire) {
        this.held = true;
        this.charge = Math.min(1, this.charge + dt / (g.mods.includes('quick-wind') ? 0.35 : 0.7));
      } else if (this.held || buffered) {
        if (g.time >= g.shootAt) g.fire();
        this.held = false;
        this.charge = 0;
      }
    } else if ((input.fire || buffered) && g.time >= g.shootAt) g.fire();
    return true;
  }
  start(weapon: MeleeWeapon, aim: Vec, damage: number) {
    const g = this.game;
    const wide = weapon === 'hammer' && g.mods.includes('sweeping-face');
    const deep = weapon === 'spear' && g.mods.includes('deep-drive');
    const reach =
      weapon === 'katana'
        ? 91
        : weapon === 'hammer'
          ? 91 + (wide ? 32 : 0)
          : 102 + this.charge * (deep ? 78 : 40);
    const duration =
      weapon === 'katana'
        ? g.mods.includes('wide-guard')
          ? 0.22
          : 0.1
        : weapon === 'hammer'
          ? 0.13
          : 0.09 + 0.09 * this.charge;
    this.swing = {
      weapon,
      aim: { ...aim },
      reach,
      halfAngle: weapon === 'katana' ? 0.96 : weapon === 'hammer' ? (wide ? 1.46 : 1.1) : 0.33,
      damage:
        damage *
        (weapon === 'spear' ? 1 + this.charge * 0.9 : 1) *
        (deep ? 1 + this.charge * 0.4 : 1) *
        (weapon === 'katana' && this.riposte ? 1.75 : 1),
      until: g.time + duration,
      struck: new Set(),
      parried: false,
      triggered: false,
      sampledAt: -Infinity,
    };
    this.riposte = false;
    this.update();
  }
  update() {
    const g = this.game,
      swing = this.swing;
    if (!swing) return;
    if (g.time > swing.until || g.mode !== 'playing' || g.hp <= 0 || g.finale.safe) {
      this.swing = null;
      return;
    }
    if (swing.sampledAt === g.time) return;
    swing.sampledAt = g.time;
    const origin = g.player.position,
      d = swing.aim;
    const inside = (point: Vec) => {
      const span = distance(origin, point);
      return (
        span <= swing.reach &&
        (span < 1 ||
          (point.x - origin.x) * d.x + (point.y - origin.y) * d.y >=
            Math.cos(swing.halfAngle) * span)
      );
    };
    const reaches = (body: Matter.Body, ignore?: Prop | Matter.Body) => {
      if (swing.struck.has(body)) return false;
      const point = closestBlastPoint(origin, body);
      return inside(point) && distance(g.lineEnd(origin, point, 0, ignore), point) < 0.1;
    };
    // Snapshot every exposed contact before breaking cover. The same stroke
    // cannot pass through an intact wall to hit a target on this frame.
    const enemies = g.enemies.filter(
      (e) => e.hp > 0 && !e.allied && e.spawn <= 0 && reaches(e.body),
    );
    const props = g.props.items.filter((p) => p.hp > 0 && reaches(p.body, p));
    const pieces = g.destruction.pieces.filter((p) => reaches(p.body, p.body));
    const end = g.lineEnd(origin, {
      x: origin.x + d.x * swing.reach,
      y: origin.y + d.y * swing.reach,
    });
    if (!swing.triggered) {
      const disconnect = g.shutdown.trace(origin, end, 2);
      const junction = g.annex.trace(origin, end, 2);
      const flood = g.floodgate.trace(origin, end, 2);
      const pressure = g.pressure.trace(origin, end, 2);
      const sorting = g.sortingPit.trace(origin, end, 2);
      if (disconnect) g.shutdown.trigger();
      if (junction) g.annex.interrupt(junction.slot);
      if (flood) g.floodgate.trigger(flood.valve);
      if (pressure) g.pressure.trigger(pressure.vent);
      if (sorting) g.sortingPit.trigger();
      swing.triggered = !!(disconnect || junction || flood || pressure || sorting);
      if (g.mode !== 'playing' || g.shutdown.complete) return;
    }
    const cable = g.cargo.trace(origin, end, 2);
    if (cable && !swing.struck.has(cable.prop.body)) {
      swing.struck.add(cable.prop.body);
      g.cargo.cut(cable.prop, swing.damage);
    }
    const anchor = g.harpoons.trace(origin, end, 2);
    if (anchor && !swing.struck.has(anchor.enemy.body)) {
      swing.struck.add(anchor.enemy.body);
      g.harpoons.hitAnchor(anchor.enemy, swing.damage);
    }
    for (const e of enemies) {
      swing.struck.add(e.body);
      const previousHp = e.hp;
      const damage = g.gun.execute && e.hp < e.maxHp * 0.3 ? 1.6 * swing.damage : swing.damage;
      g.hitEnemy(e, damage, origin);
      if (g.finale.safe || g.mode !== 'playing') return;
      g.spoof.hit(e, previousHp, true);
      if (swing.weapon === 'hammer' && e.hp > 0 && !e.body.isStatic) {
        const push =
          (g.mods.includes('counterweight-head') ? 16 : 10) * (isBoss(e.kind) ? 0.22 : 1);
        Matter.Body.setVelocity(e.body, {
          x: clamp(e.body.velocity.x + d.x * push, -22, 22),
          y: clamp(e.body.velocity.y + d.y * push - 2, -18, 18),
        });
      }
    }
    const impulse = { x: d.x * 12, y: d.y * 12 };
    for (const p of props) {
      if (swing.struck.has(p.body)) continue;
      swing.struck.add(p.body);
      g.props.hit(p, swing.damage, impulse, undefined, true);
    }
    for (const p of pieces) {
      swing.struck.add(p.body);
      g.destruction.hitBody(p.body, swing.damage, impulse);
    }
    if (swing.weapon === 'katana' && !swing.parried) {
      for (const shot of g.shots) {
        if (
          shot.friendly ||
          !inside(shot.pos) ||
          distance(g.lineEnd(origin, shot.pos), shot.pos) >= 0.1
        )
          continue;
        if ((shot.pos.x - origin.x) * shot.vel.x + (shot.pos.y - origin.y) * shot.vel.y >= 0)
          continue;
        if (!g.ballistics.parryRound(shot, { ...shot.pos })) continue;
        swing.parried = true;
        this.riposte = g.mods.includes('riposte-edge');
        break;
      }
    }
  }
}
