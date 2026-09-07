import type { Enemy, Game, Shot } from './game.ts';
import { TURBINE_LOCK, TURBINE_RANGE } from './turbine.ts';
import { clamp, distance } from './rules.ts';

export function drawBlade(c: CanvasRenderingContext2D, s: Shot, time: number, reduced: boolean) {
  c.save();
  c.translate(s.pos.x, s.pos.y);
  c.rotate(reduced ? 0 : time * 15 + s.id);
  c.fillStyle = '#bf795f';
  c.strokeStyle = '#ffd5a1';
  c.lineWidth = 1.5;
  c.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      r = i % 2 ? 6 : s.radius;
    if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = '#263c40';
  c.beginPath();
  c.arc(0, 0, 3, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
export function drawTurbine(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const rig = e.turbine!;
  const warning = e.spawn <= 0 && e.state === 'windup';
  const active = e.spawn <= 0 && e.state === 'rush';
  const open = e.state === 'recover';
  const locked = active || e.timer <= TURBINE_LOCK;
  c.save();
  if (warning || active) {
    const from = rig.origin;
    if (e.attack === 'gust') {
      const d = e.aim,
        n = { x: -d.y, y: d.x };
      c.strokeStyle = '#a7d5c9';
      c.lineWidth = 1;
      c.globalAlpha = active ? 0.33 : 0.12;
      const travel = active && !reduced ? (rig.active * 260) % 90 : 0;
      for (let row = -3; row <= 3; row++)
        for (let along = 85 + travel; along < TURBINE_RANGE; along += 90) {
          const across = (row / 3) * (48 + along * 0.14);
          const p = {
            x: from.x + d.x * along + n.x * across,
            y: from.y + d.y * along + n.y * across,
          };
          if (distance(g.lineEnd(from, p), p) > 0.1) continue;
          c.beginPath();
          c.moveTo(p.x - d.x * 10 + n.x * 3, p.y - d.y * 10 + n.y * 3);
          c.lineTo(p.x, p.y);
          c.lineTo(p.x - d.x * 10 - n.x * 3, p.y - d.y * 10 - n.y * 3);
          c.stroke();
        }
    }
    for (const [i, angle] of rig.angles.entries()) {
      const order = e.phase === 2 ? rig.angles.length - 1 - i : i;
      if (active && rig.sent > order + (e.attack === 'gust' ? rig.angles.length : 0)) continue;
      const d = { x: Math.cos(angle), y: Math.sin(angle) };
      const end = g.lineEnd(from, { x: from.x + d.x * 880, y: from.y + d.y * 880 }, 11);
      if (distance(from, end) < 62) continue;
      c.globalAlpha = locked ? 0.12 : 0.07;
      c.strokeStyle = '#edaa77';
      c.lineWidth = 22;
      c.beginPath();
      c.moveTo(from.x + d.x * 62, from.y + d.y * 62);
      c.lineTo(end.x, end.y);
      c.stroke();
      c.globalAlpha = locked ? 0.62 : 0.3;
      c.lineWidth = locked ? 1.5 : 1;
      c.setLineDash(locked ? [] : [6, 9]);
      c.stroke();
      c.setLineDash([]);
    }
  }
  c.globalAlpha = clamp(1 - e.spawn / 0.65, 0.15, 1);
  c.translate(e.body.position.x, e.body.position.y);
  c.fillStyle = e.flash > 0 ? '#fff0cf' : '#20383c';
  c.strokeStyle = '#8fa89a';
  c.lineWidth = 2.5;
  c.beginPath();
  c.roundRect(-45, -45, 90, 90, 15);
  c.fill();
  c.stroke();
  for (const x of [-34, 34])
    for (const y of [-34, 34]) {
      c.fillStyle = '#c6ae82';
      c.fillRect(x - 2, y - 2, 4, 4);
    }
  c.strokeStyle = '#557a76';
  c.lineWidth = 4;
  c.beginPath();
  c.arc(0, 0, 36, 0, Math.PI * 2);
  c.stroke();
  c.save();
  c.rotate(reduced ? 0 : g.time * (active ? 9 : warning ? 5 : open ? 0.8 : 2));
  for (let i = 0; i < 3; i++) {
    c.rotate((Math.PI * 2) / 3);
    c.fillStyle = open ? '#b3976b' : '#8db8ab';
    c.beginPath();
    c.moveTo(5, -6);
    c.lineTo(31, -13);
    c.lineTo(33, -3);
    c.lineTo(13, 10);
    c.lineTo(4, 5);
    c.closePath();
    c.fill();
    c.strokeStyle = '#c0d8bc';
    c.lineWidth = 1;
    c.stroke();
  }
  c.restore();
  c.fillStyle = open ? '#f3ce8e' : '#304c4c';
  c.strokeStyle = open ? '#fff0b8' : '#c79d76';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(0, 0, open ? 14 : 11, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  if (!open) {
    c.fillStyle = '#879d8b';
    for (let x = -7; x < 9; x += 7) c.fillRect(x, -8, 3, 16);
  }
  for (let i = 0; i < 3; i++) {
    c.fillStyle = i <= e.phase ? '#f1c78d' : '#476360';
    c.fillRect(-12 + i * 10, -42, 5, 3);
  }
  if (e.hp < e.maxHp) {
    c.fillStyle = '#483e34';
    c.fillRect(-40, -57, 80, 3);
    c.fillStyle = '#e9b584';
    c.fillRect(-40, -57, (80 * e.hp) / e.maxHp, 3);
  }
  c.restore();
}
