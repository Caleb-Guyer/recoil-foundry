import type { Game } from './game.ts';
import { STORM } from './stormfront.ts';

export function drawStormRain(c: CanvasRenderingContext2D, g: Game, reduced = false) {
  if (!g.level.overtimeRooftops || reduced) return;
  c.save();
  c.strokeStyle = '#afc3c6';
  c.globalAlpha =
    0.09 * (g.stage === 19 && g.clear ? Math.max(0, 1 - (g.time - g.clearAt) / 3) : 1);
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i < 68; i++) {
    const x = (i * 317 + g.time * 65) % g.worldWidth;
    const y = (i * 173 + g.time * 410) % 740;
    c.moveTo(x, y);
    c.lineTo(x - 5, y - 20);
  }
  c.stroke();
  c.restore();
}
export function drawStormfront(c: CanvasRenderingContext2D, g: Game, reduced = false) {
  const storm = g.stormfront;
  for (const [n, lane] of storm.items.entries()) {
    const warning = n === storm.index && storm.phase === 'warn' && !g.clear;
    const strike = n === storm.index && storm.phase === 'strike' && !g.clear;
    c.save();
    // Flush earthing strip, insulated end caps and a recognizable bolt symbol.
    c.fillStyle = '#273c43';
    c.fillRect(lane.x - lane.width / 2, 740, lane.width, 8);
    c.strokeStyle = warning ? '#f1c88c' : strike ? '#b5e0ed' : '#678088';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(lane.x - lane.width / 2, 742);
    c.lineTo(lane.x + lane.width / 2, 742);
    c.stroke();
    for (const side of [-1, 1]) {
      c.fillStyle = warning ? '#efc48a' : '#6d8589';
      c.fillRect(lane.x + side * (lane.width / 2 - 6) - 3, 734, 6, 12);
    }
    c.beginPath();
    c.moveTo(lane.x + 3, 751);
    c.lineTo(lane.x - 4, 758);
    c.lineTo(lane.x + 3, 758);
    c.lineTo(lane.x - 3, 765);
    c.stroke();
    if (warning || strike) {
      for (let i = 0; i < STORM.columns; i++) {
        const { x, half } = storm.column(lane, i),
          bottom = lane.depths[i];
        if (bottom <= STORM.top) continue;
        c.fillStyle = warning ? '#e5ba7c' : '#b5e0ed';
        c.globalAlpha = warning ? 0.055 : reduced ? 0.1 : 0.17;
        c.fillRect(x - half, STORM.top, half * 2, bottom - STORM.top);
        c.globalAlpha = 0.8;
        c.strokeStyle = warning ? '#e4bc81' : '#c2e9ee';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x - half, bottom - 2);
        c.lineTo(x + half, bottom - 2);
        c.stroke();
        if (i % 3 !== 1) continue;
        c.globalAlpha = warning ? 0.55 : 0.9;
        c.lineWidth = strike && !reduced ? 2.5 : 1;
        c.setLineDash(warning ? [4, 14] : []);
        c.beginPath();
        c.moveTo(x, STORM.top);
        for (let y = STORM.top + 24; y < bottom; y += 24)
          c.lineTo(x + (strike && !reduced ? Math.sin(y * 0.47 + n) * half * 0.65 : 0), y);
        c.lineTo(x, bottom);
        c.stroke();
        c.setLineDash([]);
        if (warning) {
          const charge = 1 - storm.timer / STORM.warn;
          c.globalAlpha = 0.9;
          c.fillStyle = '#f1cf9b';
          c.fillRect(x - 10, bottom - 8, 20 * charge, 3);
        }
      }
    }
    c.restore();
  }
}
