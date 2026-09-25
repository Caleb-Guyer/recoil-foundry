import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import { clamp, direction, distance, segmentBox, type Vec } from './rules.ts';
import { ANNEX_JUNCTION, ANNEX_PORT, annexPoint } from './annex-layout.ts';

const { Body } = Matter;
export const TRANSMISSION = { tell: 1.8, lock: 0.65, cooldown: 2.4, feedback: 42, half: 17 };
export interface Transmission {
  owner: Enemy;
  phase: 'charging' | 'cooldown';
  at: number;
  aim: Vec;
  interrupted: boolean;
}
export class AnnexSystem {
  transmission: Transmission | null = null;
  readyAt = 0;
  interruptedAt = -100;
  interruptions = 0;
  volleys = 0;
  readonly game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  get active() {
    return !!this.game.level?.annex;
  }
  point(p: Vec) {
    return annexPoint(!!this.game.level?.mirrored, p);
  }
  get junction() {
    return this.game.level.annexStation?.junction ?? this.point(ANNEX_JUNCTION);
  }
  get port() {
    return this.game.level.annexStation?.port ?? this.point(ANNEX_PORT);
  }
  clear() {
    this.transmission = null;
    this.readyAt = 0;
    this.interruptedAt = -100;
    this.interruptions = this.volleys = 0;
  }
  reset() {
    this.clear();
    this.readyAt = this.game.time + 2.4;
  }
  valid(t: Transmission) {
    const g = this.game;
    return t.owner.hp > 0 && (t.owner.allied ? g.factions.allies : g.enemies).includes(t.owner);
  }
  update() {
    const g = this.game;
    if (!this.active || g.mode !== 'playing') return;
    const t = this.transmission;
    if (t && !this.valid(t)) {
      this.transmission = null;
      this.readyAt = g.time + 1.2;
      return;
    }
    if (!g.combatEnemyCount) {
      this.transmission = null;
      return;
    }
    if (!t) {
      if (g.time < this.readyAt) return;
      const owner = [...g.enemies, ...g.factions.allies].find(
        (e) => e.kind === 'switchman' && e.spawn <= 0,
      );
      if (!owner) return;
      this.transmission = {
        owner,
        phase: 'charging',
        at: g.time + TRANSMISSION.tell,
        aim: direction(this.port, g.factions.combatTarget(owner)),
        interrupted: false,
      };
      g.onSound('aim-warn');
      return;
    }
    if (t.phase === 'cooldown') {
      if (g.time >= t.at) {
        this.transmission = null;
        this.readyAt = g.time + 0.25;
      }
      return;
    }
    if (t.at - g.time > TRANSMISSION.lock)
      t.aim = direction(this.port, g.factions.combatTarget(t.owner));
    if (g.time < t.at) return;
    const angle = Math.atan2(t.aim.y, t.aim.x);
    for (const offset of [-0.12, 0, 0.12]) g.enemyShot(t.owner, angle + offset, 8.3, 15, this.port);
    this.volleys++;
    t.phase = 'cooldown';
    t.at = g.time + TRANSMISSION.cooldown;
    g.onSound('enemy');
  }
  trace(from: Vec, to: Vec, radius = 0) {
    const t = this.transmission;
    if (!this.active || !t || t.phase !== 'charging' || t.owner.allied || !this.valid(t))
      return null;
    const p = this.junction,
      h = TRANSMISSION.half + radius;
    return segmentBox(from, to, { x: p.x - h, y: p.y - h }, { x: p.x + h, y: p.y + h });
  }
  interrupt() {
    const g = this.game,
      t = this.transmission;
    if (
      !this.active ||
      g.mode !== 'playing' ||
      !t ||
      t.phase !== 'charging' ||
      t.owner.allied ||
      !this.valid(t)
    )
      return false;
    t.phase = 'cooldown';
    t.at = g.time + TRANSMISSION.cooldown;
    t.interrupted = true;
    this.interruptedAt = g.time;
    this.interruptions++;
    // Feedback is deliberately outside gun provenance: it cannot reboot a sender.
    g.hitEnemy(t.owner, TRANSMISSION.feedback, this.junction, true, false);
    g.burst(this.junction, 12, '#e8bb76', 2.8);
    g.onSound('armor');
    return true;
  }
  blast(pos: Vec, radius: number, cone: (p: Vec) => boolean) {
    if (!this.active || this.transmission?.phase !== 'charging') return;
    if (
      distance(pos, this.junction) <= radius &&
      cone(this.junction) &&
      distance(this.game.lineEnd(pos, this.junction), this.junction) < 0.1
    )
      this.interrupt();
  }
  updateSwitchman(e: Enemy, dt: number) {
    const g = this.game,
      p = e.body.position,
      target = g.factions.combatTarget(e);
    const d = direction(p, target);
    if (e.timer > 0.55) e.aim = d;
    if (e.timer <= 0.55 && e.timer + dt > 0.55) g.onSound('aim-warn');
    if (e.timer <= 0) {
      if (distance(g.lineEnd(p, target, 5), target) < 1 && distance(p, target) < 1200) {
        g.enemyShot(e, Math.atan2(e.aim.y, e.aim.x), 8.5, 12);
        g.onSound('enemy');
      }
      e.timer = 1.65;
      e.attacks++;
    }
    // Patrol the clear bay; Matter resolves props, bodies and ledges normally.
    const canonical = g.level.mirrored ? 2000 - p.x : p.x;
    const patrol = g.level.annexStation?.patrol ?? [1190, 1410];
    const destination = patrol[e.attacks % 2];
    const dx = (destination - canonical) * (g.level.mirrored ? -1 : 1);
    Body.setVelocity(e.body, {
      x: e.timer <= 0.55 ? 0 : clamp(dx * 0.025, -1.7, 1.7),
      y: e.body.velocity.y,
    });
    e.facing = Math.sign(e.aim.x) || e.facing;
  }
}
