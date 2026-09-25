import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { EnemyKind } from './levels.ts';
import { distance, type Vec } from './rules.ts';

const { Body, Composite, Query } = Matter;
// Shared by Turf War and Spoof: targeting, contact and hostile damage have one owner.
export class FactionSystem {
  allies: Enemy[] = [];
  departingAt: number | null = null;
  contactAt = new Map<number, number>();
  readonly game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  clear() {
    for (const e of this.allies) Composite.remove(this.game.engine.world, e.body);
    this.allies = [];
    this.departingAt = null;
    this.contactAt.clear();
  }
  spawn(kind: EnemyKind, p: Vec) {
    const g = this.game,
      ally = g.spawnEnemy(kind, p.x, p.y);
    if (!ally) return;
    g.enemies = g.enemies.filter((e) => e !== ally);
    ally.allied = true;
    ally.aim = { x: 1, y: 0 };
    this.allies.push(ally);
    return ally;
  }
  beforeStep(dt: number) {
    const g = this.game;
    for (const e of [...this.allies]) {
      if (e.rebootUntil !== undefined && g.time >= e.rebootUntil) {
        g.burst(e.body.position, 9, '#7cbfff', 2);
        this.removeAlly(e);
      } else if (this.departingAt !== null) {
        if (e.body.isStatic) Body.setStatic(e.body, false);
        if (e.kind === 'flyer')
          Body.applyForce(e.body, e.body.position, { x: 0, y: -e.body.mass * 0.001 });
        Body.setVelocity(e.body, { x: -4, y: e.kind === 'flyer' ? -5 : e.body.velocity.y });
        if (e.body.position.x < 28 || e.body.position.y < 28 || g.time - this.departingAt > 3)
          this.removeAlly(e);
      } else g.updateEnemy(e, dt);
    }
  }
  contact(e: Enemy) {
    if (
      !this.allies.length ||
      this.departingAt !== null ||
      this.game.time < (this.contactAt.get(e.id) ?? 0)
    )
      return;
    const g = this.game;
    const other = (e.allied ? g.enemies : this.allies).find(
      (a) => a.hp > 0 && a.spawn <= 0 && Query.collides(e.body, [a.body]).length,
    );
    if (!other) return;
    this.contactAt.set(e.id, g.time + 0.65);
    if (other.allied) this.hitAlly(other, e.splitChild ? 9 : 15);
    else g.hitEnemy(other, 15, e.body.position, true, false, false);
  }
  combatTarget(e: Enemy): Vec {
    const g = this.game;
    if (e.allied) {
      const live = g.enemies.filter((a) => a.hp > 0 && a.spawn <= 0);
      const visible = live.filter(
        (a) => distance(g.lineEnd(e.body.position, a.body.position), a.body.position) < 1,
      );
      return (
        [...(visible.length ? visible : live)].sort(
          (a, b) =>
            distance(e.body.position, a.body.position) - distance(e.body.position, b.body.position),
        )[0]?.body.position ?? e.body.position
      );
    }
    if (
      !this.allies.length ||
      e.squad ||
      e.elite ||
      !['runner', 'flyer', 'shooter', 'switchman'].includes(e.kind)
    )
      return g.player.position;
    // Ordinary gunmen return fire at closer, visible blue combatants. Other
    // enemy archetypes keep their authored player-facing attacks and tells.
    let target = g.player.position,
      nearest = distance(e.body.position, target);
    for (const ally of this.allies) {
      const p = ally.body.position,
        d = distance(e.body.position, p);
      if (
        ally.spawn <= 0 &&
        ally.hp > 0 &&
        d < nearest &&
        distance(g.lineEnd(e.body.position, p), p) < 1
      ) {
        target = p;
        nearest = d;
      }
    }
    return target;
  }
  removeAlly(e: Enemy) {
    Composite.remove(this.game.engine.world, e.body);
    this.allies = this.allies.filter((a) => a !== e);
    this.contactAt.delete(e.id);
  }
  hitAlly(e: Enemy, damage: number) {
    if (!this.allies.includes(e) || e.spawn > 0 || this.departingAt !== null) return;
    e.hp -= damage;
    e.flash = 0.08;
    if (e.hp <= 0) {
      this.game.burst(e.body.position, 12, '#7cbfff', 3);
      this.removeAlly(e);
    }
  }
}
