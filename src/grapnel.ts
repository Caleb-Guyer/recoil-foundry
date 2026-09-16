import Matter from 'matter-js';
import type { Game, Shot } from './game.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';
import { firstSolid } from './collisions.ts';

export const GRAPNEL = { range: 560, life: 2.8 };
const rotate = (p: Vec, angle: number): Vec => ({
  x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
  y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
});
export class GrapnelSystem {
  game: Game;
  used = false;
  anchor: { body: Matter.Body; local: Vec; pos: Vec; length: number; until: number } | null = null;
  private previous: Vec | null = null;
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.anchor = null;
    this.used = false;
    this.previous = null;
  }
  detach() {
    this.anchor = null;
  }
  input() {
    const g = this.game;
    if (g.grounded) {
      this.used = false;
      this.detach();
    }
    if (this.anchor && g.jumpBuffer > 0) {
      this.detach();
      g.jumpBuffer = g.coyote = 0;
      g.jumpCut = true;
      g.onSound('tether-snap');
    }
  }
  impact(s: Shot, body?: Matter.Body, normal?: Vec) {
    const g = this.game;
    if (
      !g.mods.includes('grapnel') ||
      this.used ||
      g.grounded ||
      !body ||
      !normal ||
      !g.terrainBodies.includes(body) ||
      !s.friendly ||
      s.fragment ||
      s.echo ||
      s.reflected ||
      s.recall?.returning
    )
      return;
    const pos = { x: s.pos.x + normal.x * (s.radius + 2), y: s.pos.y + normal.y * (s.radius + 2) };
    const span = distance(g.player.position, pos);
    if (
      span < 40 ||
      span > GRAPNEL.range ||
      firstSolid(g.player.position, pos, { x: 1, y: 1 }, g.solidBodies)
    )
      return;
    this.used = true;
    this.previous = { ...g.player.position };
    this.anchor = {
      body,
      pos,
      local: rotate({ x: pos.x - body.position.x, y: pos.y - body.position.y }, -body.angle),
      length: span,
      until: g.time + GRAPNEL.life,
    };
    g.onSound('tether-link');
  }
  beforeStep() {
    const g = this.game,
      p = g.player.position,
      a = this.anchor;
    if (a) {
      const offset = rotate(a.local, a.body.angle);
      const pos = { x: a.body.position.x + offset.x, y: a.body.position.y + offset.y };
      if (
        g.grounded ||
        g.time >= a.until ||
        !g.terrainBodies.includes(a.body) ||
        (this.previous && distance(p, this.previous) > 90) ||
        distance(a.pos, pos) > 90 ||
        distance(p, pos) > GRAPNEL.range + 80 ||
        firstSolid(p, pos, { x: 1, y: 1 }, g.solidBodies)
      )
        this.detach();
      else {
        a.pos = pos;
        const span = distance(p, pos),
          d = direction(pos, p),
          v = g.player.velocity;
        // Only the player receives a radial impulse. Tangential recoil survives;
        // the rope never moves terrain or constrains a train's rigid body.
        if (span >= a.length - 2) {
          const outward = Math.max(0, v.x * d.x + v.y * d.y);
          const pull = outward + clamp((span - a.length) * 0.2, 0, 6);
          Matter.Body.setVelocity(g.player, {
            x: clamp(v.x - d.x * pull, -23, 23),
            y: clamp(v.y - d.y * pull, -21, 20),
          });
        }
      }
    }
    this.previous = { ...p };
  }
}
