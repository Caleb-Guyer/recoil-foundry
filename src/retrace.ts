import type { Game, Shot } from './game.ts';
import type { Portal } from './portals.ts';
import { direction, distance, type Vec } from './rules.ts';
export interface RoutePoint {
  pos: Vec;
  jump?: { pos: Vec; entry: Portal; exit: Portal };
}
export function recordRoute(s: Shot, point = s.pos, jump?: RoutePoint['jump']) {
  const r = s.recall;
  if (!r?.route || r.returning || r.route.length >= 128) return;
  if (!jump && distance(r.route.at(-1)!.pos, point) < 0.01) return;
  r.route.push({ pos: { ...point }, ...(jump ? { jump } : {}) });
}
// Walk the recorded route in reverse. Each ordinary segment still enters the
// normal swept collision pipeline; only a still-linked portal can skip space.
export function routeTarget(g: Game, s: Shot): Vec | undefined {
  const r = s.recall;
  if (!r?.returning || !r.route?.length) return;
  for (let i = 0; i < 8 && r.route.length; i++) {
    const next = r.route.at(-1)!;
    if (distance(s.pos, next.pos) > 0.05) {
      const speed = Math.hypot(s.vel.x, s.vel.y),
        d = direction(s.pos, next.pos);
      s.vel = { x: d.x * speed, y: d.y * speed };
      return next.pos;
    }
    r.route.pop();
    if (next.jump) {
      const { pos, entry, exit } = next.jump;
      if (!g.portals.linked || !g.portals.pair.includes(entry) || !g.portals.pair.includes(exit)) {
        s.life = 0;
        return;
      }
      s.pos = { ...pos };
      s.prev = { ...pos };
      if (s.trace) s.trace.points = [{ ...pos }];
      g.massDriver.redirect(s);
    }
  }
  if (!r.route.length) r.route = undefined;
}
