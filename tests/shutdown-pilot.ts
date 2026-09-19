import type { Game } from '../src/game.ts';
import Matter from 'matter-js';
import { distance } from '../src/rules.ts';

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
