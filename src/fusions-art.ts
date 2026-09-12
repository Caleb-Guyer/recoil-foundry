import type { Game } from './game.ts';
import { clamp, distance } from './rules.ts';
import { ORBIT_TIME } from './fusions.ts';
import { FUSE_TIME } from './ballistics.ts';

export function drawFusions(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  c.save();
  c.fillStyle = '#b9e3ce';
  for (const round of g.fusions.orbit) {
    const p = g.fusions.position(round);
    c.globalAlpha = clamp((ORBIT_TIME - (g.time - round.at)) / 0.3, 0, 0.85) * (reduced ? 0.7 : 1);
    c.beginPath();
    c.arc(p.x, p.y, 2, 0, Math.PI * 2);
    c.fill();
  }
  if (g.fusions.has('implosion')) {
    const shown: { x: number; y: number }[] = [];
    c.strokeStyle = '#dcaa82';
    c.lineWidth = 1.2;
    for (const s of g.ballistics.shells) {
      if (shown.length >= 6 || shown.some((p) => distance(p, s.pos) < 48)) continue;
      shown.push(s.pos);
      const progress = clamp(1 - (s.at - g.time) / FUSE_TIME, 0, 1);
      const r = 28 - progress * 16;
      c.globalAlpha = reduced ? 0.4 : 0.65;
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        const outer = { x: s.pos.x + Math.cos(a) * r, y: s.pos.y + Math.sin(a) * r };
        const inner = { x: s.pos.x + Math.cos(a) * (r - 5), y: s.pos.y + Math.sin(a) * (r - 5) };
        // The inward ticks stop at cover just like the pull itself.
        if (distance(g.lineEnd(s.pos, outer), outer) > 0.1) continue;
        c.beginPath();
        c.moveTo(outer.x, outer.y);
        c.lineTo(inner.x, inner.y);
        c.stroke();
      }
    }
  }
  c.restore();
}
