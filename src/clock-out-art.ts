import type { Game } from './game.ts';
import { drawOutfit } from './cosmetics.ts';
import { drawWeapon } from './weapon-art.ts';

const unit = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => {
  const t = unit(n);
  return t * t * (3 - 2 * t);
};
const colours = ['#263d49', '#333f37', '#28434a', '#4b342e', '#354349'];

function floor(c: CanvasRenderingContext2D, area: number) {
  c.fillStyle = colours[area];
  c.fillRect(-280, 0, 560, 440);
  c.fillStyle = '#152326';
  for (let i = 0; i < 5; i++) {
    const x = -260 + i * 130;
    if (area === 0) {
      // Rooftop aerials and the distant skyline.
      c.fillRect(x, 260 - (i % 3) * 45, 90, 180);
      c.fillRect(x + 40, 65 + i * 9, 4, 205);
      c.fillRect(x + 12, 110 + i * 9, 60, 3);
    } else if (area === 1) {
      // Reclamation's rail and scrap bins.
      c.fillRect(x, 275, 110, 65);
      for (let j = 0; j < 4; j++) c.fillRect(x + j * 24, 244 + (j % 2) * 14, 20, 32);
      c.fillRect(x + 30, 52, 4, 150);
    } else if (area === 2) {
      // Cooling pipes and condensation tanks.
      c.beginPath();
      c.roundRect(x, 90, 78, 225, 30);
      c.fill();
      c.fillRect(x + 28, 0, 18, 92);
      c.fillStyle = '#54818a';
      c.fillRect(x + 12, 115, 3, 125);
      c.fillStyle = '#152326';
    } else if (area === 3) {
      // The Furnace, still working after you leave.
      c.fillRect(x, 75, 100, 270);
      c.fillStyle = '#aa6948';
      c.fillRect(x + 14, 178, 72, 74);
      c.fillStyle = '#152326';
      for (let j = 0; j < 3; j++) c.fillRect(x + 28 + j * 20, 170, 5, 100);
    } else {
      // Docks: stacked freight and overhead hoists.
      c.fillRect(x, 235, 115, 98);
      c.fillRect(x + 20, 140, 90, 88);
      c.fillRect(x + 55, 0, 3, 122);
      c.fillStyle = '#56716c';
      for (let j = 0; j < 5; j++) c.fillRect(x + 8 + j * 21, 246, 2, 70);
      c.fillStyle = '#152326';
    }
  }
  c.fillStyle = '#718178';
  c.fillRect(-280, 358, 560, 3);
  c.fillStyle = '#111c20';
  c.fillRect(-280, 363, 560, 77);
  c.fillStyle = '#8d9b91';
  c.font = '11px monospace';
  c.textAlign = 'left';
  c.fillText(String(5 - area).padStart(2, '0'), -248, 387);
}

function daylight(c: CanvasRenderingContext2D) {
  const sky = c.createLinearGradient(0, 0, 0, 440);
  sky.addColorStop(0, '#637b82');
  sky.addColorStop(0.72, '#c5c6ad');
  sky.addColorStop(1, '#e2d1a9');
  c.fillStyle = sky;
  c.fillRect(-280, 0, 560, 440);
  c.fillStyle = '#eee0b8';
  c.beginPath();
  c.arc(112, 174, 34, 0, Math.PI * 2);
  c.fill();
  for (let layer = 0; layer < 3; layer++) {
    c.fillStyle = ['#8a9c98', '#637e7c', '#3f5c5d'][layer];
    c.beginPath();
    c.moveTo(-280, 440);
    for (let i = 0; i <= 14; i++)
      c.lineTo(-280 + i * 40, 280 + layer * 36 + Math.sin(i * 0.8 + layer) * 22);
    c.lineTo(280, 440);
    c.closePath();
    c.fill();
  }
}

export function drawClockOut(
  c: CanvasRenderingContext2D,
  g: Game,
  width: number,
  height: number,
  reduced: boolean,
) {
  const t = g.clockOut.time;
  c.fillStyle = '#0c1418';
  c.fillRect(0, 0, width, height);
  c.save();
  const scale = Math.min(width / 1000, height / 720);
  c.translate(width / 2, (height - 720 * scale) / 2);
  c.scale(scale, scale);
  c.fillStyle = '#899e9e';
  c.font = '12px monospace';
  c.textAlign = 'center';
  c.fillText('C L O C K   O U T', 0, 72);
  // A fixed cabin frames the journey. Reduced effects uses stationary dissolves.
  c.save();
  c.translate(0, 132);
  c.beginPath();
  c.rect(-280, 0, 560, 440);
  c.clip();
  const travel = unit((t - 1.1) / 7.5) * 4;
  if (t >= 9.5) daylight(c);
  else if (reduced) {
    const n = Math.floor(travel);
    floor(c, n);
    if (n < 4) {
      c.globalAlpha = ease(travel - n);
      floor(c, n + 1);
      c.globalAlpha = 1;
    }
  } else {
    for (let i = 0; i < 5; i++) {
      c.save();
      c.translate(0, (i - travel) * 440);
      floor(c, i);
      c.restore();
    }
  }
  const shade = c.createLinearGradient(0, 0, 0, 440);
  shade.addColorStop(0, '#07121780');
  shade.addColorStop(0.45, '#07121700');
  shade.addColorStop(1, '#07121770');
  c.fillStyle = shade;
  c.fillRect(-280, 0, 560, 440);
  // The lobby doors close at arrival, then open onto daylight, covering the cut.
  const door = t < 9.5 ? ease((t - 8.7) / 0.8) : 1 - ease((t - 9.8) / 1.3);
  c.fillStyle = '#29383c';
  c.fillRect(-280, 0, 280 * door, 440);
  c.fillRect(280 * (1 - door), 0, 280 * door, 440);
  c.fillStyle = '#637679';
  if (door > 0) {
    c.fillRect(-280 + 280 * door - 3, 0, 3, 440);
    c.fillRect(280 * (1 - door), 0, 3, 440);
  }
  c.restore();
  // Structural rails, threshold and the actual player/weapon silhouette.
  c.fillStyle = '#17262b';
  c.fillRect(-316, 108, 32, 490);
  c.fillRect(284, 108, 32, 490);
  c.fillRect(-316, 108, 632, 24);
  c.fillRect(-316, 572, 632, 26);
  c.fillStyle = '#60777a';
  c.fillRect(-288, 130, 3, 443);
  c.fillRect(285, 130, 3, 443);
  c.fillStyle = '#b8cbb6';
  c.fillRect(-48, 116, 96, 3);
  c.fillRect(-285, 570, 570, 2);
  c.fillStyle = '#101b1f';
  c.beginPath();
  c.ellipse(-30, 565, 53, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.translate(-34, 518);
  c.scale(2.4, 2.4);
  drawOutfit(c, g.cosmetics.outfit, 1, 0);
  c.translate(8, 2);
  c.rotate(0.32);
  drawWeapon(c, g, true);
  c.restore();
  c.fillStyle = '#738988';
  c.font = '11px monospace';
  c.fillText('R F  /  PERSONNEL', 0, 633);
  c.restore();
  c.fillStyle = `rgba(7,14,18,${ease((t - 11.45) / 0.55)})`;
  c.fillRect(0, 0, width, height);
}

export function drawClockOutReward(gun: HTMLCanvasElement, outfit: HTMLCanvasElement, g: Game) {
  const c = gun.getContext('2d'),
    o = outfit.getContext('2d');
  if (c) {
    c.translate(83, 79);
    c.scale(3.2, 3.2);
    drawWeapon(c, g, true);
  }
  if (o) {
    o.translate(100, 79);
    o.scale(2.8, 2.8);
    drawOutfit(o, 'night', 1, 0);
  }
}
