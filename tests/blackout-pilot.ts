import Matter from 'matter-js';
import type { Game, Input } from '../src/game.ts';
import { distance } from '../src/rules.ts';

const drops = new WeakMap<Game, { box: object; x: number; below: number }>();

// Read the cabinet and terrain, then use normal movement, jump and gun inputs.
export function blackoutInput(g: Game): Input | undefined {
  const box = g.areaEvents.fuseBox;
  if (g.mode !== 'playing' || !g.areaEvents.dark || !box || g.enemies.length) {
    drops.delete(g);
    return undefined;
  }
  const p = g.player.position,
    target = box.body.position;
  let drop = drops.get(g);
  if (drop && (drop.box !== box || p.y > drop.below)) {
    drops.delete(g);
    drop = undefined;
  }
  // A fight can end on a shelf directly above the cabinet. Walk around its
  // visible edge and finish dropping before turning back underneath it.
  if (!drop && p.y < target.y - 60) {
    const shelf = g.terrain.find(
      (body) =>
        body.bounds.min.y >= g.player.bounds.max.y - 8 &&
        body.bounds.max.y < target.y &&
        p.x > body.bounds.min.x - 20 &&
        p.x < body.bounds.max.x + 20 &&
        target.x > body.bounds.min.x - 20 &&
        target.x < body.bounds.max.x + 20,
    );
    if (shelf) {
      const edges = [shelf.bounds.min.x - 35, shelf.bounds.max.x + 35].filter(
        (x) => x > 35 && x < 1965,
      );
      const x = edges.sort(
        (a, b) =>
          Math.abs(a - p.x) + Math.abs(a - target.x) - (Math.abs(b - p.x) + Math.abs(b - target.x)),
      )[0];
      if (x !== undefined) {
        drop = { box, x, below: shelf.bounds.max.y + 22 };
        drops.set(g, drop);
      }
    }
  }
  if (drop) {
    return {
      left: p.x > drop.x + 4,
      right: p.x < drop.x - 4,
      jump: false,
      jumpHeld: false,
      fire: false,
      aim: target,
    };
  }
  const clear = distance(g.lineEnd(p, target, 0, box), target) < 1;
  // Arcing shells need a close, level shot at the cabinet; recalled rounds
  // also need an approach instead of firing outside their outbound reach.
  const closeShot = g.gun.shellshock || g.mods.includes('mass-driver') || g.mods.includes('recall');
  const inRange = !closeShot || distance(p, target) < 140;
  const move = clear && inRange ? 0 : Math.sign(target.x - p.x);
  const blocked =
    !!move && Matter.Query.ray(g.solidBodies, p, { x: p.x + move * 55, y: p.y }, 18).length > 0;
  const route = move < 0 ? [...g.level.route].reverse() : g.level.route;
  const waypoint = route.find((q) =>
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
