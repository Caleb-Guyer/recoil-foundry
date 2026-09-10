import type { Game } from './game.ts';
import type { Vec } from './rules.ts';
import { FREIGHT } from './freight-layout.ts';

export function drawFreightScenery(
  c: CanvasRenderingContext2D,
  camera: Vec,
  width: number,
  height: number,
) {
  const sky = c.createLinearGradient(0, 0, width, 0);
  sky.addColorStop(0, '#191b1d');
  sky.addColorStop(0.5, '#171819');
  sky.addColorStop(1, '#23201e');
  c.fillStyle = sky;
  c.fillRect(0, 0, width, height);
  c.save();
  c.translate(-camera.x, -camera.y);
  c.fillStyle = '#282726';
  c.fillRect(610, FREIGHT.top, 780, 2100);
  c.fillStyle = '#1c1e20';
  c.fillRect(626, FREIGHT.top, 748, 2100);
  for (let y = -1250; y < 740; y += 180) {
    c.fillStyle = '#32312e';
    c.fillRect(290, y, 1420, 8);
    c.fillStyle = '#171b1d';
    c.fillRect(610, y - 2, 780, 12);
    for (const x of [316, 1676]) {
      c.fillStyle = '#4a4439';
      c.fillRect(x, y - 74, 8, 37);
      c.fillStyle = '#b29868';
      c.fillRect(x + 2, y - 69, 4, 27);
    }
  }
  for (const x of [622, 1374]) {
    c.fillStyle = '#101718';
    c.fillRect(x - 8, FREIGHT.top, 16, 2100);
    c.fillStyle = '#615d51';
    c.fillRect(x - 1, FREIGHT.top, 2, 2100);
    for (let y = -1300; y < 740; y += 60) {
      c.fillStyle = '#3d413e';
      c.fillRect(x - 5, y, 10, 4);
    }
  }
  c.restore();
}

export function drawFreightLift(c: CanvasRenderingContext2D, g: Game) {
  const f = g.freight;
  if (!f.active) return;
  const left = FREIGHT.x - FREIGHT.w / 2,
    y = f.top;
  c.save();
  // Cables and guide shoes move with the platform, but never imply solid cover.
  c.strokeStyle = '#68665a';
  c.lineWidth = 2;
  for (const x of [left + 12, left + FREIGHT.w - 12]) {
    c.beginPath();
    c.moveTo(x, FREIGHT.top);
    c.lineTo(x, y + 13);
    c.stroke();
  }
  c.fillStyle = '#283333';
  c.fillRect(left, y, FREIGHT.w, FREIGHT.h);
  c.fillStyle = '#c0b18a';
  c.fillRect(left, y, FREIGHT.w, 3);
  c.fillStyle = '#162124';
  c.fillRect(left + 7, y + 8, FREIGHT.w - 14, 11);
  for (let x = left + 25; x < left + FREIGHT.w; x += 45) {
    c.strokeStyle = '#57635d';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y + 22);
    c.lineTo(x + 13, y + 6);
    c.stroke();
  }
  for (const x of [left - 22, left + FREIGHT.w + 4]) {
    c.fillStyle = '#4d5750';
    c.fillRect(x, y - 9, 18, 43);
    c.fillStyle = f.arrived
      ? '#b3d6b7'
      : f.state === 'waiting' || f.state === 'warning'
        ? '#e3b36e'
        : '#859d8b';
    c.fillRect(x + 5, y - 5, 8, 4);
  }
  if (f.state === 'boarding' || f.state === 'waiting') {
    c.strokeStyle = '#c9b88b';
    c.lineWidth = 2;
    for (const x of [left + 45, left + FREIGHT.w - 45]) {
      c.beginPath();
      c.moveTo(x - 7, y - 10);
      c.lineTo(x, y - 17);
      c.lineTo(x + 7, y - 10);
      c.stroke();
    }
  }
  c.restore();
}
