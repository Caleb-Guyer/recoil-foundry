import type { Game } from './game.ts';
import { CINDER_LIFE, WIND_LIFE } from './boss-salvage.ts';
import { clamp, direction } from './rules.ts';

export function drawBossSalvage(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  c.save();
  for (const f of g.salvage.cinders) {
    const fade = clamp((f.until - g.time) / CINDER_LIFE, 0, 1);
    c.globalAlpha = fade * (reduced ? 0.45 : 0.75);
    c.strokeStyle = '#e9a06f';
    c.lineWidth = 2;
    const n = f.outward,
      t = { x: -n.y, y: n.x };
    c.beginPath();
    for (let i = -2; i <= 2; i++) {
      const x = f.pos.x + t.x * i * 7,
        y = f.pos.y + t.y * i * 7;
      c.moveTo(x, y);
      const height = i % 2 ? 5 : 9;
      c.quadraticCurveTo(
        x + n.x * 3 - t.x * 3,
        y + n.y * 3 - t.y * 3,
        x + n.x * height + t.x * 2,
        y + n.y * height + t.y * 2,
      );
    }
    c.stroke();
  }
  c.strokeStyle = '#b4cec7';
  c.lineWidth = 1;
  for (const f of g.salvage.gusts) {
    c.globalAlpha = clamp(1 - (g.time - f.at) / WIND_LIFE, 0, 1) * (reduced ? 0.1 : 0.22);
    const d = direction(f.a, f.b);
    c.beginPath();
    c.moveTo(f.a.x - d.y * 7, f.a.y + d.x * 7);
    c.quadraticCurveTo(
      (f.a.x + f.b.x) / 2 - d.y * 11,
      (f.a.y + f.b.y) / 2 + d.x * 11,
      f.b.x - d.y * 7,
      f.b.y + d.x * 7,
    );
    c.stroke();
  }
  if (g.salvage.ramReady) {
    const p = g.player.position,
      d = direction({ x: 0, y: 0 }, g.player.velocity);
    c.globalAlpha = reduced ? 0.35 : 0.65;
    c.lineWidth = 2;
    c.strokeStyle = '#e9c28c';
    c.beginPath();
    for (const side of [-1, 1]) {
      c.moveTo(p.x - d.x * 12 - d.y * side * 10, p.y - d.y * 12 + d.x * side * 10);
      c.lineTo(p.x - d.x * 29 - d.y * side * 10, p.y - d.y * 29 + d.x * side * 10);
    }
    c.stroke();
  }
  c.restore();
}
