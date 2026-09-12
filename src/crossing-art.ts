import type { Game } from './game.ts';
import { CROSSING } from './crossing-layout.ts';

export function drawCrossing(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  if (!g.crossing.active) return;
  const train = g.crossing,
    warning = train.phase === 'warning';
  c.save();
  // Track hardware and sparse signals belong to the room, with no additional HUD.
  c.fillStyle = '#38474c';
  c.fillRect(0, 742, 2000, 3);
  for (let x = 20; x < 2000; x += 48) c.fillRect(x, 748, 22, 3);
  for (const x of [50, 420, 820, 1220, 1620, 1950]) {
    c.fillStyle = '#344449';
    c.fillRect(x - 2, 608, 4, 132);
    c.fillRect(x - 7, 736, 14, 4);
    c.fillStyle = '#15262c';
    c.fillRect(x - 10, 604, 20, 32);
    const lit = warning && (reduced || Math.floor(g.time * (train.timer < 1 ? 5 : 3)) % 2 === 0);
    c.fillStyle = lit || train.blocked ? '#eabd75' : '#536260';
    c.beginPath();
    c.arc(x, 613, 4, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = warning || train.phase === 'passing' ? '#eabd75' : '#536260';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x - train.direction * 3, 621);
    c.lineTo(x + train.direction * 3, 625);
    c.lineTo(x - train.direction * 3, 629);
    c.stroke();
  }
  // Suspended girders make the permanent upper route read as a catwalk.
  c.strokeStyle = '#35484b';
  c.lineWidth = 2;
  for (const s of g.level.solids) {
    for (const x of [s.x + 12, s.x + s.w - 12]) {
      c.beginPath();
      c.moveTo(x, 90);
      c.lineTo(x, s.y);
      c.stroke();
    }
  }
  for (const [i, car] of train.cars.entries()) {
    const x = car.body.position.x - CROSSING.width / 2,
      y = CROSSING.top;
    c.fillStyle = '#101e24';
    c.fillRect(x, y, CROSSING.width, CROSSING.height);
    c.fillStyle = i === 0 ? '#344c50' : '#3c4949';
    c.fillRect(x + 6, y + 7, CROSSING.width - 12, 71);
    c.strokeStyle = '#516567';
    c.lineWidth = 1;
    for (let p = x + 20; p < x + CROSSING.width - 10; p += 20) {
      c.beginPath();
      c.moveTo(p, y + 11);
      c.lineTo(p, y + 71);
      c.stroke();
    }
    c.fillStyle = '#8b9e9b';
    c.fillRect(x, y, CROSSING.width, 3);
    c.fillStyle = '#25363c';
    c.fillRect(x + 4, y + 81, CROSSING.width - 8, 9);
    for (const wheel of [x + 40, x + CROSSING.width - 40]) {
      c.fillStyle = '#111f25';
      c.beginPath();
      c.arc(wheel, 728, 12, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#6a7d7d';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(wheel, 728, 8, 0, Math.PI * 2);
      c.stroke();
      const angle = reduced ? 0 : car.body.position.x / 12;
      c.beginPath();
      c.moveTo(wheel - Math.cos(angle) * 7, 728 - Math.sin(angle) * 7);
      c.lineTo(wheel + Math.cos(angle) * 7, 728 + Math.sin(angle) * 7);
      c.stroke();
    }
    // The lit end is the dangerous leading bumper; the roof has a quiet, continuous edge.
    const front = train.direction > 0 ? x + CROSSING.width - 8 : x + 3;
    c.fillStyle = '#d6b57c';
    c.fillRect(front, y + 10, 5, 7);
    c.fillStyle = '#ac946b';
    for (let j = 0; j < 3; j++) c.fillRect(front, y + 35 + j * 12, 5, 5);
  }
  c.restore();
}
