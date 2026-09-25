import type { Game } from './game.ts';
import type { RouteChoice } from './rules.ts';
import { DETOUR_DOOR } from './detours.ts';
import { FREIGHT } from './freight-layout.ts';
import type { RegionChoice } from './regions.ts';

function routeDoor(
  c: CanvasRenderingContext2D,
  x: number,
  floor: number,
  route: RouteChoice,
  clear: boolean,
) {
  const color = clear ? (route === 'high' ? '#a4c9e0' : '#9bd9c2') : '#526168';
  c.save();
  c.fillStyle = clear ? '#213038' : '#1b2326';
  c.fillRect(x - 36, floor - 111, 72, 111);
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.strokeRect(x - 36, floor - 111, 72, 111);
  // A low passage and ascending ledges show terrain, never future enemies.
  c.beginPath();
  if (route === 'low') {
    c.moveTo(x - 19, floor - 147);
    c.lineTo(x + 19, floor - 147);
    c.moveTo(x - 19, floor - 128);
    c.lineTo(x + 19, floor - 128);
    c.moveTo(x - 11, floor - 128);
    c.lineTo(x - 11, floor - 135);
    c.lineTo(x - 3, floor - 135);
    c.lineTo(x - 3, floor - 128);
    c.moveTo(x + 7, floor - 128);
    c.lineTo(x + 7, floor - 138);
    c.lineTo(x + 14, floor - 138);
    c.lineTo(x + 14, floor - 128);
  } else {
    for (let i = 0; i < 3; i++) {
      c.moveTo(x - 21 + i * 16, floor - 128 - i * 9);
      c.lineTo(x - 9 + i * 16, floor - 128 - i * 9);
    }
  }
  c.stroke();
  c.beginPath();
  if (clear) {
    c.moveTo(x - 8, floor - 65);
    c.lineTo(x + 8, floor - 54);
    c.lineTo(x - 8, floor - 43);
  } else {
    c.moveTo(x - 8, floor - 63);
    c.lineTo(x + 8, floor - 47);
    c.moveTo(x + 8, floor - 63);
    c.lineTo(x - 8, floor - 47);
  }
  c.stroke();
  c.restore();
}

export function drawRouteExits(c: CanvasRenderingContext2D, g: Game) {
  const choices = g.routeChoices;
  if (!choices.length) return;
  routeDoor(c, DETOUR_DOOR.x, g.level.freight ? FREIGHT.dock : 740, choices[0], g.clear);
  if (choices.length === 2) routeDoor(c, g.branchDoor.x, g.branchDoor.floor, 'high', g.clear);
}

function regionDoor(
  c: CanvasRenderingContext2D,
  x: number,
  floor: number,
  region: RegionChoice,
  clear: boolean,
) {
  const annex = region === 'annex';
  const color = clear ? (annex ? '#e8bb76' : '#9bd9c2') : '#737578';
  c.save();
  c.fillStyle = annex ? '#211d2b' : '#1b292b';
  c.fillRect(x - 36, floor - 111, 72, 111);
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.strokeRect(x - 36, floor - 111, 72, 111);
  c.fillStyle = color;
  c.font = 'bold 12px monospace';
  c.textAlign = 'center';
  c.fillText(annex ? 'ANNEX' : 'COOLING', x, floor - 127);
  c.beginPath();
  if (annex) {
    for (const r of [11, 19]) c.arc(x, floor - 63, r, -Math.PI * 0.8, -Math.PI * 0.2);
    c.moveTo(x, floor - 58);
    c.lineTo(x, floor - 47);
  } else {
    for (const dx of [-12, 0, 12]) {
      c.moveTo(x + dx, floor - 78);
      c.lineTo(x + dx, floor - 52);
    }
  }
  c.stroke();
  c.beginPath();
  if (clear) {
    c.moveTo(x - 7, floor - 31);
    c.lineTo(x + 7, floor - 23);
    c.lineTo(x - 7, floor - 15);
  } else {
    c.moveTo(x - 6, floor - 31);
    c.lineTo(x + 6, floor - 19);
    c.moveTo(x + 6, floor - 31);
    c.lineTo(x - 6, floor - 19);
  }
  c.stroke();
  c.restore();
}
export function drawRegionExits(c: CanvasRenderingContext2D, g: Game) {
  const choices = g.regionChoices;
  if (!choices.length) return;
  regionDoor(c, DETOUR_DOOR.x, 740, choices[0], g.clear);
  if (choices.length === 2) regionDoor(c, g.branchDoor.x, g.branchDoor.floor, 'annex', g.clear);
}
