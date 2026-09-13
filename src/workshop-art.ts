import type { Enemy, Game } from './game.ts';

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
  for (const [x, y] of [
    [500, 740],
    [780, 740],
    [1040, 740],
    [1420, 590],
  ]) {
    c.beginPath();
    c.moveTo(x - 22, y - 2);
    c.lineTo(x + 22, y - 2);
    c.stroke();
  }
  // Sparse height ticks make recoil progress readable without another meter.
  for (const y of [650, 500, 350, 200]) {
    c.beginPath();
    c.moveTo(1870, y);
    c.lineTo(1880, y);
    c.stroke();
  }
  c.restore();
}
