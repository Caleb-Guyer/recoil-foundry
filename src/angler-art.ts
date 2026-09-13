import type { Enemy, Game } from './game.ts';
import { ANGLER, anglerSurfaceValid, anglerWarningPoints } from './angler.ts';
import { clamp } from './rules.ts';

export function drawAngler(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const rig = e.angler!,
    p = e.body.position,
    exposed = rig.exposed > 0;
  c.save();
  const plan = rig.plan;
  if (e.spawn <= 0 && e.state === 'windup' && plan && anglerSurfaceValid(g, plan)) {
    const locked = e.timer <= ANGLER.lock;
    c.strokeStyle = '#e9ab82';
    c.lineWidth = locked ? 1.5 : 1;
    c.globalAlpha = locked ? 0.72 : 0.35;
    c.setLineDash(locked ? [] : [5, 7]);
    c.beginPath();
    c.moveTo(plan.start.x, plan.start.y);
    const points = anglerWarningPoints(g, e);
    for (const point of points.slice(1)) c.lineTo(point.x, point.y);
    c.stroke();
    c.setLineDash([]);
    // A small fixed diamond identifies the bank, without filling the lane.
    if (points.length === 3) {
      c.beginPath();
      c.moveTo(plan.bounce.x, plan.bounce.y - 6);
      c.lineTo(plan.bounce.x + 6, plan.bounce.y);
      c.lineTo(plan.bounce.x, plan.bounce.y + 6);
      c.lineTo(plan.bounce.x - 6, plan.bounce.y);
      c.closePath();
      c.stroke();
    }
  }
  c.globalAlpha = clamp(1 - e.spawn / 0.65, 0.15, 1);
  c.translate(p.x, p.y);
  const gait = reduced ? 0 : Math.sin(p.x * 0.16) * Math.min(2, Math.abs(e.body.velocity.x));
  c.strokeStyle = '#88918c';
  c.lineWidth = 3;
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(side * 8, 8);
    c.lineTo(side * 12, 14);
    c.lineTo(side * 17 + gait * side, 14);
    c.stroke();
  }
  c.fillStyle = e.flash > 0 ? '#ffdebb' : '#303a3c';
  c.strokeStyle = '#c48169';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-13, 9);
  c.lineTo(-13, -7);
  c.lineTo(-5, -15);
  c.lineTo(12, -10);
  c.lineTo(14, 8);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = exposed ? '#f4cb88' : '#d77962';
  c.fillRect(-6, -6, 12, 9);
  c.fillStyle = '#344244';
  if (!exposed) {
    c.fillRect(-6, -6, 5, 9);
    c.fillRect(2, -6, 4, 9);
  }
  c.translate(0, -5);
  c.rotate(Math.atan2(e.aim.y, e.aim.x));
  c.fillStyle = '#b6b5a1';
  c.fillRect(3, -3, 22, 6);
  c.strokeStyle = '#e2b68e';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(16, -5);
  c.lineTo(22, -8);
  c.lineTo(26, -4);
  c.stroke();
  c.fillStyle = '#e5c7a0';
  c.fillRect(24, -2, 3, 4);
  c.restore();
  if (e.hp < e.maxHp) {
    c.fillStyle = '#443934';
    c.fillRect(p.x - 16, p.y - 28, 32, 3);
    c.fillStyle = exposed ? '#f4cb88' : '#d77962';
    c.fillRect(p.x - 16, p.y - 28, 32 * Math.max(0, e.hp / e.maxHp), 3);
  }
}
