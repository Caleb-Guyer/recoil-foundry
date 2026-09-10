import type { Game, Input } from '../src/game.ts';
import { distance } from '../src/rules.ts';
import { FREIGHT } from '../src/freight-layout.ts';

// A physical pilot for the moving encounter: stay aboard, take aimed shots,
// and jump around the deck edge if a dodge leaves it below the platform.
export function freightPilot(g: Game): Input {
  const p = g.player.position,
    top = g.freight.top;
  const target = [...g.enemies].sort(
    (a, b) =>
      distance(a.body.position, p) +
      (distance(g.lineEnd(p, a.body.position), a.body.position) > 2 ? 800 : 0) -
      distance(b.body.position, p) -
      (distance(g.lineEnd(p, b.body.position), b.body.position) > 2 ? 800 : 0),
  )[0];
  let goal = g.clear ? 1930 : 1000;
  let fire = !!target;
  let jump = false;
  let aim = target ? { ...target.body.position } : { x: p.x, y: p.y + 300 };
  if (!g.clear && p.y + 18 > top + 20) {
    if (p.x > 615 && p.x < 1385) goal = p.x < 1000 ? 590 : 1410;
    else {
      goal = 1000;
      jump = g.grounded;
      fire = true;
      aim = { x: p.x, y: p.y + 400 };
    }
  } else if (p.y < top - 150) {
    // Stop upward recoil and settle back onto the moving deck.
    fire = false;
  }
  if (
    !g.clear &&
    g.shots.some((s) => {
      if (s.friendly) return false;
      const dx = s.pos.x - p.x,
        dy = s.pos.y - p.y,
        vx = s.vel.x - g.player.velocity.x,
        vy = s.vel.y - g.player.velocity.y;
      const t = Math.max(0, Math.min(10, -(dx * vx + dy * vy) / (vx * vx + vy * vy || 1)));
      return Math.hypot(dx + vx * t, dy + vy * t) < 38;
    })
  ) {
    jump = g.grounded;
    fire = false;
    goal = p.x < 1000 ? 1120 : 880;
  }
  return { left: p.x > goal + 20, right: p.x < goal - 20, jump, jumpHeld: true, fire, aim };
}
