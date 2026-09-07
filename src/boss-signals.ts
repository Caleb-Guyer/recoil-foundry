import type { Enemy, Game } from './game.ts';
import { flakAngles, bossMuzzle, FLAK_LOCK, FLAK_TELL } from './enemies.ts';
import { clamp } from './rules.ts';

export function drawBossSignal(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  reduced: boolean,
): void {
  if (e.spawn > 0) return;
  if (e.kind === 'boss' && e.state === 'transition') {
    c.save();
    c.translate(e.body.position.x, e.body.position.y);
    // Narrow seams and an exposed warm center read as armor, not immunity.
    for (const side of [-1, 1]) {
      c.save();
      c.scale(side, 1);
      c.fillStyle = e.flash > 0 ? '#bfc4ae' : '#566660';
      c.beginPath();
      c.moveTo(2, -24);
      c.lineTo(34, -24);
      c.lineTo(38, -20);
      c.lineTo(38, 20);
      c.lineTo(34, 24);
      c.lineTo(2, 24);
      c.closePath();
      c.fill();
      for (let y = -15; y <= 15; y += 10) {
        c.fillStyle = '#293a34';
        c.fillRect(4, y, 31, 2);
        c.fillStyle = '#78877a';
        c.fillRect(4, y + 2, 29, 1);
      }
      c.fillStyle = '#9aa38c';
      c.fillRect(3, -24, 29, 1.5);
      c.fillRect(31, -19, 2, 5);
      c.fillRect(31, 14, 2, 5);
      c.restore();
    }
    c.fillStyle = e.flash > 0 ? '#ffe7b2' : '#d39470';
    c.fillRect(-1, -4, 2, 8);
    c.strokeStyle = '#b0ac88';
    c.lineWidth = 1.5;
    c.globalAlpha *= reduced ? 0.25 : 0.22 + (Math.sin(g.time * 4) + 1) * 0.035;
    for (let i = 0; i < 4; i++) {
      const center = Math.PI / 4 + (i * Math.PI) / 2;
      c.beginPath();
      c.arc(0, 0, 55, center - 0.28, center + 0.28);
      c.stroke();
    }
    c.restore();
    return;
  }
  if ((e.kind !== 'loader' && e.kind !== 'press') || e.state !== 'windup' || e.attack !== 'flak')
    return;

  const origin = bossMuzzle(e),
    aim = Math.atan2(e.aim.y, e.aim.x),
    locked = e.timer <= FLAK_LOCK,
    charge = clamp(1 - e.timer / FLAK_TELL, 0, 1),
    angles = flakAngles(aim, e.phase === 1),
    center = Math.floor(angles.length / 2);
  c.save();
  c.setLineDash(locked ? [] : [5, 8]);
  for (const [i, angle] of angles.entries()) {
    const end = g.lineEnd(origin, {
      x: origin.x + Math.cos(angle) * 380,
      y: origin.y + Math.sin(angle) * 380,
    });
    c.strokeStyle = locked ? (i === center ? '#ffe0a4' : '#d5ad73') : '#96714e';
    c.lineWidth = i === center ? 1.25 : 0.9;
    c.beginPath();
    c.moveTo(origin.x, origin.y);
    c.lineTo(end.x, end.y);
    c.stroke();
  }
  c.setLineDash([]);
  c.translate(origin.x, origin.y);
  c.fillStyle = '#575d53';
  c.fillRect(-10, 3, 20, 7);
  c.fillStyle = '#938871';
  c.fillRect(-8, 3, 16, 2);
  c.save();
  c.rotate(aim);
  c.fillStyle = '#b09873';
  c.fillRect(2, -3, 19, 6);
  c.fillStyle = '#ded1a9';
  c.fillRect(4, -3, 14, 1.5);
  c.fillStyle = '#534c3c';
  c.fillRect(17, -4, 5, 8);
  c.fillStyle = locked ? '#e8c38b' : '#9a7c52';
  c.fillRect(20, -2.5, 2, 5);
  c.restore();
  c.fillStyle = '#3b433b';
  c.beginPath();
  c.arc(0, 0, 7, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#9b8b6a';
  c.lineWidth = 1.5;
  c.stroke();
  const glow = reduced ? 0.07 : 0.04 + charge * 0.05 + (Math.sin(g.time * 5) + 1) * 0.01;
  c.fillStyle = `rgba(250,182,104,${glow})`;
  c.beginPath();
  c.arc(0, 0, 10, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = locked ? '#ffe1a5' : '#d09b63';
  c.beginPath();
  c.arc(0, 0, 2.2 + charge * 1.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
