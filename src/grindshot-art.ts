import type { Game } from './game.ts';
import { GRIND } from './grindshot.ts';

export function drawGrindshot(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  for (const saw of g.grind.saws) {
    c.save();
    c.globalAlpha = Math.min(1, saw.life / 0.18);
    c.strokeStyle = '#d4c895';
    c.lineWidth = 1.4;
    if (!reduced) {
      c.globalAlpha *= 0.25;
      c.beginPath();
      saw.trail.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.stroke();
      c.globalAlpha = Math.min(1, saw.life / 0.18);
    }
    c.translate(saw.pos.x, saw.pos.y);
    c.rotate(reduced ? 0 : saw.travel / GRIND.radius);
    c.fillStyle = '#283332';
    c.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12,
        r = i % 3 === 0 ? 9 : 6;
      if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#eee6c7';
    c.fillRect(-1.5, -1.5, 3, 3);
    c.restore();
  }
}
