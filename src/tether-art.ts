import type { Game } from './game.ts';
import { clamp, distance } from './rules.ts';

export function drawTethers(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const t = g.tethers;
  c.save();
  c.lineWidth = 1.4;
  c.strokeStyle = '#a7c9c6';
  if (t.mark) {
    const p = t.mark.enemy.body.position;
    c.globalAlpha = clamp((t.mark.until - g.time) / 0.3, 0, 1);
    c.beginPath();
    c.arc(p.x, p.y, 5, 0, Math.PI * 2);
    c.stroke();
  }
  const l = t.link;
  if (l) {
    const a = l.a.body.position,
      b = l.b.body.position;
    c.globalAlpha = clamp((l.until - g.time) / 0.35, 0, 1);
    c.strokeStyle = l.tension > 0.7 && g.mods.includes('snapback') ? '#ecd0a0' : '#a7c9c6';
    const sag = Math.min(16, Math.max(0, l.length - distance(a, b)) * 0.3 + 5 * (1 - l.tension));
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag, b.x, b.y);
    c.stroke();
    for (const p of [a, b]) {
      c.fillStyle = c.strokeStyle;
      c.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
  }
  for (const f of t.effects) {
    const life = clamp(1 - (g.time - f.at) / 0.18, 0, 1);
    c.globalAlpha = life * (reduced ? 0.35 : 0.7);
    c.strokeStyle = f.snapped ? '#ecd0a0' : '#a7c9c6';
    const span = f.snapped ? 0.35 * life : 0.12 * life;
    for (const [a, b] of [
      [f.a, f.b],
      [f.b, f.a],
    ]) {
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(a.x + (b.x - a.x) * span, a.y + (b.y - a.y) * span);
      c.stroke();
    }
  }
  c.restore();
}
