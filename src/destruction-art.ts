import type { Breakable } from './destruction.ts';

export function drawCracks(c: CanvasRenderingContext2D, piece: Breakable, reduced: boolean) {
  const { x, y, w, h } = piece.rect;
  const damage = 1 - Math.max(0, piece.hp / piece.maxHp);
  c.save();
  c.beginPath();
  c.rect(x + 2, y + 2, w - 4, h - 4);
  c.clip();
  if (piece.flash > 0 && !reduced) {
    c.fillStyle = '#c6d1c6';
    c.globalAlpha = 0.16;
    c.fillRect(x, y, w, h);
    c.globalAlpha = 1;
  }
  c.strokeStyle = '#a9b3a4';
  c.globalAlpha = 0.5 + damage * 0.3;
  c.lineWidth = 1.2;
  // Existing cracks identify weak material; branches spread as it takes hits.
  for (let i = 0; i < 1 + Math.floor(damage * 3); i++) {
    const cx = x + w * (0.25 + i * 0.17);
    c.beginPath();
    c.moveTo(cx - 9, y + 3);
    c.lineTo(cx + 2, y + h * 0.32);
    c.lineTo(cx - 5, y + h * 0.57);
    c.lineTo(cx + 8, y + h - 3);
    c.moveTo(cx - 5, y + h * 0.57);
    c.lineTo(cx - 17, y + h * 0.68);
    c.stroke();
  }
  c.restore();
}
