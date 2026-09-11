import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Prop } from './props.ts';
import type { MagnetPlacement } from './reclamation-layouts.ts';
import { clamp, distance } from './rules.ts';
import { firstSolid } from './collisions.ts';

const { Body } = Matter;
export const MAGNET_PERIOD = 7.6;
export const MAGNET_WARN = 1;
export interface Magnet extends MagnetPlacement {
  phase: 'rest' | 'warn' | 'lift' | 'hold' | 'drop';
  held: Prop | null;
}
export class MagnetSystem {
  game: Game;
  items: Magnet[] = [];
  startedAt = 0;
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.startedAt = this.game.time;
    this.items = (this.game.level.magnets ?? []).map((m) => ({ ...m, phase: 'rest', held: null }));
  }
  release(body: Matter.Body) {
    for (const m of this.items) if (m.held?.body === body) m.held = null;
  }
  update() {
    const g = this.game;
    for (const m of this.items) {
      const t = (g.time - this.startedAt + m.offset) % MAGNET_PERIOD;
      const phase = g.clear
        ? 'rest'
        : t < MAGNET_WARN
          ? 'warn'
          : t < 3.5
            ? 'lift'
            : t < 4.5
              ? 'hold'
              : t < 5.5
                ? 'drop'
                : 'rest';
      if (phase === 'lift' && m.phase !== 'lift') {
        m.held =
          g.props.items
            .filter(
              (p) =>
                p.kind === 'crate' &&
                !p.body.isStatic &&
                Math.abs(p.body.position.x - m.x) < 65 &&
                p.body.position.y > m.y + 32 &&
                p.body.position.y < m.floor &&
                (p.throwUntil ?? 0) < g.time &&
                !this.items.some((other) => other.held === p) &&
                !g.enemies.some((e) => e.scrapper?.held === p),
            )
            .sort((a, b) => distance(a.body.position, m) - distance(b.body.position, m))[0] ?? null;
      }
      const prop = m.held;
      if (
        prop &&
        (!g.props.items.includes(prop) ||
          prop.body.isStatic ||
          Math.abs(prop.body.position.x - m.x) > 85 ||
          prop.body.position.y < m.y ||
          prop.body.position.y > m.floor + 25)
      )
        m.held = null;
      if (m.held) {
        const body = m.held.body,
          p = body.position;
        if (phase === 'lift' || phase === 'hold') {
          const to = { x: m.x, y: m.y + 44 };
          const solids = g.solidBodies.filter((b) => b !== body && b.bounds.min.y < p.y + 21);
          if (firstSolid(p, to, { x: 24, y: 24 }, solids)) m.held = null;
          else {
            // Forces remain subject to Matter contacts; riders, enemies and
            // displaced crates cannot be teleported through a platform.
            Body.applyForce(body, p, { x: 0, y: -body.mass * 0.001 });
            Body.setVelocity(body, {
              x: clamp((to.x - p.x) * 0.08, -2, 2),
              y: clamp((to.y - p.y) * 0.07, -4, 2),
            });
            Body.setAngularVelocity(body, body.angularVelocity * 0.8);
          }
        } else {
          if (phase === 'drop') {
            Body.setVelocity(body, { x: body.velocity.x, y: Math.max(7, body.velocity.y) });
            m.held.throwUntil = g.time + 2.5;
            m.held.throwHits = new Set();
            m.held.hits.clear();
            g.onSound('scrapper-throw');
          }
          m.held = null;
        }
      }
      m.phase = phase;
    }
  }
}
