import type { Game } from './game.ts';
import { clamp } from './rules.ts';
import { SPOOF } from './subversion-rules.ts';

export function drawSpoof(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  if (!g.spoof.equipped) return;
  c.save();
  c.strokeStyle = '#79bdff';
  c.fillStyle = '#79bdff';
  c.lineWidth = 1.5;
  for (const ally of g.factions.allies) {
    if (ally.rebootUntil === undefined) continue;
    const x = ally.body.position.x,
      y = ally.body.bounds.min.y - 18;
    c.beginPath();
    c.moveTo(x - 5, y - 5);
    c.lineTo(x + 5, y - 5);
    c.lineTo(x + 5, y + 1);
    c.lineTo(x, y + 5);
    c.lineTo(x - 5, y + 1);
    c.closePath();
    c.stroke();
    const life = clamp((ally.rebootUntil - g.time) / (ally.rebootDuration ?? SPOOF.duration), 0, 1);
    c.fillRect(x - 12, y + 9, 24 * life, 2);
    if (g.mods.includes('dead-switch') && life < 0.3) {
      c.beginPath();
      c.arc(x, y, 9, -Math.PI / 2, Math.PI * 1.5);
      c.stroke();
    }
  }
  const target = g.spoof.target();
  if (target) {
    const b = target.body.bounds;
    for (const [x, dx] of [
      [b.min.x - 7, 1],
      [b.max.x + 7, -1],
    ])
      for (const [y, dy] of [
        [b.min.y - 7, 1],
        [b.max.y + 7, -1],
      ]) {
        c.beginPath();
        c.moveTo(x + dx * 6, y);
        c.lineTo(x, y);
        c.lineTo(x, y + dy * 6);
        c.stroke();
      }
  }
  for (const f of g.spoof.effects) {
    const life = clamp((g.time - f.at) / 0.32, 0, 1);
    c.globalAlpha = (1 - life) * (reduced ? 0.45 : 0.8);
    c.beginPath();
    for (const [i, end] of f.outline.entries()) {
      const x = f.pos.x + (end.x - f.pos.x) * (reduced ? 1 : 0.4 + 0.6 * life);
      const y = f.pos.y + (end.y - f.pos.y) * (reduced ? 1 : 0.4 + 0.6 * life);
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.closePath();
    c.stroke();
  }
  c.restore();
}
