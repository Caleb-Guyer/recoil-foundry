import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Prop } from './props.ts';
import { firstSolid } from './collisions.ts';
import { CARGO_SIZE } from './cargo-layout.ts';

export const SCRAP_TELL = 1.15;
export const SCRAP_SPEED = 68;

// A finite, one-way delivery. A blocked trolley releases its load after the
// same full warning as a shot latch; it never forces a body through a wall.
export function updateScrapRail(g: Game, p: Prop, dt: number) {
  const rig = p.cargo!,
    rail = rig.rail!;
  if (g.clear) {
    rig.disabled = true;
    if (rig.state === 'warning') rig.state = 'hanging';
    return;
  }
  if (rig.disabled || rig.state !== 'hanging' || g.time < rail.startsAt || !(dt > 0)) return;
  const from = p.body.position;
  const dx = rail.toX - from.x;
  const to = { x: from.x + Math.sign(dx) * Math.min(Math.abs(dx), SCRAP_SPEED * dt), y: from.y };
  const bodies = [
    ...g.solidBodies.filter((b) => b !== p.body),
    g.player,
    ...[...g.enemies, ...g.areaEvents.allies]
      .filter((e) => e.hp > 0)
      .flatMap((e) => [e.body, ...(e.crane ? [e.crane.body] : [])]),
  ];
  const hit = firstSolid(from, to, { x: CARGO_SIZE.w / 2 + 2, y: CARGO_SIZE.h / 2 + 2 }, bodies);
  if (hit) {
    g.cargo.cut(p, rig.cableHp);
    return;
  }
  Matter.Body.setPosition(p.body, to);
  rig.anchor.x = to.x;
  rig.origin.x = to.x;
  if (Math.abs(to.x - rail.toX) < 0.01) g.cargo.cut(p, rig.cableHp);
}
