import type { Enemy, Game } from './game.ts';
import { CALLER } from './caller.ts';
import { clamp, direction } from './rules.ts';
import { drawMachineBody, drawMachineContacts } from './machine-breakdown-art.ts';
import { SPLIT_SCALE } from './mutations.ts';

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
export function drawCaller(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  reduced: boolean,
  portrait = false,
) {
  const color = e.allied ? blue : red;
  c.save();
  c.translate(e.body.position.x, e.body.position.y);
  c.globalAlpha = e.spawn > 0 ? clamp(1 - e.spawn / 0.65, 0.2, 1) : 1;
  if (e.splitChild) c.scale(SPLIT_SCALE, SPLIT_SCALE);
  drawMachineBody(c, g, e, reduced || portrait);
  if (!portrait) drawMachineContacts(c, g, e, reduced);
  if (!portrait && e.hp < e.maxHp) {
    c.fillStyle = '#4a353b';
    c.fillRect(-17, -32, 34, 2);
    c.fillStyle = color;
    c.fillRect(-17, -32, 34 * clamp(e.hp / e.maxHp, 0, 1), 2);
  }
  c.restore();
}
