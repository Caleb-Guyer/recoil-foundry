import type { Game, Input } from '../src/game.ts';
import { distance } from '../src/rules.ts';
import Matter from 'matter-js';

function approach(g: Game, target: { x: number; y: number }, interact = false): Input {
  const p = g.player.position,
    dx = target.x - p.x,
    dy = p.y - target.y;
  const ceiling = g.terrain
    .filter(
      (b) =>
        b.bounds.min.y > target.y + 8 &&
        b.bounds.max.y < p.y &&
        p.x > b.bounds.min.x - 18 &&
        p.x < b.bounds.max.x + 18,
    )
    .sort((a, b) => b.bounds.max.y - a.bounds.max.y)[0];
  let move = Math.abs(dx) > 18 ? Math.sign(dx) : 0;
  if (ceiling && dy > 60) {
    const side =
      p.x - ceiling.bounds.min.x < ceiling.bounds.max.x - p.x
        ? ceiling.bounds.min.x - 45
        : ceiling.bounds.max.x + 45;
    move = Math.sign(side - p.x);
  }
  const blocked =
    !!move && Matter.Query.ray(g.solidBodies, p, { x: p.x + move * 55, y: p.y }, 15).length > 0;
  const nearby = distance(p, target) < 65;
  return {
    left: move < 0,
    right: move > 0,
    jump: (interact && nearby) || (g.grounded && (dy > 45 || blocked)),
    jumpHeld: true,
    fire: !ceiling && dy > 55 && !nearby,
    aim: { x: p.x, y: p.y + 500 },
  };
}

export function uprisingInput(g: Game): Input | undefined {
  const u = g.uprising,
    p = g.player.position;
  if (g.mode === 'playing' && u.escapeReady)
    return {
      left: false,
      right: true,
      jump: false,
      jumpHeld: false,
      fire: false,
      aim: { x: 1900, y: 700 },
    };
  if (g.mode !== 'playing' || !u.waiting) return undefined;
  let target = u.nodes.find((n) => n.hp > 0);
  if (u.kind === 'escape')
    return approach(
      g,
      u.switchTarget ?? {
        x: u.evacuation!.x + u.evacuation!.w / 2,
        y: u.evacuation!.y + u.evacuation!.h - 18,
      },
      !!u.switchTarget,
    );
  if (u.kind === 'defend' && u.armedAt !== null)
    return g.combatEnemyCount || g.waves.pending
      ? undefined
      : {
          left: false,
          right: false,
          jump: false,
          jumpHeld: true,
          fire: false,
          aim: { x: 1000, y: 600 },
        };
  // Clear the patrol with the standard pilot, then deliberately address the mission.
  if (g.combatEnemyCount || g.waves.pending) return undefined;
  if (u.kind === 'steal') target = u.nodes[0];
  if (!target) return undefined;
  const t = target.body.position,
    dx = t.x - p.x;
  const navigation = approach(g, t, u.kind === 'defend');
  if (
    distance(p, t) > 120 ||
    Math.abs(t.y - p.y) > 65 ||
    distance(g.lineEnd(p, t, 0, target), t) > 1
  )
    return navigation;
  return {
    left: dx < -60,
    right: dx > 60,
    jump: u.kind === 'defend' && distance(p, t) < 150,
    jumpHeld: true,
    fire: u.kind !== 'defend' && target.hp > 0,
    aim: t,
  };
}
