import assert from 'node:assert/strict';
import type { Game, Input } from '../../src/game.ts';
export function tick(g: Game, input: Partial<Input> = {}) {
  const p = g.player.position;
  g.tick(1 / 60, {
    left: false,
    right: false,
    jump: false,
    jumpHeld: true,
    fire: false,
    aim: { x: p.x, y: p.y + 500 },
    ...input,
  });
}
// Real tick/input simulation: no teleport, healing, disabled hazards, altered
// gravity or forced completion. Shoot downward, coast to a landing, repeat.
export function climb(g: Game) {
  let waypoint = 0,
    boost = true;
  for (let frame = 0; frame < 7200 && g.mode === 'playing'; frame++) {
    const p = g.player.position,
      point = g.level.route[waypoint];
    const lift =
      point &&
      g.hazards.items.find(
        (h) => h.kind === 'lift' && h.placement.x === point.x && h.placement.y - 18 === point.y,
      );
    const t = point && {
      x: point.x,
      y:
        lift && g.level.maintenanceTiming ? lift.placement.y - lift.placement.travel - 18 : point.y,
    };
    if (!t) {
      tick(g);
      continue;
    }
    if (
      g.level.maintenanceTiming &&
      g.grounded &&
      waypoint < g.level.route.length - 1 &&
      p.y < t.y - 30
    ) {
      waypoint++;
      boost = true;
      continue;
    }
    if (
      g.grounded &&
      (lift && g.level.maintenanceTiming
        ? g.hazards.supported(g.player, lift.body) || p.y < t.y - 12
        : Math.abs(p.x - t.x) < 50 && Math.abs(p.y - t.y) < 12)
    ) {
      waypoint++;
      boost = true;
      continue;
    }
    let x = t.x;
    if (lift && g.level.maintenanceTiming && p.y > lift.body.position.y - 42) {
      x = t.x + (p.x < t.x ? -1 : 1) * (lift.placement.w / 2 + 28);
    }
    if (
      (g.level.maintenance === 'piston' ||
        (g.level.maintenanceTiming && (t.x < 880 || t.x > 1120))) &&
      p.y > t.y + 25 &&
      ((t.x < 1000 && p.x < 985) || (t.x > 1000 && p.x > 1015))
    )
      x = 1000;
    if (p.y < t.y - 45) boost = false;
    if (p.y > t.y + 180) boost = true;
    const dx = x - p.x,
      vx = g.player.velocity.x;
    const dir = Math.abs(dx) < 5 ? -Math.sign(vx) : Math.sign(dx - vx * 5);
    tick(g, {
      left: dir < 0,
      right: dir > 0,
      jump: g.grounded,
      fire: boost && !g.grounded && p.y > t.y - 55 && g.player.velocity.y > -9,
    });
    assert(Number.isFinite(g.player.position.y));
  }
  return { waypoint, mode: g.mode, hp: g.hp, seconds: g.time, shots: g.shotCount };
}
