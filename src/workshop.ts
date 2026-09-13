import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { Level } from './levels.ts';
import type { Vec } from './rules.ts';
const { Body, Query } = Matter;

export interface WorkshopTarget {
  home: Vec;
  moving: boolean;
}
const TARGETS = [
  { x: 500, y: 723, moving: false, shielded: false },
  { x: 780, y: 723, moving: false, shielded: true },
  { x: 1040, y: 723, moving: true, shielded: false },
  { x: 1420, y: 573, moving: false, shielded: false },
];

export function workshopLevel(): Level {
  return {
    id: 'workshop',
    name: 'The Workshop',
    area: 'docks',
    mirrored: false,
    boss: false,
    solids: [
      { x: 430, y: 525, w: 200, h: 22 },
      { x: 800, y: 575, w: 180, h: 22 },
      { x: 1040, y: 430, w: 180, h: 22 },
      { x: 1320, y: 180, w: 32, h: 430 },
      { x: 1880, y: 180, w: 32, h: 560 },
      { x: 1352, y: 590, w: 145, h: 22 },
      { x: 1720, y: 460, w: 160, h: 22 },
      { x: 1352, y: 330, w: 145, h: 22 },
      { x: 1610, y: 200, w: 270, h: 22 },
    ],
    route: [
      { x: 220, y: 720 },
      { x: 1250, y: 720 },
      { x: 1590, y: 720 },
    ],
    spawns: [],
    hazards: [],
    setpiece: {
      rosters: [[]],
      weak: [0, 7],
      props: [
        { kind: 'crate', x: 500, y: 502 },
        { kind: 'crate', x: 650, y: 717 },
        { kind: 'crate', x: 1420, y: 307 },
      ],
    },
  };
}

export class WorkshopSystem {
  active = false;
  discovered: string[] = [];
  slots: { enemy?: Enemy; remaining: number }[] = [];
  game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.slots = this.active ? TARGETS.map(() => ({ remaining: 0 })) : [];
    if (this.active) this.update(0);
  }
  update(dt: number) {
    if (!this.active) return;
    const g = this.game;
    for (const [index, slot] of this.slots.entries()) {
      if (slot.enemy && g.enemies.includes(slot.enemy)) continue;
      if (slot.enemy) {
        slot.enemy = undefined;
        slot.remaining = 1.2;
      }
      slot.remaining = Math.max(0, slot.remaining - dt);
      if (slot.remaining > 0) continue;
      const t = TARGETS[index];
      // Wait for the player, crates and other targets to leave the reset mount.
      // Returning targets never materialize through an occupied physical hull.
      const hull = { min: { x: t.x - 18, y: t.y - 17 }, max: { x: t.x + 18, y: t.y + 16 } };
      if (Query.region([...g.solidBodies, g.player, ...g.enemies.map((e) => e.body)], hull).length)
        continue;
      g.spawnEnemy('runner', t.x, t.y, t.shielded ? 'shielded' : undefined);
      const e = g.enemies.at(-1)!;
      e.workshopTarget = { home: { x: t.x, y: t.y }, moving: t.moving };
      e.hp = e.maxHp = t.shielded ? 300 : 160;
      e.spawn = 0.3;
      e.facing = -1;
      e.aim = { x: -1, y: 0 };
      e.timer = 0;
      slot.enemy = e;
    }
  }
  move(e: Enemy) {
    const target = e.workshopTarget!;
    const g = this.game,
      p = e.body.position;
    if (p.y > 820) {
      g.hitEnemy(e, e.maxHp * 20);
      return;
    }
    const desired = target.moving ? target.home.x + Math.sin(g.time * 0.8) * 115 : p.x;
    const direction = Math.sign(desired - p.x);
    const blocked =
      direction && Query.ray(g.solidBodies, p, { x: p.x + direction * 25, y: p.y }, 22).length;
    const speed = target.moving && !blocked ? Math.max(-2, Math.min(2, (desired - p.x) * 0.1)) : 0;
    Body.setVelocity(e.body, {
      x: target.moving ? speed : e.body.velocity.x * 0.92,
      y: e.body.velocity.y,
    });
  }
}
