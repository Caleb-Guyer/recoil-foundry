import type Matter from 'matter-js';
import type { Game } from './game.ts';
import { firstSolid } from './collisions.ts';
import { isBoss } from './enemies.ts';

export interface ConductorPlacement {
  x: number;
  width: number;
}
export interface StormLane extends ConductorPlacement {
  depths: number[];
}
export const STORM = {
  ready: 3.5,
  rest: 3.2,
  warn: 1.5,
  afterglow: 0.22,
  player: 22,
  enemy: 220,
  boss: 120,
  columns: 9,
  top: 8,
  floor: 740,
};

export class StormfrontSystem {
  game: Game;
  items: StormLane[] = [];
  phase: 'rest' | 'warn' | 'strike' = 'rest';
  timer = STORM.ready;
  index = 0;
  constructor(game: Game) {
    this.game = game;
  }
  clear() {
    this.items = [];
    this.phase = 'rest';
    this.timer = STORM.ready;
    this.index = 0;
  }
  reset() {
    this.clear();
    this.items = (this.game.level.conductors ?? []).map((p) => ({ ...p, depths: [] }));
  }
  column(lane: ConductorPlacement, i: number) {
    const width = lane.width / STORM.columns;
    return { x: lane.x - lane.width / 2 + width * (i + 0.5), half: width / 2 };
  }
  depth(lane: ConductorPlacement, i: number, bodies = this.game.solidBodies) {
    const col = this.column(lane, i);
    const hit = firstSolid(
      { x: col.x, y: STORM.top },
      { x: col.x, y: STORM.floor },
      { x: col.half, y: 0 },
      bodies,
    );
    return STORM.top + (STORM.floor - STORM.top) * (hit?.t ?? 1);
  }
  exposed(lane: StormLane, body: Matter.Body) {
    return lane.depths.some((depth, i) => {
      const col = this.column(lane, i);
      const hit = firstSolid(
        { x: col.x, y: STORM.top },
        { x: col.x, y: STORM.floor },
        { x: col.half, y: 0 },
        [body],
      );
      return !!hit && STORM.top + hit.t * (STORM.floor - STORM.top) < depth - 0.1;
    });
  }
  beforeStep(dt: number) {
    const g = this.game;
    if (g.mode !== 'playing' || !(dt > 0) || !this.items.length) return;
    if (g.clear) {
      this.phase = 'rest';
      this.timer = STORM.ready;
      return;
    }
    const lane = this.items[this.index];
    if (this.phase === 'warn') {
      // Cover may shorten a warned column, but removing it cannot expose an
      // unannounced section. The next complete warning may extend again.
      lane.depths = lane.depths.map((d, i) => Math.min(d, this.depth(lane, i)));
    }
    this.timer = Math.max(0, this.timer - dt);
    if (this.timer > 1e-8) return;
    // Advance at most one phase: a delayed frame never skips the tell.
    if (this.phase === 'rest') {
      this.phase = 'warn';
      this.timer = STORM.warn;
      lane.depths = Array.from({ length: STORM.columns }, (_, i) => this.depth(lane, i));
      g.onSound('storm-warn');
    } else if (this.phase === 'warn') {
      this.phase = 'strike';
      this.timer = STORM.afterglow;
      const player = this.exposed(lane, g.player);
      const enemies = g.enemies.filter(
        (e) => e.hp > 0 && e.spawn <= 0 && !e.allied && this.exposed(lane, e.body),
      );
      // Resolve one snapshot, without destroying cover or cancelling boss AI.
      for (const e of enemies)
        g.hitEnemy(e, isBoss(e.kind) ? STORM.boss : STORM.enemy, undefined, false, false, false);
      g.onSound('storm-strike');
      if (player) g.damagePlayer(STORM.player, undefined, { type: 'lightning' });
    } else {
      this.phase = 'rest';
      this.timer = STORM.rest;
      this.index = (this.index + 1) % this.items.length;
    }
  }
}
