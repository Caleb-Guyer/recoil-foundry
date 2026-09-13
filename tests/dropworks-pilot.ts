import Matter from 'matter-js';
import type { Game, Input } from '../src/game.ts';
import { distance, type Vec } from '../src/rules.ts';
import { dodgePilot } from './combat-pilot.ts';

// A player beneath an upper platform has to retreat to a stairway before
// approaching its guard. Use only movement, jump, and normal aiming inputs.
export function dropworksPilot() {
  let blocked = 0,
    path: Vec[] = [],
    index = 0;
  return (g: Game): Partial<Input> => {
    const p = g.player.position;
    const visible = (point: Vec) => distance(g.lineEnd(p, point), point) < 2;
    const targets = g.enemies
      .filter((e) => e.spawn <= 0)
      .sort((a, b) => {
        const cost = (point: Vec) => distance(p, point) + (visible(point) ? 0 : 1000);
        return cost(a.body.position) - cost(b.body.position);
      });
    const enemy = targets[0];
    if (!enemy) return {};
    blocked = visible(enemy.body.position) ? 0 : blocked + 1;
    if (path.length && visible(enemy.body.position) && p.y < enemy.body.position.y + 70) path = [];
    if (!path.length && blocked > 90) {
      const crown = g.level.route.findIndex((point) => point.y < 220);
      path = p.x < 1000 ? g.level.route.slice(0, crown + 1) : g.level.route.slice(crown).reverse();
      index = 0;
      for (let i = 0; i < path.length; i++)
        if (g.grounded && Math.abs(path[i].y - p.y) < 15 && Math.abs(path[i].x - p.x) < 75)
          index = i + 1;
    }
    if (index >= path.length) path = [];
    if (path.length) {
      let goal = path[index];
      if (g.grounded && Math.abs(p.x - goal.x) < 32 && Math.abs(p.y - goal.y) < 12) {
        index++;
        if (index === path.length) {
          path = [];
          blocked = 0;
          return dodgePilot(g, enemy);
        }
        goal = path[index];
      }
      // A hit can knock the player off a step. Backtrack to the entrance and
      // climb again instead of trying to jump through an overhead platform.
      if (p.y > goal.y + 210) {
        index = 0;
        goal = path[0];
      }
      const steer = goal.x - p.x - g.player.velocity.x * 5;
      const wall =
        Math.abs(steer) > 6 &&
        Matter.Query.ray(g.solidBodies, p, { x: p.x + Math.sign(steer) * 55, y: p.y }, 24).length >
          0;
      return {
        left: steer < -6,
        right: steer > 6,
        jump: g.grounded && (p.y > goal.y + 45 || wall),
        fire: false,
        aim: { ...enemy.body.position },
      };
    }
    return dodgePilot(g, enemy);
  };
}
