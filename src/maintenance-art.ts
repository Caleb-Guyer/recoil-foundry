import type { Game } from './game.ts';
import type { Vec } from './rules.ts';
import { SHAFT_TOP } from './maintenance.ts';

export function drawMaintenanceScenery(
  c: CanvasRenderingContext2D,
  camera: Vec,
  width: number,
  height: number,
) {
  c.fillStyle = '#121a1c';
  c.fillRect(0, 0, width, height);
  c.save();
  c.translate(-camera.x, -camera.y);
  c.fillStyle = '#1a2325';
  c.fillRect(670, SHAFT_TOP, 660, 1600);
  for (const x of [706, 992, 1286]) {
    c.fillStyle = '#273235';
    c.fillRect(x, SHAFT_TOP, 8, 1600);
    c.fillStyle = '#0f1719';
    c.fillRect(x + 8, SHAFT_TOP, 5, 1600);
  }
  for (let y = SHAFT_TOP + 40; y < 740; y += 160) {
    c.fillStyle = '#273235';
    c.fillRect(670, y, 660, 6);
    c.fillStyle = '#414e4b';
    for (const x of [682, 1312]) {
      c.fillRect(x, y - 8, 5, 22);
      c.fillStyle = '#a4b197';
      c.fillRect(x - 3, y - 6, 11, 3);
      c.fillStyle = '#414e4b';
    }
  }
  c.restore();
}

export function drawMaintenanceDetails(c: CanvasRenderingContext2D, g: Game) {
  if (!g.maintenance.active) return;
  c.save();
  for (const h of g.hazards.items) {
    if (h.kind !== 'crusher') continue;
    const { x, y } = h.placement,
      wall = x < 1000 ? 650 : 1350;
    c.strokeStyle = '#3b4645';
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(wall, y - 33);
    c.lineTo(x, y - 33);
    c.stroke();
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(wall, y + 14);
    c.lineTo(x, y - 33);
    c.stroke();
  }
  for (const s of g.level.solids.slice(2)) {
    c.fillStyle = '#47524e';
    c.fillRect(s.x, s.y, s.w, 3);
    // Painted edge ticks and mounting brackets read as landings, not cover.
    for (let x = s.x + 10; x < s.x + s.w - 8; x += 25) {
      c.fillStyle = '#8e9173';
      c.fillRect(x, s.y + 5, 11, 3);
    }
    c.fillStyle = '#364043';
    c.fillRect(s.x + 20, s.y + s.h, 12, 24);
    c.fillRect(s.x + s.w - 32, s.y + s.h, 12, 24);
  }
  if (g.level.maintenance === 'lift') {
    for (const h of g.hazards.items) {
      c.strokeStyle = '#495451';
      c.lineWidth = 2;
      for (const x of [h.placement.x - 58, h.placement.x + 58]) {
        c.beginPath();
        c.moveTo(x, h.placement.y - h.placement.travel - 80);
        c.lineTo(x, h.body.position.y - 10);
        c.stroke();
      }
    }
  }
  const { x, floor } = g.maintenance.exit;
  c.strokeStyle = '#a8c8a9';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x, floor - 91);
  c.lineTo(x + 8, floor - 83);
  c.lineTo(x, floor - 75);
  c.lineTo(x - 8, floor - 83);
  c.closePath();
  c.stroke();
  c.restore();
}

export function drawMaintenanceHatch(c: CanvasRenderingContext2D, g: Game) {
  const { x, floor } = g.branchDoor;
  c.save();
  c.fillStyle = '#142024';
  c.fillRect(x - 38, floor - 112, 76, 112);
  c.strokeStyle = g.clear ? '#adc9b4' : '#536662';
  c.lineWidth = 3;
  c.strokeRect(x - 36, floor - 110, 72, 110);
  c.fillStyle = '#303f40';
  c.fillRect(x - 23, floor - 100, 46, 14);
  // Ladder silhouette and one diamond convey ascent and a reward.
  c.strokeStyle = g.clear ? '#adc9b4' : '#536662';
  c.lineWidth = 2;
  for (const dx of [-9, 9]) {
    c.beginPath();
    c.moveTo(x + dx, floor - 77);
    c.lineTo(x + dx, floor - 33);
    c.stroke();
  }
  for (let y = floor - 70; y < floor - 32; y += 10) {
    c.beginPath();
    c.moveTo(x - 9, y);
    c.lineTo(x + 9, y);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(x, floor - 25);
  c.lineTo(x + 6, floor - 19);
  c.lineTo(x, floor - 13);
  c.lineTo(x - 6, floor - 19);
  c.closePath();
  c.stroke();
  c.restore();
}
