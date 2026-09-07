import type { Game } from './game.ts';
import { DETOUR_DOOR } from './detours.ts';

export function drawDetourDoor(c: CanvasRenderingContext2D, g: Game) {
  if (!g.canDetour) return;
  const { x, floor } = DETOUR_DOOR;
  const color = g.clear ? '#e5b577' : '#73644f';
  c.save();
  c.fillStyle = '#221f1b';
  c.fillRect(x - 36, floor - 111, 72, 111);
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.strokeRect(x - 36, floor - 111, 72, 111);
  // Diagonal frame markings and a hazard triangle distinguish this entrance
  // even without color. Its label never reveals the fight waiting inside.
  c.lineWidth = 3;
  for (let side of [-1, 1])
    for (let y = floor - 99; y < floor - 10; y += 20) {
      c.beginPath();
      c.moveTo(x + side * 35, y);
      c.lineTo(x + side * 29, y + 7);
      c.stroke();
    }
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(x, floor - 88);
  c.lineTo(x - 15, floor - 62);
  c.lineTo(x + 15, floor - 62);
  c.closePath();
  c.stroke();
  c.fillStyle = color;
  c.fillRect(x - 1, floor - 79, 2, 8);
  c.fillRect(x - 1, floor - 68, 2, 2);
  c.font = '9px monospace';
  c.textAlign = 'center';
  c.fillText('CHALLENGE', x, floor - 124);
  if (g.clear) {
    c.font = '12px monospace';
    c.fillText('+1', x - 7, floor - 25);
    c.beginPath();
    c.moveTo(x + 13, floor - 36);
    c.lineTo(x + 20, floor - 29);
    c.lineTo(x + 13, floor - 22);
    c.lineTo(x + 6, floor - 29);
    c.closePath();
    c.stroke();
  } else {
    c.beginPath();
    c.moveTo(x - 9, floor - 40);
    c.lineTo(x + 9, floor - 22);
    c.moveTo(x + 9, floor - 40);
    c.lineTo(x - 9, floor - 22);
    c.stroke();
  }
  c.restore();
}
