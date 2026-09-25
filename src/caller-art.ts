import type { Enemy, Game } from './game.ts';
import { CALLER } from './caller.ts';
import { clamp, direction } from './rules.ts';

const red = '#ed735d',
  blue = '#79bdff';
export function drawCallerWarnings(c: CanvasRenderingContext2D, g: Game) {
  for (const e of [...g.enemies, ...g.factions.allies]) {
    const r = e.caller;
    if (!r || r.phase === 'ready' || e.hp <= 0 || e.spawn > 0) continue;
    const locked = r.phase !== 'recording';
    c.save();
    c.strokeStyle = e.allied ? blue : red;
    c.lineWidth = locked ? 2 : 1.5;
    c.setLineDash(locked ? [] : [3, 4]);
    for (let i = r.next; i < r.marks.length; i++) {
      const p = r.marks[i],
        radius = 12 + i * 4;
      c.beginPath();
      c.arc(p.x, p.y, radius, 0, Math.PI * 2);
      c.stroke();
      if (locked) {
        c.beginPath();
        c.moveTo(p.x - radius - 4, p.y);
        c.lineTo(p.x - radius + 4, p.y);
        c.moveTo(p.x + radius - 4, p.y);
        c.lineTo(p.x + radius + 4, p.y);
        c.stroke();
      }
    }
    // Only the next lane is drawn, including the shot's path beyond the mark.
    if (locked) {
      const p = e.body.position,
        d = direction(p, r.marks[r.next]);
      const end = g.lineEnd(p, { x: p.x + d.x * CALLER.range, y: p.y + d.y * CALLER.range }, 5);
      c.globalAlpha = 0.5;
      c.lineWidth = 1;
      c.setLineDash([5, 7]);
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(end.x, end.y);
      c.stroke();
    }
    c.restore();
  }
}
export function drawCaller(c: CanvasRenderingContext2D, e: Enemy, reduced: boolean) {
  const r = e.caller,
    color = e.allied ? blue : red;
  c.save();
  c.translate(e.body.position.x, e.body.position.y);
  c.globalAlpha = e.spawn > 0 ? clamp(1 - e.spawn / 0.65, 0.2, 1) : 1;
  c.fillStyle = '#1b1821';
  c.strokeStyle = e.flash > 0 && !reduced ? '#fff1da' : color;
  c.lineWidth = 2;
  // A horn and narrow pedestal distinguish the Caller from the Switchman's radio box.
  c.fillRect(-8, 1, 16, 16);
  c.strokeRect(-8, 1, 16, 16);
  c.fillStyle = color;
  c.fillRect(-16, 15, 32, 3);
  c.save();
  c.rotate(Math.atan2(e.aim.y, e.aim.x));
  c.fillStyle = '#1b1821';
  c.beginPath();
  c.moveTo(-12, -7);
  c.lineTo(14, -15);
  c.lineTo(14, 15);
  c.lineTo(-12, 7);
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(8, -11);
  c.lineTo(8, 11);
  c.stroke();
  c.restore();
  for (let i = 0; i < 3; i++) {
    c.fillStyle = r && i >= r.next && i < r.marks.length ? color : '#55434e';
    c.fillRect(-10 + i * 8, -24, 4, 4);
  }
  if (e.hp < e.maxHp) {
    c.fillStyle = '#4a353b';
    c.fillRect(-17, -32, 34, 2);
    c.fillStyle = color;
    c.fillRect(-17, -32, 34 * clamp(e.hp / e.maxHp, 0, 1), 2);
  }
  c.restore();
}
