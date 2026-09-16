import type { Game, Shot } from './game.ts';
import { direction, distance, type Vec } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { redirectVector } from './vector-rounds.ts';

export const POCKET = { range: 480, direct: 0.8 };
export function pocketDirection(
  g: Game,
  pos: Vec,
  normal: Vec,
  radius: number,
  skip: ReadonlySet<number> = new Set(),
): Vec | null {
  const from = { x: pos.x + normal.x, y: pos.y + normal.y };
  const enemy = g.enemies
    .filter((e) => {
      if (
        e.hp <= 0 ||
        e.spawn > 0 ||
        skip.has(e.id) ||
        distance(from, e.body.position) > POCKET.range
      )
        return false;
      const d = direction(from, e.body.position);
      return (
        d.x * normal.x + d.y * normal.y > 0.05 &&
        !firstSolid(from, e.body.position, { x: radius, y: radius }, g.solidBodies)
      );
    })
    .sort(
      (a, b) => distance(from, a.body.position) - distance(from, b.body.position) || a.id - b.id,
    )[0];
  return enemy ? direction(from, enemy.body.position) : null;
}
export function pocketBank(g: Game, s: Shot, body: Matter.Body | undefined, normal: Vec) {
  if (
    !g.mods.includes('corner-pocket') ||
    s.pocketSpent ||
    !body ||
    !g.terrainBodies.includes(body) ||
    !s.friendly ||
    s.fragment ||
    s.echo ||
    s.reflected
  )
    return false;
  s.pocketSpent = true;
  s.damage /= POCKET.direct;
  if (s.shell) s.shell.damage /= POCKET.direct;
  const d = pocketDirection(g, s.pos, normal, s.radius, s.hits);
  if (!d || s.recall?.returning) return false;
  const speed = Math.hypot(s.vel.x, s.vel.y);
  s.vel = { x: d.x * speed, y: d.y * speed };
  if (s.massDriver) s.massDriver.rolling = undefined;
  g.massDriver.redirect(s);
  redirectVector(s);
  g.burst(s.pos, 3, '#d5c690', 1.5);
  return true;
}
