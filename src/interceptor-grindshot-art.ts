import type { Enemy, Game } from './game.ts';
import { grindPlanValid } from './interceptor-grindshot.ts';
import { direction, distance } from './rules.ts';

export function drawRivalGrind(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const rig = e.interceptor!;
  c.save();
  c.strokeStyle = '#ef7264';
  c.lineWidth = 2;
  if (e.spawn <= 0 && e.attack !== 'vault' && rig.move === 'grindshot' && e.state === 'windup') {
    for (const plan of rig.grindPlans) {
      if (!grindPlanValid(g, plan)) continue;
      c.globalAlpha = 0.75;
      c.beginPath();
      c.moveTo(plan.path[0].x, plan.path[0].y);
      for (const p of plan.path.slice(1)) c.lineTo(p.x, p.y);
      c.stroke();
      // Direction is readable without animation, including reduced motion.
      for (let i = 1; i < plan.path.length; i++) {
        const a = plan.path[i - 1],
          b = plan.path[i],
          d = direction(a, b);
        for (let u = 24; u < distance(a, b); u += 64) {
          const p = { x: a.x + d.x * u, y: a.y + d.y * u };
          c.beginPath();
          c.moveTo(p.x - d.x * 5 - d.y * 4, p.y - d.y * 5 + d.x * 4);
          c.lineTo(p.x, p.y);
          c.lineTo(p.x - d.x * 5 + d.y * 4, p.y - d.y * 5 - d.x * 4);
          c.stroke();
        }
      }
      c.beginPath();
      c.arc(plan.path[0].x, plan.path[0].y, 7, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.globalAlpha = 1;
  for (const saw of rig.saws) {
    c.save();
    c.translate(saw.pos.x, saw.pos.y);
    c.rotate(reduced ? 0 : saw.travel / 9);
    c.fillStyle = '#4b2927';
    c.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12,
        r = i % 3 === 0 ? 11 : 7;
      if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#ffc3ad';
    c.fillRect(-2, -2, 4, 4);
    c.restore();
  }
  c.restore();
}
