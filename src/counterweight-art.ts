import type { Game } from './game.ts';
import { COUNTERWEIGHT as CW } from './counterweight-layouts.ts';
import { AREAS } from './areas.ts';
export function drawCounterweightMounts(c: CanvasRenderingContext2D, g: Game) {
  const palette = AREAS[g.level.area];
  c.save();
  // Recessed gantry columns belong to the backdrop. The light-edged deck and
  // central bearing sit in the playable plane; the floor below stays open.
  for (const { placement: p } of g.counterweights.items) {
    c.globalAlpha = 0.48;
    c.fillStyle = palette.edge;
    c.fillRect(p.x - 9, p.y - 26, 18, 740 - p.y + 26);
    c.fillRect(p.x - 32, 730, 64, 10);
    c.globalAlpha = 1;
    c.fillStyle = palette.body;
    c.strokeStyle = palette.edge;
    c.lineWidth = 2;
    c.fillRect(p.x - 24, p.y - 24, 48, 48);
    c.strokeRect(p.x - 24, p.y - 24, 48, 48);
    c.fillStyle = palette.surface;
    c.globalAlpha = 0.6;
    for (const x of [-17, 17])
      for (const y of [-17, 17]) c.fillRect(p.x + x - 1.5, p.y + y - 1.5, 3, 3);
  }
  c.restore();
}
export function drawCounterweights(c: CanvasRenderingContext2D, g: Game) {
  const palette = AREAS[g.level.area];
  for (const p of g.counterweights.items) {
    const b = p.body,
      w = p.placement.w;
    c.save();
    c.translate(p.placement.x, p.placement.y);
    c.lineWidth = 2;
    c.translate(b.position.x - p.placement.x, b.position.y - p.placement.y);
    c.rotate(b.angle);
    c.fillStyle = palette.body;
    c.fillRect(-w / 2, -CW.h / 2, w, CW.h);
    c.fillStyle = palette.face;
    c.fillRect(-w / 2, -CW.h / 2 + 4, w, CW.h - 4);
    c.strokeStyle = palette.surface;
    c.beginPath();
    c.moveTo(-w / 2, -CW.h / 2);
    c.lineTo(w / 2, -CW.h / 2);
    c.stroke();
    c.strokeStyle = palette.edge;
    for (let x = -w / 2 + 18; x < w / 2 - 12; x += 38) {
      c.beginPath();
      c.moveTo(x, -4);
      c.lineTo(x + 15, 7);
      c.stroke();
    }
    c.fillStyle = '#b5a17c';
    c.fillRect(-w / 2, -CW.h / 2, 12, 3);
    c.fillRect(w / 2 - 12, -CW.h / 2, 12, 3);
    c.fillStyle = '#222a2e';
    c.strokeStyle = '#86918e';
    c.beginPath();
    c.arc(0, 0, 9, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#c6b48c';
    c.fillRect(-3, -3, 6, 6);
    c.restore();
  }
}
