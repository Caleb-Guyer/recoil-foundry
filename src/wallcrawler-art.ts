import type { Enemy, Game } from './game.ts';
import { CRAWLER } from './wallcrawler.ts';
import { clamp, distance } from './rules.ts';

export function drawWallcrawler(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const rig = e.crawler!,
    p = e.body.position,
    fallen = rig.vulnerable > 0;
  c.save();
  if (e.spawn <= 0 && (e.state === 'windup' || e.state === 'followup') && rig.support) {
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
  c.save();
  c.rotate(
    fallen && !reduced
      ? Math.atan2(rig.normal.y, rig.normal.x) + Math.PI / 2 + g.time * 3
      : Math.atan2(rig.normal.y, rig.normal.x) + Math.PI / 2,
  );
  const gait = reduced || e.state !== 'idle' ? 0 : Math.sin(rig.travel * 0.2) * 2;
  c.strokeStyle = fallen ? '#bf9974' : '#929d9b';
  c.lineWidth = 2;
  for (const side of [-1, 1])
    for (const row of [-1, 1]) {
      c.beginPath();
      c.moveTo(side * 7, row * 5);
      c.lineTo(side * (15 + row * gait), row * 9);
      c.lineTo(side * (18 + row * gait), fallen ? row * 13 : 17);
      c.lineTo(side * (22 + row * gait), fallen ? row * 13 : 17);
      c.stroke();
    }
  c.fillStyle = e.flash > 0 ? '#ffe0bd' : '#343d40';
  c.strokeStyle = '#a77665';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-11, -9);
  c.lineTo(-5, -13);
  c.lineTo(8, -11);
  c.lineTo(12, 0);
  c.lineTo(8, 10);
  c.lineTo(-9, 10);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = fallen ? '#f3c58d' : '#d97761';
  c.fillRect(-5, -5, 10, 7);
  if (fallen) {
    c.fillStyle = '#392b24';
    c.fillRect(-1, -6, 2, 9);
  }
  c.restore();
  c.rotate(Math.atan2(e.aim.y, e.aim.x));
  c.fillStyle = '#c7816c';
  c.fillRect(7, -3, 18, 6);
  c.fillStyle = '#efd4aa';
  c.fillRect(23, -2, 3, 4);
  c.restore();
  if (e.hp < e.maxHp) {
    c.fillStyle = '#443934';
    c.fillRect(p.x - 16, p.y - 30, 32, 3);
    c.fillStyle = fallen ? '#f3c58d' : '#d97761';
    c.fillRect(p.x - 16, p.y - 30, 32 * Math.max(0, e.hp / e.maxHp), 3);
  }
}
