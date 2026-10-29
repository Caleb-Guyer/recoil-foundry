import type { Enemy, Game } from './game.ts';
import { ANGLER, anglerSurfaceValid, anglerWarningPoints } from './angler.ts';
import { clamp } from './rules.ts';
import { drawMachineBody, drawMachineContacts } from './machine-breakdown-art.ts';
import { SPLIT_SCALE } from './mutations.ts';

export function drawAngler(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  reduced: boolean,
  portrait = false,
) {
  const rig = e.angler!,
    p = e.body.position,
    exposed = rig.exposed > 0;
  c.save();
  const plan = rig.plan;
  if (!portrait && e.spawn <= 0 && e.state === 'windup' && plan && anglerSurfaceValid(g, plan)) {
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
  if (e.splitChild) c.scale(SPLIT_SCALE, SPLIT_SCALE);
  drawMachineBody(c, g, e, reduced || portrait);
  if (!portrait) drawMachineContacts(c, g, e, reduced);
  c.restore();
  if (!portrait && e.hp < e.maxHp) {
    c.fillStyle = '#443934';
    c.fillRect(p.x - 16, p.y - 28, 32, 3);
    c.fillStyle = exposed ? '#f4cb88' : '#d77962';
    c.fillRect(p.x - 16, p.y - 28, 32 * Math.max(0, e.hp / e.maxHp), 3);
  }
}
