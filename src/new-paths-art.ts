import type { Game, Shot } from './game.ts';
import { clamp } from './rules.ts';
import { COLD } from './cryogenic.ts';

export function drawNewPaths(c: CanvasRenderingContext2D, g: Game) {
  c.save();
  for (const e of g.enemies) {
    const cold = g.cryogenic.states.get(e.id);
    if (!cold || e.spawn > 0) continue;
    const frozen = cold.frozen > g.time;
    const intensity = frozen || cold.ready ? 1 : clamp(cold.cold / COLD.threshold, 0, 1);
    if (!intensity) continue;
    const { min, max } = e.body.bounds;
    c.strokeStyle = '#9bdbe5';
    c.lineWidth = frozen ? 2 : 1;
    c.globalAlpha = 0.3 + intensity * 0.55;
    c.beginPath();
    const corners = [
      [min.x, min.y, 1, 1],
      [max.x, min.y, -1, 1],
      [min.x, max.y, 1, -1],
      [max.x, max.y, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      c.moveTo(x + sx * 8, y);
      c.lineTo(x, y);
      c.lineTo(x, y + sy * 8);
    }
    c.stroke();
    if (frozen) {
      c.fillStyle = '#9bdbe5';
      c.globalAlpha = 0.12;
      c.fillRect(min.x, min.y, max.x - min.x, max.y - min.y);
    }
  }
  c.globalAlpha = 1;
  const p = g.player.position;
  if (g.mobility.grip) {
    c.strokeStyle = '#b8ddc9';
    c.lineWidth = 2;
    const x = p.x - g.mobility.grip.normal.x * 15;
    c.beginPath();
    c.moveTo(x, p.y - 10);
    c.lineTo(x, p.y + 10);
    c.stroke();
  }
  if (g.mobility.flash > 0) {
    c.strokeStyle = '#b8ddc9';
    c.globalAlpha = g.mobility.flash / 0.18;
    c.beginPath();
    c.arc(p.x, p.y, 22 + (0.18 - g.mobility.flash) * 50, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}
export function drawStoredRound(c: CanvasRenderingContext2D, s: Shot, trap: boolean) {
  c.save();
  c.strokeStyle = '#b4a6dd';
  c.fillStyle = '#e1d5f4';
  c.lineWidth = 1;
  c.beginPath();
  c.arc(s.pos.x, s.pos.y, s.radius + 4, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.arc(s.pos.x, s.pos.y, s.radius, 0, Math.PI * 2);
  c.fill();
  if (trap) {
    c.beginPath();
    c.moveTo(s.pos.x - 9, s.pos.y);
    c.lineTo(s.pos.x - 5, s.pos.y);
    c.moveTo(s.pos.x + 5, s.pos.y);
    c.lineTo(s.pos.x + 9, s.pos.y);
    c.stroke();
  }
  c.restore();
}
