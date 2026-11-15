import type { Game, Input } from '../src/game.ts';
import Matter from 'matter-js';
import { distance, type Vec } from '../src/rules.ts';
import { playRoom } from './room-pilot.ts';

/** Keep one edge decision while dropping to a covered enemy below a shelf.
 * Re-selecting left/right at the room midpoint can oscillate over the same
 * cover forever, while downward recoil prevents the ordinary fall. */
export function createShutdownDropInput() {
  let exit: { shelf: Matter.Body; x: number } | null = null;
  return (g: Game, input: Input, target?: Vec): Input => {
    const p = g.player.position;
    if (!g.shutdown.state?.chamber || g.clear || !target || target.y < p.y + 80) {
      exit = null;
      return input;
    }
    if (exit && (!g.terrain.includes(exit.shelf) || p.y - 18 > exit.shelf.bounds.max.y))
      exit = null;
    const blocked = distance(g.lineEnd(p, target), target) > 1;
    if (exit && Math.abs(p.x - exit.x) < 12 && !blocked) exit = null;
    if (!exit && blocked) {
      const shelf = g.terrain
        .filter(
          (body) =>
            body.bounds.min.y > p.y + 8 &&
            body.bounds.max.y < target.y &&
            p.x > body.bounds.min.x - 22 &&
            p.x < body.bounds.max.x + 22 &&
            Matter.Query.ray([body], p, target).length > 0,
        )
        .sort((a, b) => a.bounds.min.y - b.bounds.min.y)[0];
      if (shelf) {
        const left = shelf.bounds.min.x - 45,
          right = shelf.bounds.max.x + 45;
        exit = { shelf, x: Math.abs(p.x - left) <= Math.abs(p.x - right) ? left : right };
      }
    }
    if (!exit) return input;
    return {
      ...input,
      left: p.x > exit.x + 8,
      right: p.x < exit.x - 8,
      jump: false,
      fire: false,
      firePressed: false,
    };
  };
}

/** Reuse the ordinary dodger, with a chamber-specific route out of occluding
 * shelves. The wrapper changes only movement/fire inputs, never game state. */
export function playShutdownWave(g: Game, seconds: number) {
  const tick = g.tick,
    dropInput = createShutdownDropInput();
  g.tick = (dt, input) => {
    const target = g.enemies
      .filter((enemy) => enemy.hp > 0 && enemy.spawn <= 0)
      .sort(
        (a, b) =>
          distance(a.body.position, g.player.position) -
          distance(b.body.position, g.player.position),
      )[0];
    tick.call(g, dt, dropInput(g, input, target?.body.position));
  };
  try {
    return playRoom(g, seconds);
  } finally {
    g.tick = tick;
  }
}

// Reach the exposed control with normal jumps and fire. Never move a body,
// clear enemies, heal, or invoke the objective directly between combat waves.
export function shootShutdownControl(g: Game) {
  const cycle = g.shutdown.state?.cycle;
  const target = g.shutdown.target;
  if (cycle === undefined || !target || !g.clear) return false;
  const right = cycle === 1;
  const route = right
    ? [
        { x: 1850, y: 722 },
        { x: 1642, y: 657 },
        { x: 1480, y: 572 },
      ]
    : [
        { x: 140, y: 722 },
        { x: 355, y: 657 },
        { x: 520, y: 572 },
        ...(cycle === 2
          ? [
              { x: 810, y: 472 },
              { x: 1000, y: 382 },
            ]
          : []),
      ];
  let index = 0;
  for (let frame = 0; frame < 60 * 35 && g.mode === 'playing'; frame++) {
    if (g.shutdown.state?.cycle !== cycle) return true;
    const p = g.player.position;
    const canShoot = distance(p, target) < 185 && distance(g.lineEnd(p, target), target) < 1;
    const waypoint = route[index];
    if (!canShoot && index < route.length - 1 && g.grounded && distance(p, waypoint) < 25) index++;
    const next = route[index],
      dx = next.x - p.x,
      dy = next.y - p.y;
    const blocked =
      Math.abs(dx) > 8 &&
      Matter.Query.ray(g.solidBodies, p, { x: p.x + Math.sign(dx) * 45, y: p.y }, 20).length > 0;
    g.tick(1 / 60, {
      left: !canShoot && dx < -8,
      right: !canShoot && dx > 8,
      jump: !canShoot && g.grounded && (dy < -20 || blocked),
      jumpHeld: true,
      fire: canShoot,
      aim: target,
    });
  }
  return g.shutdown.state?.cycle !== cycle;
}
