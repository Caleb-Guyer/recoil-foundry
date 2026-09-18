import type { Enemy, Game } from './game.ts';
import { COURIER_DOOR, COURIER_DOOR_TIME } from './courier.ts';

function caseArt(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = '#3c3328';
  c.strokeStyle = '#edc486';
  c.lineWidth = 2;
  c.fillRect(x - 13, y - 10, 26, 20);
  c.strokeRect(x - 13, y - 10, 26, 20);
  c.strokeRect(x - 5, y - 14, 10, 4);
  c.fillStyle = '#fbe0ac';
  c.fillRect(x - 3, y - 6, 6, 12);
}

export function drawCourier(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const p = e.body.position,
    rig = g.courier;
  c.save();
  c.translate(p.x, p.y);
  c.scale(e.facing || 1, 1);
  c.globalAlpha = e.spawn > 0 ? 0.5 : 1;
  c.fillStyle = e.flash > 0 ? '#fff0ca' : '#50483b';
  c.strokeStyle = '#d6b784';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-14, -10);
  c.lineTo(7, -13);
  c.lineTo(17, -4);
  c.lineTo(13, 11);
  c.lineTo(-13, 11);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = '#efd4a4';
  c.fillRect(7, -6, 9, 3);
  c.strokeStyle = '#82755f';
  for (const x of [-9, 9]) {
    c.beginPath();
    c.arc(x, 13, 5, 0, Math.PI * 2);
    c.stroke();
  }
  caseArt(c, -3, -3);
  if (rig.boost > 0) {
    c.strokeStyle = '#edc486';
    c.lineWidth = 3;
    const len = reduced ? 10 : 14 + Math.sin(g.time * 80) * 4;
    c.beginPath();
    c.moveTo(-17, 4);
    c.lineTo(-17 - len, 4);
    c.stroke();
  }
  // Damage is readable on the cargo latch, without another floating health bar.
  c.fillStyle = '#3c3328';
  c.fillRect(-13, 7, 26, 3);
  c.fillStyle = '#edc486';
  c.fillRect(-13, 7, 26 * Math.max(0, e.hp / e.maxHp), 3);
  c.restore();
}

export function drawCourierWorld(c: CanvasRenderingContext2D, g: Game) {
  if (!g.level.courier) return;
  const rig = g.courier,
    { x, y } = COURIER_DOOR;
  const opening = Math.min(1, rig.opening / COURIER_DOOR_TIME);
  c.save();
  c.fillStyle = '#15191b';
  c.fillRect(x - 29, y - 65, 58, 65);
  c.strokeStyle = '#5b5548';
  c.lineWidth = 3;
  c.strokeRect(x - 30, y - 66, 60, 66);
  c.save();
  c.beginPath();
  c.rect(x - 27, y - 62, 54, 62);
  c.clip();
  c.fillStyle = '#393a35';
  c.fillRect(x - 27, y - 62 - opening * 64, 54, 62);
  c.strokeStyle = '#666052';
  c.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.moveTo(x - 25, y - 8 - i * 12 - opening * 64);
    c.lineTo(x + 25, y - 8 - i * 12 - opening * 64);
    c.stroke();
  }
  c.restore();
  c.fillStyle = rig.enemy ? '#d3aa69' : '#56564d';
  c.fillRect(x - 12, y - 73, 24, 3);
  if (rig.cargo) {
    c.save();
    c.translate(rig.cargo.position.x, rig.cargo.position.y);
    c.rotate(rig.cargo.angle);
    caseArt(c, 0, 0);
    c.restore();
  }
  if (rig.state?.status === 'collected') {
    // The recovered case waits beside the normal reward exit.
    caseArt(c, 1862, 728);
  }
  c.restore();
}
