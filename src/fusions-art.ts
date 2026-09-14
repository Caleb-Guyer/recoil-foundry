import type { Game } from './game.ts';
import { clamp, distance } from './rules.ts';
import { ORBIT_TIME } from './fusions.ts';
import { FUSE_TIME } from './ballistics.ts';
import { RESONATOR } from './cross-fusions.ts';

export function drawFusions(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  c.save();
  for (const p of g.fusions.resonator.pending) {
    c.strokeStyle = '#a9d9cb';
    c.globalAlpha = 0.6;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(p.origin.from.x, p.origin.from.y, 7, 0, Math.PI * 2);
    c.stroke();
  }
  for (const e of g.fusions.resonator.effects) {
    c.strokeStyle = '#c6eee0';
    c.globalAlpha = clamp(1 - (g.time - e.at) / RESONATOR.flash, 0, 1);
    c.lineWidth = 2;
    c.beginPath();
    for (const s of e.segments) {
      c.moveTo(s.a.x, s.a.y);
      c.lineTo(s.b.x, s.b.y);
    }
    c.stroke();
  }
  for (const cell of g.fusions.storm.cells) {
    c.strokeStyle = '#9fd8c5';
    c.fillStyle = '#c8f0dc';
    c.lineWidth = 1.4;
    c.globalAlpha =
      g.time < cell.armed ? 0.25 : clamp((cell.expires - g.time) / 0.2, 0, reduced ? 0.65 : 0.85);
    c.beginPath();
    for (const link of cell.links) {
      c.moveTo(link.a.x, link.a.y);
      c.lineTo(link.b.x, link.b.y);
    }
    c.stroke();
    c.globalAlpha = 0.8;
    for (const n of cell.nodes) {
      c.beginPath();
      c.arc(n.pos.x, n.pos.y, 3, 0, Math.PI * 2);
      c.fill();
    }
  }
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
