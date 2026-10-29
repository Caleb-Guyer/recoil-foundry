import type { Enemy, Game } from './game.ts';
import { CRAWLER } from './wallcrawler.ts';
import { clamp, distance } from './rules.ts';
import { drawMachineBody, drawMachineContacts } from './machine-breakdown-art.ts';
import { SPLIT_SCALE } from './mutations.ts';

export function drawWallcrawler(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  reduced: boolean,
  portrait = false,
) {
  const rig = e.crawler!,
    p = e.body.position,
    fallen = rig.vulnerable > 0;
  c.save();
  if (
    !portrait &&
    e.spawn <= 0 &&
    (e.state === 'windup' || e.state === 'followup') &&
    rig.support
  ) {
    const locked = e.state === 'followup' || e.timer <= CRAWLER.lock;
    c.strokeStyle = '#ef9b7e';
    c.lineWidth = locked ? 1.5 : 1;
    c.globalAlpha = locked ? 0.65 : 0.3;
    c.setLineDash(locked ? [] : [4, 7]);
    for (const a of rig.angles.slice(rig.fired)) {
      const from = { x: rig.origin.x + Math.cos(a) * 26, y: rig.origin.y + Math.sin(a) * 26 };
      const end = g.lineEnd(
        rig.origin,
        { x: rig.origin.x + Math.cos(a) * 900, y: rig.origin.y + Math.sin(a) * 900 },
        5,
      );
      if (distance(rig.origin, end) < 26) continue;
      c.beginPath();
      c.moveTo(from.x, from.y);
      c.lineTo(end.x, end.y);
      c.stroke();
    }
    c.setLineDash([]);
  }
  c.globalAlpha = clamp(1 - e.spawn / 0.65, 0.15, 1);
  c.translate(p.x, p.y);
  if (e.splitChild) c.scale(SPLIT_SCALE, SPLIT_SCALE);
  drawMachineBody(c, g, e, reduced || portrait);
  if (!portrait) drawMachineContacts(c, g, e, reduced);
  c.restore();
  if (!portrait && e.hp < e.maxHp) {
    c.fillStyle = '#443934';
    c.fillRect(p.x - 16, p.y - 30, 32, 3);
    c.fillStyle = fallen ? '#f3c58d' : '#d97761';
    c.fillRect(p.x - 16, p.y - 30, 32 * Math.max(0, e.hp / e.maxHp), 3);
  }
}
