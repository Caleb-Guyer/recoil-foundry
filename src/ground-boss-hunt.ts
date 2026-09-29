import type { Enemy, Game } from './game.ts';
import Matter from 'matter-js';
import { ENEMY_STATS } from './enemies.ts';
import { clamp, distance, type Vec } from './rules.ts';

export interface GroundBossHunt {
  x: number;
  player: Vec;
  nextPlan: number;
  climb?: { platform: Matter.Body; x: number; launched: boolean };
}

// Evaluate actual standing positions, not a hypothetical muzzle in midair.
// Movement and obstacle hops remain the caller's ordinary physical controls.
export function groundBossTarget(
  g: Game,
  e: Enemy,
  muzzleOffset: number,
  usable = (from: Vec) => distance(g.lineEnd(from, g.player.position, 7), g.player.position) < 0.1,
) {
  const { w, h } = ENEMY_STATS[e.kind];
  const grounded =
    e.body.velocity.y >= -1 &&
    Matter.Query.ray(
      g.solidBodies,
      { x: e.body.position.x - w / 2 + 3, y: e.body.bounds.max.y + 1 },
      { x: e.body.position.x + w / 2 - 3, y: e.body.bounds.max.y + 1 },
      5,
    ).length > 0;
  let climb = e.groundHunt?.climb;
  if (
    climb &&
    (!g.terrainBodies.includes(climb.platform) ||
      g.player.position.y > climb.platform.bounds.min.y ||
      g.player.position.x < climb.platform.bounds.min.x - 40 ||
      g.player.position.x > climb.platform.bounds.max.x + 40 ||
      (grounded && e.body.bounds.max.y < climb.platform.bounds.min.y + 5))
  ) {
    e.groundHunt = undefined;
    climb = undefined;
  }
  if (climb) {
    const top = climb.platform.bounds.min.y;
    if (climb.launched && grounded && e.body.bounds.max.y > top + 5) climb.launched = false;
    if (grounded && !climb.launched && Math.abs(e.body.position.x - climb.x) < 14) {
      const rise = e.body.bounds.max.y - top + 65;
      let speed = 12;
      for (; speed < 26; speed += 0.25) {
        let v = -speed,
          height = 0;
        for (let n = 0; n < 100 && v < 0; n++) {
          v =
            v * (1 - e.body.frictionAir) +
            g.engine.gravity.y * g.engine.gravity.scale * (1000 / 60) ** 2;
          height -= Math.min(v, 0);
        }
        if (height >= rise) break;
      }
      Matter.Body.setVelocity(e.body, { x: 0, y: -speed });
      climb.launched = true;
    }
    return climb.launched && e.body.bounds.max.y < top - 4 ? g.player.position.x : climb.x;
  }
  if (
    e.groundHunt &&
    g.time < e.groundHunt.nextPlan &&
    distance(e.groundHunt.player, g.player.position) < 80
  )
    return e.groundHunt.x;
  const positions = [
    e.body.position.x,
    ...[0, -180, 180, -320, 320, -500, 500, -750, 750, -1000, 1000].map(
      (dx) => g.player.position.x + dx,
    ),
    w / 2 + 20,
    g.worldWidth - w / 2 - 20,
  ].map((x) => clamp(x, w / 2 + 12, g.worldWidth - w / 2 - 12));
  const candidates: Vec[] = [];
  for (const x of positions)
    for (const support of g.terrainBodies) {
      const floor = support.bounds.min.y;
      if (
        floor > 740 ||
        floor < Math.min(580, e.body.bounds.max.y - 150) ||
        x - w / 2 < support.bounds.min.x ||
        x + w / 2 > support.bounds.max.x
      )
        continue;
      const p = { x, y: floor - h / 2 - 0.2 };
      if (
        g.solidBodies.some(
          (b) =>
            b !== support &&
            p.x + w / 2 > b.bounds.min.x &&
            p.x - w / 2 < b.bounds.max.x &&
            p.y + h / 2 > b.bounds.min.y &&
            p.y - h / 2 < b.bounds.max.y,
        )
      )
        continue;
      if (usable({ x, y: p.y - muzzleOffset })) candidates.push(p);
    }
  candidates.sort((a, b) => distance(a, e.body.position) - distance(b, e.body.position));
  const x = candidates[0]?.x ?? clamp(g.player.position.x, w / 2 + 12, g.worldWidth - w / 2 - 12);
  e.groundHunt = { x, player: { ...g.player.position }, nextPlan: g.time + 0.8 };
  if (!candidates.length && g.grounded && e.kind === 'auditor') {
    const platform = g.terrainBodies.find(
      (b) =>
        b.bounds.max.x - b.bounds.min.x < 700 &&
        Math.abs(b.bounds.min.y - g.player.bounds.max.y) < 5 &&
        b.bounds.max.y < e.body.position.y &&
        g.player.position.x >= b.bounds.min.x &&
        g.player.position.x <= b.bounds.max.x,
    );
    if (platform) {
      const margin = w / 2 + 28;
      const sides = [platform.bounds.min.x - margin, platform.bounds.max.x + margin]
        .filter((x) => x > w / 2 + 10 && x < g.worldWidth - w / 2 - 10)
        .sort((a, b) => Math.abs(a - e.body.position.x) - Math.abs(b - e.body.position.x));
      if (sides.length) {
        e.groundHunt.climb = { platform, x: sides[0], launched: false };
        return sides[0];
      }
    }
  }
  return x;
}
