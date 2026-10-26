import type { Enemy, Game } from './game.ts';
import { WORKSHOP_INCOMING_WARNING } from './workshop.ts';
import { clamp } from './rules.ts';

export function drawWorkshopTarget(c: CanvasRenderingContext2D, e: Enemy) {
  const p = e.body.position;
  c.save();
  c.translate(p.x, p.y);
  c.rotate(e.body.angle);
  c.globalAlpha = e.spawn > 0 ? 0.4 : 1;
  c.fillStyle = e.flash > 0 ? '#dce6db' : '#283b3c';
  c.strokeStyle = '#9cadab';
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(-15, -16, 30, 32, 3);
  c.fill();
  c.stroke();
  c.strokeStyle = '#dcab78';
  c.beginPath();
  c.arc(0, 0, 9, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.arc(0, 0, 3, 0, Math.PI * 2);
  c.stroke();
  if (e.workshopTarget?.firing) {
    c.strokeStyle = e.state === 'windup' ? '#f3c68b' : '#8eaaa8';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(e.aim.x * 25, e.aim.y * 25);
    c.stroke();
  }
  if (e.elite === 'shielded') {
    c.strokeStyle = e.shieldFlash > 0 ? '#fff1c7' : '#dbca97';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(e.facing * 20, -19);
    c.lineTo(e.facing * 20, 19);
    c.stroke();
  }
  if (e.hp < e.maxHp) {
    c.fillStyle = '#415254';
    c.fillRect(-17, -25, 34, 3);
    c.fillStyle = '#dcab78';
    c.fillRect(-17, -25, 34 * Math.max(0, e.hp / e.maxHp), 3);
  }
  c.restore();
}

export function drawWorkshopMounts(c: CanvasRenderingContext2D, g: Game) {
  if (!g.workshop.active) return;
  c.save();
  c.strokeStyle = '#536568';
  c.lineWidth = 1.5;
  for (const target of g.workshop.targets) {
    const x = target.x,
      y = target.y + 17;
    c.beginPath();
    c.moveTo(x - 22, y - 2);
    c.lineTo(x + 22, y - 2);
    c.stroke();
  }
  // A full locked aim warning uses the actual projectile direction and cover.
  for (const e of g.enemies) {
    if (!e.workshopTarget?.firing || e.spawn > 0 || e.state !== 'windup' || e.hp <= 0) continue;
    const p = e.body.position;
    const end = g.lineEnd(p, { x: p.x + e.aim.x * 1500, y: p.y + e.aim.y * 1500 }, 5);
    c.strokeStyle = '#f3c68b';
    c.lineWidth = 1.5;
    c.setLineDash([7, 8]);
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(end.x, end.y);
    c.stroke();
    c.setLineDash([]);
    c.lineWidth = 2;
    c.beginPath();
    c.arc(
      p.x,
      p.y,
      25,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * clamp(1 - e.timer / WORKSHOP_INCOMING_WARNING, 0, 1),
    );
    c.stroke();
  }
  // Sparse height ticks make recoil progress readable without another meter.
  const wall = g.workshop.scenario === 'recoil' ? 1080 : 1880;
  for (const y of [650, 500, 350, 200]) {
    c.beginPath();
    c.moveTo(wall - 10, y);
    c.lineTo(wall, y);
    c.stroke();
  }
  c.restore();
}
