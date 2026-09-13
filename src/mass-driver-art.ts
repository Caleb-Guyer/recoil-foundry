import type { Shot } from './game.ts';
import { clamp } from './rules.ts';
import { dropForgePower } from './mass-driver.ts';

export function drawMassRound(c: CanvasRenderingContext2D, s: Shot, reduced: boolean) {
  c.save();
  const points = s.trace?.points ?? [];
  c.strokeStyle = s.charged ? '#e1d9a7' : '#96afb0';
  c.lineWidth = 2;
  for (let i = 1; i < points.length; i++) {
    c.globalAlpha = ((reduced ? 0.18 : 0.32) * i) / points.length;
    c.beginPath();
    c.moveTo(points[i - 1].x, points[i - 1].y);
    c.lineTo(points[i].x, points[i].y);
    c.stroke();
  }
  c.globalAlpha = (s.echo ? 0.65 : 1) * clamp(s.life / 0.18, 0, 1);
  c.translate(s.pos.x, s.pos.y);
  const heat = clamp((dropForgePower(s) - 0.35) / 0.65, 0, 1);
  if (heat > 0) {
    c.save();
    c.globalAlpha *= heat;
    c.strokeStyle = '#edc785';
    if (!reduced) {
      c.shadowColor = '#e5ae5e';
      c.shadowBlur = 7 * heat;
    }
    c.lineWidth = 1.5 + heat;
    c.beginPath();
    c.arc(0, 0, s.radius + 1.5, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }
  c.fillStyle = '#45555b';
  c.strokeStyle = s.shell ? '#d5ab72' : s.charged ? '#ebe2aa' : '#d0d7ce';
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(0, 0, s.radius, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#aebfb8';
  c.beginPath();
  c.arc(-2, -2.3, s.radius * 0.37, 0, Math.PI * 2);
  c.fill();
  if (!reduced) c.rotate(s.massDriver!.spin);
  c.strokeStyle = '#748a8c';
  c.lineWidth = 1;
  c.beginPath();
  c.ellipse(0, 0, s.radius * 0.35, s.radius - 1, 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();
}
