import type { Game, Input } from '../src/game.ts';
import { distance, segmentBox } from '../src/rules.ts';
import { approach } from './uprising-pilot.ts';
const dropping = new WeakMap<Game, { x: number; y: number }>();
function dropTo(g: Game, target: { x: number; y: number }): Input | undefined {
  const p = g.player.position;
  let drop = dropping.get(g);
  if (drop && (p.y > drop.y || target.y < p.y + 60)) {
    dropping.delete(g);
    drop = undefined;
  }
  const edge = (b: (typeof g.terrain)[number]) => {
    const xs = [b.bounds.min.x - 55, b.bounds.max.x + 55].sort(
      (a, z) => Math.abs(a - p.x) - Math.abs(z - p.x),
    );
    return xs.find((x) => distance(g.lineEnd(p, { x, y: p.y }, 13), { x, y: p.y }) < 1) ?? xs[0];
  };
  if (drop && g.grounded) {
    const footing = g.terrain
      .slice(4)
      .find(
        (b) =>
          Math.abs(b.bounds.min.y - p.y - 18) < 5 &&
          p.x > b.bounds.min.x &&
          p.x < b.bounds.max.x &&
          drop!.x > b.bounds.min.x - 15 &&
          drop!.x < b.bounds.max.x + 15,
      );
    if (footing) {
      drop = { x: edge(footing), y: footing.bounds.max.y + 30 };
      dropping.set(g, drop);
    }
  }
  if (!drop && target.y > p.y + 90) {
    const platform = g.terrain
      .slice(4)
      .filter(
        (b) =>
          b.bounds.min.y > p.y &&
          b.bounds.max.y < target.y - 20 &&
          p.x > b.bounds.min.x - 10 &&
          p.x < b.bounds.max.x + 10,
      )
      .sort((a, b) => a.bounds.min.y - b.bounds.min.y)[0];
    if (platform) {
      const box = platform.bounds;
      drop = {
        x: edge(platform),
        y: box.max.y + 30,
      };
      dropping.set(g, drop);
    }
  }
  if (!drop) return undefined;
  return {
    left: drop.x < p.x - 6,
    right: drop.x > p.x + 6,
    jump: false,
    jumpHeld: true,
    fire: false,
    aim: target,
  };
}

/** Read the visible objective and use the same ordinary movement/fire controls as a player. */
export function uprisingRemasterInput(g: Game): Input | undefined {
  const u = g.uprising,
    r = u.remaster;
  if (g.mode !== 'playing' || !r.eligible || !u.waiting) return undefined;
  const target = r.objectiveTarget;
  if (!target) return undefined;
  if (g.combatEnemyCount || g.waves.pending) {
    const threat = g.enemies
      .slice()
      .sort(
        (a, b) =>
          distance(a.body.position, g.player.position) -
          distance(b.body.position, g.player.position),
      )[0];
    if (
      threat &&
      distance(g.lineEnd(g.player.position, threat.body.position), threat.body.position) > 1
    ) {
      const drop = dropTo(g, threat.body.position);
      if (drop) return drop;
      if (
        u.nodes.some(
          (n) =>
            n.uprising === 'generator' &&
            segmentBox(
              g.player.position,
              threat.body.position,
              n.body.bounds.min,
              n.body.bounds.max,
            ),
        )
      )
        return approach(g, threat.body.position);
    }
    return undefined;
  }
  if (u.kind === 'defend' && u.armedAt !== null)
    return { left: false, right: false, jump: false, jumpHeld: true, fire: false, aim: target };
  const drop = dropTo(g, target);
  if (drop) return drop;
  if (r.extracting || u.switchTarget) return approach(g, target, !!u.switchTarget);
  const node = u.kind === 'sabotage' ? u.nodes.find((n) => n.hp > 0) : r.activeNode;
  if (!node) return approach(g, target);
  if (u.kind === 'defend') return approach(g, target, true);
  const p = g.player.position,
    dx = target.x - p.x;
  if (
    distance(p, target) > 120 ||
    Math.abs(target.y - p.y) > 65 ||
    distance(g.lineEnd(p, target, 0, node), target) > 1
  )
    return approach(g, target);
  return {
    left: dx < -60,
    right: dx > 60,
    jump: false,
    jumpHeld: true,
    fire: node.hp > 0,
    aim: { ...target },
  };
}
