import type { Game, Input } from '../src/game.ts';
import { distance } from '../src/rules.ts';

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
  const patrol = g.enemies
    .filter((e) => e.spawn <= 0)
    .sort(
      (a, b) =>
        (a.kind === 'shooter' ? -1000 : 0) +
        distance(p, a.body.position) -
        ((b.kind === 'shooter' ? -1000 : 0) + distance(p, b.body.position)),
    )[0];
  if (u.kind === 'escape')
    return {
      left: false,
      right: true,
      jump: g.grounded && !!patrol && distance(p, patrol.body.position) < 200,
      jumpHeld: true,
      fire: !!patrol,
      aim: patrol?.body.position ?? { x: 1900, y: 700 },
    };
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
  return {
    left: dx < -60,
    right: dx > 60,
    jump: u.kind === 'defend' && distance(p, t) < 150,
    jumpHeld: false,
    fire: u.kind !== 'defend' && target.hp > 0,
    aim: t,
  };
}
