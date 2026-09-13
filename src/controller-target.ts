import type { Game } from './game.ts';
import { firstSolid } from './collisions.ts';
import type { Vec } from './rules.ts';

/** Aim at the first visible solid face; moving props cannot become portal hosts. */
export function controllerPortalTarget(
  game: Game,
  direction: Vec,
  view: { x: number; y: number; width: number; height: number },
): Vec | null {
  if (!game.portals.canPlace) return null;
  const from = game.player.position;
  const range = Math.hypot(view.width, view.height);
  const length = Math.hypot(direction.x, direction.y);
  if (!Number.isFinite(length) || length < 0.001) return null;
  const to = {
    x: from.x + (direction.x / length) * range,
    y: from.y + (direction.y / length) * range,
  };
  const hit = firstSolid(from, to, { x: 0, y: 0 }, game.solidBodies);
  if (!hit || !game.terrain.includes(hit.body)) return null;
  const point = { x: from.x + (to.x - from.x) * hit.t, y: from.y + (to.y - from.y) * hit.t };
  if (
    point.x < view.x ||
    point.x > view.x + view.width ||
    point.y < view.y ||
    point.y > view.y + view.height
  )
    return null;
  return game.portals.candidate(point) ? point : null;
}
