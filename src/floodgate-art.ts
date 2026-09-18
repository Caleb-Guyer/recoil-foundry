import type { Game } from './game.ts';
import { FLOOD } from './floodgate.ts';

export function drawFloodgate(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const f = g.floodgate;
  if (!f.active) return;
  c.save();
  // Plumbing, wheels and lamps live in the room, never on the HUD.
  for (const v of f.valves) {
    c.strokeStyle = '#243d40';
    c.lineWidth = 14;
    c.beginPath();
    c.moveTo(v.x, v.y + 22);
    c.lineTo(v.x, 724);
    c.stroke();
    c.strokeStyle = '#51736d';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(v.x - 6, v.y + 22);
    c.lineTo(v.x - 6, 724);
    c.stroke();
    for (let y = 475; y < 740; y += 90) {
      c.fillStyle = '#58716a';
      c.fillRect(v.x - 10, y, 20, 4);
    }
    c.fillStyle = '#172a2e';
    c.fillRect(v.x - 22, v.y - 22, 44, 44);
    c.strokeStyle = v.used ? '#647570' : '#e3c18a';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(v.x, v.y, 16, v.used ? 0.5 : 0, v.used ? 5.5 : Math.PI * 2);
    c.stroke();
    c.save();
    c.translate(v.x, v.y);
    c.rotate(v.used ? 0.65 : 0);
    for (let i = 0; i < (v.used ? 2 : 3); i++) {
      c.rotate((Math.PI * 2) / 3);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(15, 0);
      c.stroke();
    }
    c.restore();
    c.fillStyle = v.used ? '#485c58' : '#f5d89d';
    c.fillRect(v.x - 3, v.y - 3, 6, 6);
    const warning = f.phase === 'warning' || f.phase === 'rising';
    c.fillStyle =
      f.phase === 'draining' || f.relief > 0 ? '#9bc9bd' : warning ? '#e8ac72' : '#496361';
    c.globalAlpha = !reduced && warning ? 0.7 + Math.sin(g.time * 3) * 0.15 : 1;
    c.fillRect(v.x - 8, v.y - 33, 16, 5);
    c.globalAlpha = 1;
    if (v.flash > 0) {
      c.strokeStyle = '#d7eee2';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(v.x, v.y, 20 + (0.3 - v.flash) * 55, 0, Math.PI * 2);
      c.stroke();
    }
  }
  for (const x of [64, 1936]) {
    c.fillStyle = '#233c40';
    c.fillRect(x - 24, 640, 48, 100);
    c.strokeStyle = '#547771';
    c.lineWidth = 3;
    c.strokeRect(x - 24, 640, 48, 100);
    for (let y = 650; y < 732; y += 12) {
      c.fillStyle = '#14282d';
      c.fillRect(x - 18, y, 36, 5);
    }
    if (f.phase === 'rising' && f.relief <= 0) {
      c.strokeStyle = '#8cb4a8';
      c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const y = Math.max(f.surface, 660) + i * 7;
        if (y < 739) {
          c.beginPath();
          c.moveTo(x - 27, y);
          c.lineTo(x + 27, y + (reduced ? 0 : Math.sin(g.time * 4 + i) * 3));
          c.stroke();
        }
      }
    }
  }
  c.restore();
}

// Translucent foreground submerges low cover without hiding actors or shots.
export function drawFloodwater(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const f = g.floodgate;
  if (!f.active || f.surface >= FLOOD.floor) return;
  c.save();
  const gradient = c.createLinearGradient(0, f.surface, 0, FLOOD.floor);
  gradient.addColorStop(0, '#709a8f55');
  gradient.addColorStop(1, '#173c4580');
  c.fillStyle = gradient;
  c.fillRect(0, f.surface, 2000, FLOOD.floor - f.surface);
  c.strokeStyle = '#a2c8b9';
  c.lineWidth = 2;
  c.beginPath();
  for (let x = 0; x <= 2000; x += 10) {
    const y = f.surface + (reduced ? 0 : Math.sin(x * 0.025 + g.time * 1.7) * 1.4);
    if (!x) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.stroke();
  c.globalAlpha = 0.28;
  c.strokeStyle = '#aacac0';
  c.lineWidth = 1;
  for (let x = 30; x < 2000; x += 137) {
    const y = f.surface + 13 + (x % 71);
    if (y < 735) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 24, y);
      c.stroke();
    }
  }
  c.restore();
}
