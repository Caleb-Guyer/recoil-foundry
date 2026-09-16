import type { Game, Shot } from './game.ts';
import type { Vec } from './rules.ts';

export const SCRAP = { rounds: 7, damage: 8, speed: 22, life: 0.2 };
export class ScrapFeedSystem {
  game: Game;
  loaded = false;
  private credited = new Set<number>();
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.loaded = false;
    this.credited.clear();
  }
  collect(s?: Shot) {
    const g = this.game;
    if (
      !g.mods.includes('scrap-feed') ||
      !s ||
      !s.friendly ||
      (s.fragment && s.feedGeneration === undefined) ||
      s.echo ||
      s.reflected ||
      !(s.damage > 0)
    )
      return;
    const generation = s.feedGeneration ?? s.discharge ?? s.id;
    if (this.credited.has(generation)) return;
    this.credited.add(generation);
    if (this.credited.size > 128) this.credited.delete(this.credited.values().next().value!);
    this.loaded = true;
    g.onSound('loaded');
    g.burst(g.player.position, 3, '#dec297', 1.2);
  }
  fire(d: Vec) {
    if (!this.loaded) return;
    const g = this.game;
    this.loaded = false;
    const origin = { x: g.player.position.x, y: g.player.position.y - 3 };
    // Inert fragments obey the same sweep/cover checks as every other round.
    // Fixed total payload prevents pellet counts and beam frames multiplying it.
    for (let i = 0; i < SCRAP.rounds; i++) {
      const angle = Math.atan2(d.y, d.x) + (i - 3) * 0.16;
      g.addShot({
        pos: { ...origin },
        vel: { x: Math.cos(angle) * SCRAP.speed, y: Math.sin(angle) * SCRAP.speed },
        damage: SCRAP.damage,
        life: SCRAP.life,
        friendly: true,
        radius: 2,
        bounces: 0,
        pierce: 0,
        fragment: true,
        split: true,
      });
    }
    g.burst(origin, 5, '#dec297', 3, d);
  }
}
