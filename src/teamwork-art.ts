import type { Enemy, Game } from './game.ts';
import { clamp } from './rules.ts';

export function drawSupport(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const rig = e.support!,
    p = e.body.position,
    repair = e.kind === 'repairer';
  const color = repair ? '#a8d9c3' : '#efc477';
  const partner = g.teamwork.partner(e);
  c.save();
  if (partner && e.spawn <= 0) {
    const q = partner.body.position,
      charging = rig.phase === 'windup';
    c.strokeStyle = '#152729';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(q.x, q.y);
    c.stroke();
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.setLineDash(charging ? [5, 7] : []);
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(q.x, q.y, 23, 0, Math.PI * 2);
    c.stroke();
    // Shape cues remain still and visible with Reduced effects.
    c.beginPath();
    if (repair) {
      c.moveTo(q.x - 5, q.y - 29);
      c.lineTo(q.x + 5, q.y - 29);
      c.moveTo(q.x, q.y - 34);
      c.lineTo(q.x, q.y - 24);
    } else {
      c.moveTo(q.x + 2, q.y - 36);
      c.lineTo(q.x - 3, q.y - 29);
      c.lineTo(q.x + 3, q.y - 29);
      c.lineTo(q.x - 2, q.y - 23);
    }
    c.stroke();
  }
  c.globalAlpha = clamp(1 - e.spawn / 0.65, 0.15, 1);
  c.translate(p.x, p.y);
  c.fillStyle = e.flash > 0 ? '#fff1d2' : '#263c40';
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(-14, -13, 28, 26, repair ? 10 : 3);
  c.fill();
  c.stroke();
  c.fillStyle = rig.phase === 'spent' ? '#667775' : color;
  if (repair) {
    c.fillRect(-7, -2, 14, 4);
    c.fillRect(-2, -7, 4, 14);
  } else {
    c.beginPath();
    c.moveTo(3, -9);
    c.lineTo(-5, 1);
    c.lineTo(1, 1);
    c.lineTo(-3, 9);
    c.lineTo(6, -2);
    c.lineTo(0, -2);
    c.closePath();
    c.fill();
  }
  c.strokeStyle = '#8fa4a1';
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(side * 12, 7);
    c.lineTo(side * 20, 10);
    c.lineTo(side * 25, 4);
    c.stroke();
    c.fillStyle = '#425f62';
    c.fillRect(side * 22 - 5, -17, 10, 4);
    c.strokeStyle = color;
    c.beginPath();
    c.moveTo(side * 22 - 7, -19);
    c.lineTo(side * 22 + 7, -19);
    c.stroke();
  }
  if (!reduced && rig.phase !== 'spent') {
    c.fillStyle = color;
    c.globalAlpha *= 0.4 + Math.sin(g.time * 4) * 0.1;
    c.fillRect(-6, 15, 12, 3);
  }
  c.restore();
  if (e.hp < e.maxHp) {
    c.fillStyle = '#384447';
    c.fillRect(p.x - 16, p.y - 28, 32, 3);
    c.fillStyle = color;
    c.fillRect(p.x - 16, p.y - 28, 32 * Math.max(0, e.hp / e.maxHp), 3);
  }
}
