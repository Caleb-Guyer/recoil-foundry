import Matter from 'matter-js';
import type { Game, Input } from '../src/game.ts';
import { distance } from '../src/rules.ts';

// Read the cabinet and terrain, then use normal movement, jump and gun inputs.
export function blackoutInput(g: Game): Input | undefined {
  const box = g.areaEvents.fuseBox;
  if (g.mode !== 'playing' || !g.areaEvents.dark || !box || g.enemies.length) return undefined;
  const p = g.player.position,
    target = box.body.position;
  const clear = distance(g.lineEnd(p, target, 0, box), target) < 1;
  const move = clear ? 0 : Math.sign(target.x - p.x);
  const blocked =
    !!move && Matter.Query.ray(g.solidBodies, p, { x: p.x + move * 55, y: p.y }, 18).length > 0;
  const waypoint = g.level.route.find((q) =>
    move > 0 ? q.x > p.x + 25 && q.x < target.x : q.x < p.x - 25 && q.x > target.x,
  );
  const climb = !clear && !!waypoint && p.y > waypoint.y - 12 && !g.grounded;
  return {
    left: move < 0,
    right: move > 0,
    jump: g.grounded && (blocked || (!!waypoint && p.y > waypoint.y + 45)),
    jumpHeld: true,
    fire: clear || climb,
    aim: climb ? { x: p.x, y: p.y + 500 } : target,
  };
}
